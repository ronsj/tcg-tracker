import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { card, cardVariant, collectionItem } from "@/db/schema";
import { batchCards, JUSTTCG_BATCH_LIMIT } from "@/lib/sources/justtcg";
import { SourceApiError } from "@/lib/sources/http";
import { QuotaExceededError } from "@/lib/sources/quota";
import { persistJustTcgCard } from "./justtcg-prices";
import { finishRun, startRun, updateRun } from "./run";
import { chunk, matchBatchResponse, type TrackedCard } from "./tracked-utils";

const SOURCE = "justtcg";
const JOB = "prices:tracked";
const DEFAULT_MAX_AGE_MS = 20 * 60 * 60 * 1000;

export interface TrackedJustTcgSummary {
  runId: string;
  status: "succeeded" | "partial" | "failed";
  requestsUsed: number;
  cardsRefreshed: number;
  cardsMissing: number;
}

/** Tracked cards (in any collection) with stale JustTCG prices, stalest first. */
export async function selectStaleTrackedCards(maxAgeMs: number, limit: number): Promise<TrackedCard[]> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const rows = await db
    .selectDistinct({
      id: card.id,
      tcgplayerProductId: card.tcgplayerProductId,
      fetchedAt: card.justtcgPricesFetchedAt,
    })
    .from(collectionItem)
    .innerJoin(cardVariant, eq(cardVariant.id, collectionItem.variantId))
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .where(
      and(
        // The product ID is the only key we can look cards up by.
        isNotNull(card.tcgplayerProductId),
        or(isNull(card.justtcgPricesFetchedAt), lt(card.justtcgPricesFetchedAt, cutoff)),
      ),
    )
    .orderBy(sql`${card.justtcgPricesFetchedAt} asc nulls first`, card.id)
    .limit(limit);
  return rows.flatMap((r) => (r.tcgplayerProductId ? [{ id: r.id, tcgplayerProductId: r.tcgplayerProductId }] : []));
}

/**
 * Refresh JustTCG prices for tracked cards, stalest first, 20 cards per request.
 * Stalest-first ordering makes a partial run resume itself: no cursor needed.
 */
export async function refreshTrackedJustTcg({
  maxRequests,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
}: {
  maxRequests: number;
  maxAgeMs?: number;
}): Promise<TrackedJustTcgSummary> {
  const runId = await startRun(SOURCE, JOB);

  let requestsUsed = 0;
  let cardsRefreshed = 0;
  let cardsMissing = 0;

  const finish = async (status: TrackedJustTcgSummary["status"], error?: string) => {
    await updateRun(runId, { requestsUsed, rowsUpserted: cardsRefreshed });
    await finishRun(runId, { status, error });
    return { runId, status, requestsUsed, cardsRefreshed, cardsMissing };
  };

  try {
    const stale = await selectStaleTrackedCards(maxAgeMs, maxRequests * JUSTTCG_BATCH_LIMIT);
    const batches = chunk(stale, JUSTTCG_BATCH_LIMIT);

    for (const [i, batch] of batches.entries()) {
      if (requestsUsed >= maxRequests) return await finish("partial");
      requestsUsed++;

      let res;
      try {
        res = await batchCards(batch.map((c) => ({ tcgplayerId: c.tcgplayerProductId })));
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          // Blocked before the request was sent, so nothing was spent.
          requestsUsed--;
          return await finish("partial");
        }
        // JustTCG 404s when it knows none of the cards (e.g. an unreleased set):
        // treat the whole batch as missing so they get stamped, not retried daily.
        if (err instanceof SourceApiError && err.status === 404) {
          res = { data: [] };
        } else {
          throw err;
        }
      }

      const now = new Date();
      const { matched, missing } = matchBatchResponse(batch, res.data);
      for (const m of matched) await persistJustTcgCard(m.cardId, m.match, now);
      // Remember the misses so they aren't retried every day.
      if (missing.length > 0) {
        await db.update(card).set({ justtcgPricesFetchedAt: now }).where(inArray(card.id, missing));
      }
      cardsRefreshed += matched.length;
      cardsMissing += missing.length;
      await updateRun(runId, { requestsUsed, rowsUpserted: cardsRefreshed });

      if (i === batches.length - 1) break;
    }

    return await finish("succeeded");
  } catch (err) {
    await finish("failed", err instanceof Error ? err.message : String(err));
    throw err;
  }
}
