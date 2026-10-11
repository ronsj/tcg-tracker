import { cacheLife, cacheTag } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import * as stylex from "@stylexjs/stylex";
import { formatCents, formatDate } from "@/lib/format";
import { getSetWithCards } from "@/lib/queries/cards";
import { colors } from "@/app/tokens.stylex";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SetPage({ params }: PageProps<"/sets/[id]">) {
  return (
    <Suspense fallback={<p {...stylex.props(styles.main, styles.meta)}>Loading…</p>}>
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
    <main {...stylex.props(styles.main)}>
      <Link href="/" {...stylex.props(styles.back)}>
        ← All sets
      </Link>
      <h1 {...stylex.props(styles.title)}>{set.name}</h1>
      <p {...stylex.props(styles.meta)}>
        {set.gameName} · {formatDate(set.releaseDate)} · {cards.length} cards
      </p>

      <ul {...stylex.props(styles.grid)}>
        {cards.map((c) => (
          <li key={c.id}>
            <Link href={`/cards/${c.id}`} {...stylex.props(styles.card)}>
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt=""
                  width={200}
                  height={280}
                  {...stylex.props(styles.image)}
                />
              ) : (
                <div {...stylex.props(styles.image, styles.placeholder)} />
              )}
              <span {...stylex.props(styles.name)}>{c.name}</span>
              <span {...stylex.props(styles.meta)}>
                {[c.number, c.rarity].filter(Boolean).join(" · ")}
              </span>
              <span {...stylex.props(styles.price)}>{formatCents(c.marketCents)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

const styles = stylex.create({
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxWidth: 960,
    padding: 32,
    marginInline: "auto",
  },
  back: {
    fontSize: 14,
    color: colors.muted,
    textDecoration: "none",
  },
  title: {
    fontSize: 32,
    fontWeight: 600,
  },
  meta: {
    fontSize: 14,
    color: colors.muted,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 16,
    padding: 0,
    marginTop: 16,
    listStyle: "none",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "inherit",
    textDecoration: "none",
  },
  image: {
    width: "100%",
    height: "auto",
    aspectRatio: "5 / 7",
    borderRadius: 8,
  },
  placeholder: {
    backgroundColor: colors.border,
  },
  name: {
    fontWeight: 600,
  },
  price: {
    fontVariantNumeric: "tabular-nums",
  },
});
