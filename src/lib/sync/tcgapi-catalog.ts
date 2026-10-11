import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { card, cardSet, game, printingPriceCurrent, printingPriceDaily } from "@/db/schema";
import { QuotaExceededError } from "@/lib/sources/quota";
import { getSetCards, listGameSets, type TcgApiEnvelope, type TcgApiSet, type TcgApiSetCardRow } from "@/lib/sources/tcgapi";
import { findActive, findResumable, finishRun, startRun, updateRun } from "./run";
import { mapSetCardRows, mapSetRow } from "./tcgapi-mapping";

const SOURCE = "tcgapi";
const PER_PAGE = 100;

export interface CatalogCursor extends Record<string, unknown> {
  /** TCG API set ids, oldest release first */
  setIds: string[];
  setIndex: number;
  page: number;
}

export interface CatalogImportSummary {
  runId: string;
  status: "succeeded" | "partial" | "failed";
  requestsUsed: number;
  setsUpserted: number;
  cardsUpserted: number;
  pricesUpserted: number;
  cursor: CatalogCursor | null;
}

/** Stops the loop cleanly when the per-run request budget is spent. */
class BudgetExhausted extends Error {}

const byReleaseDate = (a: TcgApiSet, b: TcgApiSet) => {
  if (a.release_date === b.release_date) return a.id - b.id;
  if (!a.release_date) return 1;
  if (!b.release_date) return -1;
  return a.release_date < b.release_date ? -1 : 1;
};

