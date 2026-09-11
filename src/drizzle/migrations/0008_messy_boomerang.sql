ALTER TABLE "students" DROP CONSTRAINT "students_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "timetable_class_day_idx";--> statement-breakpoint
CREATE INDEX "timetable_school_class_day_idx" ON "timetables" USING btree ("school_id","grade_level","stream","day_of_week");--> statement-breakpoint
CREATE INDEX "timetable_teacher_schedule_idx" ON "timetables" USING btree ("school_id","day_of_week","period_number","teacher_id");--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "user_id";