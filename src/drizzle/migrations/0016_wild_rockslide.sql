CREATE TYPE "public"."approval_status" AS ENUM('Draft', 'Submitted', 'Approved', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."boarding_status" AS ENUM('Day', 'Boarding');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('BirthCertificate', 'TransferLetter', 'ReportForm', 'MedicalReport', 'IdentityDocument', 'Photo', 'Circular', 'Other');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('Male', 'Female', 'Other');--> statement-breakpoint
CREATE TYPE "public"."guardian_relationship" AS ENUM('Mother', 'Father', 'Guardian', 'Sponsor', 'Sibling', 'Other');--> statement-breakpoint
CREATE TYPE "public"."health_record_type" AS ENUM('Allergy', 'Condition', 'Vaccination', 'SickBayVisit', 'Injury', 'Other');--> statement-breakpoint
CREATE TYPE "public"."import_job_type" AS ENUM('students', 'guardians', 'teachers', 'fees', 'marks');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('Queued', 'Processing', 'Completed', 'Failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('Unpaid', 'Partial', 'Paid', 'Overdue', 'Waived', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_slot_status" AS ENUM('Open', 'Booked', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('Fees', 'Attendance', 'Exam', 'Homework', 'Announcement', 'Message', 'Discipline', 'System');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('Pending', 'Completed', 'Failed', 'Reversed');--> statement-breakpoint
CREATE TYPE "public"."sms_status" AS ENUM('Queued', 'Sent', 'Delivered', 'Failed');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('password_reset', 'email_verification', 'phone_otp', 'login_otp', 'invite');--> statement-breakpoint
CREATE TYPE "public"."weekday" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');--> statement-breakpoint
ALTER TYPE "public"."discipline_incident" ADD VALUE 'Detention';--> statement-breakpoint
ALTER TYPE "public"."discipline_incident" ADD VALUE 'Suspension';--> statement-breakpoint
ALTER TYPE "public"."enrollment_status" ADD VALUE 'Repeated' BEFORE 'Transferred';--> statement-breakpoint
ALTER TYPE "public"."enrollment_status" ADD VALUE 'Withdrawn';--> statement-breakpoint
ALTER TYPE "public"."enrollment_status" ADD VALUE 'Graduated';--> statement-breakpoint
ALTER TYPE "public"."inventory_category" ADD VALUE 'Furniture';--> statement-breakpoint
ALTER TYPE "public"."inventory_category" ADD VALUE 'ICT';--> statement-breakpoint
ALTER TYPE "public"."inventory_category" ADD VALUE 'Lab Equipment';--> statement-breakpoint
ALTER TYPE "public"."inventory_category" ADD VALUE 'Sports Equipment';--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE 'Lost';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'Cheque';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'principal' BEFORE 'bursar';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'deputy_principal' BEFORE 'bursar';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'registrar' BEFORE 'teacher';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'librarian' BEFORE 'teacher';--> statement-breakpoint
CREATE TABLE "boarding_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"dormitory_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"bed_number" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "class_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"teacher_id" uuid
);
--> statement-breakpoint
CREATE TABLE "curriculum_strands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_sub_strands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"strand_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"learning_outcomes" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid,
	"category" "document_category" NOT NULL,
	"title" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_name" varchar(255),
	"mime_type" varchar(100),
	"size_bytes" integer,
	"is_visible_to_parent" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dormitories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"gender" "gender",
	"capacity" integer,
	"warden_id" uuid
);
--> statement-breakpoint
CREATE TABLE "exam_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"class_id" uuid,
	"marks" numeric(5, 2),
	"out_of" numeric(5, 2) DEFAULT '100' NOT NULL,
	"is_absent" boolean DEFAULT false NOT NULL,
	"grade" varchar(10),
	"points" integer,
	"subject_position" integer,
	"remarks" text,
	"entered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_result_marks_chk" CHECK ("exam_results"."marks" IS NULL OR ("exam_results"."marks" >= 0 AND "exam_results"."marks" <= "exam_results"."out_of"))
);
--> statement-breakpoint
CREATE TABLE "exam_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"exam_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"venue" varchar(100),
	"invigilator_id" uuid
);
--> statement-breakpoint
CREATE TABLE "grade_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"sort_order" integer NOT NULL,
	"education_stage" varchar(50),
	"next_grade_level_id" uuid,
	"is_final_grade" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grading_bands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scale_id" uuid NOT NULL,
	"min_score" numeric(5, 2) NOT NULL,
	"max_score" numeric(5, 2) NOT NULL,
	"grade" varchar(10) NOT NULL,
	"points" integer,
	"descriptor" varchar(100),
	"remark" text,
	CONSTRAINT "grading_band_range_chk" CHECK ("grading_bands"."max_score" >= "grading_bands"."min_score")
);
--> statement-breakpoint
CREATE TABLE "grading_scales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_by" uuid,
	"type" "import_job_type" NOT NULL,
	"status" "import_status" DEFAULT 'Queued' NOT NULL,
	"file_url" text NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"success_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"errors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"fee_item_id" uuid,
	"description" varchar(150) NOT NULL,
	"amount" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"scheme_entry_id" uuid,
	"teacher_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"lesson_date" date NOT NULL,
	"topic" varchar(255) NOT NULL,
	"objectives" text,
	"introduction" text,
	"development" text,
	"conclusion" text,
	"resources" text,
	"assessment" text,
	"reflection" text,
	"status" "approval_status" DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"booked_by" uuid,
	"student_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "meeting_slot_status" DEFAULT 'Open' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_time_chk" CHECK ("meeting_slots"."ends_at" > "meeting_slots"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"period_number" integer NOT NULL,
	"name" varchar(50) NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_break" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"mean_score" numeric(5, 2),
	"class_position" integer,
	"stream_size" integer,
	"attendance_days" integer,
	"class_teacher_remarks" text,
	"principal_remarks" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheme_of_work_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"strand_id" uuid,
	"sub_strand_id" uuid,
	"week_number" integer NOT NULL,
	"lesson_number" integer DEFAULT 1 NOT NULL,
	"topic" varchar(255) NOT NULL,
	"objectives" text,
	"learning_activities" text,
	"resources" text,
	"assessment_methods" text,
	"remarks" text,
	"is_covered" boolean DEFAULT false NOT NULL,
	"covered_on" date
);
--> statement-breakpoint
CREATE TABLE "schemes_of_work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "approval_status" DEFAULT 'Draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"review_comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"announcement_id" uuid,
	"phone" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"status" "sms_status" DEFAULT 'Queued' NOT NULL,
	"provider_message_id" varchar(100),
	"cost" numeric(8, 4),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_user_id" uuid NOT NULL,
	"relationship" "guardian_relationship" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_fee_payer" boolean DEFAULT false NOT NULL,
	"can_pickup" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_health_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"record_type" "health_record_type" NOT NULL,
	"title" varchar(150) NOT NULL,
	"description" text,
	"treatment" text,
	"follow_up_date" date,
	"recorded_by" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "invoice_status" DEFAULT 'Unpaid' NOT NULL,
	"due_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_amount_chk" CHECK ("student_invoices"."total_amount" >= 0 AND "student_invoices"."discount_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "student_transport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"pickup_point" varchar(150)
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"plan" "subscription_plan" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'KES' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference_code" varchar(100) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_reference_code_unique" UNIQUE("reference_code")
);
--> statement-breakpoint
CREATE TABLE "transport_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"vehicle_registration" varchar(20),
	"driver_name" varchar(150),
	"driver_phone" varchar(20),
	"capacity" integer,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_id" uuid,
	"token_hash" varchar(255) NOT NULL,
	"user_agent" text,
	"ip_address" varchar(45),
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"school_id" uuid,
	"identifier" varchar(255) NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"provider" varchar(50) NOT NULL,
	"event_id" varchar(150) NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT "students_upi_number_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_national_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_tsc_number_unique";--> statement-breakpoint
