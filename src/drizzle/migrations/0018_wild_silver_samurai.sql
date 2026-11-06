ALTER TABLE "classes" DROP CONSTRAINT "classes_grade_level_id_grade_levels_id_fk";
--> statement-breakpoint
DROP INDEX "class_school_year_grade_stream_idx";--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "grade_level_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_school_year_grade_stream_idx" ON "classes" USING btree ("school_id","academic_year","grade_level_id","stream");--> statement-breakpoint
ALTER TABLE "classes" DROP COLUMN "grade_level";