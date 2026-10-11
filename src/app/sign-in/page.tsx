import type { Metadata } from "next";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/Layout";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SigninPage() {
  return (
    <Center axis="horizontal">
      <Card width="100%" maxWidth={400} padding={6}>
        <VStack gap={4}>
          <Heading level={1}>Sign in</Heading>
          <AuthForm mode="sign-in" />
        </VStack>
      </Card>
    </Center>
  );
}
