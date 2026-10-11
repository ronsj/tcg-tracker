import { and, desc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { syncRun, type ApiSource } from "@/db/schema";

// Bookkeeping over `sync_run`: one row per job execution, with a cursor to resume from.

export type SyncRun = typeof syncRun.$inferSelect;
export type RunCursor = Record<string, unknown>;

/** A "running" row older than this is assumed to belong to a crashed process. */
const ACTIVE_WINDOW_MS = 60 * 60 * 1000;

export async function startRun(source: ApiSource, job: string, cursor?: RunCursor | null) {
  const [row] = await db
    .insert(syncRun)
    .values({ source, job, cursor: cursor ?? null })
    .returning({ id: syncRun.id });
  return row.id;
}

export async function updateRun(
  id: string,
  patch: { cursor?: RunCursor | null; requestsUsed?: number; rowsUpserted?: number },
) {
  // Skip an empty patch: Drizzle throws on an empty SET.
  if (Object.values(patch).every((v) => v === undefined)) return;
  await db.update(syncRun).set(patch).where(eq(syncRun.id, id));
}

export async function finishRun(
  id: string,
  result: {
    status: "succeeded" | "failed" | "partial";
    cursor?: RunCursor | null;
    error?: string;
  },
) {
  await db
    .update(syncRun)
    .set({
      status: result.status,
      cursor: result.cursor,
      error: result.error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(syncRun.id, id));
}

/**
 * Latest partial/failed run with a cursor, unless a later run succeeded
 * (a success means the job is complete and the next one starts fresh).
 */
export async function findResumable(source: ApiSource, job: string): Promise<SyncRun | null> {
  const [latest] = await db
    .select()
    .from(syncRun)
    .where(
      and(
        eq(syncRun.source, source),
        eq(syncRun.job, job),
        inArray(syncRun.status, ["partial", "failed"]),
        isNotNull(syncRun.cursor),
      ),
    )
    .orderBy(desc(syncRun.startedAt))
    .limit(1);
  if (!latest) return null;

  const [succeeded] = await db
    .select({ id: syncRun.id })
    .from(syncRun)
    .where(
      and(
        eq(syncRun.source, source),
        eq(syncRun.job, job),
        eq(syncRun.status, "succeeded"),
        gt(syncRun.startedAt, latest.startedAt),
      ),
    )
    .limit(1);
  return succeeded ? null : latest;
}

/** A run still marked "running" that started within the last hour. */
export async function findActive(source: ApiSource, job: string): Promise<SyncRun | null> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const [row] = await db
    .select()
    .from(syncRun)
    .where(
      and(
        eq(syncRun.source, source),
        eq(syncRun.job, job),
        eq(syncRun.status, "running"),
        gt(syncRun.startedAt, since),
      ),
    )
    .orderBy(desc(syncRun.startedAt))
    .limit(1);
  return row ?? null;
}
