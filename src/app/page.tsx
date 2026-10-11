import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import * as stylex from "@stylexjs/stylex";
import { formatDate } from "@/lib/format";
import { getSets } from "@/lib/queries/cards";
import { colors } from "./tokens.stylex";

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
    <main {...stylex.props(styles.main)}>
      <h1 {...stylex.props(styles.title)}>TCG Tracker</h1>
      <p {...stylex.props(styles.subtitle)}>
        Pokémon, Magic: The Gathering and Riftbound prices and collections.
      </p>

      {[...games].map(([gameId, group]) => (
        <section key={gameId} {...stylex.props(styles.section)}>
          <h2 {...stylex.props(styles.heading)}>{group.name}</h2>
          <ul {...stylex.props(styles.list)}>
            {group.sets.map((set) => (
              <li key={set.id} {...stylex.props(styles.row)}>
                <Link href={`/sets/${set.id}`} {...stylex.props(styles.link)}>
                  {set.name}
                </Link>
                <span {...stylex.props(styles.meta)}>
                  {formatDate(set.releaseDate)}
                  {set.cardCount != null &&
                    ` · ${set.cardCount} ${set.cardCount === 1 ? "card" : "cards"}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

const styles = stylex.create({
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxWidth: 720,
    padding: 32,
    marginInline: "auto",
  },
  title: {
    fontSize: 32,
    fontWeight: 600,
  },
  subtitle: {
    color: colors.muted,
  },
  section: {
    marginTop: 24,
  },
  heading: {
    marginBottom: 8,
    fontSize: 20,
    fontWeight: 600,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    padding: 0,
    listStyle: "none",
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    columnGap: 16,
    justifyContent: "space-between",
    paddingBlock: 6,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
  },
  link: {
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
  },
  meta: {
    fontSize: 14,
    color: colors.muted,
  },
});
