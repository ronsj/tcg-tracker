import { cacheLife, cacheTag } from "next/cache";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import type { StyleXStyles } from "@stylexjs/stylex";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { formatCents, formatDate, formatPct } from "@/lib/format";
import { CONDITION_LABELS } from "@/lib/normalize/condition";
import { OwnedControl } from "@/components/OwnedControl";
import { changeTone } from "@/components/tones";
import { getCard, getCardVariantPrices } from "@/lib/queries/cards";
import { getOwnedQuantities } from "@/lib/queries/collection";
import { getSession } from "@/lib/session";
import { ensureJustTcgPrices } from "@/lib/sync/justtcg-prices";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CardPage({ params }: PageProps<"/cards/[id]">) {
  return (
    <Suspense fallback={<Text type="supporting">Loading…</Text>}>
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
      <Suspense fallback={<Text type="supporting">Loading condition prices…</Text>}>
        <ConditionPrices cardId={id} />
      </Suspense>
    </CardDetails>
  );
}

function Num({ children, xstyle }: { children: ReactNode; xstyle?: StyleXStyles }) {
  return (
    <Text display="block" justify="end" hasTabularNumbers xstyle={xstyle}>
      {children}
    </Text>
  );
}

function NumHeader({ children }: { children: ReactNode }) {
  return (
    <TableHeaderCell>
      <Text display="block" justify="end" weight="semibold">
        {children}
      </Text>
    </TableHeaderCell>
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
    <VStack gap={6}>
      <VStack gap={2}>
        <Breadcrumbs>
          <BreadcrumbItem href="/">All sets</BreadcrumbItem>
          <BreadcrumbItem href={`/sets/${card.setId}`}>{card.setName}</BreadcrumbItem>
          <BreadcrumbItem>{card.name}</BreadcrumbItem>
        </Breadcrumbs>
        <Heading level={1}>{card.name}</Heading>
        <Text type="supporting">
          {[card.gameName, card.number, card.rarity].filter(Boolean).join(" · ")}
        </Text>
      </VStack>

      <HStack gap={6} wrap="wrap" vAlign="start">
        {card.imageUrl && (
          <VStack width={300} maxWidth="100%">
            <AspectRatio ratio={5 / 7} fit="contain">
              <Image src={card.imageUrl} alt={card.name} width={300} height={420} priority />
            </AspectRatio>
          </VStack>
        )}
        <StackItem size="fill">
          <VStack gap={6}>
            <VStack gap={3}>
              <Heading level={2}>Market prices by printing</Heading>
              {card.printingPrices.length === 0 ? (
                <Text type="supporting">No printing prices yet.</Text>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Printing</TableHeaderCell>
                      <NumHeader>Market</NumHeader>
                      <NumHeader>Low</NumHeader>
                      <NumHeader>Median</NumHeader>
                      <NumHeader>As of</NumHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {card.printingPrices.map((p) => (
                      <TableRow key={p.printing}>
                        <TableCell>{p.printing}</TableCell>
                        <TableCell>
                          <Num>{formatCents(p.marketCents)}</Num>
                        </TableCell>
                        <TableCell>
                          <Num>{formatCents(p.lowCents)}</Num>
                        </TableCell>
                        <TableCell>
                          <Num>{formatCents(p.medianCents)}</Num>
                        </TableCell>
                        <TableCell>
                          <Num>{formatDate(p.marketAsOf)}</Num>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </VStack>
            {children}
          </VStack>
        </StackItem>
      </HStack>
    </VStack>
  );
}

// Not cached: reads the DB at request time and may call JustTCG on first view.
async function ConditionPrices({ cardId }: { cardId: string }) {
  // Request-time work: keeps the prerender pass from starting (and aborting) the fetch.
  await connection();
  const { reason } = await ensureJustTcgPrices(cardId);
  const [variants, session] = await Promise.all([getCardVariantPrices(cardId), getSession()]);
  const owned = session ? await getOwnedQuantities(session.user.id, cardId) : null;

  return (
    <VStack gap={3}>
      <Heading level={2}>Prices by condition</Heading>
      {variants.length === 0 ? (
        <Text type="supporting">
          {reason === "quota"
            ? "Condition prices unavailable: daily API budget spent. Try again tomorrow."
            : reason === "unavailable"
              ? "Condition prices are temporarily unavailable. Try again later."
              : reason === "no-tcgplayer-id"
                ? "No condition prices: this card has no TCGplayer ID."
                : "No condition prices for this card on JustTCG yet."}
        </Text>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Printing</TableHeaderCell>
              <TableHeaderCell>Condition</TableHeaderCell>
              <NumHeader>Price</NumHeader>
              <NumHeader>24h</NumHeader>
              <NumHeader>7d</NumHeader>
              <NumHeader>30d</NumHeader>
              <NumHeader>Observed</NumHeader>
              {owned && <TableHeaderCell>Owned</TableHeaderCell>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  {v.printing}
                  {v.language !== "English" && ` (${v.language})`}
                </TableCell>
                <TableCell>{CONDITION_LABELS[v.condition]}</TableCell>
                <TableCell>
                  <Num>
                    {v.priceCents != null ? (
                      formatCents(v.priceCents)
                    ) : (
                      <>
                        —
                        {v.lastKnownPriceCents != null && (
                          <Text type="supporting">
                            {" "}
                            (last known {formatCents(v.lastKnownPriceCents)})
                          </Text>
                        )}
                      </>
                    )}
                  </Num>
                </TableCell>
                <TableCell>
                  <Num xstyle={changeTone(v.change24hPct)}>{formatPct(v.change24hPct)}</Num>
                </TableCell>
                <TableCell>
                  <Num xstyle={changeTone(v.change7dPct)}>{formatPct(v.change7dPct)}</Num>
                </TableCell>
                <TableCell>
                  <Num xstyle={changeTone(v.change30dPct)}>{formatPct(v.change30dPct)}</Num>
                </TableCell>
                <TableCell>
                  <Num>{formatDate(v.observedAt)}</Num>
                </TableCell>
                {owned && (
                  <TableCell>
                    <OwnedControl
                      variantId={v.id}
                      itemId={owned.get(v.id)?.itemId}
                      quantity={owned.get(v.id)?.quantity ?? 0}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {!owned && variants.length > 0 && (
        <Text type="supporting">
          <Link href="/sign-in">Sign in</Link> to track what you own
        </Text>
      )}
      <Text type="supporting">Prices from JustTCG</Text>
    </VStack>
  );
}
