import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { CollectionTable } from "@/components/CollectionTable";
import { tones } from "@/components/tones";
import { gainCents } from "@/lib/collection-math";
import { formatCents } from "@/lib/format";
import { getCollection, getCollectionTotals } from "@/lib/queries/collection";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Collection" };

export default function CollectionPage() {
  return (
    <Suspense fallback={<Text type="supporting">Loading…</Text>}>
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
    <VStack gap={6}>
      <Heading level={1}>Collection</Heading>
      <Grid columns={{ minWidth: 200 }} gap={3}>
        <Stat label="Cards" value={String(totals.items)} />
        <Stat label="Distinct printings" value={String(totals.distinct)} />
        <Stat label="Total value" value={formatCents(totals.valueCents)} />
        {totals.costCents != null && gain != null && (
          <Stat
            label={`Gain / loss (cost ${formatCents(totals.costCents)})`}
            value={`${gain > 0 ? "+" : gain < 0 ? "−" : ""}${formatCents(Math.abs(gain))}`}
            xstyle={gain > 0 ? tones.up : gain < 0 ? tones.down : undefined}
          />
        )}
      </Grid>
      <CollectionTable items={items} />
    </VStack>
  );
}

function Stat({ label, value, xstyle }: { label: ReactNode; value: string; xstyle?: StyleXStyles }) {
  return (
    <Card>
      <VStack gap={1}>
        <Text type="supporting">{label}</Text>
        <Text type="display-3" hasTabularNumbers xstyle={xstyle}>
          {value}
        </Text>
      </VStack>
    </Card>
  );
}
