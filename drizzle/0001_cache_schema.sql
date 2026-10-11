CREATE TYPE "public"."api_source" AS ENUM('justtcg', 'tcgapi');--> statement-breakpoint
CREATE TYPE "public"."card_condition" AS ENUM('NM', 'LP', 'MP', 'HP', 'DMG');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'succeeded', 'failed', 'partial');--> statement-breakpoint
CREATE TABLE "api_response_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"source" "api_source" NOT NULL,
	"endpoint" text NOT NULL,
	"status_code" integer NOT NULL,
	"body" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_daily" (
	"source" "api_source" NOT NULL,
	"day" date NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"reported_remaining" integer,
	CONSTRAINT "api_usage_daily_source_day_pk" PRIMARY KEY("source","day"),
	CONSTRAINT "api_usage_requests_nonneg" CHECK ("api_usage_daily"."requests" >= 0)
);
--> statement-breakpoint
CREATE TABLE "card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"set_id" uuid NOT NULL,
	"name" text NOT NULL,
	"number" text,
	"rarity" text,
	"image_url" text,
	"tcgplayer_product_id" text,
	"justtcg_card_id" text,
	"tcgapi_card_id" text,
	"scryfall_id" uuid,
	"mtgjson_id" uuid,
	"attributes" jsonb,
	"justtcg_prices_fetched_at" timestamp with time zone,
	"tcgapi_prices_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"release_date" date,
	"card_count" integer,
	"justtcg_set_id" text,
	"tcgapi_set_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"printing" text NOT NULL,
	"condition" "card_condition" NOT NULL,
	"language" text DEFAULT 'English' NOT NULL,
	"justtcg_variant_id" text,
	"tcgplayer_sku_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"justtcg_game_id" text,
	"tcgapi_game_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_justtcgGameId_unique" UNIQUE("justtcg_game_id"),
	CONSTRAINT "game_tcgapiGameSlug_unique" UNIQUE("tcgapi_game_slug")
);
--> statement-breakpoint
CREATE TABLE "printing_price_current" (
	"card_id" uuid NOT NULL,
	"printing" text NOT NULL,
	"market_cents" integer,
	"low_cents" integer,
	"median_cents" integer,
	"lowest_with_shipping_cents" integer,
	"buylist_cents" integer,
	"total_listings" integer,
	"change24h_pct" real,
	"change7d_pct" real,
	"change30d_pct" real,
	"market_as_of" date,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "printing_price_current_card_id_printing_pk" PRIMARY KEY("card_id","printing")
);
--> statement-breakpoint
CREATE TABLE "printing_price_daily" (
	"card_id" uuid NOT NULL,
	"printing" text NOT NULL,
	"day" date NOT NULL,
	"market_cents" integer,
	"low_cents" integer,
	"avg_sales_cents" integer,
	"sales_volume" integer,
	CONSTRAINT "printing_price_daily_card_id_printing_day_pk" PRIMARY KEY("card_id","printing","day")
);
--> statement-breakpoint
CREATE TABLE "sync_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "api_source" NOT NULL,
	"job" text NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"requests_used" integer DEFAULT 0 NOT NULL,
	"rows_upserted" integer DEFAULT 0 NOT NULL,
	"cursor" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "variant_price_current" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"price_cents" integer,
	"price_status" text,
	"last_known_price_cents" integer,
	"change24h_pct" real,
	"change7d_pct" real,
	"change30d_pct" real,
	"change90d_pct" real,
	"observed_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_price_daily" (
	"variant_id" uuid NOT NULL,
	"day" date NOT NULL,
	"price_cents" integer NOT NULL,
	CONSTRAINT "variant_price_daily_variant_id_day_pk" PRIMARY KEY("variant_id","day")
);
--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_set_id_card_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."card_set"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_set" ADD CONSTRAINT "card_set_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_variant" ADD CONSTRAINT "card_variant_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printing_price_current" ADD CONSTRAINT "printing_price_current_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printing_price_daily" ADD CONSTRAINT "printing_price_daily_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_price_current" ADD CONSTRAINT "variant_price_current_variant_id_card_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."card_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_price_daily" ADD CONSTRAINT "variant_price_daily_variant_id_card_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."card_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_response_cache_expires_idx" ON "api_response_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "card_tcgplayer_uq" ON "card" USING btree ("tcgplayer_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_justtcg_uq" ON "card" USING btree ("justtcg_card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_tcgapi_uq" ON "card" USING btree ("tcgapi_card_id");--> statement-breakpoint
CREATE INDEX "card_set_number_idx" ON "card" USING btree ("set_id","number");--> statement-breakpoint
CREATE INDEX "card_scryfall_idx" ON "card" USING btree ("scryfall_id");--> statement-breakpoint
CREATE INDEX "card_name_trgm_idx" ON "card" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "card_set_justtcg_uq" ON "card_set" USING btree ("justtcg_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_set_tcgapi_uq" ON "card_set" USING btree ("tcgapi_set_id");--> statement-breakpoint
CREATE INDEX "card_set_game_release_idx" ON "card_set" USING btree ("game_id","release_date");--> statement-breakpoint
CREATE UNIQUE INDEX "card_variant_natural_uq" ON "card_variant" USING btree ("card_id","printing","condition","language");--> statement-breakpoint
CREATE UNIQUE INDEX "card_variant_justtcg_uq" ON "card_variant" USING btree ("justtcg_variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_variant_sku_uq" ON "card_variant" USING btree ("tcgplayer_sku_id");--> statement-breakpoint
CREATE INDEX "sync_run_job_started_idx" ON "sync_run" USING btree ("source","job","started_at");