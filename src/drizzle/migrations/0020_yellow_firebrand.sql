DROP INDEX "timetable_class_slot_idx";--> statement-breakpoint
DROP INDEX "timetable_teacher_day_idx";--> statement-breakpoint
ALTER TABLE "timetables" ADD COLUMN "period_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timetable_period_idx" ON "timetables" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "timetable_room_idx" ON "timetables" USING btree ("school_id","day_of_week","period_id","room");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_class_slot_idx" ON "timetables" USING btree ("class_id","day_of_week","period_id");--> statement-breakpoint
CREATE INDEX "timetable_teacher_day_idx" ON "timetables" USING btree ("teacher_id","day_of_week","period_id");--> statement-breakpoint
ALTER TABLE "timetables" DROP COLUMN "period_number";--> statement-breakpoint
ALTER TABLE "timetables" DROP COLUMN "start_time";--> statement-breakpoint
ALTER TABLE "timetables" DROP COLUMN "end_time";