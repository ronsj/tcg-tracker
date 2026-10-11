import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  card,
  cardSet,
  cardVariant,
  collectionItem,
  game,
  variantPriceCurrent,
} from "@/db/schema";

// Per-user reads. Never cache these: they depend on the signed-in user.

export async function getCollection(userId: string) {
  return db
    .select({
      itemId: collectionItem.id,
      quantity: collectionItem.quantity,
      acquiredPriceCents: collectionItem.acquiredPriceCents,
      acquiredAt: collectionItem.acquiredAt,
      variantId: cardVariant.id,
      cardId: card.id,
      cardName: card.name,
      cardNumber: card.number,
      imageUrl: card.imageUrl,
      setId: cardSet.id,
      setName: cardSet.name,
      gameName: game.name,
      printing: cardVariant.printing,
      condition: cardVariant.condition,
      language: cardVariant.language,
      priceCents: variantPriceCurrent.priceCents,
      priceStatus: variantPriceCurrent.priceStatus,
      lastKnownPriceCents: variantPriceCurrent.lastKnownPriceCents,
      observedAt: variantPriceCurrent.observedAt,
    })
    .from(collectionItem)
    .innerJoin(cardVariant, eq(collectionItem.variantId, cardVariant.id))
    .innerJoin(card, eq(cardVariant.cardId, card.id))
    .innerJoin(cardSet, eq(card.setId, cardSet.id))
    .innerJoin(game, eq(card.gameId, game.id))
    .leftJoin(variantPriceCurrent, eq(variantPriceCurrent.variantId, cardVariant.id))
    .where(eq(collectionItem.userId, userId))
    .orderBy(
      sql`${card.name} asc`,
      sql`${cardVariant.printing} asc`,
      sql`array_position(array['NM','LP','MP','HP','DMG']::card_condition[], ${cardVariant.condition})`,
    );
}

export async function getCollectionTotals(userId: string) {
  const [row] = await db
    .select({
      items: sql<number>`coalesce(sum(${collectionItem.quantity}), 0)::int`,
      distinct: sql<number>`count(*)::int`,
      valueCents: sql<number>`coalesce(sum(${collectionItem.quantity}::bigint * coalesce(${variantPriceCurrent.priceCents}, ${variantPriceCurrent.lastKnownPriceCents}, 0)), 0)::bigint`.mapWith(
        Number,
      ),
      costCents:
        sql<number | null>`sum(${collectionItem.quantity}::bigint * ${collectionItem.acquiredPriceCents})::bigint`.mapWith(
          (v) => (v == null ? null : Number(v)),
        ),
    })
    .from(collectionItem)
    .leftJoin(variantPriceCurrent, eq(variantPriceCurrent.variantId, collectionItem.variantId))
    .where(eq(collectionItem.userId, userId));

  return {
    items: row?.items ?? 0,
    distinct: row?.distinct ?? 0,
    valueCents: row?.valueCents ?? 0,
    costCents: row?.costCents ?? null,
  };
}

/** variantId → what the user owns, for one card's variants. */
export async function getOwnedQuantities(userId: string, cardId: string) {
  const rows = await db
    .select({
      variantId: collectionItem.variantId,
      itemId: collectionItem.id,
      quantity: collectionItem.quantity,
    })
    .from(collectionItem)
    .innerJoin(cardVariant, eq(collectionItem.variantId, cardVariant.id))
    .where(and(eq(collectionItem.userId, userId), eq(cardVariant.cardId, cardId)));

  return new Map(rows.map((r) => [r.variantId, { itemId: r.itemId, quantity: r.quantity }]));
}
