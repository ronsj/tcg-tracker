import type { Metadata } from "next";
import * as stylex from "@stylexjs/stylex";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SigninPage() {
  return (
    <main {...stylex.props(styles.main)}>
      <h1 {...stylex.props(styles.title)}>Sign in</h1>
      <AuthForm mode="sign-in" />
    </main>
  );
}

const styles = stylex.create({
  main: {
    display: "flex",
    flexDirection: "column",
    maxWidth: 400,
    padding: 32,
    marginInline: "auto",
  },
  title: {
    fontSize: 32,
    fontWeight: 600,
  },
});
