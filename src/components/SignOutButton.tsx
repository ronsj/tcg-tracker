"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as stylex from "@stylexjs/stylex";
import { colors } from "@/app/tokens.stylex";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
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
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      {...stylex.props(styles.button, pending && styles.disabled)}
    >
      Sign out
    </button>
  );
}

const styles = stylex.create({
  button: {
    paddingBlock: 4,
    paddingInline: 10,
    fontFamily: "inherit",
    fontSize: 14,
    color: colors.foreground,
    cursor: "pointer",
    backgroundColor: "transparent",
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 6,
  },
  disabled: {
    cursor: "default",
    opacity: 0.6,
  },
});
