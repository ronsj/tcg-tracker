import * as stylex from "@stylexjs/stylex";

const DARK = "@media (prefers-color-scheme: dark)";

export const colors = stylex.defineVars({
  background: { default: "#ffffff", [DARK]: "#0a0a0a" },
  foreground: { default: "#171717", [DARK]: "#ededed" },
  muted: { default: "#666666", [DARK]: "#a1a1a1" },
});

export const fonts = stylex.defineVars({
  sans: "var(--font-geist-sans), system-ui, sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, monospace",
});
