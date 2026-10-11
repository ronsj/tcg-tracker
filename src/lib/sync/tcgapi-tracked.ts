import { asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { card, cardVariant, collectionItem } from "@/db/schema";
import { importTcgApiCatalog, type CatalogImportSummary } from "./tcgapi-catalog";
import { nextShare } from "./tracked-utils";

const MAX_AGE_MS = 20 * 60 * 60 * 1000;

export type TrackedTcgApiGameResult =
  | { gameId: string; summary: CatalogImportSummary }
  | { gameId: string; error: string };

/** Sets holding tracked cards with stale TCG API prices, stalest first, grouped by game. */
export async function selectStaleTrackedSets(maxAgeMs: number = MAX_AGE_MS): Promise<Map<string, string[]>> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const oldest = sql`min(${card.tcgapiPricesFetchedAt})`;
  const rows = await db
    .select({ gameId: card.gameId, setId: card.setId })
    .from(collectionItem)
    .innerJoin(cardVariant, eq(cardVariant.id, collectionItem.variantId))
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .where(or(isNull(card.tcgapiPricesFetchedAt), lt(card.tcgapiPricesFetchedAt, cutoff)))
    .groupBy(card.gameId, card.setId)
    // A set with any never-fetched card sorts first (min() ignores nulls, so check explicitly).
    .orderBy(
      sql`bool_or(${card.tcgapiPricesFetchedAt} is null) desc`,
      sql`${oldest} asc nulls first`,
      asc(card.setId),
    );

  const byGame = new Map<string, string[]>();
  for (const r of rows) byGame.set(r.gameId, [...(byGame.get(r.gameId) ?? []), r.setId]);
  return byGame;
}

/** Refresh TCG API prices for the sets that hold tracked cards, splitting the budget across games. */
export async function refreshTrackedTcgApi({
  maxRequests,
}: {
  maxRequests: number;
}): Promise<TrackedTcgApiGameResult[]> {
  const byGame = await selectStaleTrackedSets();
  const results: TrackedTcgApiGameResult[] = [];

  let remaining = maxRequests;
  let gamesLeft = byGame.size;
  for (const [gameId, setIds] of byGame) {
    const budget = nextShare(remaining, gamesLeft--);
    if (budget < 1) break;
    try {
      const summary = await importTcgApiCatalog({ gameId, setIds, maxRequests: budget });
      remaining -= summary.requestsUsed;
      results.push({ gameId, summary });
    } catch (err) {
      // One game failing (e.g. no TCG API slug) shouldn't starve the others.
      results.push({ gameId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
