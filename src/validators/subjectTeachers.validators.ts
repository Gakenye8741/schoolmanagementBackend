import { z } from "zod";

// 1. Schema for assigning a single teacher to a subject
export const assignTeacherSubjectSchema = z.object({
  teacherId: z.string().uuid({ message: "Invalid teacher ID format." }),
  subjectId: z.string().uuid({ message: "Invalid subject ID format." }),
});

// 2. Schema for bulk assigning multiple subjects to a teacher
export const bulkAssignSubjectsSchema = z.object({
  teacherId: z.string().uuid({ message: "Invalid teacher ID format." }),
  subjectIds: z
    .array(z.string().uuid({ message: "Invalid subject ID format in array." }))
    .min(1, { message: "At least one subject ID must be provided for bulk assignment." }),
});

// 3. Schema for syncing/replacing all subject assignments for a teacher
export const syncTeacherSubjectsSchema = z.object({
  teacherId: z.string().uuid({ message: "Invalid teacher ID format." }),
  subjectIds: z
    .array(z.string().uuid({ message: "Invalid subject ID format in array." })),
});

// 4. Schema for validating route parameters (teacherId or subjectId)
export const teacherSubjectParamsSchema = z.object({
  teacherId: z.string().uuid({ message: "Invalid teacher ID format." }).optional(),
  subjectId: z.string().uuid({ message: "Invalid subject ID format." }).optional(),
});

// TypeScript inference types for validation outputs
export type AssignTeacherSubjectInput = z.infer<typeof assignTeacherSubjectSchema>;
export type BulkAssignSubjectsInput = z.infer<typeof bulkAssignSubjectsSchema>;
export type SyncTeacherSubjectsInput = z.infer<typeof syncTeacherSubjectsSchema>;
export type TeacherSubjectParamsInput = z.infer<typeof teacherSubjectParamsSchema>;