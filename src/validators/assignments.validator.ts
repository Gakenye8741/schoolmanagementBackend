import { z } from "zod";

// ==========================================
// HOMEWORK ASSIGNMENTS VALIDATORS
// ==========================================

export const createHomeworkAssignmentSchema = z.object({
  classId: z.string().uuid("Invalid class ID format."),
  subjectId: z.string().uuid("Invalid subject ID format."),
  teacherId: z.string().uuid("Invalid teacher ID format."),
  title: z.string().min(3, "Title must be at least 3 characters long.").max(255, "Title cannot exceed 255 characters."),
  description: z.string().min(5, "Description must be at least 5 characters long."),
  dueDate: z.string().datetime({ message: "Due date must be a valid ISO 8601 timestamp string." }).transform((val) => new Date(val)),
});

export const updateHomeworkAssignmentSchema = createHomeworkAssignmentSchema.partial();


// ==========================================
// HOMEWORK SUBMISSIONS VALIDATORS
// ==========================================

export const upsertHomeworkSubmissionSchema = z.object({
  assignmentId: z.string().uuid("Invalid assignment ID format."),
  studentId: z.string().uuid("Invalid student ID format."),
  submissionText: z.string().optional().nullable(),
  status: z.enum(["Pending", "Submitted", "Graded", "Late"], {
    errorMap: () => ({ message: "Status must be one of: Pending, Submitted, Graded, Late." }),
  }).default("Submitted"),
  gradeScore: z.union([z.string(), z.number()]).optional().nullable().transform((val) => val !== undefined && val !== null ? String(val) : null),
  submittedAt: z.string().datetime({ message: "Submitted date must be a valid ISO 8601 timestamp string." }).optional().nullable().transform((val) => val ? new Date(val) : new Date()),
});

export const gradeHomeworkSubmissionSchema = z.object({
  gradeScore: z.union([z.string(), z.number()], {
    errorMap: () => ({ message: "Grade score is required and must be a valid number or string." }),
  }).transform((val) => String(val)),
});


// TypeScript Type Inference
export type TCreateHomeworkAssignmentInput = z.infer<typeof createHomeworkAssignmentSchema>;
export type TUpdateHomeworkAssignmentInput = z.infer<typeof updateHomeworkAssignmentSchema>;

export type TUpsertHomeworkSubmissionInput = z.infer<typeof upsertHomeworkSubmissionSchema>;
export type TGradeHomeworkSubmissionInput = z.infer<typeof gradeHomeworkSubmissionSchema>;