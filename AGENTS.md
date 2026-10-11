# TCG Tracker

Portfolio project (non-commercial): a Pokémon TCG + Magic: The Gathering + Riftbound price cache, then a collection tracker on top of it.

## Stack
- Next.js (App Router, TypeScript)
- Neon Postgres + Drizzle ORM (`@neondatabase/serverless`, `drizzle-orm/neon-http`)
- Better Auth (its tables come from its CLI, so don't hand-write them: `pnpm auth:generate` rewrites `src/db/auth-schema.ts`, then `pnpm db:generate` + `pnpm db:migrate`)
- StyleX for styling

## Status
- [x] Cache schema drafted: `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`
- [x] Scaffold Next.js (16, App Router, `src/`, Turbopack, pnpm). StyleX via its Babel + PostCSS plugins (`babel.config.js`, `postcss.config.js`, `@stylex` directive in `src/app/globals.css`).
- [x] Initial migrations generated: `drizzle/0000_enable_pg_trgm.sql` (runs before the trigram index), `drizzle/0001_cache_schema.sql`
- [x] Neon project created, migrations applied
- [x] API clients with quota checks (`src/lib/sources/`) + normalization (`src/lib/normalize/`); games seeded (`pnpm db:seed`)
- [x] Catalog import from TCG API: `pnpm sync:catalog <gameId> [--max-requests N]` (`src/lib/sync/`). Riftbound imported (15 sets, 1,722 cards, 29 requests).
- [x] JustTCG condition prices fetched on first card view (`src/lib/sync/justtcg-prices.ts`, 1 request per card per 24h), creating `card_variant` rows. Pages: `/` (games → sets), `/sets/[id]`, `/cards/[id]`.
- [x] Daily price refresh for tracked cards: `pnpm sync:prices [--max-requests N] [--source justtcg|tcgapi]` (JustTCG batches of 20 per request; TCG API re-pages the sets that contain tracked cards)
- [x] Better Auth (email + password): `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts`; pages `/sign-in`, `/sign-up`, `/account`
- [x] Collection tracker: `collection_item` (user × variant, quantity, optional cost basis), server actions in `src/lib/actions/collection.ts`, `/collection` page, Owned column on card pages
- [ ] Schedule `pnpm sync:prices` daily (GitHub Actions cron or similar; needs the env secrets)

## Games
Rows in the `game` table (not an enum), seeded by `src/db/seed.ts`. Both APIs cover all three.

| `game.id` | Name | `justtcg_game_id` | `tcgapi_game_slug` |
|---|---|---|---|
| `pokemon` | Pokémon | `pokemon` | `pokemon` |
| `mtg` | Magic: The Gathering | `magic-the-gathering` | `magic` |
| `riftbound` | Riftbound: League of Legends TCG | `riftbound-league-of-legends-trading-card-game` | `riftbound-league-of-legends-trading-card-game` |

## Data sources
Both free tiers: about 100 requests/day each, non-commercial only. Every outbound call must go through the quota check (`api_usage_daily`).

**JustTCG**: `https://api.justtcg.com/v1`, header `x-api-key`
- Card: `uuid` (use this, not the legacy slug `id`), `name`, `game`, `set`, `set_name`, `number`, `rarity`, `tcgplayerId`, `scryfallId`, `mtgjsonId`, `details`, `variants[]`
- Variant: `uuid`, `condition`, `printing`, `language` (omitted = English), `tcgplayerSkuId`, `price`, `lastUpdated` (unix seconds), `priceStatus` (current|expired|unpriced), `lastKnownPrice`, `priceChange24hr|7d|30d|90d`, `priceHistory[{p,t}]`
- `GET /cards` lookup by `tcgplayerId`, `scryfallId`, `mtgjsonId`, `tcgplayerSkuId`, `variantId`, `cardId`. `POST /cards` batch (20 per request on free tier). Pagination meta: `total, limit, offset, hasMore`.
- Free tier: 1,000/month, 100/day, 10/min. Monthly resets on the account-creation anniversary, daily at 00:00 UTC. Every response's `_metadata` has `apiRequestsRemaining` (monthly) and `apiDailyRequestsRemaining`.
- Variants carry inline stats (`avgPrice30d`, `minPrice90d`, `trendSlope7d`, …). Condition `Sealed`/`S` is sealed product, so we skip it.
- Free keys used from shared serverless infra (Vercel, Lambda) can get a temporary `EXCESSIVE_FREE_TIER_USAGE` block, so run JustTCG syncs from a non-serverless runner if that bites.
- Full reference: https://justtcg.com/llms-full.txt

**TCG API**: `https://api.tcgapi.dev/v1`, header `X-API-Key`
- `GET /search?q=&game=`, `GET /sets?game=&page=&per_page=` (max 100), `GET /sets/:id/cards`, `GET /cards/:id`, `GET /cards/tcgplayer/:tcgplayerId`, `GET /cards/:id/prices?printing=`, `GET /cards/:id/history?range=month`
- Card fields: `id`, `tcgplayer_id`, `name`, `number`, `rarity`, `image_url`, `set_id`, `set_name`, `game_id`, `custom_attributes`
- Prices: by printing only (`market_price`, `low_price`, `median_price`, `lowest_with_shipping`, `buylist_price`, `price_change_24h|7d|30d`, `market_price_as_of`). Per-condition prices, set price dumps and bulk endpoints are Pro-only.
- Free tier: `/cards/:id/history` returns only the last 7 days (date, printing, market, low). Sales volume is in `/history/detailed`, which is Pro+, so `printing_price_daily.sales_volume`/`avg_sales_cents` stay NULL on free.
- Search results are flattened card + one printing's price and have no `set_id`; use `GET /cards/:id` for that.
- Reports quota in the `X-RateLimit-Remaining` header on keyed endpoints. Public endpoints (`/games`, `/games/:slug/sets`) send no header and a placeholder `rate_limit.daily_remaining: 0` in the body, so never trust the body value.
- `/sets/:id/cards` returns sealed products unless you pass `type=Cards`. Each row is one card plus one printing's price (no `custom_attributes`).
- A set's `card_count` overcounts what `/sets/:id/cards` returns (it includes sealed product and apparently unpriced promos), so don't use it to check an import.
- Full reference: https://tcgapi.dev/llms-full.txt

## Schema conventions
- **TCGplayer product ID is the cross-source join key** (`card.tcgplayer_product_id`, unique). Sets are matched across sources through their cards, not by name.
- `card_variant` = printing × condition × language, the unit a user owns.
- Each source has its own price tables, because the granularity differs: JustTCG → `variant_price_current` / `variant_price_daily`; TCG API → `printing_price_current` / `printing_price_daily`.
- Money is integer **cents** (USD). Percent changes are `real`.
- External IDs are stored as `text` (TCG API's ID type isn't documented).
- `casing: "snake_case"` in both the Drizzle config and the client: camelCase in TS, snake_case in Postgres.
- Migrations use Neon's direct (non-pooled) URL: `DATABASE_URL_UNPOOLED`.

## Next.js notes
- Cache Components is on. Catalog pages use `"use cache"` + `cacheTag` (`sets`, `set:<id>`, `card:<id>`); anything reading request-time data or calling an API sits inside `<Suspense>`. `params` is awaited inside the Suspense boundary, not in the page's default export.
- Components that do request-time I/O (session reads, fetch-on-view) call `await connection()` first. Without it, dev's prerender pass starts the DB query, hits Better Auth's `new Date()` ("unstable value" insight) and then aborts the query (`NeonDbError: AbortError`).
- Server actions call `refresh()` from `next/cache` after writing so the dynamic parts of the page re-render in the same round trip.

## Auth notes
- Session reads (`getSession()` / `requireSession()` in `src/lib/session.ts`) use `headers()`, so they must sit inside `<Suspense>`; `SiteHeader` does this for the user menu.
- `.env.local` changes need a dev-server restart; Better Auth warns "Base URL is not set" if it started without `BETTER_AUTH_URL`.
- Collection rows will reference `user.id` (a `text` column, not uuid).

## Sync strategy (free-tier budget)
- Import the catalog once, then refresh per set; resume via `sync_run.cursor`.
- Daily prices only for cards in collections, stalest first (`card.*_prices_fetched_at`, considered stale after 20h). `sync:prices` gives JustTCG up to half the budget first (20 cards per request), then TCG API gets the rest (one request per 100 cards of each set that has tracked cards).
- Everything else: fetch on first view, read from cache afterward. Raw search responses go in `api_response_cache`.
- Storage budget: Neon free = 1 GB/project. Daily variant history ≈ 2 MB/day at about 20K rows.

## Env
```
DATABASE_URL=            # Neon pooled
DATABASE_URL_UNPOOLED=   # Neon direct (migrations)
JUSTTCG_API_KEY=
TCGAPI_API_KEY=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
