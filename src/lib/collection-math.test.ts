import { describe, expect, it } from "vitest";
import { gainCents, isValidQuantity, unitValueCents } from "./collection-math";

describe("unitValueCents", () => {
  it("prefers the current price, then last known", () => {
    expect(unitValueCents(500, 400)).toBe(500);
    expect(unitValueCents(null, 400)).toBe(400);
    expect(unitValueCents(null, null)).toBeNull();
    expect(unitValueCents(0, 400)).toBe(0);
  });
});

describe("gainCents", () => {
  it("is null without a cost basis", () => {
    expect(gainCents(1000, null)).toBeNull();
  });

  it("subtracts cost from value", () => {
    expect(gainCents(1500, 1000)).toBe(500);
    expect(gainCents(500, 1000)).toBe(-500);
  });
});

describe("isValidQuantity", () => {
  it("accepts safe integers, including zero and negatives", () => {
    expect(isValidQuantity(0)).toBe(true);
    expect(isValidQuantity(3)).toBe(true);
    expect(isValidQuantity(-1)).toBe(true);
  });

  it("rejects fractions, NaN, huge and non-numbers", () => {
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(NaN)).toBe(false);
    expect(isValidQuantity(Infinity)).toBe(false);
    expect(isValidQuantity(1e9)).toBe(false);
    expect(isValidQuantity("2")).toBe(false);
  });
});
