ALTER TABLE "slides" ADD COLUMN "active_editor_id" uuid;--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "active_editor_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_active_editor_id_users_id_fk" FOREIGN KEY ("active_editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;