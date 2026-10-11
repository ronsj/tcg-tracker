import { sourceFetch } from "./http";

const DAY = 24 * 60 * 60;

export interface JustTcgGame {
  id: string;
  name: string;
  cards_count: number;
  variants_count: number;
  sealed_count: number;
  sets_count: number;
  /** Unix seconds */
  last_updated: number;
  game_value_index_cents: number;
  game_value_change_7d_pct: number | null;
  game_value_change_30d_pct: number | null;
  game_value_change_90d_pct: number | null;
}

export interface JustTcgSet {
  id: string;
  name: string;
  game_id: string;
  game: string;
  cards_count: number;
  variants_count: number;
  sealed_count: number;
  /** ISO 8601 */
  release_date: string | null;
  set_value_usd: number | null;
  set_value_change_7d_pct: number | null;
  set_value_change_30d_pct: number | null;
  set_value_change_90d_pct: number | null;
}

export interface JustTcgPricePoint {
  /** Price in USD */
  p: number;
  /** Unix seconds */
  t: number;
}

export interface JustTcgVariant {
  /** Legacy human-readable slug */
  id: string;
  /** Stable UUID; prefer this */
  uuid: string;
  /** "Near Mint", "Lightly Played", ..., or "Sealed" */
  condition: string;
  printing: string;
  /** Omitted for English */
  language?: string;
  tcgplayerSkuId?: string | null;
  /** USD; null when unpriced or expired */
  price: number | null;
  /** Unix seconds, possibly fractional */
  lastUpdated: number | null;
  priceStatus: "current" | "expired" | "unpriced";
  lastKnownPrice: number | null;
  priceChange24hr?: number | null;
  priceChange7d?: number | null;
  priceChange30d?: number | null;
  priceChange90d?: number | null;
  /** null when `include_price_history=false` */
  priceHistory?: JustTcgPricePoint[] | null;
  /** Present when `include_statistics` is set; shape is not documented in detail. */
  statistics?: Record<string, unknown>;
}

export interface JustTcgCard {
  /** Legacy human-readable slug */
  id: string;
  /** Stable UUID; prefer this */
  uuid: string;
  name: string;
  /** Game display name, e.g. "Pokemon" */
  game: string;
  /** Set slug */
  set: string;
  set_name: string;
  number: string | null;
  rarity: string | null;
  tcgplayerId: string | null;
  scryfallId?: string | null;
  mtgjsonId?: string | null;
  details?: unknown;
  variants: JustTcgVariant[];
}

export interface JustTcgPageMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface JustTcgEnvelope<T> {
  data: T;
  meta?: JustTcgPageMeta;
  _metadata?: {
    apiPlan: string;
    apiRequestLimit: number;
    apiDailyLimit: number;
    apiRateLimit: number;
    apiRequestsUsed: number;
    apiDailyRequestsUsed: number;
    /** Monthly */
    apiRequestsRemaining: number;
    apiDailyRequestsRemaining: number;
  };
}

export function listGames() {
  return sourceFetch<JustTcgEnvelope<JustTcgGame[]>>({
    source: "justtcg",
    path: "/games",
    cacheTtlSeconds: 7 * DAY,
  });
}

export function listSets(params: {
  game: string;
  q?: string;
  orderBy?: "name" | "release_date";
  order?: "asc" | "desc";
}) {
  return sourceFetch<JustTcgEnvelope<JustTcgSet[]>>({
    source: "justtcg",
    path: "/sets",
    query: params,
    cacheTtlSeconds: DAY,
  });
}

export interface GetCardsParams {
  // Lookups by ID (take precedence over `q`)
  cardId?: string;
  variantId?: string;
  tcgplayerId?: string;
  mtgjsonId?: string;
  scryfallId?: string;
  /** Ignores condition/printing filters */
  tcgplayerSkuId?: string;
  // Search / browse
  q?: string;
  game?: string;
  set?: string;
  number?: string;
  /** Names or abbreviations: "NM", "Near Mint", "S", ... */
  condition?: string[];
  printing?: string;
  /** Unix seconds. Cannot be combined with `q`. */
  updated_after?: number;
  priceHistoryDuration?: "7d" | "30d" | "90d" | "180d" | "1y";
  include_price_history?: boolean;
  /** Timeframes, e.g. ["7d", "30d", "allTime"] */
  include_statistics?: string[];
  include_null_prices?: boolean;
  orderBy?: "price" | "24h" | "7d" | "30d" | "90d";
  order?: "asc" | "desc";
  /** Free tier max is 20 */
  limit?: number;
  offset?: number;
}

/**
 * Only searches (`q`) are cached: the same query is likely to repeat. ID lookups and
 * browsing are not cached here, since their results land in the normalized tables.
 */
export function getCards(params: GetCardsParams) {
  return sourceFetch<JustTcgEnvelope<JustTcgCard[]>>({
    source: "justtcg",
    path: "/cards",
    query: { ...params },
    cacheTtlSeconds: params.q ? DAY : undefined,
  });
}

/** Free tier maximum items per POST /cards. */
export const JUSTTCG_BATCH_LIMIT = 20;

export type JustTcgBatchItem = {
  condition?: string;
  printing?: string;
} & (
  | { cardId: string }
  | { variantId: string }
  | { tcgplayerId: string }
  | { mtgjsonId: string }
  | { scryfallId: string }
  | { tcgplayerSkuId: string }
);

const BATCH_ID_KEYS = [
  "cardId",
  "variantId",
  "tcgplayerId",
  "mtgjsonId",
  "scryfallId",
  "tcgplayerSkuId",
];

/** POST /cards: look up several cards/variants in one request (one quota unit). */
export function batchCards(items: JustTcgBatchItem[]) {
  if (items.length === 0) throw new Error("batchCards: no items");
  if (items.length > JUSTTCG_BATCH_LIMIT) {
    throw new Error(`batchCards: ${items.length} items exceeds the limit of ${JUSTTCG_BATCH_LIMIT}`);
  }
  for (const item of items) {
    const ids = BATCH_ID_KEYS.filter((k) => (item as Record<string, unknown>)[k] !== undefined);
    if (ids.length !== 1) {
      throw new Error(`batchCards: each item needs exactly one identifier, got ${ids.length}`);
    }
  }
  return sourceFetch<JustTcgEnvelope<JustTcgCard[]>>({
    source: "justtcg",
    method: "POST",
    path: "/cards",
    body: items,
  });
}
