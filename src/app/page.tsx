import { cacheLife, cacheTag } from "next/cache";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { formatDate } from "@/lib/format";
import { getSets } from "@/lib/queries/cards";

export default async function Home() {
  "use cache";
  cacheLife("hours");
  cacheTag("sets");

  const sets = await getSets();

  // Rows arrive ordered by game, so grouping keeps that order.
  const games = new Map<string, { name: string; sets: typeof sets }>();
  for (const set of sets) {
    const group = games.get(set.gameId) ?? { name: set.gameName, sets: [] };
    group.sets.push(set);
    games.set(set.gameId, group);
  }

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Heading level={1}>Sets</Heading>
        <Text type="supporting">
          Pokémon, Magic: The Gathering and Riftbound prices and collections.
        </Text>
      </VStack>

      {[...games].map(([gameId, group]) => (
        <VStack key={gameId} gap={3}>
            <Heading level={2}>{group.name}</Heading>
            <Grid columns={{ minWidth: 240 }} gap={3}>
              {group.sets.map((set) => (
                <Card key={set.id}>
                  <VStack gap={1}>
                    <Link href={`/sets/${set.id}`} color="primary" weight="semibold" maxLines={2}>
                      {set.name}
                    </Link>
                    <Text type="supporting">{formatDate(set.releaseDate)}</Text>
                    <Text type="supporting">
                      {set.importedCount} {set.importedCount === 1 ? "card" : "cards"}
                    </Text>
                  </VStack>
                </Card>
              ))}
            </Grid>
          </VStack>
      ))}
    </VStack>
  );
}