ALTER TABLE "announcements" DROP CONSTRAINT "announcements_posted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_marked_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "disciplinary_records" DROP CONSTRAINT "disciplinary_records_recorded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "fee_transactions" DROP CONSTRAINT "fee_transactions_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "fee_transactions" DROP CONSTRAINT "fee_transactions_term_id_academic_terms_id_fk";
--> statement-breakpoint
ALTER TABLE "fee_transactions" DROP CONSTRAINT "fee_transactions_recorded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "library_loans" DROP CONSTRAINT "library_loans_inventory_id_school_inventory_id_fk";
--> statement-breakpoint
ALTER TABLE "school_expenses" DROP CONSTRAINT "school_expenses_recorded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT "students_parent_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT "students_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "term_school_idx";--> statement-breakpoint
DROP INDEX "audit_school_idx";--> statement-breakpoint
DROP INDEX "class_fee_structure_idx";--> statement-breakpoint
DROP INDEX "class_school_idx";--> statement-breakpoint
DROP INDEX "fee_item_school_idx";--> statement-breakpoint
DROP INDEX "inventory_school_idx";--> statement-breakpoint
DROP INDEX "school_slug_idx";--> statement-breakpoint
DROP INDEX "student_history_idx";--> statement-breakpoint
DROP INDEX "term_exam_idx";--> statement-breakpoint
DROP INDEX "timetable_school_class_day_idx";--> statement-breakpoint
DROP INDEX "timetable_teacher_schedule_idx";--> statement-breakpoint
DROP INDEX "user_school_idx";--> statement-breakpoint
DROP INDEX "user_role_idx";--> statement-breakpoint
DROP INDEX "user_tsc_idx";--> statement-breakpoint
DROP INDEX "announcement_school_audience_idx";--> statement-breakpoint
DROP INDEX "message_thread_idx";--> statement-breakpoint
DROP INDEX "discipline_student_idx";--> statement-breakpoint
DROP INDEX "fee_student_idx";--> statement-breakpoint
DROP INDEX "event_school_idx";--> statement-breakpoint
DROP INDEX "student_user_idx";--> statement-breakpoint
DROP INDEX "teacher_subject_idx";--> statement-breakpoint
DROP INDEX "term_window_idx";--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "posted_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "cbc_assessments" ALTER COLUMN "performance_level" SET DATA TYPE "public"."performance_level" USING "performance_level"::"public"."performance_level";--> statement-breakpoint
ALTER TABLE "cbc_assessments" ALTER COLUMN "assessed_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "direct_messages" ALTER COLUMN "sent_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "disciplinary_records" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "disciplinary_records" ALTER COLUMN "date" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "fee_transactions" ALTER COLUMN "transaction_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fee_transactions" ALTER COLUMN "transaction_date" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "homework_assignments" ALTER COLUMN "due_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "homework_assignments" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "homework_assignments" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "homework_submissions" ALTER COLUMN "submitted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "school_events" ALTER COLUMN "start_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "school_events" ALTER COLUMN "end_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "subscription_expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "gender" SET DATA TYPE "public"."gender" USING "gender"::"public"."gender";--> statement-breakpoint
ALTER TABLE "timetables" ALTER COLUMN "day_of_week" SET DATA TYPE "public"."weekday" USING "day_of_week"::"public"."weekday";--> statement-breakpoint
ALTER TABLE "timetables" ALTER COLUMN "teacher_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "timetables" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "timetables" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_login_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "class_id" uuid;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "class_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "remarks" varchar(255);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "entity_type" varchar(50);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD COLUMN "strand_id" uuid;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD COLUMN "sub_strand_id" uuid;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "grade_level_id" uuid;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "capacity" integer;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "disciplinary_records" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "disciplinary_records" ADD COLUMN "parent_notified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD COLUMN "status" "payment_status" DEFAULT 'Completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD COLUMN "mpesa_checkout_request_id" varchar(100);--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD COLUMN "payer_name" varchar(150);--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD COLUMN "payer_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD COLUMN "attachment_url" text;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD COLUMN "max_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD COLUMN "attachment_url" text;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD COLUMN "teacher_feedback" text;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD COLUMN "graded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "library_loans" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "library_loans" ADD COLUMN "issued_by" uuid;--> statement-breakpoint
ALTER TABLE "library_loans" ADD COLUMN "fine_amount" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "school_events" ADD COLUMN "location" varchar(150);--> statement-breakpoint
ALTER TABLE "school_expenses" ADD COLUMN "receipt_url" text;--> statement-breakpoint
ALTER TABLE "school_expenses" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "school_expenses" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "school_inventory" ADD COLUMN "isbn" varchar(20);--> statement-breakpoint
ALTER TABLE "school_inventory" ADD COLUMN "author" varchar(150);--> statement-breakpoint
ALTER TABLE "school_inventory" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "school_inventory" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "max_students" integer;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "sms_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_activity_memberships" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "student_enrollment_history" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "student_enrollment_history" ADD COLUMN "class_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "student_enrollment_history" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "first_name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "middle_name" varchar(100);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "last_name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "birth_certificate_number" varchar(50);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "nationality" varchar(50) DEFAULT 'Kenyan';--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "boarding_status" "boarding_status" DEFAULT 'Day' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "medical_notes" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "special_needs" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "previous_school" varchar(255);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "exit_date" date;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "exit_reason" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "term_exams" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "term_exams" ADD COLUMN "weighting" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "term_exams" ADD COLUMN "grading_scale_id" uuid;--> statement-breakpoint
ALTER TABLE "timetables" ADD COLUMN "class_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "timetables" ADD COLUMN "start_time" time;--> statement-breakpoint
ALTER TABLE "timetables" ADD COLUMN "end_time" time;--> statement-breakpoint
ALTER TABLE "timetables" ADD COLUMN "room" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "boarding_assignments" ADD CONSTRAINT "boarding_assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boarding_assignments" ADD CONSTRAINT "boarding_assignments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boarding_assignments" ADD CONSTRAINT "boarding_assignments_dormitory_id_dormitories_id_fk" FOREIGN KEY ("dormitory_id") REFERENCES "public"."dormitories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boarding_assignments" ADD CONSTRAINT "boarding_assignments_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_strands" ADD CONSTRAINT "curriculum_strands_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_strands" ADD CONSTRAINT "curriculum_strands_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_strands" ADD CONSTRAINT "curriculum_strands_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_sub_strands" ADD CONSTRAINT "curriculum_sub_strands_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_sub_strands" ADD CONSTRAINT "curriculum_sub_strands_strand_id_curriculum_strands_id_fk" FOREIGN KEY ("strand_id") REFERENCES "public"."curriculum_strands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dormitories" ADD CONSTRAINT "dormitories_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dormitories" ADD CONSTRAINT "dormitories_warden_id_users_id_fk" FOREIGN KEY ("warden_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_exam_id_term_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."term_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_exam_id_term_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."term_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_invigilator_id_users_id_fk" FOREIGN KEY ("invigilator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_levels" ADD CONSTRAINT "grade_levels_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_levels" ADD CONSTRAINT "grade_levels_next_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("next_grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_bands" ADD CONSTRAINT "grading_bands_scale_id_grading_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."grading_scales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_scales" ADD CONSTRAINT "grading_scales_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_student_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."student_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_fee_item_id_fee_items_id_fk" FOREIGN KEY ("fee_item_id") REFERENCES "public"."fee_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_scheme_entry_id_scheme_of_work_entries_id_fk" FOREIGN KEY ("scheme_entry_id") REFERENCES "public"."scheme_of_work_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_booked_by_users_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periods" ADD CONSTRAINT "periods_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_of_work_entries" ADD CONSTRAINT "scheme_of_work_entries_scheme_id_schemes_of_work_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes_of_work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_of_work_entries" ADD CONSTRAINT "scheme_of_work_entries_strand_id_curriculum_strands_id_fk" FOREIGN KEY ("strand_id") REFERENCES "public"."curriculum_strands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_of_work_entries" ADD CONSTRAINT "scheme_of_work_entries_sub_strand_id_curriculum_sub_strands_id_fk" FOREIGN KEY ("sub_strand_id") REFERENCES "public"."curriculum_sub_strands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_guardian_user_id_users_id_fk" FOREIGN KEY ("guardian_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_health_records" ADD CONSTRAINT "student_health_records_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_health_records" ADD CONSTRAINT "student_health_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_health_records" ADD CONSTRAINT "student_health_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_route_id_transport_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."transport_routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_transport" ADD CONSTRAINT "student_transport_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "boarding_student_term_idx" ON "boarding_assignments" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "boarding_bed_unique_idx" ON "boarding_assignments" USING btree ("dormitory_id","term_id","bed_number");--> statement-breakpoint
CREATE INDEX "boarding_school_idx" ON "boarding_assignments" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "class_subject_unique_idx" ON "class_subjects" USING btree ("class_id","subject_id");--> statement-breakpoint
CREATE INDEX "class_subject_school_idx" ON "class_subjects" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "class_subject_teacher_idx" ON "class_subjects" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "class_subject_subject_idx" ON "class_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strand_unique_idx" ON "curriculum_strands" USING btree ("subject_id","grade_level_id","name");--> statement-breakpoint
CREATE INDEX "strand_school_idx" ON "curriculum_strands" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "strand_grade_idx" ON "curriculum_strands" USING btree ("grade_level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sub_strand_unique_idx" ON "curriculum_sub_strands" USING btree ("strand_id","name");--> statement-breakpoint
CREATE INDEX "sub_strand_school_idx" ON "curriculum_sub_strands" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "document_student_idx" ON "documents" USING btree ("student_id","category");--> statement-breakpoint
CREATE INDEX "document_school_category_idx" ON "documents" USING btree ("school_id","category","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dormitory_school_name_idx" ON "dormitories" USING btree ("school_id","name");--> statement-breakpoint
CREATE INDEX "dormitory_warden_idx" ON "dormitories" USING btree ("warden_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_result_unique_idx" ON "exam_results" USING btree ("exam_id","student_id","subject_id");--> statement-breakpoint
CREATE INDEX "exam_result_student_exam_idx" ON "exam_results" USING btree ("student_id","exam_id");--> statement-breakpoint
CREATE INDEX "exam_result_marksheet_idx" ON "exam_results" USING btree ("school_id","exam_id","subject_id");--> statement-breakpoint
CREATE INDEX "exam_result_class_idx" ON "exam_results" USING btree ("class_id","exam_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_schedule_unique_idx" ON "exam_schedules" USING btree ("exam_id","class_id","subject_id");--> statement-breakpoint
CREATE INDEX "exam_schedule_school_date_idx" ON "exam_schedules" USING btree ("school_id","exam_date");--> statement-breakpoint
CREATE INDEX "exam_schedule_invigilator_idx" ON "exam_schedules" USING btree ("invigilator_id","exam_date");--> statement-breakpoint
CREATE INDEX "exam_schedule_class_idx" ON "exam_schedules" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_level_school_name_idx" ON "grade_levels" USING btree ("school_id","name");--> statement-breakpoint
CREATE INDEX "grade_level_school_order_idx" ON "grade_levels" USING btree ("school_id","sort_order");--> statement-breakpoint
CREATE INDEX "grading_band_lookup_idx" ON "grading_bands" USING btree ("scale_id","min_score","max_score");--> statement-breakpoint
CREATE UNIQUE INDEX "grading_scale_school_name_idx" ON "grading_scales" USING btree ("school_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "grading_scale_one_default_idx" ON "grading_scales" USING btree ("school_id") WHERE "grading_scales"."is_default" = true;--> statement-breakpoint
CREATE INDEX "import_school_date_idx" ON "import_jobs" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "import_active_idx" ON "import_jobs" USING btree ("created_at") WHERE "import_jobs"."status" IN ('Queued', 'Processing');--> statement-breakpoint
CREATE INDEX "invoice_item_invoice_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "lesson_plan_teacher_date_idx" ON "lesson_plans" USING btree ("teacher_id","lesson_date");--> statement-breakpoint
CREATE INDEX "lesson_plan_class_date_idx" ON "lesson_plans" USING btree ("class_id","lesson_date");--> statement-breakpoint
CREATE INDEX "lesson_plan_school_date_idx" ON "lesson_plans" USING btree ("school_id","lesson_date");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_teacher_start_idx" ON "meeting_slots" USING btree ("teacher_id","starts_at");--> statement-breakpoint
CREATE INDEX "meeting_open_idx" ON "meeting_slots" USING btree ("school_id","starts_at") WHERE "meeting_slots"."status" = 'Open';--> statement-breakpoint
CREATE INDEX "meeting_booked_by_idx" ON "meeting_slots" USING btree ("booked_by");--> statement-breakpoint
CREATE INDEX "notification_feed_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notification_school_idx" ON "notifications" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "period_school_number_idx" ON "periods" USING btree ("school_id","period_number");--> statement-breakpoint
CREATE UNIQUE INDEX "report_card_student_term_idx" ON "report_cards" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "report_card_class_term_idx" ON "report_cards" USING btree ("class_id","term_id");--> statement-breakpoint
CREATE INDEX "report_card_school_term_idx" ON "report_cards" USING btree ("school_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scheme_entry_unique_idx" ON "scheme_of_work_entries" USING btree ("scheme_id","week_number","lesson_number");--> statement-breakpoint
CREATE INDEX "scheme_entry_strand_idx" ON "scheme_of_work_entries" USING btree ("strand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scheme_unique_idx" ON "schemes_of_work" USING btree ("term_id","class_id","subject_id");--> statement-breakpoint
CREATE INDEX "scheme_review_queue_idx" ON "schemes_of_work" USING btree ("school_id","term_id") WHERE "schemes_of_work"."status" = 'Submitted';--> statement-breakpoint
CREATE INDEX "scheme_teacher_idx" ON "schemes_of_work" USING btree ("teacher_id","term_id");--> statement-breakpoint
CREATE INDEX "scheme_class_idx" ON "schemes_of_work" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "sms_school_date_idx" ON "sms_logs" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "sms_provider_idx" ON "sms_logs" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "sms_announcement_idx" ON "sms_logs" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "sms_retry_idx" ON "sms_logs" USING btree ("created_at") WHERE "sms_logs"."status" IN ('Queued', 'Failed');--> statement-breakpoint
CREATE INDEX "sms_created_brin_idx" ON "sms_logs" USING brin ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "student_guardian_unique_idx" ON "student_guardians" USING btree ("student_id","guardian_user_id");--> statement-breakpoint
CREATE INDEX "student_guardian_user_idx" ON "student_guardians" USING btree ("guardian_user_id");--> statement-breakpoint
CREATE INDEX "student_guardian_school_idx" ON "student_guardians" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_one_primary_idx" ON "student_guardians" USING btree ("student_id") WHERE "student_guardians"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "health_student_idx" ON "student_health_records" USING btree ("student_id","recorded_at");--> statement-breakpoint
CREATE INDEX "health_school_type_idx" ON "student_health_records" USING btree ("school_id","record_type");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_school_number_idx" ON "student_invoices" USING btree ("school_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoice_student_term_idx" ON "student_invoices" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "invoice_open_idx" ON "student_invoices" USING btree ("school_id","term_id","due_date") WHERE "student_invoices"."status" IN ('Unpaid', 'Partial', 'Overdue');--> statement-breakpoint
CREATE UNIQUE INDEX "student_transport_student_term_idx" ON "student_transport" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "student_transport_route_term_idx" ON "student_transport" USING btree ("route_id","term_id");--> statement-breakpoint
CREATE INDEX "student_transport_school_idx" ON "student_transport" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "sub_payment_school_idx" ON "subscription_payments" USING btree ("school_id","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "transport_route_school_name_idx" ON "transport_routes" USING btree ("school_id","name");--> statement-breakpoint
CREATE INDEX "session_active_user_idx" ON "user_sessions" USING btree ("user_id") WHERE "user_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "session_expiry_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_school_idx" ON "user_sessions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "vtoken_identifier_purpose_idx" ON "verification_tokens" USING btree ("identifier","purpose","expires_at");--> statement-breakpoint
CREATE INDEX "vtoken_hash_idx" ON "verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "vtoken_user_idx" ON "verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vtoken_expiry_idx" ON "verification_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_provider_event_idx" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_unprocessed_idx" ON "webhook_events" USING btree ("received_at") WHERE "webhook_events"."processed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_exam_id_term_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."term_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_strand_id_curriculum_strands_id_fk" FOREIGN KEY ("strand_id") REFERENCES "public"."curriculum_strands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_sub_strand_id_curriculum_sub_strands_id_fk" FOREIGN KEY ("sub_strand_id") REFERENCES "public"."curriculum_sub_strands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD CONSTRAINT "class_fee_structures_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_invoice_id_student_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."student_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_inventory_id_school_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."school_inventory"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_expenses" ADD CONSTRAINT "school_expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_expenses" ADD CONSTRAINT "school_expenses_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_activity_memberships" ADD CONSTRAINT "student_activity_memberships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollment_history" ADD CONSTRAINT "student_enrollment_history_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollment_history" ADD CONSTRAINT "student_enrollment_history_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_exams" ADD CONSTRAINT "term_exams_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_exams" ADD CONSTRAINT "term_exams_grading_scale_id_grading_scales_id_fk" FOREIGN KEY ("grading_scale_id") REFERENCES "public"."grading_scales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "term_unique_idx" ON "academic_terms" USING btree ("school_id","academic_year","term_name");--> statement-breakpoint
CREATE UNIQUE INDEX "term_one_current_idx" ON "academic_terms" USING btree ("school_id") WHERE "academic_terms"."is_current_term" = true;--> statement-breakpoint
CREATE INDEX "announcement_class_idx" ON "announcements" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "attendance_class_date_idx" ON "attendance" USING btree ("class_id","date");--> statement-breakpoint
CREATE INDEX "attendance_school_date_idx" ON "attendance" USING btree ("school_id","date");--> statement-breakpoint
CREATE INDEX "attendance_absence_idx" ON "attendance" USING btree ("school_id","date") WHERE "attendance"."status" IN ('Absent', 'Late');--> statement-breakpoint
CREATE INDEX "audit_school_time_idx" ON "audit_logs" USING btree ("school_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_time_brin_idx" ON "audit_logs" USING brin ("timestamp");--> statement-breakpoint
CREATE INDEX "cbc_student_term_idx" ON "cbc_assessments" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "cbc_exam_subject_idx" ON "cbc_assessments" USING btree ("exam_id","subject_id");--> statement-breakpoint
CREATE INDEX "cbc_school_term_subject_idx" ON "cbc_assessments" USING btree ("school_id","term_id","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "class_fee_structure_unique_idx" ON "class_fee_structures" USING btree ("term_id","grade_level","fee_item_id");--> statement-breakpoint
CREATE INDEX "class_fee_structure_school_idx" ON "class_fee_structures" USING btree ("school_id","term_id");--> statement-breakpoint
CREATE INDEX "class_fee_structure_item_idx" ON "class_fee_structures" USING btree ("fee_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "class_school_year_grade_stream_idx" ON "classes" USING btree ("school_id","academic_year","grade_level","stream");--> statement-breakpoint
CREATE INDEX "class_teacher_idx" ON "classes" USING btree ("class_teacher_id");--> statement-breakpoint
CREATE INDEX "class_grade_level_idx" ON "classes" USING btree ("grade_level_id");--> statement-breakpoint
CREATE INDEX "activity_patron_idx" ON "co_curricular_activities" USING btree ("patron_teacher_id");--> statement-breakpoint
CREATE INDEX "message_inbox_idx" ON "direct_messages" USING btree ("receiver_id","sent_at");--> statement-breakpoint
CREATE INDEX "message_unread_idx" ON "direct_messages" USING btree ("receiver_id") WHERE "direct_messages"."is_read" = false;--> statement-breakpoint
CREATE INDEX "message_school_idx" ON "direct_messages" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "discipline_school_date_idx" ON "disciplinary_records" USING btree ("school_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_item_school_name_idx" ON "fee_items" USING btree ("school_id","name");--> statement-breakpoint
CREATE INDEX "fee_invoice_idx" ON "fee_transactions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "fee_school_date_idx" ON "fee_transactions" USING btree ("school_id","transaction_date");--> statement-breakpoint
CREATE INDEX "fee_pending_checkout_idx" ON "fee_transactions" USING btree ("mpesa_checkout_request_id") WHERE "fee_transactions"."status" = 'Pending';--> statement-breakpoint
CREATE INDEX "homework_class_due_idx" ON "homework_assignments" USING btree ("class_id","due_date");--> statement-breakpoint
CREATE INDEX "homework_teacher_idx" ON "homework_assignments" USING btree ("teacher_id","due_date");--> statement-breakpoint
CREATE INDEX "homework_school_idx" ON "homework_assignments" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "homework_subject_idx" ON "homework_assignments" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "submission_student_idx" ON "homework_submissions" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "submission_school_idx" ON "homework_submissions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "submission_to_grade_idx" ON "homework_submissions" USING btree ("assignment_id") WHERE "homework_submissions"."status" = 'Submitted';--> statement-breakpoint
CREATE INDEX "library_inventory_idx" ON "library_loans" USING btree ("inventory_id");--> statement-breakpoint
CREATE INDEX "library_open_loans_idx" ON "library_loans" USING btree ("school_id","due_date") WHERE "library_loans"."status" IN ('Borrowed', 'Overdue');--> statement-breakpoint
CREATE INDEX "expense_school_date_idx" ON "school_expenses" USING btree ("school_id","expense_date");--> statement-breakpoint
CREATE INDEX "expense_school_category_idx" ON "school_expenses" USING btree ("school_id","category","expense_date");--> statement-breakpoint
CREATE INDEX "inventory_school_category_idx" ON "school_inventory" USING btree ("school_id","category");--> statement-breakpoint
CREATE INDEX "inventory_school_isbn_idx" ON "school_inventory" USING btree ("school_id","isbn");--> statement-breakpoint
CREATE INDEX "school_expiring_idx" ON "schools" USING btree ("subscription_expires_at") WHERE "schools"."subscription_status" IN ('Active', 'PastDue');--> statement-breakpoint
CREATE UNIQUE INDEX "membership_unique_idx" ON "student_activity_memberships" USING btree ("student_id","activity_id","term_id");--> statement-breakpoint
CREATE INDEX "membership_activity_term_idx" ON "student_activity_memberships" USING btree ("activity_id","term_id");--> statement-breakpoint
CREATE INDEX "membership_school_idx" ON "student_activity_memberships" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_history_unique_idx" ON "student_enrollment_history" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "student_history_class_term_idx" ON "student_enrollment_history" USING btree ("class_id","term_id");--> statement-breakpoint
CREATE INDEX "student_history_school_term_idx" ON "student_enrollment_history" USING btree ("school_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_school_upi_idx" ON "students" USING btree ("school_id","upi_number");--> statement-breakpoint
CREATE INDEX "student_active_roster_idx" ON "students" USING btree ("school_id","class_id") WHERE "students"."is_enrolled" = true AND "students"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "student_name_idx" ON "students" USING btree ("school_id","last_name","first_name");--> statement-breakpoint
CREATE INDEX "teacher_subject_subject_idx" ON "teacher_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "term_exam_school_term_idx" ON "term_exams" USING btree ("school_id","term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_class_slot_idx" ON "timetables" USING btree ("class_id","day_of_week","period_number");--> statement-breakpoint
CREATE INDEX "timetable_teacher_day_idx" ON "timetables" USING btree ("teacher_id","day_of_week","period_number");--> statement-breakpoint
CREATE INDEX "timetable_school_idx" ON "timetables" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "timetable_subject_idx" ON "timetables" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_platform_email_idx" ON "users" USING btree ("email") WHERE "users"."school_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_school_national_id_idx" ON "users" USING btree ("school_id","national_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_school_tsc_idx" ON "users" USING btree ("school_id","tsc_number");--> statement-breakpoint
CREATE INDEX "user_school_role_idx" ON "users" USING btree ("school_id","role");--> statement-breakpoint
CREATE INDEX "announcement_school_audience_idx" ON "announcements" USING btree ("school_id","target_audience","created_at");--> statement-breakpoint
CREATE INDEX "message_thread_idx" ON "direct_messages" USING btree ("sender_id","receiver_id","sent_at");--> statement-breakpoint
CREATE INDEX "discipline_student_idx" ON "disciplinary_records" USING btree ("student_id","date");--> statement-breakpoint
CREATE INDEX "fee_student_idx" ON "fee_transactions" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "event_school_idx" ON "school_events" USING btree ("school_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "student_user_idx" ON "students" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_subject_idx" ON "teacher_subjects" USING btree ("teacher_id","subject_id");--> statement-breakpoint
CREATE INDEX "term_window_idx" ON "term_windows" USING btree ("term_id","start_date");--> statement-breakpoint
ALTER TABLE "student_enrollment_history" DROP COLUMN "grade_level";--> statement-breakpoint
ALTER TABLE "student_enrollment_history" DROP COLUMN "stream";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "parent_id";--> statement-breakpoint
ALTER TABLE "timetables" DROP COLUMN "grade_level";--> statement-breakpoint
ALTER TABLE "timetables" DROP COLUMN "stream";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "parent_id";--> statement-breakpoint
ALTER TABLE "academic_terms" ADD CONSTRAINT "term_dates_chk" CHECK ("academic_terms"."end_date" > "academic_terms"."start_date");--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_score_chk" CHECK ("cbc_assessments"."score_value" IS NULL OR "cbc_assessments"."out_of" IS NULL OR ("cbc_assessments"."score_value" >= 0 AND "cbc_assessments"."score_value" <= "cbc_assessments"."out_of"));--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD CONSTRAINT "class_fee_amount_chk" CHECK ("class_fee_structures"."amount" >= 0);--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_amount_chk" CHECK ("fee_transactions"."amount_paid" > 0);--> statement-breakpoint
ALTER TABLE "school_events" ADD CONSTRAINT "event_dates_chk" CHECK ("school_events"."end_date" >= "school_events"."start_date");--> statement-breakpoint
ALTER TABLE "school_expenses" ADD CONSTRAINT "expense_amount_chk" CHECK ("school_expenses"."amount" > 0);--> statement-breakpoint
ALTER TABLE "school_inventory" ADD CONSTRAINT "inventory_qty_chk" CHECK ("school_inventory"."available_quantity" >= 0 AND "school_inventory"."available_quantity" <= "school_inventory"."total_quantity");--> statement-breakpoint
ALTER TABLE "term_windows" ADD CONSTRAINT "term_window_dates_chk" CHECK ("term_windows"."end_date" >= "term_windows"."start_date");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "user_school_required_chk" CHECK ("users"."role" = 'super_admin' OR "users"."school_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "user_email_lower_chk" CHECK ("users"."email" = lower("users"."email"));