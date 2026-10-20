ALTER TABLE "training_entries" ADD COLUMN "custom_text_layers" jsonb;--> statement-breakpoint
ALTER TABLE "training_entries" ADD COLUMN "custom_text_layers_count" integer DEFAULT 0 NOT NULL;