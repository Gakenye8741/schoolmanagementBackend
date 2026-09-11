ALTER TABLE "cbc_assessments" DROP CONSTRAINT "cbc_assessments_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "cbc_assessments" DROP CONSTRAINT "cbc_assessments_subject_id_subjects_id_fk";
--> statement-breakpoint
ALTER TABLE "cbc_assessments" DROP CONSTRAINT "cbc_assessments_term_id_academic_terms_id_fk";
--> statement-breakpoint
ALTER TABLE "cbc_assessments" DROP CONSTRAINT "cbc_assessments_exam_id_term_exams_id_fk";
--> statement-breakpoint
ALTER TABLE "cbc_assessments" DROP CONSTRAINT "cbc_assessments_assessed_by_users_id_fk";
--> statement-breakpoint
DROP INDEX "assessment_student_exam_subject_idx";--> statement-breakpoint
ALTER TABLE "cbc_assessments" ALTER COLUMN "out_of" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ALTER COLUMN "performance_level" SET DATA TYPE varchar(2);--> statement-breakpoint
CREATE UNIQUE INDEX "student_exam_subject_strand_idx" ON "cbc_assessments" USING btree ("student_id","exam_id","subject_id","strand");--> statement-breakpoint
ALTER TABLE "cbc_assessments" DROP COLUMN "updated_at";