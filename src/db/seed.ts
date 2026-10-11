import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

// Own client (instead of ./index) so the script can use the direct URL when available.
const client = neon((process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!);
const db = drizzle({ client, schema, casing: "snake_case" });

const games: (typeof schema.game.$inferInsert)[] = [
  { id: "pokemon", name: "Pokémon", justtcgGameId: "pokemon", tcgapiGameSlug: "pokemon" },
  { id: "mtg", name: "Magic: The Gathering", justtcgGameId: "magic-the-gathering", tcgapiGameSlug: "magic" },
  {
    id: "riftbound",
    name: "Riftbound",
    justtcgGameId: "riftbound-league-of-legends-trading-card-game",
    tcgapiGameSlug: "riftbound-league-of-legends-trading-card-game",
  },
];

async function main() {
  await db
    .insert(schema.game)
    .values(games)
    .onConflictDoUpdate({
      target: schema.game.id,
      set: {
        name: sql`excluded.name`,
        justtcgGameId: sql`excluded.justtcg_game_id`,
        tcgapiGameSlug: sql`excluded.tcgapi_game_slug`,
      },
    });
  console.log(`Seeded ${games.length} games`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
