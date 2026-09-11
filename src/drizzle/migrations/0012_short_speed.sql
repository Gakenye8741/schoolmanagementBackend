ALTER TABLE "school_events" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."event_category";--> statement-breakpoint
CREATE TYPE "public"."event_category" AS ENUM('Academic', 'Sports', 'Cultural', 'Club', 'Meeting', 'Holiday', 'General', 'Other');--> statement-breakpoint
ALTER TABLE "school_events" ALTER COLUMN "category" SET DATA TYPE "public"."event_category" USING "category"::"public"."event_category";--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "school_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."school_type";--> statement-breakpoint
CREATE TYPE "public"."school_type" AS ENUM('Primary', 'Secondary', 'HighSchool', 'Mixed', 'ECD', 'Tertiary');--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "school_type" SET DATA TYPE "public"."school_type" USING "school_type"::"public"."school_type";