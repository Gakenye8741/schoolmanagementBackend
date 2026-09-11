ALTER TABLE "users" ADD COLUMN "national_id" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tsc_number" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "user_tsc_idx" ON "users" USING btree ("tsc_number");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_national_id_unique" UNIQUE("national_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tsc_number_unique" UNIQUE("tsc_number");