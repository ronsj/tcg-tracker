"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as stylex from "@stylexjs/stylex";
import { colors } from "@/app/tokens.stylex";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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

  return (
    <>
      <form onSubmit={onSubmit} {...stylex.props(styles.form)}>
        {isSignUp && (
          <div {...stylex.props(styles.field)}>
            <label htmlFor="name" {...stylex.props(styles.label)}>
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              {...stylex.props(styles.input)}
            />
          </div>
        )}
        <div {...stylex.props(styles.field)}>
          <label htmlFor="email" {...stylex.props(styles.label)}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            {...stylex.props(styles.input)}
          />
        </div>
        <div {...stylex.props(styles.field)}>
          <label htmlFor="password" {...stylex.props(styles.label)}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            required
            {...stylex.props(styles.input)}
          />
        </div>
        {error && (
          <p role="alert" {...stylex.props(styles.error)}>
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} {...stylex.props(styles.button, pending && styles.disabled)}>
          {pending ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
        </button>
      </form>
      <p {...stylex.props(styles.switch)}>
        {isSignUp ? (
          <>
            Have an account? <Link href="/sign-in" {...stylex.props(styles.link)}>Sign in</Link>
          </>
        ) : (
          <>
            No account? <Link href="/sign-up" {...stylex.props(styles.link)}>Sign up</Link>
          </>
        )}
      </p>
    </>
  );
}

const styles = stylex.create({
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginTop: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    paddingBlock: 8,
    paddingInline: 12,
    fontFamily: "inherit",
    fontSize: 16,
    color: colors.foreground,
    outline: "none",
    backgroundColor: colors.inputBg,
    borderColor: {
      default: colors.border,
      ":focus-visible": colors.accent,
    },
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 6,
  },
  error: {
    paddingBlock: 8,
    paddingInline: 12,
    fontSize: 14,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 6,
  },
  button: {
    paddingBlock: 10,
    paddingInline: 16,
    fontFamily: "inherit",
    fontSize: 16,
    fontWeight: 500,
    color: colors.accentText,
    cursor: "pointer",
    backgroundColor: colors.accent,
    borderStyle: "none",
    borderRadius: 6,
  },
  disabled: {
    cursor: "default",
    opacity: 0.6,
  },
  switch: {
    marginTop: 16,
    fontSize: 14,
    color: colors.muted,
  },
  link: {
    color: colors.foreground,
    textDecoration: "underline",
  },
});
