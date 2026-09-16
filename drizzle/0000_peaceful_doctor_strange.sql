CREATE TYPE "public"."role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."training_source" AS ENUM('upload', 'live');--> statement-breakpoint
CREATE TABLE "slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled Slide' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "training_source" NOT NULL,
	"screen_type" text NOT NULL,
	"orientation" text NOT NULL,
	"has_label" boolean DEFAULT false NOT NULL,
	"has_logos" boolean DEFAULT false NOT NULL,
	"has_qr_code" boolean DEFAULT false NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"title_font" text,
	"title_italic" boolean DEFAULT false NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"subtitle_weight" text,
	"subtitle2" text DEFAULT '' NOT NULL,
	"presenters" text DEFAULT '' NOT NULL,
	"presenters_font" text,
	"presenters_italic" boolean DEFAULT false NOT NULL,
	"program_title" text DEFAULT '' NOT NULL,
	"program_title_font" text,
	"program_title_italic" boolean DEFAULT false NOT NULL,
	"series_name" text DEFAULT '' NOT NULL,
	"listening_credit" text DEFAULT '' NOT NULL,
	"background_color" text DEFAULT '' NOT NULL,
	"text_color" text DEFAULT '' NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"image_1_type" text,
	"image_1_position_x" double precision,
	"image_1_position_y" double precision,
	"image_1_width_ratio" double precision,
	"image_1_height_ratio" double precision,
	"image_1_crop" jsonb,
	"image_position_was_overridden" boolean,
	"title_font_size_suggested_px" integer,
	"title_font_size_final_px" integer,
	"title_font_size_was_overridden" boolean,
	"subtitle_font_size_suggested_px" integer,
	"subtitle_font_size_final_px" integer,
	"subtitle_font_size_was_overridden" boolean,
	"subtitle2_font_size_final_px" integer,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"live_style" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_entries" ADD CONSTRAINT "training_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slides_user_id_idx" ON "slides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "training_entries_user_id_idx" ON "training_entries" USING btree ("user_id");