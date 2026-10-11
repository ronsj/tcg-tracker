import { cacheLife, cacheTag } from "next/cache";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import * as stylex from "@stylexjs/stylex";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { formatCents, formatDate } from "@/lib/format";
import { getSetWithCards } from "@/lib/queries/cards";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SetPage({ params }: PageProps<"/sets/[id]">) {
  return (
    <Suspense fallback={<Text type="supporting">Loading…</Text>}>
      <SetView params={params} />
    </Suspense>
  );
}

// Awaiting `params` is request-time work, so it lives behind Suspense; the cached
// component below receives the plain id.
async function SetView({ params }: { params: PageProps<"/sets/[id]">["params"] }) {
  const { id } = await params;
  return <SetContent id={id} />;
}

async function SetContent({ id }: { id: string }) {
  "use cache";
  cacheLife("hours");
  cacheTag(`set:${id}`);

  // A malformed id would make Postgres throw on the uuid cast.
  const data = UUID_RE.test(id) ? await getSetWithCards(id) : null;
  if (!data) notFound();
  const { set, cards } = data;

  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <Breadcrumbs>
          <BreadcrumbItem href="/">All sets</BreadcrumbItem>
          <BreadcrumbItem>{set.name}</BreadcrumbItem>
        </Breadcrumbs>
        <Heading level={1}>{set.name}</Heading>
        <Text type="supporting">
          {set.gameName} · {formatDate(set.releaseDate)} · {cards.length} cards
        </Text>
      </VStack>

      <Grid columns={{ minWidth: 180 }} gap={3}>
        {cards.map((c) => (
          <Card key={c.id}>
            <VStack gap={2}>
              {c.imageUrl && (
                <AspectRatio ratio={5 / 7} fit="contain" xstyle={styles.thumb}>
                  <Image src={c.imageUrl} alt="" width={200} height={280} />
                </AspectRatio>
              )}
              <VStack gap={0.5}>
                <Link href={`/cards/${c.id}`} color="primary" weight="semibold" maxLines={2}>
                  {c.name}
                </Link>
                <Text type="supporting">{[c.number, c.rarity].filter(Boolean).join(" · ")}</Text>
                <Text weight="medium" hasTabularNumbers>
                  {formatCents(c.marketCents)}
                </Text>
              </VStack>
            </VStack>
          </Card>
        ))}
      </Grid>
    </VStack>
  );
}

const styles = stylex.create({
  // AspectRatio derives its height from its width, and a stack child has none by default.
  thumb: {
    width: "100%",
  },
});
