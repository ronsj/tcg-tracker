/** Price used to value a holding: current, else last known, else nothing. */
export function unitValueCents(
  priceCents: number | null,
  lastKnownPriceCents: number | null,
): number | null {
  return priceCents ?? lastKnownPriceCents;
}

/** Total gain/loss in cents, or null when no cost basis was recorded. */
export function gainCents(valueCents: number, costCents: number | null): number | null {
  return costCents == null ? null : valueCents - costCents;
}

/** Whole-number-safe quantity check for server actions. */
export function isValidQuantity(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n <= 100_000;
}