export async function importTcgApiCatalog({
  gameId,
  maxRequests = 40,
  setIds,
}: {
  gameId: string;
  maxRequests?: number;
  /**
   * Our `card_set.id`s. Skips the set listing and imports just these sets, in the order
   * given, as a fresh `prices:sets:<game>` run (never resumed, never blocks the catalog job).
   */
  setIds?: string[];
}): Promise<CatalogImportSummary> {
  const [gameRow] = await db.select().from(game).where(eq(game.id, gameId)).limit(1);
  if (!gameRow) throw new Error(`Unknown game: ${gameId}`);
  if (!gameRow.tcgapiGameSlug) throw new Error(`Game ${gameId} has no tcgapiGameSlug`);
  const slug = gameRow.tcgapiGameSlug;

  const job = setIds ? `prices:sets:${gameId}` : `catalog:${gameId}`;
  const active = await findActive(SOURCE, job);
  if (active) {
    throw new Error(`A ${job} run is already in progress (${active.id}, started ${active.startedAt.toISOString()})`);
  }

  let cursor: CatalogCursor | null = null;
  if (setIds) {
    const rows =
      setIds.length > 0
        ? await db
            .select({ id: cardSet.id, tcgapiSetId: cardSet.tcgapiSetId })
            .from(cardSet)
            .where(inArray(cardSet.id, setIds))
        : [];
    const byId = new Map(rows.map((r) => [r.id, r.tcgapiSetId]));
    // Keep the caller's order (stalest first) and drop sets TCG API doesn't know.
    const tcgapiSetIds = setIds.flatMap((id) => byId.get(id) ?? []);
    cursor = { setIds: tcgapiSetIds, setIndex: 0, page: 1 };
  } else {
    const resumable = await findResumable(SOURCE, job);
    cursor = (resumable?.cursor as CatalogCursor | null | undefined) ?? null;
  }
  const runId = await startRun(SOURCE, job, cursor);

  let requestsUsed = 0;
  let setsUpserted = 0;
  let cardsUpserted = 0;
  let pricesUpserted = 0;

  const persist = () =>
    updateRun(runId, {
      cursor,
      requestsUsed,
      rowsUpserted: setsUpserted + cardsUpserted + pricesUpserted,
    });

  // Every outbound call goes through here so the budget is counted in one place.
  async function call<T>(fn: () => Promise<T>): Promise<T> {
    if (requestsUsed >= maxRequests) throw new BudgetExhausted();
    requestsUsed++;
    try {
      return await fn();
    } catch (err) {
      // Blocked before the request was sent, so nothing was spent.
      if (err instanceof QuotaExceededError) requestsUsed--;
      throw err;
    }
  }

  const finish = async (status: CatalogImportSummary["status"], error?: string) => {
    await persist();
    await finishRun(runId, { status, cursor, error });
    return { runId, status, requestsUsed, setsUpserted, cardsUpserted, pricesUpserted, cursor };
  };

  try {
    if (!cursor) {
      const sets = new Map<number, TcgApiSet>();
      for (let page = 1; ; page++) {
        const res = await call(() => listGameSets(slug, { page, perPage: PER_PAGE }));
        for (const set of res.data) sets.set(set.id, set);
        if (!res.meta?.has_more || res.data.length === 0) break;
      }
      const ordered = [...sets.values()].sort(byReleaseDate);
      if (ordered.length > 0) {
        await db
          .insert(cardSet)
          .values(ordered.map((s) => mapSetRow(s, gameId)))
          .onConflictDoUpdate({
            target: cardSet.tcgapiSetId,
            set: {
              name: sql`excluded.name`,
              code: sql`excluded.code`,
              releaseDate: sql`excluded.release_date`,
              cardCount: sql`excluded.card_count`,
              updatedAt: new Date(),
            },
          });
      }
      setsUpserted = ordered.length;
      cursor = { setIds: ordered.map((s) => String(s.id)), setIndex: 0, page: 1 };
      await persist();
    }

    for (;;) {
      const current: CatalogCursor = cursor;
      const setIds: string[] = current.setIds;
      const setIndex: number = current.setIndex;
      const page: number = current.page;
      if (setIndex >= setIds.length) break;
      const tcgapiSetId: string = setIds[setIndex];
      const [setRow] = await db
        .select({ id: cardSet.id })
        .from(cardSet)
        .where(eq(cardSet.tcgapiSetId, tcgapiSetId))
        .limit(1);
      if (!setRow) throw new Error(`card_set row missing for TCG API set ${tcgapiSetId}`);

      const res: TcgApiEnvelope<TcgApiSetCardRow[]> = await call(() =>
        getSetCards(tcgapiSetId, { type: "Cards", perPage: PER_PAGE, page }),
      );
      const { cards, prices } = mapSetCardRows(res.data, { gameId, setId: setRow.id });

      const now = new Date();
      const day = now.toISOString().slice(0, 10);

      // Drizzle throws on empty values arrays, so skip pages with nothing to write.
      if (cards.length > 0) {
        const saved = await db
          .insert(card)
          .values(cards.map((c) => ({ ...c, tcgapiPricesFetchedAt: now })))
          .onConflictDoUpdate({
            target: card.tcgplayerProductId,
            set: {
              tcgapiCardId: sql`excluded.tcgapi_card_id`,
              name: sql`excluded.name`,
              number: sql`excluded.number`,
              rarity: sql`excluded.rarity`,
              imageUrl: sql`excluded.image_url`,
              setId: sql`excluded.set_id`,
              gameId: sql`excluded.game_id`,
              tcgapiPricesFetchedAt: now,
              updatedAt: now,
            },
          })
          .returning({ id: card.id, tcgapiCardId: card.tcgapiCardId });
        cardsUpserted += saved.length;

        const idByTcgapi = new Map(saved.map((c) => [c.tcgapiCardId, c.id]));
        const priceRows = prices.flatMap(({ tcgapiCardId, ...p }) => {
          const cardId = idByTcgapi.get(tcgapiCardId);
          return cardId ? [{ cardId, ...p }] : [];
        });

        if (priceRows.length > 0) {
          // Only the fields the listing carries; change %s and buylist come from other endpoints.
          await db
            .insert(printingPriceCurrent)
            .values(priceRows.map((p) => ({ ...p, fetchedAt: now })))
            .onConflictDoUpdate({
              target: [printingPriceCurrent.cardId, printingPriceCurrent.printing],
              set: {
                marketCents: sql`excluded.market_cents`,
                lowCents: sql`excluded.low_cents`,
                medianCents: sql`excluded.median_cents`,
                lowestWithShippingCents: sql`excluded.lowest_with_shipping_cents`,
                totalListings: sql`excluded.total_listings`,
                marketAsOf: sql`excluded.market_as_of`,
                fetchedAt: now,
              },
            });
          pricesUpserted += priceRows.length;

          // Today's history point comes free with the listing.
          await db
            .insert(printingPriceDaily)
            .values(
              priceRows.map((p) => ({
                cardId: p.cardId,
                printing: p.printing,
                day,
                marketCents: p.marketCents,
                lowCents: p.lowCents,
              })),
            )
            .onConflictDoUpdate({
              target: [printingPriceDaily.cardId, printingPriceDaily.printing, printingPriceDaily.day],
              set: {
                marketCents: sql`excluded.market_cents`,
                lowCents: sql`excluded.low_cents`,
              },
            });
        }
      }

      cursor =
        res.meta?.has_more && res.data.length > 0
          ? { setIds, setIndex, page: page + 1 }
          : { setIds, setIndex: setIndex + 1, page: 1 };
      await persist();
    }

    cursor = null;
    return await finish("succeeded");
  } catch (err) {
    if (err instanceof BudgetExhausted || err instanceof QuotaExceededError) {
      return await finish("partial");
    }
    await finish("failed", err instanceof Error ? err.message : String(err));
    throw err;
  }
}
