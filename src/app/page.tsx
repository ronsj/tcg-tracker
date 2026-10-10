import * as stylex from "@stylexjs/stylex";
import { colors } from "./tokens.stylex";

export default function Home() {
  return (
    <main {...stylex.props(styles.main)}>
      <h1 {...stylex.props(styles.title)}>TCG Tracker</h1>
      <p {...stylex.props(styles.subtitle)}>
        Pokémon and Magic: The Gathering prices and collections.
      </p>
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
});
