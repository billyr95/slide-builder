CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_folder_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_folder_id_folders_id_fk" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folders_parent_folder_id_idx" ON "folders" USING btree ("parent_folder_id");--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slides_folder_id_idx" ON "slides" USING btree ("folder_id");--> statement-breakpoint
-- Seed the single root folder ("All Slides") every browsing path starts
-- from, owned by the earliest-created user (an arbitrary but stable choice
-- for a system-seeded row) -- guarded so re-running this migration is a
-- no-op if a root folder somehow already exists.
INSERT INTO "folders" ("id", "name", "parent_folder_id", "created_by", "created_at")
SELECT gen_random_uuid(), 'All Slides', NULL, (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1), now()
WHERE NOT EXISTS (SELECT 1 FROM "folders" WHERE "parent_folder_id" IS NULL)
  AND EXISTS (SELECT 1 FROM "users");--> statement-breakpoint
-- Backfill: every pre-existing slide with no folder assignment goes into
-- that root folder, so nothing becomes orphaned/invisible in the new
-- folder-browsing UI.
UPDATE "slides" SET "folder_id" = (SELECT "id" FROM "folders" WHERE "parent_folder_id" IS NULL LIMIT 1)
WHERE "folder_id" IS NULL;