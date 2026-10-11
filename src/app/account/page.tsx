import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<Text type="supporting">Loading…</Text>}>
      <AccountDetails />
    </Suspense>
  );
}

async function AccountDetails() {
  const { user } = await requireSession();

  return (
    <VStack gap={6}>
      <Heading level={1}>Account</Heading>
      <Card maxWidth={400}>
        <VStack gap={1}>
          <Text weight="semibold">{user.name}</Text>
          <Text type="supporting">{user.email}</Text>
          <Text type="supporting">Member since {formatDate(user.createdAt)}</Text>
        </VStack>
      </Card>
    </VStack>
  );
}
