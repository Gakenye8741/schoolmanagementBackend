import { z } from "zod";
import { eventCategories } from "../drizzle/schema";

// ==========================================
// ZOD SCHEMAS & VALIDATORS
// ==========================================

export const insertSchoolEventSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID format."),
  title: z.string().min(3, "Title must be at least 3 characters long.").max(255),
  description: z.string().optional().nullable(),
  category: z.enum(eventCategories, {
    message: "Invalid event category selected.",
  }),
  startDate: z.coerce.date({ message: "A valid start date is required." }),
  endDate: z.coerce.date({ message: "A valid end date is required." }).optional().nullable(),
  location: z.string().optional().nullable(),
  postedBy: z.string().uuid("Invalid user ID format.").optional().nullable(),
}).refine((data) => {
  if (data.endDate && data.startDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}, {
  message: "End date must be greater than or equal to start date.",
  path: ["endDate"],
});

export const updateSchoolEventSchema = insertSchoolEventSchema.partial();

export const insertCoCurricularActivitySchema = z.object({
  schoolId: z.string().uuid("Invalid school ID format."),
  name: z.string().min(2, "Activity name must be at least 2 characters long.").max(255),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  patronTeacherId: z.string().uuid("Invalid patron teacher ID format.").optional().nullable(),
});

export const updateCoCurricularActivitySchema = insertCoCurricularActivitySchema.partial();

export const insertStudentActivityMembershipSchema = z.object({
  studentId: z.string().uuid("Invalid student ID format."),
  activityId: z.string().uuid("Invalid activity ID format."),
  termId: z.string().uuid("Invalid term ID format."),
});

export const updateStudentActivityMembershipSchema = insertStudentActivityMembershipSchema.partial();

export const bulkEnrollStudentsSchema = z.object({
  activityId: z.string().uuid("Invalid activity ID format."),
  termId: z.string().uuid("Invalid term ID format."),
  studentIds: z.array(z.string().uuid("Invalid student ID format in array.")).min(1, "At least one student must be provided."),
});

// TypeScript Inference Types
export type TInsertSchoolEvent = z.infer<typeof insertSchoolEventSchema>;
export type TInsertCoCurricularActivity = z.infer<typeof insertCoCurricularActivitySchema>;
export type TInsertStudentActivityMembership = z.infer<typeof insertStudentActivityMembershipSchema>;
export type TBulkEnrollStudents = z.infer<typeof bulkEnrollStudentsSchema>;