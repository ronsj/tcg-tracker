import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Layout";
import { getSession } from "@/lib/session";
import { UserMenuClient } from "./UserMenuClient";

// Reading the session touches request headers, so the layout wraps this in Suspense.
export async function UserMenu() {
  const session = await getSession();

  if (!session) {
    return (
      <HStack gap={2} vAlign="center">
        <Button label="Sign in" href="/sign-in" variant="ghost" size="sm" />
        <Button label="Sign up" href="/sign-up" variant="primary" size="sm" />
      </HStack>
    );
  }

  return <UserMenuClient name={session.user.name} email={session.user.email} />;
}
