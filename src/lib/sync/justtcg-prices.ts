import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { card, cardVariant, variantPriceCurrent, variantPriceDaily } from "@/db/schema";
import { getCards } from "@/lib/sources/justtcg";
import { QuotaExceededError } from "@/lib/sources/quota";
import { mapJustTcgCard } from "./justtcg-mapping";

const DAY_MS = 24 * 60 * 60 * 1000;

export type EnsurePricesResult = {
  fetched: boolean;
  reason?: "fresh" | "no-tcgplayer-id" | "quota" | "not-found";
};

// In-flight fetches by card, so concurrent renders of one card share a request.
// Per-process only: separate serverless instances don't see each other's entries.
const inFlight = new Map<string, Promise<EnsurePricesResult>>();

/**
 * Fetch-on-view: refresh a card's JustTCG condition prices if they are older than
 * `maxAgeMs`. Costs one API request (all conditions), and never throws on quota.
 */
export function ensureJustTcgPrices(
  cardId: string,
  { maxAgeMs = DAY_MS }: { maxAgeMs?: number } = {},
): Promise<EnsurePricesResult> {
  const existing = inFlight.get(cardId);
  if (existing) return existing;

  const promise = refresh(cardId, maxAgeMs).finally(() => inFlight.delete(cardId));
  inFlight.set(cardId, promise);
  return promise;
}

async function refresh(cardId: string, maxAgeMs: number): Promise<EnsurePricesResult> {
  const [row] = await db
    .select({
      id: card.id,
      tcgplayerProductId: card.tcgplayerProductId,
      justtcgPricesFetchedAt: card.justtcgPricesFetchedAt,
    })
    .from(card)
    .where(eq(card.id, cardId))
    .limit(1);
  if (!row) return { fetched: false, reason: "not-found" };

  const fetchedAt = row.justtcgPricesFetchedAt;
  if (fetchedAt && Date.now() - fetchedAt.getTime() < maxAgeMs) {
    return { fetched: false, reason: "fresh" };
  }
  if (!row.tcgplayerProductId) return { fetched: false, reason: "no-tcgplayer-id" };

  try {
    const res = await getCards({
      tcgplayerId: row.tcgplayerProductId,
      include_price_history: false,
    });
    const match = res.data.find((c) => c.tcgplayerId === row.tcgplayerProductId);
    const now = new Date();

    if (!match) {
      // Remember the miss so we don't spend a request on every view.
      await db.update(card).set({ justtcgPricesFetchedAt: now }).where(eq(card.id, row.id));
      return { fetched: true, reason: "not-found" };
    }

    await persistJustTcgCard(row.id, match, now);
    return { fetched: true };
  } catch (err) {
    // A page view must never crash because the daily budget is spent.
    if (err instanceof QuotaExceededError) return { fetched: false, reason: "quota" };
    throw err;
  }
}

/** Write one JustTCG card's variants and prices, then stamp the card as fresh. */
export async function persistJustTcgCard(
  cardId: string,
  match: Parameters<typeof mapJustTcgCard>[0],
  now: Date,
) {
  const { cardPatch, variants } = mapJustTcgCard(match);

  // neon-http has no multi-statement transactions, so write in dependency order and
  // stamp the card last: a crash midway leaves it stale and the next view retries.
  if (variants.length > 0) {
    const ids = await db
      .insert(cardVariant)
      .values(
        variants.map((v) => ({
          cardId,
          printing: v.printing,
          condition: v.condition,
          language: v.language,
          justtcgVariantId: v.justtcgVariantId,
          tcgplayerSkuId: v.tcgplayerSkuId,
        })),
      )
      .onConflictDoUpdate({
        target: [cardVariant.cardId, cardVariant.printing, cardVariant.condition, cardVariant.language],
        set: {
          justtcgVariantId: sql`excluded.justtcg_variant_id`,
          tcgplayerSkuId: sql`excluded.tcgplayer_sku_id`,
          updatedAt: now,
        },
      })
      .returning({
        id: cardVariant.id,
        printing: cardVariant.printing,
        condition: cardVariant.condition,
        language: cardVariant.language,
      });

    const idByKey = new Map(
      ids.map((r) => [[r.printing, r.condition, r.language].join("\u0000"), r.id]),
    );
    const priced = variants.flatMap((v) => {
      const variantId = idByKey.get([v.printing, v.condition, v.language].join("\u0000"));
      return variantId ? [{ variantId, ...v.price }] : [];
    });

    if (priced.length > 0) {
      await db
        .insert(variantPriceCurrent)
        .values(priced.map((p) => ({ ...p, fetchedAt: now })))
        .onConflictDoUpdate({
          target: variantPriceCurrent.variantId,
          set: {
            priceCents: sql`excluded.price_cents`,
            priceStatus: sql`excluded.price_status`,
            lastKnownPriceCents: sql`excluded.last_known_price_cents`,
            change24hPct: sql`excluded.change24h_pct`,
            change7dPct: sql`excluded.change7d_pct`,
            change30dPct: sql`excluded.change30d_pct`,
            change90dPct: sql`excluded.change90d_pct`,
            observedAt: sql`excluded.observed_at`,
            fetchedAt: sql`excluded.fetched_at`,
          },
        });
    }

    // `price_cents` is NOT NULL in the daily table, so unpriced variants get no row.
    const day = now.toISOString().slice(0, 10);
    const daily = priced.flatMap((p) =>
      p.priceCents == null ? [] : [{ variantId: p.variantId, day, priceCents: p.priceCents }],
    );
    if (daily.length > 0) {
      await db
        .insert(variantPriceDaily)
        .values(daily)
        .onConflictDoUpdate({
          target: [variantPriceDaily.variantId, variantPriceDaily.day],
          set: { priceCents: sql`excluded.price_cents` },
        });
    }
  }

  await db
    .update(card)
    .set({ ...cardPatch, justtcgPricesFetchedAt: now, updatedAt: now })
    .where(eq(card.id, cardId));
}
