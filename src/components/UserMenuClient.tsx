"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@astryxdesign/core/Avatar";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { signOut } from "@/lib/auth-client";

// Signed-in controls collapse into an avatar menu so they fit the top bar at phone width,
// where an email + button would overlap AppShell's nav toggle.
export function UserMenuClient({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSignOut() {
    setPending(true);
    const { error } = await signOut();
    if (error) {
      setPending(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu
      renderTrigger={(props) => <Avatar {...props} name={name || email} size="sm" tooltip={email} />}
      hasChevron={false}
      placement="below"
      alignment="end"
      menuWidth={220}
      items={[
        { type: "section", title: email, items: [{ label: "Account", href: "/account" }] },
        { type: "divider" },
        { label: pending ? "Signing out…" : "Sign out", onClick: onSignOut, isDisabled: pending },
      ]}
    />
  );
}
