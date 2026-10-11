import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  card,
  cardSet,
  cardVariant,
  game,
  printingPriceCurrent,
  variantPriceCurrent,
} from "@/db/schema";

// Plain reads. Pages decide whether to cache them.

/** All sets, grouped by game in the caller; newest first within each game. */
export async function getSets() {
  return db
    .select({
      id: cardSet.id,
      name: cardSet.name,
      code: cardSet.code,
      releaseDate: cardSet.releaseDate,
      cardCount: cardSet.cardCount,
      gameId: game.id,
      gameName: game.name,
    })
    .from(cardSet)
    .innerJoin(game, eq(cardSet.gameId, game.id))
    .orderBy(asc(game.name), desc(cardSet.releaseDate), asc(cardSet.name));
}

export async function getSetWithCards(setId: string) {
  const [set] = await db
    .select({
      id: cardSet.id,
      name: cardSet.name,
      code: cardSet.code,
      releaseDate: cardSet.releaseDate,
      cardCount: cardSet.cardCount,
      gameName: game.name,
    })
    .from(cardSet)
    .innerJoin(game, eq(cardSet.gameId, game.id))
    .where(eq(cardSet.id, setId))
    .limit(1);
  if (!set) return null;

  const cheapest = db
    .select({
      cardId: printingPriceCurrent.cardId,
      marketCents: sql<number | null>`min(${printingPriceCurrent.marketCents})`.as("market_cents"),
    })
    .from(printingPriceCurrent)
    .groupBy(printingPriceCurrent.cardId)
    .as("cheapest");

  // Numeric part of "4/102" / "TG01" first, then the raw string as a tiebreaker.
  const cards = await db
    .select({
      id: card.id,
      name: card.name,
      number: card.number,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
      marketCents: cheapest.marketCents,
    })
    .from(card)
    .leftJoin(cheapest, eq(cheapest.cardId, card.id))
    .where(eq(card.setId, setId))
    .orderBy(
      // "263a/298" → 263. The backslash must survive the JS template literal.
      sql`NULLIF(regexp_replace(split_part(${card.number}, '/', 1), '\\D', '', 'g'), '')::int NULLS LAST`,
      asc(card.number),
    );

  return { set, cards };
}

export async function getCard(cardId: string) {
  const [row] = await db
    .select({
      id: card.id,
      name: card.name,
      number: card.number,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
      setId: cardSet.id,
      setName: cardSet.name,
      gameName: game.name,
    })
    .from(card)
    .innerJoin(cardSet, eq(card.setId, cardSet.id))
    .innerJoin(game, eq(card.gameId, game.id))
    .where(eq(card.id, cardId))
    .limit(1);
  if (!row) return null;

  const printingPrices = await db
    .select()
    .from(printingPriceCurrent)
    .where(eq(printingPriceCurrent.cardId, cardId))
    .orderBy(asc(printingPriceCurrent.printing));

  return { ...row, printingPrices };
}

export async function getCardVariantPrices(cardId: string) {
  return db
    .select({
      id: cardVariant.id,
      printing: cardVariant.printing,
      condition: cardVariant.condition,
      language: cardVariant.language,
      priceCents: variantPriceCurrent.priceCents,
      priceStatus: variantPriceCurrent.priceStatus,
      lastKnownPriceCents: variantPriceCurrent.lastKnownPriceCents,
      change24hPct: variantPriceCurrent.change24hPct,
      change7dPct: variantPriceCurrent.change7dPct,
      change30dPct: variantPriceCurrent.change30dPct,
      observedAt: variantPriceCurrent.observedAt,
    })
    .from(cardVariant)
    .leftJoin(variantPriceCurrent, eq(variantPriceCurrent.variantId, cardVariant.id))
    .where(eq(cardVariant.cardId, cardId))
    .orderBy(
      asc(cardVariant.printing),
      asc(cardVariant.language),
      sql`array_position(array['NM','LP','MP','HP','DMG']::card_condition[], ${cardVariant.condition})`,
    );
}
