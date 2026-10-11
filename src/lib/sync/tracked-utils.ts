import type { JustTcgCard } from "@/lib/sources/justtcg";

// Pure helpers for the tracked-card price refresh (no DB, no network).

/** Split into consecutive chunks of at most `size` items. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error(`chunk: invalid size ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface TrackedCard {
  id: string;
  tcgplayerProductId: string;
}

/**
 * Pair a batch response with the cards we asked for, by TCGplayer product ID.
 * A product returned twice keeps its first entry; requested cards that never
 * came back are reported as missing, and unrequested response cards are ignored.
 */
export function matchBatchResponse(requested: readonly TrackedCard[], returned: readonly JustTcgCard[]) {
  const byProductId = new Map<string, JustTcgCard>();
  for (const c of returned) {
    if (c.tcgplayerId && !byProductId.has(c.tcgplayerId)) byProductId.set(c.tcgplayerId, c);
  }
  const matched: { cardId: string; match: JustTcgCard }[] = [];
  const missing: string[] = [];
  for (const r of requested) {
    const match = byProductId.get(r.tcgplayerProductId);
    if (match) matched.push({ cardId: r.id, match });
    else missing.push(r.id);
  }
  return { matched, missing };
}

/** JustTCG goes first and is cheaper per card, so it may take up to half (rounded up). */
export function justTcgShare(totalRequests: number): number {
  return Math.ceil(totalRequests / 2);
}

/** Whatever the first source left unspent goes to the next one. */
export function remainingBudget(totalRequests: number, used: number): number {
  return Math.max(0, totalRequests - used);
}

/** Even share of `remaining` for the next of `partsLeft` consumers (earlier ones round up). */
export function nextShare(remaining: number, partsLeft: number): number {
  if (partsLeft < 1) return 0;
  return Math.ceil(Math.max(0, remaining) / partsLeft);
}
