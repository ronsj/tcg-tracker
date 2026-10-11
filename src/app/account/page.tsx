import type { Metadata } from "next";
import { Suspense } from "react";
import * as stylex from "@stylexjs/stylex";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { colors } from "../tokens.stylex";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<p {...stylex.props(styles.main, styles.muted)}>Loading…</p>}>
      <AccountDetails />
    </Suspense>
  );
}

async function AccountDetails() {
  const { user } = await requireSession();

  return (
    <main {...stylex.props(styles.main)}>
      <h1 {...stylex.props(styles.title)}>Account</h1>
      <p>{user.name}</p>
      <p {...stylex.props(styles.muted)}>{user.email}</p>
      <p {...stylex.props(styles.muted)}>Member since {formatDate(user.createdAt)}</p>
    </main>
  );
}

const styles = stylex.create({
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxWidth: 480,
    padding: 32,
    marginInline: "auto",
  },
  title: {
    fontSize: 32,
    fontWeight: 600,
  },
  muted: {
    color: colors.muted,
  },
});
