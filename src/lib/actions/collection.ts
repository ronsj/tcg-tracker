"use server";

import { refresh } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardVariant, collectionItem } from "@/db/schema";
import { isValidQuantity } from "@/lib/collection-math";
import { requireSession } from "@/lib/session";
import { isUuid } from "@/lib/uuid";

export async function addToCollection(variantId: string): Promise<{ quantity: number }> {
  if (!isUuid(variantId)) throw new Error("Invalid variant.");
  const { user } = await requireSession();

  const [variant] = await db
    .select({ id: cardVariant.id })
    .from(cardVariant)
    .where(eq(cardVariant.id, variantId))
    .limit(1);
  if (!variant) throw new Error("That printing no longer exists.");

  const [row] = await db
    .insert(collectionItem)
    .values({ userId: user.id, variantId, quantity: 1 })
    .onConflictDoUpdate({
      target: [collectionItem.userId, collectionItem.variantId],
      set: { quantity: sql`${collectionItem.quantity} + 1`, updatedAt: new Date() },
    })
    .returning({ quantity: collectionItem.quantity });

  refresh();
  return { quantity: row.quantity };
}

export async function setCollectionQuantity(
  itemId: string,
  quantity: number,
): Promise<{ quantity: number }> {
  if (!isUuid(itemId)) throw new Error("Invalid collection item.");
  if (!isValidQuantity(quantity)) throw new Error("Quantity must be a whole number.");
  const { user } = await requireSession();

  const owned = and(eq(collectionItem.id, itemId), eq(collectionItem.userId, user.id));

  if (quantity <= 0) {
    await db.delete(collectionItem).where(owned);
    refresh();
    return { quantity: 0 };
  }

  const [row] = await db
    .update(collectionItem)
    .set({ quantity, updatedAt: new Date() })
    .where(owned)
    .returning({ quantity: collectionItem.quantity });
  if (!row) throw new Error("Collection item not found.");

  refresh();
  return { quantity: row.quantity };
}

export async function removeCollectionItem(itemId: string): Promise<void> {
  if (!isUuid(itemId)) throw new Error("Invalid collection item.");
  const { user } = await requireSession();

  await db
    .delete(collectionItem)
    .where(and(eq(collectionItem.id, itemId), eq(collectionItem.userId, user.id)));

  refresh();
}
