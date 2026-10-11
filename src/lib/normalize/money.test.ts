import { describe, expect, it } from "vitest";
import { dollarsToCents, unixSecondsToDate } from "./money";

describe("dollarsToCents", () => {
  it("rounds to integer cents", () => {
    expect(dollarsToCents(31.22)).toBe(3122);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(0)).toBe(0);
  });

  it("returns null for missing or non-finite values", () => {
    expect(dollarsToCents(null)).toBeNull();
    expect(dollarsToCents(undefined)).toBeNull();
    expect(dollarsToCents(NaN)).toBeNull();
    expect(dollarsToCents(Infinity)).toBeNull();
  });
});

describe("unixSecondsToDate", () => {
  it("converts whole and fractional seconds", () => {
    expect(unixSecondsToDate(1744774273)?.toISOString()).toBe("2025-04-16T03:31:13.000Z");
    expect(unixSecondsToDate(1744774273.765591)?.toISOString()).toBe("2025-04-16T03:31:13.766Z");
  });

  it("returns null for missing or non-finite values", () => {
    expect(unixSecondsToDate(null)).toBeNull();
    expect(unixSecondsToDate(undefined)).toBeNull();
    expect(unixSecondsToDate(NaN)).toBeNull();
  });
});
