import type { NewCard, cardSet, printingPriceCurrent } from "@/db/schema";
import { dollarsToCents } from "@/lib/normalize/money";
import type { TcgApiSet, TcgApiSetCardRow } from "@/lib/sources/tcgapi";

// Pure mapping from TCG API rows to insert values. No DB access, so it can be unit tested.

export type CardSetInsert = typeof cardSet.$inferInsert;

export function mapSetRow(set: TcgApiSet, gameId: string): CardSetInsert {
  return {
    gameId,
    name: set.name,
    code: set.abbreviation || null,
    releaseDate: set.release_date,
    cardCount: set.card_count,
    tcgapiSetId: String(set.id),
  };
}

export type MappedCard = Omit<NewCard, "tcgplayerProductId" | "tcgapiCardId"> & {
  tcgplayerProductId: string;
  tcgapiCardId: string;
};

/** Price values minus `cardId`, which the caller resolves after upserting the cards. */
export type MappedPrice = Omit<typeof printingPriceCurrent.$inferInsert, "cardId"> & {
  tcgapiCardId: string;
};

export function mapSetCardRows(
  rows: TcgApiSetCardRow[],
  { gameId, setId }: { gameId: string; setId: string },
): { cards: MappedCard[]; prices: MappedPrice[] } {
  // Keyed maps: a repeated conflict key in one INSERT ... ON CONFLICT DO UPDATE is an error.
  const cards = new Map<string, MappedCard>();
  const prices = new Map<string, MappedPrice>();

  for (const row of rows) {
    // Sealed products come back even when the request asks for cards only.
    if (row.product_type !== "Cards") continue;

    const tcgplayerProductId = String(row.tcgplayer_id);
    const tcgapiCardId = String(row.id);

    let card = cards.get(tcgplayerProductId);
    if (!card) {
      card = {
        gameId,
        setId,
        name: row.name,
        number: row.number || null,
        rarity: row.rarity && row.rarity !== "None" ? row.rarity : null,
        imageUrl: row.image_url ?? null,
        tcgplayerProductId,
        tcgapiCardId,
      };
      cards.set(tcgplayerProductId, card);
    }

    // Prices hang off the card we kept, in case two ids share a TCGplayer product.
    const priceKey = `${card.tcgapiCardId}\u0000${row.printing}`;
    if (!prices.has(priceKey)) {
      prices.set(priceKey, {
        tcgapiCardId: card.tcgapiCardId,
        printing: row.printing,
        marketCents: dollarsToCents(row.market_price),
        lowCents: dollarsToCents(row.low_price),
        medianCents: dollarsToCents(row.median_price),
        lowestWithShippingCents: dollarsToCents(row.lowest_with_shipping),
        totalListings: row.total_listings ?? null,
        marketAsOf: row.market_price_as_of ?? null,
      });
    }
  }

  return { cards: [...cards.values()], prices: [...prices.values()] };
}
