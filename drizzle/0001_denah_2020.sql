ALTER TYPE "public"."location_type" ADD VALUE 'toilet' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."location_type" ADD VALUE 'food' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "map_source_label" varchar(160);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "route_note" text;