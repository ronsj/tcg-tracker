"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { tones } from "./tones";
import { addToCollection, setCollectionQuantity } from "@/lib/actions/collection";

type Props = {
  variantId: string;
  itemId?: string;
  quantity: number;
};

// The server action calls `refresh()`, so fresh props arrive in the same transition
// and the optimistic value settles on the real one.
export function OwnedControl({ variantId, itemId, quantity }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(quantity);
  const [error, setError] = useState<string | null>(null);

  function run(next: number, action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const errorText = error && (
    <Text role="alert" size="sm" xstyle={tones.error}>
      {error}
    </Text>
  );

  if (optimistic === 0 || !itemId) {
    return (
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button
          label="Add"
          aria-label="Add to collection"
          size="sm"
          isDisabled={pending}
          onClick={() => run(1, () => addToCollection(variantId))}
        />
        {errorText}
      </HStack>
    );
  }

  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      <HStack gap={1} vAlign="center">
        <Button
          label="−"
          aria-label="Remove one"
          size="sm"
          isDisabled={pending}
          onClick={() => run(optimistic - 1, () => setCollectionQuantity(itemId, optimistic - 1))}
        />
        <Text aria-live="polite" hasTabularNumbers>
          {optimistic}
        </Text>
        <Button
          label="+"
          aria-label="Add one"
          size="sm"
          isDisabled={pending}
          onClick={() => run(optimistic + 1, () => setCollectionQuantity(itemId, optimistic + 1))}
        />
      </HStack>
      {errorText}
    </HStack>
  );
}
