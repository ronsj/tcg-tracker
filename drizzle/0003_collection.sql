CREATE TABLE "collection_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"acquired_price_cents" integer,
	"acquired_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_quantity_positive" CHECK ("collection_item"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_variant_id_card_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."card_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_item_user_variant_uq" ON "collection_item" USING btree ("user_id","variant_id");--> statement-breakpoint
CREATE INDEX "collection_item_variant_idx" ON "collection_item" USING btree ("variant_id");