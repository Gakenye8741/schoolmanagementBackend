ALTER TABLE "users" ADD COLUMN "admission_number" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
CREATE INDEX "user_admission_idx" ON "users" USING btree ("admission_number");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admission_number_unique" UNIQUE("admission_number");