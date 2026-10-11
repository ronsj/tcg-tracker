/** USD dollars (float) → integer cents. Null for missing or non-finite input. */
export function dollarsToCents(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Unix seconds → Date. JustTCG `lastUpdated` can be fractional (e.g. 1744774273.765591). */
export function unixSecondsToDate(s: number | null | undefined): Date | null {
  if (s == null || !Number.isFinite(s)) return null;
  return new Date(Math.round(s * 1000));
}
