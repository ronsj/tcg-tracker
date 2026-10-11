import { describe, expect, it } from "vitest";
import type { JustTcgCard, JustTcgVariant } from "@/lib/sources/justtcg";
import { mapJustTcgCard } from "./justtcg-mapping";

function variant(overrides: Partial<JustTcgVariant> = {}): JustTcgVariant {
  return {
    id: "slug",
    uuid: "71622e07-a7ae-5e9d-8a3f-3fb2866ab706",
    condition: "Near Mint",
    printing: "Foil",
    language: "English",
    tcgplayerSkuId: "8927112",
    price: 2.79,
    lastUpdated: 1791659878,
    priceStatus: "current",
    lastKnownPrice: null,
    priceChange24hr: -0.36,
    priceChange7d: -9.42,
    priceChange30d: -1.76,
    priceChange90d: 5.28,
    priceHistory: null,
    ...overrides,
  };
}

function card(variants: JustTcgVariant[], overrides: Partial<JustTcgCard> = {}): JustTcgCard {
  return {
    id: "slug",
    uuid: "11111111-1111-4111-8111-111111111111",
    name: "Jinx, Rebel",
    game: "Riftbound",
    set: "origins",
    set_name: "Origins",
    number: "1/298",
    rarity: "Epic",
    tcgplayerId: "652993",
    variants,
    ...overrides,
  };
}

describe("mapJustTcgCard", () => {
  it("maps prices to cents and dates", () => {
    const { variants } = mapJustTcgCard(card([variant()]));
    expect(variants).toEqual([
      {
        printing: "Foil",
        condition: "NM",
        language: "English",
        justtcgVariantId: "71622e07-a7ae-5e9d-8a3f-3fb2866ab706",
        tcgplayerSkuId: "8927112",
        price: {
          priceCents: 279,
          priceStatus: "current",
          lastKnownPriceCents: null,
          change24hPct: -0.36,
          change7dPct: -9.42,
          change30dPct: -1.76,
          change90dPct: 5.28,
          observedAt: new Date(1791659878 * 1000),
        },
      },
    ]);
  });

  it("skips sealed products", () => {
    const { variants } = mapJustTcgCard(card([variant({ condition: "Sealed" })]));
    expect(variants).toEqual([]);
  });

  it("defaults a missing language to English", () => {
    const { variants } = mapJustTcgCard(card([variant({ language: undefined })]));
    expect(variants[0].language).toBe("English");
  });

  it("keeps the first of duplicate (printing, condition, language) variants", () => {
    const { variants } = mapJustTcgCard(
      card([variant({ uuid: "first" }), variant({ uuid: "second" })]),
    );
    expect(variants).toHaveLength(1);
    expect(variants[0].justtcgVariantId).toBe("first");
  });

  it("keeps variants that differ in language", () => {
    const { variants } = mapJustTcgCard(
      card([variant({ uuid: "en" }), variant({ uuid: "ja", language: "Japanese" })]),
    );
    expect(variants.map((v) => v.language)).toEqual(["English", "Japanese"]);
  });

  it("maps an expired variant to a null price with the last known price", () => {
    const { variants } = mapJustTcgCard(
      card([variant({ price: null, priceStatus: "expired", lastKnownPrice: 4.5 })]),
    );
    expect(variants[0].price.priceCents).toBeNull();
    expect(variants[0].price.priceStatus).toBe("expired");
    expect(variants[0].price.lastKnownPriceCents).toBe(450);
  });

  it("maps a missing observation time and changes to null", () => {
    const { variants } = mapJustTcgCard(
      card([variant({ lastUpdated: null, priceChange24hr: undefined })]),
    );
    expect(variants[0].price.observedAt).toBeNull();
    expect(variants[0].price.change24hPct).toBeNull();
  });

  it("includes valid scryfall and mtgjson IDs in the card patch", () => {
    const scryfallId = "22222222-2222-4222-8222-222222222222";
    const mtgjsonId = "33333333-3333-4333-8333-333333333333";
    const { cardPatch } = mapJustTcgCard(card([], { scryfallId, mtgjsonId }));
    expect(cardPatch).toEqual({
      justtcgCardId: "11111111-1111-4111-8111-111111111111",
      scryfallId,
      mtgjsonId,
    });
  });

  it("omits invalid or missing scryfall and mtgjson IDs", () => {
    const { cardPatch } = mapJustTcgCard(card([], { scryfallId: "nope", mtgjsonId: null }));
    expect(cardPatch).toEqual({ justtcgCardId: "11111111-1111-4111-8111-111111111111" });
    expect("scryfallId" in cardPatch).toBe(false);
    expect("mtgjsonId" in cardPatch).toBe(false);
  });
});
