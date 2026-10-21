import { sourceFetch } from "./http";

const DAY = 24 * 60 * 60;
/** Documented max is 100 or 200 depending on the page; stay at the lower one. */
const MAX_PER_PAGE = 100;

type Id = string | number;

export interface TcgApiGame {
  id: number;
  name: string;
  slug: string;
  tcgplayer_id: number;
  /** 3 = refreshed daily, 2 = every 3 days */
  priority: number;
  set_count: number;
  card_count: number;
  image_tcgplayer_id: number | null;
  last_synced_at: string | null;
  image_url: string | null;
  logo_url: string | null;
}

export interface TcgApiSet {
  id: number;
  name: string;
  slug: string;
  tcgplayer_id: number;
  abbreviation: string | null;
  /** ISO date */
  release_date: string | null;
  card_count: number;
  image_tcgplayer_id?: number | null;
  tcg_group_id?: number | null;
  image_url: string | null;
  set_icon_url: string | null;
  /** Not present on the per-game set listing */
  game_name?: string;
  game_slug?: string;
}

export interface TcgApiCard {
  id: number;
  name: string;
  clean_name: string;
  number: string | null;
  rarity: string | null;
  image_url: string | null;
  tcgplayer_id: number;
  tcgplayer_url: string | null;
  /** "Cards" or "Sealed Products" */
  product_type: string;
  /** 0 or 1 in practice */
  foil_only: boolean | number;
  total_listings: number;
  shipping_category_id: number;
  product_status_id: number;
  /** Game-specific extras (HP, attacks, mana cost, ...) */
  custom_attributes: Record<string, unknown> | null;
  game_name: string;
  game_slug: string;
  set_name: string;
  set_slug: string;
  /** Set ID, as used by the list/search responses */
  set_id?: number;
  game_id?: number;
}

/** Prices per printing, in USD. */
export interface TcgApiPrice {
  card_id: number;
  /** "Normal" or "Foil" */
  printing: string;
  market_price: number | null;
  low_price: number | null;
  median_price: number | null;
  lowest_with_shipping: number | null;
  buylist_price: number | null;
  /** UTC date (YYYY-MM-DD) of the market price */
  market_price_as_of: string | null;
  price_change_24h: number | null;
  price_change_7d: number | null;
  price_change_30d: number | null;
  last_updated_at: string;
}

export interface TcgApiPriceHistory {
  /** ISO date */
  date: string;
  printing: string;
  market_price: number | null;
  low_price: number | null;
}

export interface TcgApiMeta {
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface TcgApiEnvelope<T> {
  data: T;
  meta?: TcgApiMeta;
  rate_limit?: { daily_limit: number; daily_remaining: number; daily_reset: string };
}

interface PageParams {
  page?: number;
  perPage?: number;
}

function pageQuery({ page, perPage }: PageParams) {
  return {
    page,
    per_page: perPage === undefined ? undefined : Math.min(perPage, MAX_PER_PAGE),
  };
}

export function listGames(params: PageParams = {}) {
  return sourceFetch<TcgApiEnvelope<TcgApiGame[]>>({
    source: "tcgapi",
    path: "/games",
    query: pageQuery(params),
    cacheTtlSeconds: 7 * DAY,
  });
}

export function listSets(params: PageParams & { game?: string } = {}) {
  return sourceFetch<TcgApiEnvelope<TcgApiSet[]>>({
    source: "tcgapi",
    path: "/sets",
    query: { game: params.game, ...pageQuery(params) },
    cacheTtlSeconds: DAY,
  });
}

/** Public endpoint, but it still goes through sourceFetch so it is counted against the quota. */
export function listGameSets(slug: string, params: PageParams = {}) {
  return sourceFetch<TcgApiEnvelope<TcgApiSet[]>>({
    source: "tcgapi",
    path: `/games/${slug}/sets`,
    query: pageQuery(params),
    cacheTtlSeconds: DAY,
  });
}

/**
 * A row from GET /sets/:id/cards: card fields plus one printing's prices, flattened.
 * A card with several printings appears once per printing, and sealed products can
 * come back even when `type` is "Cards", so check `product_type`.
 */
export interface TcgApiSetCardRow {
  id: number;
  name: string;
  clean_name?: string | null;
  number?: string | null;
  /** "None" when the card has no rarity */
  rarity?: string | null;
  tcgplayer_id: number;
  /** "Cards" or "Sealed Products" */
  product_type: string;
  foil_only?: boolean | number;
  total_listings?: number | null;
  shipping_category_id?: number | null;
  /** "Normal" or "Foil"; null on unlisted cards that have no price */
  printing: string | null;
  market_price?: number | null;
  /** UTC date (YYYY-MM-DD) */
  market_price_as_of?: string | null;
  low_price?: number | null;
  median_price?: number | null;
  lowest_with_shipping?: number | null;
  price_updated_at?: string | null;
  image_url?: string | null;
}

export function getSetCards(
  setId: Id,
  params: PageParams & { type?: "Cards" | "Sealed Products" } = {},
) {
  return sourceFetch<TcgApiEnvelope<TcgApiSetCardRow[]>>({
    source: "tcgapi",
    path: `/sets/${setId}/cards`,
    query: { type: params.type, ...pageQuery(params) },
  });
}

export function getCard(id: Id) {
  return sourceFetch<TcgApiEnvelope<TcgApiCard>>({ source: "tcgapi", path: `/cards/${id}` });
}

export function getCardByTcgplayerId(tcgplayerId: Id) {
  return sourceFetch<TcgApiEnvelope<TcgApiCard & { prices: TcgApiPrice[] }>>({
    source: "tcgapi",
    path: `/cards/tcgplayer/${tcgplayerId}`,
  });
}

export function getCardPrices(id: Id, params: { printing?: string } = {}) {
  return sourceFetch<TcgApiEnvelope<TcgApiPrice[]>>({
    source: "tcgapi",
    path: `/cards/${id}/prices`,
    query: params,
  });
}

/**
 * Daily market/low price history. The free tier only sees the last 7 days whatever
 * `range` is. Sales volume lives in /history/detailed (Pro+), which isn't implemented.
 */
export function getCardHistory(
  id: Id,
  params: { range?: "month" | "quarter" | "year" | "all"; printing?: string } = {},
) {
  return sourceFetch<TcgApiEnvelope<TcgApiPriceHistory[]>>({
    source: "tcgapi",
    path: `/cards/${id}/history`,
    query: params,
  });
}

export function search(
  params: PageParams & {
    /** Min 2 characters */
    q: string;
    game?: string;
    setId?: Id;
    type?: "Cards" | "Sealed Products";
    printing?: string;
    rarity?: string;
    sort?: "relevance" | "price_asc" | "price_desc" | "name";
  },
) {
  return sourceFetch<TcgApiEnvelope<TcgApiCard[]>>({
    source: "tcgapi",
    path: "/search",
    query: {
      q: params.q,
      game: params.game,
      set_id: params.setId,
      type: params.type,
      printing: params.printing,
      rarity: params.rarity,
      sort: params.sort,
      ...pageQuery(params),
    },
    cacheTtlSeconds: DAY,
  });
}
