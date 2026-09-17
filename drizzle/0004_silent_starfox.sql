ALTER TABLE "training_entries" ADD COLUMN "image_1_face_detected" boolean;--> statement-breakpoint
ALTER TABLE "training_entries" ADD COLUMN "image_1_face_crop_suggested" jsonb;--> statement-breakpoint
ALTER TABLE "training_entries" ADD COLUMN "image_1_face_crop_final" jsonb;--> statement-breakpoint
ALTER TABLE "training_entries" ADD COLUMN "image_1_face_crop_was_overridden" boolean;--> statement-breakpoint
ALTER TABLE "training_entries" ADD COLUMN "image_1_face_detection_mismatch" boolean;