# TCG Tracker

Portfolio project (non-commercial): a Pokémon TCG + Magic: The Gathering + Riftbound price cache, then a collection tracker on top of it.

## Stack
- Next.js (App Router, TypeScript)
- Neon Postgres + Drizzle ORM (`@neondatabase/serverless`, `drizzle-orm/neon-http`)
- Better Auth (its tables come from its CLI, so don't hand-write them)
- StyleX for styling

## Status
- [x] Cache schema drafted: `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`
- [x] Scaffold Next.js (16, App Router, `src/`, Turbopack, pnpm). StyleX via its Babel + PostCSS plugins (`babel.config.js`, `postcss.config.js`, `@stylex` directive in `src/app/globals.css`).
- [x] Initial migrations generated: `drizzle/0000_enable_pg_trgm.sql` (runs before the trigram index), `drizzle/0001_cache_schema.sql`
- [ ] Create the Neon project, fill `.env.local`, run `pnpm db:migrate`
- [ ] API clients + normalization layer (condition strings → `NM|LP|MP|HP|DMG`)
- [ ] Sync jobs (catalog import, daily prices for tracked cards), with quota checks
- [ ] Better Auth setup
- [ ] Collection tracker (collection items reference `card_variant.id` and Better Auth `user.id`)

## Games
Rows in the `game` table (not an enum), so adding a game is a data change. Both APIs cover all three.

| `game.id` | Name | `justtcg_game_id` | `tcgapi_game_slug` |
|---|---|---|---|
| `pokemon` | Pokémon | verify via `GET /games` | `pokemon` |
| `mtg` | Magic: The Gathering | `magic-the-gathering` | `magic` |
| `riftbound` | Riftbound: League of Legends TCG | verify via `GET /games` | `riftbound-league-of-legends-trading-card-game` |

## Data sources
Both free tiers: about 100 requests/day each, non-commercial only. Every outbound call must go through the quota check (`api_usage_daily`).

**JustTCG**: `https://api.justtcg.com/v1`, header `x-api-key`
- Card: `uuid` (use this, not the legacy slug `id`), `name`, `game`, `set`, `set_name`, `number`, `rarity`, `tcgplayerId`, `scryfallId`, `mtgjsonId`, `details`, `variants[]`
- Variant: `uuid`, `condition`, `printing`, `language` (omitted = English), `tcgplayerSkuId`, `price`, `lastUpdated` (unix seconds), `priceStatus` (current|expired|unpriced), `lastKnownPrice`, `priceChange24hr|7d|30d|90d`, `priceHistory[{p,t}]`
- `GET /cards` lookup by `tcgplayerId`, `scryfallId`, `mtgjsonId`, `tcgplayerSkuId`, `variantId`, `cardId`. `POST /cards` batch (20 per request on free tier). Pagination meta: `total, limit, offset, hasMore`.
- Free tier: 1,000/month, 100/day, 10/min.

**TCG API**: `https://api.tcgapi.dev/v1`, header `X-API-Key`
- `GET /search?q=&game=`, `GET /sets?game=&page=&per_page=` (max 100), `GET /sets/:id/cards`, `GET /cards/:id`, `GET /cards/tcgplayer/:tcgplayerId`, `GET /cards/:id/prices?printing=`, `GET /cards/:id/history?range=month`
- Card fields: `id`, `tcgplayer_id`, `name`, `number`, `rarity`, `image_url`, `set_id`, `set_name`, `game_id`, `custom_attributes`
- Prices: by printing only (`market_price`, `low_price`, `median_price`, `lowest_with_shipping`, `buylist_price`, `price_change_24h|7d|30d`, `market_price_as_of`). Per-condition prices, set price dumps and bulk endpoints are Pro-only.
- History `sales_volume`: `null` = not reported yet, `0` = no sales.

## Schema conventions
- **TCGplayer product ID is the cross-source join key** (`card.tcgplayer_product_id`, unique). Sets are matched across sources through their cards, not by name.
- `card_variant` = printing × condition × language, the unit a user owns.
- Each source has its own price tables, because the granularity differs: JustTCG → `variant_price_current` / `variant_price_daily`; TCG API → `printing_price_current` / `printing_price_daily`.
- Money is integer **cents** (USD). Percent changes are `real`.
- External IDs are stored as `text` (TCG API's ID type isn't documented).
- `casing: "snake_case"` in both the Drizzle config and the client: camelCase in TS, snake_case in Postgres.
- Migrations use Neon's direct (non-pooled) URL: `DATABASE_URL_UNPOOLED`.

## Sync strategy (free-tier budget)
- Import the catalog once, then refresh per set; resume via `sync_run.cursor`.
- Daily prices only for cards in collections/watchlists, stalest first (`card.*_prices_fetched_at`).
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
