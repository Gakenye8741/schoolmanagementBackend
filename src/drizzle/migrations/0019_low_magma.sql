DROP INDEX "class_fee_structure_unique_idx";--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD COLUMN "class_id" uuid;--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD COLUMN "grade_level_id" uuid;--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD COLUMN "boarding_status" "boarding_status" DEFAULT 'Day' NOT NULL;--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD CONSTRAINT "class_fee_structures_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_fee_structures" ADD CONSTRAINT "class_fee_structures_grade_level_id_grade_levels_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_fee_structure_schoolwide_idx" ON "class_fee_structures" USING btree ("term_id","fee_item_id","boarding_status") WHERE "class_fee_structures"."grade_level_id" IS NULL AND "class_fee_structures"."class_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "class_fee_structure_gradewide_idx" ON "class_fee_structures" USING btree ("term_id","fee_item_id","boarding_status","grade_level_id") WHERE "class_fee_structures"."grade_level_id" IS NOT NULL AND "class_fee_structures"."class_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "class_fee_structure_classspecific_idx" ON "class_fee_structures" USING btree ("term_id","fee_item_id","boarding_status","grade_level_id","class_id") WHERE "class_fee_structures"."grade_level_id" IS NOT NULL AND "class_fee_structures"."class_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "class_fee_structure_grade_idx" ON "class_fee_structures" USING btree ("grade_level_id");--> statement-breakpoint
CREATE INDEX "class_fee_structure_class_idx" ON "class_fee_structures" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "class_fee_structure_boarding_idx" ON "class_fee_structures" USING btree ("school_id","boarding_status");--> statement-breakpoint
ALTER TABLE "class_fee_structures" DROP COLUMN "grade_level";