import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type { ApiSource } from "@/db/schema";

type Quota = { daily: number; monthly?: number; perMinute?: number };

// Free-tier limits. Daily resets at 00:00 UTC for both APIs.
export const QUOTAS = {
  justtcg: { daily: 100, monthly: 1000, perMinute: 10 },
  tcgapi: { daily: 100 },
} as const satisfies Record<ApiSource, Quota>;

export class QuotaExceededError extends Error {
  constructor(
    public readonly source: ApiSource,
    public readonly reason: "daily" | "monthly" | "reported",
  ) {
    super(`${source} ${reason} quota exhausted`);
    this.name = "QuotaExceededError";
  }
}

const utcToday = sql`(now() at time zone 'utc')::date`;

/**
 * Builds the single-statement reservation: bump today's counter only while we
 * are under every limit. Exported so it can be EXPLAINed without executing.
 *
 * Monthly usage is approximated by calendar month. JustTCG's free tier actually
 * resets on the account-creation anniversary, so the `reported_remaining` guard
 * (the API's own count) covers the gap between the two.
 */
export function buildReserveQuery(source: ApiSource): SQL {
  const limits: Quota = QUOTAS[source];
  const monthlyOk = limits.monthly ? sql`(select used from month) < ${limits.monthly}` : sql`true`;

  return sql`
    with month as (
      select coalesce(sum(requests), 0) as used
      from api_usage_daily
      where source = ${source}::api_source
        and day >= date_trunc('month', ${utcToday})::date
    )
    insert into api_usage_daily (source, day, requests)
    select ${source}::api_source, ${utcToday}, 1
    where ${monthlyOk}
    on conflict (source, day) do update
      set requests = api_usage_daily.requests + 1
      where api_usage_daily.requests < ${limits.daily}
        and ${monthlyOk}
        and (api_usage_daily.reported_remaining is null or api_usage_daily.reported_remaining > 0)
    returning requests
  `;
}

/** Atomically count one outbound request, or throw if any limit is reached. */
export async function reserveRequest(source: ApiSource): Promise<void> {
  const { rows } = await db.execute(buildReserveQuery(source));
  if (rows.length > 0) return;

  // Nothing was written, so find out which limit blocked us.
  const limits: Quota = QUOTAS[source];
  const { rows: usage } = await db.execute<{
    today: number | null;
    month: number;
    reported: number | null;
  }>(sql`
    select
      (select requests from api_usage_daily
        where source = ${source}::api_source and day = ${utcToday}) as today,
      (select coalesce(sum(requests), 0)::int from api_usage_daily
        where source = ${source}::api_source
          and day >= date_trunc('month', ${utcToday})::date) as month,
      (select reported_remaining from api_usage_daily
        where source = ${source}::api_source and day = ${utcToday}) as reported
  `);
  const row = usage[0];
  if (limits.monthly && Number(row?.month ?? 0) >= limits.monthly) {
    throw new QuotaExceededError(source, "monthly");
  }
  if (Number(row?.today ?? 0) >= limits.daily) throw new QuotaExceededError(source, "daily");
  throw new QuotaExceededError(source, "reported");
}

/** Give back a reservation, e.g. after a JustTCG 5xx (which doesn't count against their quota). */
export async function releaseRequest(source: ApiSource): Promise<void> {
  await db.execute(sql`
    update api_usage_daily
    set requests = greatest(requests - 1, 0)
    where source = ${source}::api_source and day = ${utcToday}
  `);
}

/** Store the remaining-quota figure the API reported on its latest response. */
export async function recordReportedRemaining(source: ApiSource, remaining: number): Promise<void> {
  await db.execute(sql`
    update api_usage_daily
    set reported_remaining = ${Math.max(0, Math.trunc(remaining))}
    where source = ${source}::api_source and day = ${utcToday}
  `);
}

// Timestamps of recent requests per source. In-memory, so it only limits the current
// process: separate serverless instances don't share it.
const recentRequests: Partial<Record<ApiSource, number[]>> = {};

/** Sleep until another request fits in the per-minute window (JustTCG only). */
export async function waitForRateLimit(source: ApiSource): Promise<void> {
  const limit: number | undefined = (QUOTAS[source] as Quota).perMinute;
  if (!limit) return;

  const windowMs = 60_000;
  const stamps = (recentRequests[source] ??= []);
  for (;;) {
    const now = Date.now();
    while (stamps.length > 0 && now - stamps[0] >= windowMs) stamps.shift();
    if (stamps.length < limit) {
      stamps.push(now);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, stamps[0] + windowMs - now + 10));
  }
}
