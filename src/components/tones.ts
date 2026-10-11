import * as stylex from "@stylexjs/stylex";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";

// Text has no error/positive/negative color prop, so these are the only xstyle overrides.
export const tones = stylex.create({
  up: { color: colorVars["--color-text-green"] },
  down: { color: colorVars["--color-text-red"] },
  error: { color: colorVars["--color-text-red"] },
});

export function changeTone(n: number | null) {
  if (n == null || n === 0) return undefined;
  return n > 0 ? tones.up : tones.down;
}
