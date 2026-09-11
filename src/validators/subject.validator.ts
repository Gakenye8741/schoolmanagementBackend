import { z } from "zod";

// Enum for subject categories based on CBC Junior School curriculum
export const SubjectCategoryEnum = z.enum([
  "Core",
  "Optional",
  "Technical",
  "Other"
], {
  errorMap: () => ({ message: "Invalid subject category. Must be Core, Optional, Technical, or Other." })
});

// 1. Schema for creating a single subject
export const createSubjectSchema = z.object({
  schoolId: z.string().uuid({ message: "Invalid school ID format." }),
  name: z
    .string({ required_error: "Subject name is required." })
    .min(2, { message: "Subject name must be at least 2 characters long." })
    .max(100, { message: "Subject name cannot exceed 100 characters." }),
  code: z
    .string({ required_error: "Subject code is required." })
    .min(2, { message: "Subject code must be at least 2 characters long." })
    .max(20, { message: "Subject code cannot exceed 20 characters." }),
  category: SubjectCategoryEnum,
});

// 2. Schema for bulk creating subjects (an array of subject objects)
export const bulkCreateSubjectsSchema = z.object({
  subjects: z
    .array(createSubjectSchema)
    .min(1, { message: "At least one subject must be provided for bulk upload." }),
});

// 3. Schema for updating subject details (all fields optional)
export const updateSubjectSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Subject name must be at least 2 characters long." })
    .max(100, { message: "Subject name cannot exceed 100 characters." })
    .optional(),
  code: z
    .string()
    .min(2, { message: "Subject code must be at least 2 characters long." })
    .max(20, { message: "Subject code cannot exceed 20 characters." })
    .optional(),
  category: SubjectCategoryEnum.optional(),
});

// 4. Schema for assigning or removing a teacher from a subject
export const assignTeacherToSubjectSchema = z.object({
  teacherId: z.string().uuid({ message: "Invalid teacher ID format." }),
});

// TypeScript inference types for validation outputs
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type BulkCreateSubjectsInput = z.infer<typeof bulkCreateSubjectsSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type AssignTeacherToSubjectInput = z.infer<typeof assignTeacherToSubjectSchema>;