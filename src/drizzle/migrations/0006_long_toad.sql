CREATE TYPE "public"."term_status" AS ENUM('upcoming', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."window_type" AS ENUM('mid_term_break', 'cat_week', 'exam_week', 'registration_deadline');--> statement-breakpoint
CREATE TABLE "term_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"window_type" "window_type" NOT NULL,
	"title" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_terms" ADD COLUMN "status" "term_status" DEFAULT 'upcoming' NOT NULL;--> statement-breakpoint
ALTER TABLE "term_windows" ADD CONSTRAINT "term_windows_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "term_window_idx" ON "term_windows" USING btree ("term_id");