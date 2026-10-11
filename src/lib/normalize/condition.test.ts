import { describe, expect, it } from "vitest";
import { CONDITION_LABELS, normalizeCondition } from "./condition";

describe("normalizeCondition", () => {
  it("maps full names and abbreviations", () => {
    expect(normalizeCondition("Near Mint")).toBe("NM");
    expect(normalizeCondition("NM")).toBe("NM");
    expect(normalizeCondition("Lightly Played")).toBe("LP");
    expect(normalizeCondition("LP")).toBe("LP");
    expect(normalizeCondition("Moderately Played")).toBe("MP");
    expect(normalizeCondition("MP")).toBe("MP");
    expect(normalizeCondition("Heavily Played")).toBe("HP");
    expect(normalizeCondition("HP")).toBe("HP");
    expect(normalizeCondition("Damaged")).toBe("DMG");
    expect(normalizeCondition("DMG")).toBe("DMG");
  });

  it("ignores case, outer whitespace and repeated inner whitespace", () => {
    expect(normalizeCondition("  near   MINT ")).toBe("NM");
    expect(normalizeCondition("lp")).toBe("LP");
    expect(normalizeCondition("heavily\tplayed")).toBe("HP");
  });

  it("returns null for sealed, unknown and empty input", () => {
    expect(normalizeCondition("Sealed")).toBeNull();
    expect(normalizeCondition("S")).toBeNull();
    expect(normalizeCondition("Mint")).toBeNull();
    expect(normalizeCondition("")).toBeNull();
    expect(normalizeCondition(null)).toBeNull();
    expect(normalizeCondition(undefined)).toBeNull();
  });

  it("round-trips through CONDITION_LABELS", () => {
    for (const [code, label] of Object.entries(CONDITION_LABELS)) {
      expect(normalizeCondition(label)).toBe(code);
    }
  });
});
