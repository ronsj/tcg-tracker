import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiResponseCache, type ApiSource } from "@/db/schema";
import {
  recordReportedRemaining,
  releaseRequest,
  reserveRequest,
  waitForRateLimit,
} from "./quota";
import { buildUrl, cacheKey, type QueryParams } from "./request-utils";

export { buildUrl, cacheKey } from "./request-utils";
export type { QueryParams } from "./request-utils";

const REQUEST_TIMEOUT_MS = 60_000;

const AUTH = {
  justtcg: { header: "x-api-key", env: "JUSTTCG_API_KEY" },
  tcgapi: { header: "X-API-Key", env: "TCGAPI_API_KEY" },
} as const satisfies Record<ApiSource, { header: string; env: string }>;

export class SourceApiError extends Error {
  constructor(
    public readonly source: ApiSource,
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(`${source} API ${status}: ${message}`);
    this.name = "SourceApiError";
  }
}

export interface SourceFetchOptions {
  source: ApiSource;
  method?: "GET" | "POST";
  path: string;
  query?: QueryParams;
  body?: unknown;
  /** Serve from / store in `api_response_cache`. Cache hits use no quota. */
  cacheTtlSeconds?: number;
}

function apiKey(source: ApiSource): string {
  const { env } = AUTH[source];
  const key = process.env[env];
  if (!key) throw new Error(`Missing ${env}: set it in .env.local`);
  return key;
}

/** Pull a message/code out of the various error shapes the APIs use. */
function parseError(body: unknown, fallback: string): { message: string; code?: string } {
  if (body && typeof body === "object") {
    const { error, message } = body as { error?: unknown; message?: unknown };
    if (typeof error === "string") return { message: error };
    if (error && typeof error === "object") {
      const e = error as { message?: unknown; code?: unknown };
      return {
        message: typeof e.message === "string" ? e.message : fallback,
        code: typeof e.code === "string" ? e.code : undefined,
      };
    }
    if (typeof message === "string") return { message };
  }
  return { message: fallback };
}

function parseRemaining(source: ApiSource, headers: Headers, body: unknown): number | null {
  const fromBody = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  if (source === "tcgapi") {
    // Header only: public endpoints (/games, /games/:slug/sets) send no header and a
    // placeholder `rate_limit.daily_remaining: 0` in the body, which would block us.
    const header = headers.get("X-RateLimit-Remaining");
    if (header !== null && header.trim() !== "" && Number.isFinite(Number(header))) {
      return Number(header);
    }
    return null;
  }
  // JustTCG reports both monthly and daily remaining; whichever runs out first blocks us.
  const meta = (
    body as { _metadata?: { apiRequestsRemaining?: unknown; apiDailyRequestsRemaining?: unknown } } | null
  )?._metadata;
  const counts = [fromBody(meta?.apiRequestsRemaining), fromBody(meta?.apiDailyRequestsRemaining)];
  const known = counts.filter((n): n is number => n !== null);
  return known.length > 0 ? Math.min(...known) : null;
}

async function readCache<T>(key: string): Promise<T | undefined> {
  const [hit] = await db
    .select({ body: apiResponseCache.body })
    .from(apiResponseCache)
    .where(and(eq(apiResponseCache.key, key), gt(apiResponseCache.expiresAt, sql`now()`)))
    .limit(1);
  return hit?.body as T | undefined;
}

async function writeCache(
  key: string,
  opts: SourceFetchOptions,
  statusCode: number,
  body: unknown,
  ttlSeconds: number,
) {
  const values = {
    key,
    source: opts.source,
    endpoint: opts.path,
    statusCode,
    body,
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  };
  await db
    .insert(apiResponseCache)
    .values(values)
    .onConflictDoUpdate({ target: apiResponseCache.key, set: values });
}

/**
 * Quota-checked fetch against one of the source APIs. No automatic retries:
 * a retry would burn another request from a tiny budget.
 */
export async function sourceFetch<T>(opts: SourceFetchOptions): Promise<T> {
  const { source, method = "GET", path, query, body, cacheTtlSeconds } = opts;

  const key = cacheTtlSeconds ? cacheKey({ source, method, path, query, body }) : undefined;
  if (key) {
    const cached = await readCache<T>(key);
    if (cached !== undefined) return cached;
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    [AUTH[source].header]: apiKey(source),
  };
  if (method === "POST") headers["content-type"] = "application/json";

  await reserveRequest(source);
  await waitForRateLimit(source);

  let res: Response;
  try {
    res = await fetch(buildUrl(source, path, query), {
      method,
      headers,
      body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Network failure or timeout: JustTCG may not have counted it.
    if (source === "justtcg") await releaseRequest(source);
    throw err;
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body (e.g. a gateway error page); handled below.
  }

  // JustTCG doesn't count 5xx responses against the quota.
  if (source === "justtcg" && res.status >= 500) await releaseRequest(source);

  const remaining = parseRemaining(source, res.headers, json);
  if (remaining !== null) await recordReportedRemaining(source, remaining);

  if (!res.ok) {
    const { message, code } = parseError(json, res.statusText || `HTTP ${res.status}`);
    const retryAfter = Number(res.headers.get("Retry-After"));
    throw new SourceApiError(
      source,
      res.status,
      message,
      code,
      Number.isFinite(retryAfter) && res.headers.has("Retry-After") ? retryAfter : undefined,
    );
  }
  if (json === null) {
    throw new SourceApiError(source, res.status, "Response was not valid JSON");
  }

  if (key && cacheTtlSeconds) await writeCache(key, opts, res.status, json, cacheTtlSeconds);
  return json as T;
}
