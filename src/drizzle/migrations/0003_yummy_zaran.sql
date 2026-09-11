CREATE TYPE "public"."curriculum_type" AS ENUM('CBC', '8-4-4', 'IGCSE', 'Other');--> statement-breakpoint
CREATE TYPE "public"."school_type" AS ENUM('Primary', 'Secondary', 'Mixed', 'ECDE');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('Trial', 'Basic', 'Premium', 'Enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('Active', 'PastDue', 'Suspended', 'Cancelled');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'school_admin' BEFORE 'bursar';--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"short_name" varchar(50),
	"slug" varchar(100) NOT NULL,
	"motto" varchar(255),
	"registration_number" varchar(100),
	"knec_code" varchar(50),
	"school_type" "school_type" NOT NULL,
	"curriculum_type" "curriculum_type" DEFAULT 'CBC' NOT NULL,
	"established_year" integer,
	"logo_url" text,
	"favicon_url" text,
	"cover_image_url" text,
	"primary_color" varchar(9) DEFAULT '#0F172A' NOT NULL,
	"secondary_color" varchar(9) DEFAULT '#64748B' NOT NULL,
	"accent_color" varchar(9),
	"gradient_from" varchar(9),
	"gradient_to" varchar(9),
	"gradient_direction" varchar(20) DEFAULT 'to-r',
	"address" text,
	"county" varchar(100),
	"sub_county" varchar(100),
	"phone" varchar(20),
	"alternative_phone" varchar(20),
	"email" varchar(255),
	"website" text,
	"timezone" varchar(50) DEFAULT 'Africa/Nairobi' NOT NULL,
	"currency" varchar(10) DEFAULT 'KES' NOT NULL,
	"principal_name" varchar(150),
	"subscription_plan" "subscription_plan" DEFAULT 'Trial' NOT NULL,
	"subscription_status" "subscription_status" DEFAULT 'Active' NOT NULL,
	"subscription_expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug"),
	CONSTRAINT "schools_registration_number_unique" UNIQUE("registration_number"),
	CONSTRAINT "schools_knec_code_unique" UNIQUE("knec_code")
);
--> statement-breakpoint
ALTER TABLE "fee_transactions" DROP CONSTRAINT "fee_transactions_reference_code_unique";--> statement-breakpoint
ALTER TABLE "school_expenses" DROP CONSTRAINT "school_expenses_reference_code_unique";--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT "students_admission_number_unique";--> statement-breakpoint
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_code_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_admission_number_unique";--> statement-breakpoint
DROP INDEX "announcement_audience_idx";--> statement-breakpoint
DROP INDEX "fee_ref_idx";--> statement-breakpoint
DROP INDEX "student_adm_idx";--> statement-breakpoint
DROP INDEX "user_email_idx";--> statement-breakpoint
DROP INDEX "user_admission_idx";--> statement-breakpoint
DROP INDEX "attendance_student_date_idx";--> statement-breakpoint
DROP INDEX "timetable_class_day_idx";--> statement-breakpoint
ALTER TABLE "academic_terms" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "school_id" uuid;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "co_curricular_activities" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_items" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "school_events" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "school_expenses" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "school_inventory" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "timetables" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
CREATE INDEX "school_slug_idx" ON "schools" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "school_active_idx" ON "schools" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_curricular_activities" ADD CONSTRAINT "co_curricular_activities_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_transactions" ADD CONSTRAINT "fee_transactions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_expenses" ADD CONSTRAINT "school_expenses_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_inventory" ADD CONSTRAINT "school_inventory_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "term_school_idx" ON "academic_terms" USING btree ("school_id","academic_year");--> statement-breakpoint
CREATE INDEX "announcement_school_audience_idx" ON "announcements" USING btree ("school_id","target_audience");--> statement-breakpoint
CREATE INDEX "audit_school_idx" ON "audit_logs" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "class_school_idx" ON "classes" USING btree ("school_id","grade_level","stream");--> statement-breakpoint
CREATE INDEX "activity_school_idx" ON "co_curricular_activities" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "fee_item_school_idx" ON "fee_items" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_school_ref_idx" ON "fee_transactions" USING btree ("school_id","reference_code");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_assignment_student_idx" ON "homework_submissions" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE INDEX "event_school_idx" ON "school_events" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_school_ref_idx" ON "school_expenses" USING btree ("school_id","reference_code");--> statement-breakpoint
CREATE INDEX "inventory_school_idx" ON "school_inventory" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_school_adm_idx" ON "students" USING btree ("school_id","admission_number");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_school_code_idx" ON "subjects" USING btree ("school_id","code");--> statement-breakpoint
CREATE INDEX "user_school_idx" ON "users" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_school_email_idx" ON "users" USING btree ("school_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_school_admission_idx" ON "users" USING btree ("school_id","admission_number");--> statement-breakpoint
CREATE INDEX "user_email_lookup_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_admission_lookup_idx" ON "users" USING btree ("admission_number");--> statement-breakpoint
CREATE INDEX "user_phone_lookup_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_student_date_idx" ON "attendance" USING btree ("student_id","date");--> statement-breakpoint
CREATE INDEX "timetable_class_day_idx" ON "timetables" USING btree ("school_id","grade_level","stream","day_of_week");