import Link from "next/link";
import * as stylex from "@stylexjs/stylex";
import { colors } from "@/app/tokens.stylex";
import { unitValueCents } from "@/lib/collection-math";
import { formatCents } from "@/lib/format";
import { CONDITION_LABELS } from "@/lib/normalize/condition";
import type { getCollection } from "@/lib/queries/collection";
import { OwnedControl } from "./OwnedControl";

type Items = Awaited<ReturnType<typeof getCollection>>;

export function CollectionTable({ items }: { items: Items }) {
  if (items.length === 0) {
    return (
      <p {...stylex.props(styles.muted)}>
        Your collection is empty. Open a card and add a printing/condition to track it.
      </p>
    );
  }

  return (
    <div {...stylex.props(styles.scroll)}>
      <table {...stylex.props(styles.table)}>
        <thead>
          <tr>
            <th {...stylex.props(styles.th)}>Card</th>
            <th {...stylex.props(styles.th)}>Printing · Condition</th>
            <th {...stylex.props(styles.th)}>Qty</th>
            <th {...stylex.props(styles.th, styles.num)}>Price</th>
            <th {...stylex.props(styles.th, styles.num)}>Value</th>
            <th {...stylex.props(styles.th, styles.num)}>Cost</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const unit = unitValueCents(item.priceCents, item.lastKnownPriceCents);
            const expired = item.priceCents == null && item.lastKnownPriceCents != null;
            return (
              <tr key={item.itemId}>
                <td {...stylex.props(styles.td)}>
                  <Link href={`/cards/${item.cardId}`} {...stylex.props(styles.link)}>
                    {item.cardName}
                  </Link>
                  <div {...stylex.props(styles.sub)}>{item.setName}</div>
                </td>
                <td {...stylex.props(styles.td)}>
                  {item.printing}
                  {item.language !== "English" && ` (${item.language})`} ·{" "}
                  {CONDITION_LABELS[item.condition]}
                </td>
                <td {...stylex.props(styles.td)}>
                  <OwnedControl
                    variantId={item.variantId}
                    itemId={item.itemId}
                    quantity={item.quantity}
                  />
                </td>
                <td {...stylex.props(styles.td, styles.num, expired && styles.muted)}>
                  {formatCents(unit)}
                  {expired && " (last known)"}
                </td>
                <td {...stylex.props(styles.td, styles.num)}>
                  {unit == null ? "—" : formatCents(unit * item.quantity)}
                </td>
                <td {...stylex.props(styles.td, styles.num)}>
                  {item.acquiredPriceCents == null
                    ? "—"
                    : formatCents(item.acquiredPriceCents * item.quantity)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = stylex.create({
  muted: {
    color: colors.muted,
  },
  scroll: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    fontSize: 14,
    borderCollapse: "collapse",
  },
  th: {
    paddingBlock: 6,
    paddingInline: 8,
    fontWeight: 500,
    color: colors.muted,
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    paddingBlock: 6,
    paddingInline: 8,
    whiteSpace: "nowrap",
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  num: {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  },
  link: {
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
  },
  sub: {
    fontSize: 12,
    color: colors.muted,
  },
});
