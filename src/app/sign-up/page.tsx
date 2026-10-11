import type { Metadata } from "next";
import * as stylex from "@stylexjs/stylex";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <main {...stylex.props(styles.main)}>
      <h1 {...stylex.props(styles.title)}>Sign up</h1>
      <AuthForm mode="sign-up" />
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
