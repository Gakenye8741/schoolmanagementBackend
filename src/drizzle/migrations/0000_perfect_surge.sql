CREATE TYPE "public"."assignment_status" AS ENUM('Pending', 'Submitted', 'Graded');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('Present', 'Absent', 'Late');--> statement-breakpoint
CREATE TYPE "public"."audience" AS ENUM('All', 'Parents', 'Teachers');--> statement-breakpoint
CREATE TYPE "public"."discipline_incident" AS ENUM('Merit', 'Warning', 'Late-coming');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('Active', 'Promoted', 'Transferred');--> statement-breakpoint
CREATE TYPE "public"."event_category" AS ENUM('Academic', 'Sports', 'Holiday', 'Meeting', 'General');--> statement-breakpoint
CREATE TYPE "public"."exam_category" AS ENUM('Opener', 'Mid-Term', 'End-Term');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('Salary', 'Utilities', 'Maintenance', 'Supplies', 'Transport');--> statement-breakpoint
CREATE TYPE "public"."inventory_category" AS ENUM('Textbook', 'CBC Apparatus', 'Stationery');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('Borrowed', 'Returned', 'Overdue');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('M-Pesa', 'Bank', 'Cash');--> statement-breakpoint
CREATE TYPE "public"."performance_level" AS ENUM('EE', 'ME', 'AE', 'BE');--> statement-breakpoint
CREATE TYPE "public"."subject_category" AS ENUM('Core', 'Optional');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'bursar', 'teacher', 'parent', 'student');--> statement-breakpoint
CREATE TABLE "academic_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academic_year" varchar(20) NOT NULL,
	"term_name" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_current_term" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"target_audience" "audience" NOT NULL,
	"posted_by" uuid NOT NULL,
	"send_via_sms" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"marked_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"ip_address" varchar(45),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cbc_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"strand" varchar(255) NOT NULL,
	"sub_strand" varchar(255),
	"score_value" numeric(5, 2),
	"out_of" numeric(5, 2) DEFAULT '20.00',
	"performance_level" "performance_level" NOT NULL,
	"teacher_remarks" text,
	"assessed_by" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_fee_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"grade_level" varchar(50) NOT NULL,
	"fee_item_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_level" varchar(50) NOT NULL,
	"stream" varchar(50) NOT NULL,
	"class_teacher_id" uuid,
	"academic_year" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "co_curricular_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"patron_teacher_id" uuid
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"message_text" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disciplinary_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"recorded_by" uuid NOT NULL,
	"incident_type" "discipline_incident" NOT NULL,
	"description" text NOT NULL,
	"action_taken" text,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_optional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"amount_paid" numeric(10, 2) NOT NULL,
	"balance_remaining" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference_code" varchar(100) NOT NULL,
	"term_id" uuid NOT NULL,
	"recorded_by" uuid,
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fee_transactions_reference_code_unique" UNIQUE("reference_code")
);
--> statement-breakpoint
CREATE TABLE "homework_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"due_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"submission_text" text,
	"status" "assignment_status" DEFAULT 'Pending' NOT NULL,
	"grade_score" numeric(5, 2),
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "library_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"borrow_date" date DEFAULT now() NOT NULL,
	"due_date" date NOT NULL,
	"return_date" date,
	"status" "loan_status" DEFAULT 'Borrowed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" "event_category" NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"posted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "school_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(150) NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference_code" varchar(100),
	"recorded_by" uuid NOT NULL,
	"expense_date" date NOT NULL,
	CONSTRAINT "school_expenses_reference_code_unique" UNIQUE("reference_code")
);
--> statement-breakpoint
CREATE TABLE "school_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_name" varchar(150) NOT NULL,
	"category" "inventory_category" NOT NULL,
	"total_quantity" integer NOT NULL,
	"available_quantity" integer NOT NULL,
	"unit_condition" varchar(50) DEFAULT 'Good' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_activity_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"performance_role" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "student_enrollment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"grade_level" varchar(50) NOT NULL,
	"stream" varchar(50) NOT NULL,
	"status" "enrollment_status" DEFAULT 'Active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admission_number" varchar(50) NOT NULL,
	"upi_number" varchar(100),
	"user_id" uuid,
	"parent_id" uuid,
	"class_id" uuid,
	"date_of_birth" date,
	"gender" varchar(20),
	"enrollment_date" date DEFAULT now() NOT NULL,
	"is_enrolled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "students_admission_number_unique" UNIQUE("admission_number"),
	CONSTRAINT "students_upi_number_unique" UNIQUE("upi_number")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"category" "subject_category" NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "teacher_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "term_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"exam_title" varchar(100) NOT NULL,
	"exam_category" "exam_category" NOT NULL,
	"start_date" date,
	"end_date" date,
	"is_locked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timetables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_level" varchar(50) NOT NULL,
	"stream" varchar(50) NOT NULL,
	"day_of_week" varchar(20) NOT NULL,
	"period_number" integer NOT NULL,
	"subject_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_exam_id_term_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."term_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbc_assessments" ADD CONSTRAINT "cbc_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD CONSTRAINT "class_fee_structures_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD CONSTRAINT "class_fee_structures_fee_item_id_fee_items_id_fk" FOREIGN KEY ("fee_item_id") REFERENCES "public"."fee_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_class_teacher_id_users_id_fk" FOREIGN KEY ("class_teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_curricular_activities" ADD CONSTRAINT "co_curricular_activities_patron_teacher_id_users_id_fk" FOREIGN KEY ("patron_teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplinary_records" ADD CONSTRAINT "disciplinary_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_assignment_id_homework_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."homework_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_inventory_id_school_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."school_inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_expenses" ADD CONSTRAINT "school_expenses_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_activity_memberships" ADD CONSTRAINT "student_activity_memberships_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_activity_memberships" ADD CONSTRAINT "student_activity_memberships_activity_id_co_curricular_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."co_curricular_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_activity_memberships" ADD CONSTRAINT "student_activity_memberships_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollment_history" ADD CONSTRAINT "student_enrollment_history_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollment_history" ADD CONSTRAINT "student_enrollment_history_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_exams" ADD CONSTRAINT "term_exams_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_audience_idx" ON "announcements" USING btree ("target_audience");--> statement-breakpoint
CREATE INDEX "attendance_student_date_idx" ON "attendance" USING btree ("student_id","date");--> statement-breakpoint
CREATE INDEX "assessment_student_exam_subject_idx" ON "cbc_assessments" USING btree ("student_id","exam_id","subject_id");--> statement-breakpoint
CREATE INDEX "class_fee_structure_idx" ON "class_fee_structures" USING btree ("term_id","grade_level");--> statement-breakpoint
CREATE INDEX "message_thread_idx" ON "direct_messages" USING btree ("sender_id","receiver_id");--> statement-breakpoint
CREATE INDEX "discipline_student_idx" ON "disciplinary_records" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "fee_student_idx" ON "fee_transactions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "fee_ref_idx" ON "fee_transactions" USING btree ("reference_code");--> statement-breakpoint
CREATE INDEX "library_student_idx" ON "library_loans" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_history_idx" ON "student_enrollment_history" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX "student_adm_idx" ON "students" USING btree ("admission_number");--> statement-breakpoint
CREATE INDEX "student_class_idx" ON "students" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "teacher_subject_idx" ON "teacher_subjects" USING btree ("teacher_id","subject_id");--> statement-breakpoint
CREATE INDEX "term_exam_idx" ON "term_exams" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "timetable_class_day_idx" ON "timetables" USING btree ("grade_level","stream","day_of_week");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "users" USING btree ("role");