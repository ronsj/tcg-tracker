"use client";

import { useOptimistic, useState, useTransition } from "react";
import * as stylex from "@stylexjs/stylex";
import { colors } from "@/app/tokens.stylex";
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

  if (optimistic === 0 || !itemId) {
    return (
      <span {...stylex.props(styles.wrap)}>
        <button
          type="button"
          aria-label="Add to collection"
          disabled={pending}
          onClick={() => run(1, () => addToCollection(variantId))}
          {...stylex.props(styles.button, styles.add, pending && styles.disabled)}
        >
          Add
        </button>
        {error && (
          <span role="alert" {...stylex.props(styles.error)}>
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <span {...stylex.props(styles.wrap)}>
      <span {...stylex.props(styles.group)}>
        <button
          type="button"
          aria-label="Remove one"
          disabled={pending}
          onClick={() => run(optimistic - 1, () => setCollectionQuantity(itemId, optimistic - 1))}
          {...stylex.props(styles.button, styles.step, pending && styles.disabled)}
        >
          −
        </button>
        <span aria-live="polite" {...stylex.props(styles.qty)}>
          {optimistic}
        </span>
        <button
          type="button"
          aria-label="Add one"
          disabled={pending}
          onClick={() => run(optimistic + 1, () => setCollectionQuantity(itemId, optimistic + 1))}
          {...stylex.props(styles.button, styles.step, pending && styles.disabled)}
        >
          +
        </button>
      </span>
      {error && (
        <span role="alert" {...stylex.props(styles.error)}>
          {error}
        </span>
      )}
    </span>
  );
}

const styles = stylex.create({
  wrap: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
  },
  group: {
    display: "inline-flex",
    gap: 4,
    alignItems: "center",
  },
  button: {
    fontFamily: "inherit",
    fontSize: 14,
    color: colors.foreground,
    cursor: "pointer",
    backgroundColor: "transparent",
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 6,
  },
  add: {
    paddingBlock: 2,
    paddingInline: 10,
  },
  step: {
    minWidth: 26,
    paddingBlock: 2,
    paddingInline: 6,
  },
  disabled: {
    cursor: "default",
    opacity: 0.6,
  },
  qty: {
    minWidth: 24,
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
  },
  error: {
    fontSize: 12,
    color: colors.danger,
  },
});
