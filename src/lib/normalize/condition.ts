import type { CardCondition } from "@/db/schema";

const CONDITION_ALIASES: Record<string, CardCondition> = {
  "near mint": "NM",
  nm: "NM",
  "lightly played": "LP",
  lp: "LP",
  "moderately played": "MP",
  mp: "MP",
  "heavily played": "HP",
  hp: "HP",
  damaged: "DMG",
  dmg: "DMG",
};

/** Full English names, for UI. */
export const CONDITION_LABELS: Record<CardCondition, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

/**
 * Maps a source's condition string to our enum. Returns null for anything we
 * don't track as a card condition, including "Sealed" / "S" (sealed product).
 */
export function normalizeCondition(input: string | null | undefined): CardCondition | null {
  if (!input) return null;
  const key = input.trim().replace(/\s+/g, " ").toLowerCase();
  return CONDITION_ALIASES[key] ?? null;
}
