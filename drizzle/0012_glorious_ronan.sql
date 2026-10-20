ALTER TABLE "training_entries" ADD COLUMN "photo_adjustments" jsonb;--> statement-breakpoint
ALTER TABLE "training_entries" ADD COLUMN "has_photo_adjustments" boolean DEFAULT false NOT NULL;