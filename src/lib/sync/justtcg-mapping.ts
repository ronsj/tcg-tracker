import type { CardCondition, NewCard, variantPriceCurrent } from "@/db/schema";
import { normalizeCondition } from "@/lib/normalize/condition";
import { dollarsToCents, unixSecondsToDate } from "@/lib/normalize/money";
import type { JustTcgCard } from "@/lib/sources/justtcg";

// Pure mapping from a JustTCG card to insert values. No DB access, so it can be unit tested.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Price values minus `variantId` and `fetchedAt`, which the caller supplies. */
export type MappedVariantPrice = Omit<
  typeof variantPriceCurrent.$inferInsert,
  "variantId" | "fetchedAt"
>;

export interface MappedVariant {
  printing: string;
  condition: CardCondition;
  language: string;
  justtcgVariantId: string;
  tcgplayerSkuId: string | null;
  price: MappedVariantPrice;
}

export type CardPatch = Pick<NewCard, "justtcgCardId" | "scryfallId" | "mtgjsonId">;

function validUuid(value: string | null | undefined): string | undefined {
  return value && UUID_RE.test(value) ? value : undefined;
}

export function mapJustTcgCard(card: JustTcgCard): { cardPatch: CardPatch; variants: MappedVariant[] } {
  // The DB columns are `uuid`; leave invalid or missing IDs out so existing values survive.
  const cardPatch: CardPatch = { justtcgCardId: card.uuid };
  const scryfallId = validUuid(card.scryfallId);
  const mtgjsonId = validUuid(card.mtgjsonId);
  if (scryfallId) cardPatch.scryfallId = scryfallId;
  if (mtgjsonId) cardPatch.mtgjsonId = mtgjsonId;

  // Keyed map: a repeated conflict key in one INSERT ... ON CONFLICT DO UPDATE is an error.
  const variants = new Map<string, MappedVariant>();
  for (const v of card.variants) {
    const condition = normalizeCondition(v.condition);
    if (!condition) continue; // sealed product etc.

    const language = v.language ?? "English";
    const key = [v.printing, condition, language].join("\u0000");
    if (variants.has(key)) continue;

    variants.set(key, {
      printing: v.printing,
      condition,
      language,
      justtcgVariantId: v.uuid,
      tcgplayerSkuId: v.tcgplayerSkuId ?? null,
      price: {
        priceCents: dollarsToCents(v.price),
        priceStatus: v.priceStatus,
        lastKnownPriceCents: dollarsToCents(v.lastKnownPrice),
        change24hPct: v.priceChange24hr ?? null,
        change7dPct: v.priceChange7d ?? null,
        change30dPct: v.priceChange30d ?? null,
        change90dPct: v.priceChange90d ?? null,
        observedAt: unixSecondsToDate(v.lastUpdated),
      },
    });
  }

  return { cardPatch, variants: [...variants.values()] };
}
