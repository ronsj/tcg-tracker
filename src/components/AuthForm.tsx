"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignUp = mode === "sign-up";

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setError(null);
    setPending(true);
    try {
      const { error } = isSignUp
        ? await signUp.email({ name, email, password })
        : await signIn.email({ email, password });
      if (error) {
        setError(error.message ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  // TextInput's typings omit native validation attributes, but it spreads them onto the <input>.
  const requiredAttr = { required: true };
  const passwordAttrs = { required: true, minLength: 8 };

  return (
    <VStack gap={4}>
      <form onSubmit={onSubmit}>
        <FormLayout defaultOptionality="required">
          {isSignUp && (
            <TextInput
              label="Name"
              htmlName="name"
              autoComplete="name"
              value={name}
              onChange={setName}
              {...requiredAttr}
            />
          )}
          <TextInput
            label="Email"
            type="email"
            htmlName="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            {...requiredAttr}
          />
          <TextInput
            label="Password"
            type="password"
            htmlName="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={setPassword}
            {...passwordAttrs}
          />
          {error && <Banner status="error" title={error} />}
          <Button
            type="submit"
            variant="primary"
            label={isSignUp ? "Sign up" : "Sign in"}
            isLoading={pending}
          />
        </FormLayout>
      </form>
      <Text type="supporting">
        {isSignUp ? (
          <>
            Have an account? <Link href="/sign-in">Sign in</Link>
          </>
        ) : (
          <>
            No account? <Link href="/sign-up">Sign up</Link>
          </>
        )}
      </Text>
    </VStack>
  );
}
