import type { Metadata } from "next";
import { Suspense } from "react";
import * as stylex from "@stylexjs/stylex";
import { colors } from "@/app/tokens.stylex";
import { CollectionTable } from "@/components/CollectionTable";
import { gainCents } from "@/lib/collection-math";
import { formatCents } from "@/lib/format";
import { getCollection, getCollectionTotals } from "@/lib/queries/collection";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Collection" };

export default function CollectionPage() {
  return (
    <Suspense fallback={<p {...stylex.props(styles.main, styles.muted)}>Loading…</p>}>
      <CollectionView />
    </Suspense>
  );
}

// Per-user and request-time: uncached, behind Suspense.
async function CollectionView() {
  const { user } = await requireSession();
  const [totals, items] = await Promise.all([getCollectionTotals(user.id), getCollection(user.id)]);
  const gain = gainCents(totals.valueCents, totals.costCents);

  return (
    <main {...stylex.props(styles.main)}>
      <h1 {...stylex.props(styles.title)}>Collection</h1>
      <div {...stylex.props(styles.stats)}>
        <Stat label="Cards" value={String(totals.items)} />
        <Stat label="Distinct printings" value={String(totals.distinct)} />
        <Stat label="Total value" value={formatCents(totals.valueCents)} />
        {totals.costCents != null && gain != null && (
          <Stat
            label={`Gain / loss (cost ${formatCents(totals.costCents)})`}
            value={`${gain > 0 ? "+" : gain < 0 ? "−" : ""}${formatCents(Math.abs(gain))}`}
            tone={gain > 0 ? "up" : gain < 0 ? "down" : undefined}
          />
        )}
      </div>
      <CollectionTable items={items} />
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div {...stylex.props(styles.tile)}>
      <div {...stylex.props(styles.tileLabel)}>{label}</div>
      <div {...stylex.props(styles.tileValue, tone === "up" && styles.up, tone === "down" && styles.down)}>
        {value}
      </div>
    </div>
  );
}

const styles = stylex.create({
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 960,
    padding: 32,
    marginInline: "auto",
  },
  title: {
    fontSize: 32,
    fontWeight: 600,
  },
  muted: {
    color: colors.muted,
  },
  stats: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  tile: {
    flexGrow: 1,
    flexBasis: 160,
    padding: 12,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 8,
  },
  tileLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  tileValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  up: {
    color: colors.positive,
  },
  down: {
    color: colors.negative,
  },
});
