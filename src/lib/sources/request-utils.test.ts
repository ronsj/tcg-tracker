import { describe, expect, it } from "vitest";
import { buildUrl, cacheKey } from "./request-utils";

describe("buildUrl", () => {
  it("skips undefined, joins arrays and stringifies booleans and numbers", () => {
    const url = new URL(
      buildUrl("justtcg", "/cards", {
        q: "Charizard ex",
        game: "pokemon",
        condition: ["NM", "LP"],
        include_price_history: false,
        limit: 5,
        set: undefined,
      }),
    );
    expect(url.origin + url.pathname).toBe("https://api.justtcg.com/v1/cards");
    expect(url.searchParams.get("q")).toBe("Charizard ex");
    expect(url.searchParams.get("condition")).toBe("NM,LP");
    expect(url.searchParams.get("include_price_history")).toBe("false");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.has("set")).toBe(false);
  });

  it("uses the TCG API base URL and no query string when empty", () => {
    expect(buildUrl("tcgapi", "/games")).toBe("https://api.tcgapi.dev/v1/games");
  });
});

describe("cacheKey", () => {
  const base = { source: "tcgapi", path: "/search", query: { q: "pikachu", page: 1 } } as const;

  it("is a sha256 hex digest", () => {
    expect(cacheKey(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores query key order and undefined values", () => {
    const reordered = { ...base, query: { page: 1, game: undefined, q: "pikachu" } };
    expect(cacheKey(reordered)).toBe(cacheKey(base));
  });

  it("treats a default GET the same as an explicit GET", () => {
    expect(cacheKey({ ...base, method: "GET" })).toBe(cacheKey(base));
  });

  it("differs by source, path, query and body", () => {
    const key = cacheKey(base);
    expect(cacheKey({ ...base, source: "justtcg" })).not.toBe(key);
    expect(cacheKey({ ...base, path: "/sets" })).not.toBe(key);
    expect(cacheKey({ ...base, query: { q: "raichu", page: 1 } })).not.toBe(key);
    expect(cacheKey({ ...base, method: "POST", body: [1] })).not.toBe(
      cacheKey({ ...base, method: "POST", body: [2] }),
    );
  });
});
