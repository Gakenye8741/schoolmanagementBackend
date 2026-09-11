ALTER TABLE "term_exams" ALTER COLUMN "exam_category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."exam_category";--> statement-breakpoint
CREATE TYPE "public"."exam_category" AS ENUM('Mid-Term', 'End-Term', 'Continuous Assessment', 'Project', 'Practical', 'Opening', 'Formative', 'Summative', 'Mock', 'End of Year');--> statement-breakpoint
ALTER TABLE "term_exams" ALTER COLUMN "exam_category" SET DATA TYPE "public"."exam_category" USING "exam_category"::"public"."exam_category";