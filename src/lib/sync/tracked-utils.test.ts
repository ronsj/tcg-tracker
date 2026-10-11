import { describe, expect, it } from "vitest";
import type { JustTcgCard } from "@/lib/sources/justtcg";
import { chunk, justTcgShare, matchBatchResponse, nextShare, remainingBudget } from "./tracked-utils";

function jc(tcgplayerId: string | null, name = "card"): JustTcgCard {
  return {
    id: "slug",
    uuid: `uuid-${tcgplayerId}-${name}`,
    name,
    game: "Pokemon",
    set: "set",
    set_name: "Set",
    number: null,
    rarity: null,
    tcgplayerId,
    variants: [],
  };
}

describe("chunk", () => {
  it("splits into batches of the given size", () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    const out = chunk(items, 20);
    expect(out.map((c) => c.length)).toEqual([20, 20, 5]);
    expect(out.flat()).toEqual(items);
  });

  it("handles empty and exact-multiple input", () => {
    expect(chunk([], 20)).toEqual([]);
    expect(chunk(Array.from({ length: 40 }, (_, i) => i), 20)).toHaveLength(2);
  });

  it("rejects invalid sizes", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("matchBatchResponse", () => {
  const requested = [
    { id: "a", tcgplayerProductId: "100" },
    { id: "b", tcgplayerProductId: "200" },
    { id: "c", tcgplayerProductId: "300" },
  ];

  it("matches by tcgplayerId and reports cards missing from the response", () => {
    const { matched, missing } = matchBatchResponse(requested, [jc("300"), jc("100")]);
    expect(matched.map((m) => m.cardId)).toEqual(["a", "c"]);
    expect(missing).toEqual(["b"]);
  });

  it("keeps the first of a card returned twice", () => {
    const first = jc("100", "first");
    const { matched, missing } = matchBatchResponse(requested, [first, jc("100", "second"), jc("200"), jc("300")]);
    expect(matched).toHaveLength(3);
    expect(matched[0].match).toBe(first);
    expect(missing).toEqual([]);
  });

  it("ignores unrequested and id-less response cards", () => {
    const { matched, missing } = matchBatchResponse(requested, [jc("999"), jc(null)]);
    expect(matched).toEqual([]);
    expect(missing).toEqual(["a", "b", "c"]);
  });
});

describe("budget split", () => {
  it("gives JustTCG half, rounded up", () => {
    expect(justTcgShare(40)).toBe(20);
    expect(justTcgShare(5)).toBe(3);
    expect(justTcgShare(1)).toBe(1);
  });

  it("hands unspent JustTCG requests to the next source", () => {
    expect(remainingBudget(40, 7)).toBe(33);
    expect(remainingBudget(40, 50)).toBe(0);
  });

  it("shares a budget across games without overspending", () => {
    let remaining = 5;
    const shares: number[] = [];
    for (let left = 3; left > 0; left--) {
      const s = nextShare(remaining, left);
      shares.push(s);
      remaining -= s;
    }
    expect(shares).toEqual([2, 2, 1]);
    expect(remaining).toBe(0);
    expect(nextShare(0, 2)).toBe(0);
    expect(nextShare(5, 0)).toBe(0);
  });
});
