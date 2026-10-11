import { createHash } from "node:crypto";
import type { ApiSource } from "@/db/schema";

// Pure helpers for building requests. Kept free of DB imports so they can be unit tested.

export type QueryValue = string | number | boolean | string[] | undefined;
export type QueryParams = Record<string, QueryValue>;

export const BASE_URLS = {
  justtcg: "https://api.justtcg.com/v1",
  tcgapi: "https://api.tcgapi.dev/v1",
} as const satisfies Record<ApiSource, string>;

/** Query entries as strings: undefined skipped, arrays comma-joined, sorted by key. */
function queryEntries(query: QueryParams = {}): [string, string][] {
  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    entries.push([key, Array.isArray(value) ? value.join(",") : String(value)]);
  }
  return entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function buildUrl(source: ApiSource, path: string, query?: QueryParams): string {
  const url = new URL(BASE_URLS[source] + path);
  for (const [key, value] of queryEntries(query)) url.searchParams.append(key, value);
  return url.toString();
}

/** Stable cache key: sha256 hex of source, method, path, sorted query and body. */
export function cacheKey(opts: {
  source: ApiSource;
  method?: "GET" | "POST";
  path: string;
  query?: QueryParams;
  body?: unknown;
}): string {
  const payload = JSON.stringify([
    opts.source,
    opts.method ?? "GET",
    opts.path,
    queryEntries(opts.query),
    opts.body ?? null,
  ]);
  return createHash("sha256").update(payload).digest("hex");
}
