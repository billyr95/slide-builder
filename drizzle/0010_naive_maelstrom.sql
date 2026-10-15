CREATE TYPE "public"."screen_type" AS ENUM('projector', 'lobby');--> statement-breakpoint
CREATE TABLE "slide_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "screen_type" "screen_type" DEFAULT 'projector' NOT NULL;--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "training_entries" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "slide_groups" ADD CONSTRAINT "slide_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_group_id_slide_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."slide_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slides_group_id_idx" ON "slides" USING btree ("group_id");