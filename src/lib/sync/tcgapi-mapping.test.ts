import { describe, expect, it } from "vitest";
import type { TcgApiSet, TcgApiSetCardRow } from "@/lib/sources/tcgapi";
import { mapSetCardRows, mapSetRow } from "./tcgapi-mapping";

const ctx = { gameId: "riftbound", setId: "set-uuid" };

function row(overrides: Partial<TcgApiSetCardRow> = {}): TcgApiSetCardRow {
  return {
    id: 790766,
    name: "Teemo, Swift Scout",
    number: "263a/298",
    rarity: "Promo",
    tcgplayer_id: 670598,
    product_type: "Cards",
    printing: "Normal",
    market_price: 12.34,
    market_price_as_of: "2026-10-11",
    low_price: 9.99,
    median_price: 13,
    lowest_with_shipping: 11.5,
    total_listings: 26,
    image_url: "https://example.com/670598.jpg",
    ...overrides,
  };
}

describe("mapSetRow", () => {
  it("maps a set listing row", () => {
    const set: TcgApiSet = {
      id: 500001,
      name: "Origins",
      slug: "origins",
      tcgplayer_id: 500001,
      abbreviation: null,
      release_date: "2025-10-31",
      card_count: 364,
      image_url: null,
      set_icon_url: null,
    };
    expect(mapSetRow(set, "riftbound")).toEqual({
      gameId: "riftbound",
      name: "Origins",
      code: null,
      releaseDate: "2025-10-31",
      cardCount: 364,
      tcgapiSetId: "500001",
    });
  });
});

describe("mapSetCardRows", () => {
  it("drops sealed products", () => {
    const { cards, prices } = mapSetCardRows(
      [row(), row({ id: 1, tcgplayer_id: 2, product_type: "Sealed Products" })],
      ctx,
    );
    expect(cards).toHaveLength(1);
    expect(prices).toHaveLength(1);
  });

  it("collapses a card listed as Normal and Foil into one card with two prices", () => {
    const { cards, prices } = mapSetCardRows(
      [row({ printing: "Normal" }), row({ printing: "Foil", market_price: 40 })],
      ctx,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      gameId: "riftbound",
      setId: "set-uuid",
      tcgplayerProductId: "670598",
      tcgapiCardId: "790766",
    });
    expect(prices.map((p) => [p.tcgapiCardId, p.printing, p.marketCents])).toEqual([
      ["790766", "Normal", 1234],
      ["790766", "Foil", 4000],
    ]);
  });

  it("dedupes an exact repeat of the same printing", () => {
    const { prices } = mapSetCardRows([row(), row()], ctx);
    expect(prices).toHaveLength(1);
  });

  it("maps rarity None and empty to null", () => {
    const { cards } = mapSetCardRows(
      [row({ rarity: "None" }), row({ id: 2, tcgplayer_id: 2, rarity: "" })],
      ctx,
    );
    expect(cards.map((c) => c.rarity)).toEqual([null, null]);
  });

  it("converts dollars to cents", () => {
    const [price] = mapSetCardRows([row()], ctx).prices;
    expect(price).toMatchObject({
      marketCents: 1234,
      lowCents: 999,
      medianCents: 1300,
      lowestWithShippingCents: 1150,
      totalListings: 26,
      marketAsOf: "2026-10-11",
    });
  });

  it("keeps null prices as null", () => {
    const [price] = mapSetCardRows(
      [
        row({
          market_price: null,
          low_price: undefined,
          median_price: null,
          lowest_with_shipping: null,
          market_price_as_of: null,
          total_listings: null,
        }),
      ],
      ctx,
    ).prices;
    expect(price).toMatchObject({
      marketCents: null,
      lowCents: null,
      medianCents: null,
      lowestWithShippingCents: null,
      totalListings: null,
      marketAsOf: null,
    });
  });
});
