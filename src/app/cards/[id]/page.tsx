import { cacheLife, cacheTag } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { colors } from "@/app/tokens.stylex";
import { formatCents, formatDate, formatPct } from "@/lib/format";
import { CONDITION_LABELS } from "@/lib/normalize/condition";
import { getCard, getCardVariantPrices } from "@/lib/queries/cards";
import { ensureJustTcgPrices } from "@/lib/sync/justtcg-prices";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CardPage({ params }: PageProps<"/cards/[id]">) {
  return (
    <Suspense fallback={<p {...stylex.props(styles.main, styles.muted)}>Loading…</p>}>
      <CardView params={params} />
    </Suspense>
  );
}

// Awaiting `params` is request-time work, so it lives behind Suspense. The cached
// details and the uncached prices below it are siblings in the output.
async function CardView({ params }: { params: PageProps<"/cards/[id]">["params"] }) {
  const { id } = await params;
  return (
    <CardDetails id={id}>
      <Suspense fallback={<p {...stylex.props(styles.muted)}>Loading condition prices…</p>}>
        <ConditionPrices cardId={id} />
      </Suspense>
    </CardDetails>
  );
}

// `children` passes through the cache untouched, so the uncached prices can sit inside.
async function CardDetails({ id, children }: { id: string; children: ReactNode }) {
  "use cache";
  cacheLife("hours");
  cacheTag(`card:${id}`);

  // A malformed id would make Postgres throw on the uuid cast.
  const card = UUID_RE.test(id) ? await getCard(id) : null;
  if (!card) notFound();

  return (
    <main {...stylex.props(styles.main)}>
      <Link href={`/sets/${card.setId}`} {...stylex.props(styles.back)}>
        ← {card.setName}
      </Link>
      <h1 {...stylex.props(styles.title)}>{card.name}</h1>
      <p {...stylex.props(styles.muted)}>
        {[card.gameName, card.number, card.rarity].filter(Boolean).join(" · ")}
      </p>

      <div {...stylex.props(styles.layout)}>
        {card.imageUrl && (
          <Image
            src={card.imageUrl}
            alt={card.name}
            width={300}
            height={420}
            priority
            {...stylex.props(styles.image)}
          />
        )}
        <div {...stylex.props(styles.tables)}>
          <section>
            <h2 {...stylex.props(styles.heading)}>Market prices by printing</h2>
            {card.printingPrices.length === 0 ? (
              <p {...stylex.props(styles.muted)}>No printing prices yet.</p>
            ) : (
              <div {...stylex.props(styles.scroll)}>
                <table {...stylex.props(styles.table)}>
                  <thead>
                    <tr>
                      <th {...stylex.props(styles.th)}>Printing</th>
                      <th {...stylex.props(styles.th, styles.num)}>Market</th>
                      <th {...stylex.props(styles.th, styles.num)}>Low</th>
                      <th {...stylex.props(styles.th, styles.num)}>Median</th>
                      <th {...stylex.props(styles.th, styles.num)}>As of</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.printingPrices.map((p) => (
                      <tr key={p.printing}>
                        <td {...stylex.props(styles.td)}>{p.printing}</td>
                        <td {...stylex.props(styles.td, styles.num)}>{formatCents(p.marketCents)}</td>
                        <td {...stylex.props(styles.td, styles.num)}>{formatCents(p.lowCents)}</td>
                        <td {...stylex.props(styles.td, styles.num)}>{formatCents(p.medianCents)}</td>
                        <td {...stylex.props(styles.td, styles.num)}>{formatDate(p.marketAsOf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {children}
        </div>
      </div>
    </main>
  );
}

function changeStyle(n: number | null) {
  if (n == null || n === 0) return undefined;
  return n > 0 ? styles.up : styles.down;
}

// Not cached: reads the DB at request time and may call JustTCG on first view.
async function ConditionPrices({ cardId }: { cardId: string }) {
  const { reason } = await ensureJustTcgPrices(cardId);
  const variants = await getCardVariantPrices(cardId);

  return (
    <section>
      <h2 {...stylex.props(styles.heading)}>Prices by condition</h2>
      {variants.length === 0 ? (
        <p {...stylex.props(styles.muted)}>
          {reason === "quota"
            ? "Condition prices unavailable: daily API budget spent. Try again tomorrow."
            : reason === "no-tcgplayer-id"
              ? "No condition prices: this card has no TCGplayer ID."
              : "No condition prices for this card on JustTCG."}
        </p>
      ) : (
        <div {...stylex.props(styles.scroll)}>
          <table {...stylex.props(styles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(styles.th)}>Printing</th>
                <th {...stylex.props(styles.th)}>Condition</th>
                <th {...stylex.props(styles.th, styles.num)}>Price</th>
                <th {...stylex.props(styles.th, styles.num)}>24h</th>
                <th {...stylex.props(styles.th, styles.num)}>7d</th>
                <th {...stylex.props(styles.th, styles.num)}>30d</th>
                <th {...stylex.props(styles.th, styles.num)}>Observed</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id}>
                  <td {...stylex.props(styles.td)}>
                    {v.printing}
                    {v.language !== "English" && ` (${v.language})`}
                  </td>
                  <td {...stylex.props(styles.td)}>{CONDITION_LABELS[v.condition]}</td>
                  <td {...stylex.props(styles.td, styles.num)}>
                    {v.priceCents != null ? (
                      formatCents(v.priceCents)
                    ) : (
                      <>
                        —
                        {v.lastKnownPriceCents != null && (
                          <span {...stylex.props(styles.muted)}>
                            {" "}
                            (last known {formatCents(v.lastKnownPriceCents)})
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td {...stylex.props(styles.td, styles.num, changeStyle(v.change24hPct))}>
                    {formatPct(v.change24hPct)}
                  </td>
                  <td {...stylex.props(styles.td, styles.num, changeStyle(v.change7dPct))}>
                    {formatPct(v.change7dPct)}
                  </td>
                  <td {...stylex.props(styles.td, styles.num, changeStyle(v.change30dPct))}>
                    {formatPct(v.change30dPct)}
                  </td>
                  <td {...stylex.props(styles.td, styles.num)}>{formatDate(v.observedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p {...stylex.props(styles.note)}>Prices from JustTCG</p>
    </section>
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
  muted: {
    color: colors.muted,
  },
  layout: {
    display: "flex",
    flexWrap: "wrap",
    gap: 24,
    alignItems: "flex-start",
    marginTop: 16,
  },
  image: {
    maxWidth: "100%",
    height: "auto",
    borderRadius: 12,
  },
  tables: {
    display: "flex",
    flexGrow: 1,
    flexBasis: 320,
    flexDirection: "column",
    gap: 24,
    minWidth: 0,
  },
  heading: {
    marginBottom: 8,
    fontSize: 20,
    fontWeight: 600,
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
  up: {
    color: colors.positive,
  },
  down: {
    color: colors.negative,
  },
  note: {
    marginTop: 8,
    fontSize: 12,
    color: colors.muted,
  },
});
