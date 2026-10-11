import Link from "next/link";
import { Suspense } from "react";
import * as stylex from "@stylexjs/stylex";
import { colors } from "@/app/tokens.stylex";
import { getSession } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";

export function SiteHeader() {
  return (
    <header {...stylex.props(styles.header)}>
      <nav {...stylex.props(styles.nav)}>
        <Link href="/" {...stylex.props(styles.brand)}>
          TCG Tracker
        </Link>
        <Suspense fallback={<span />}>
          <UserMenu />
        </Suspense>
      </nav>
    </header>
  );
}

// Reading the session touches request headers, so it stays behind Suspense.
async function UserMenu() {
  const session = await getSession();

  if (!session) {
    return (
      <div {...stylex.props(styles.menu)}>
        <Link href="/sign-in" {...stylex.props(styles.link)}>
          Sign in
        </Link>
        <Link href="/sign-up" {...stylex.props(styles.link)}>
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.menu)}>
      <Link href="/account" {...stylex.props(styles.link, styles.email)}>
        {session.user.email}
      </Link>
      <SignOutButton />
    </div>
  );
}

const styles = stylex.create({
  header: {
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
  },
  nav: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 960,
    paddingBlock: 12,
    paddingInline: 32,
    marginInline: "auto",
  },
  brand: {
    fontWeight: 600,
  },
  menu: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    minWidth: 0,
  },
  link: {
    fontSize: 14,
    color: colors.muted,
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
  },
  email: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
