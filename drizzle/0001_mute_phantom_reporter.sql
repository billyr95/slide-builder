CREATE TYPE "public"."orientation" AS ENUM('landscape', 'portrait');--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "orientation" "orientation" DEFAULT 'landscape' NOT NULL;