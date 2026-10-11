import * as stylex from "@stylexjs/stylex";

const DARK = "@media (prefers-color-scheme: dark)";

export const colors = stylex.defineVars({
  background: { default: "#ffffff", [DARK]: "#0a0a0a" },
  foreground: { default: "#171717", [DARK]: "#ededed" },
  muted: { default: "#666666", [DARK]: "#a1a1a1" },
  border: { default: "#e5e5e5", [DARK]: "#262626" },
  positive: { default: "#15803d", [DARK]: "#4ade80" },
  negative: { default: "#b91c1c", [DARK]: "#f87171" },
  accent: { default: "#171717", [DARK]: "#ededed" },
  accentText: { default: "#ffffff", [DARK]: "#0a0a0a" },
  danger: { default: "#b91c1c", [DARK]: "#f87171" },
  dangerBg: { default: "#fef2f2", [DARK]: "#2a1215" },
  inputBg: { default: "#ffffff", [DARK]: "#111111" },
});

export const fonts = stylex.defineVars({
  sans: "var(--font-geist-sans), system-ui, sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, monospace",
});
