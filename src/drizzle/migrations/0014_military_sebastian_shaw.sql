ALTER TABLE "students" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_user_idx" ON "students" USING btree ("user_id");