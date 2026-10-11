import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@astryxdesign/core/Table";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { unitValueCents } from "@/lib/collection-math";
import { formatCents } from "@/lib/format";
import { CONDITION_LABELS } from "@/lib/normalize/condition";
import type { getCollection } from "@/lib/queries/collection";
import { OwnedControl } from "./OwnedControl";

type Items = Awaited<ReturnType<typeof getCollection>>;

function NumHeader({ children }: { children: ReactNode }) {
  return (
    <TableHeaderCell>
      <Text display="block" justify="end" weight="semibold">
        {children}
      </Text>
    </TableHeaderCell>
  );
}

function Num({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text
      display="block"
      justify="end"
      hasTabularNumbers
      color={muted ? "secondary" : undefined}
    >
      {children}
    </Text>
  );
}

export function CollectionTable({ items }: { items: Items }) {
  if (items.length === 0) {
    return (
      <Text type="supporting">
        Your collection is empty. Open a card and add a printing/condition to track it.
      </Text>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Card</TableHeaderCell>
          <TableHeaderCell>Printing · Condition</TableHeaderCell>
          <TableHeaderCell>Qty</TableHeaderCell>
          <NumHeader>Price</NumHeader>
          <NumHeader>Value</NumHeader>
          <NumHeader>Cost</NumHeader>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const unit = unitValueCents(item.priceCents, item.lastKnownPriceCents);
          const expired = item.priceCents == null && item.lastKnownPriceCents != null;
          return (
            <TableRow key={item.itemId}>
              <TableCell>
                <VStack gap={0.5}>
                  <Link href={`/cards/${item.cardId}`} color="primary" weight="semibold">
                    {item.cardName}
                  </Link>
                  <Text type="supporting">{item.setName}</Text>
                </VStack>
              </TableCell>
              <TableCell>
                {item.printing}
                {item.language !== "English" && ` (${item.language})`} ·{" "}
                {CONDITION_LABELS[item.condition]}
              </TableCell>
              <TableCell>
                <OwnedControl
                  variantId={item.variantId}
                  itemId={item.itemId}
                  quantity={item.quantity}
                />
              </TableCell>
              <TableCell>
                <Num muted={expired}>
                  {formatCents(unit)}
                  {expired && " (last known)"}
                </Num>
              </TableCell>
              <TableCell>
                <Num>{unit == null ? "—" : formatCents(unit * item.quantity)}</Num>
              </TableCell>
              <TableCell>
                <Num>
                  {item.acquiredPriceCents == null
                    ? "—"
                    : formatCents(item.acquiredPriceCents * item.quantity)}
                </Num>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
