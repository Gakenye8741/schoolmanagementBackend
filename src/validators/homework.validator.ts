// src/services/homework/homework.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

const isoDateTime = z
  .string()
  .datetime({ message: "Must be a valid ISO 8601 datetime (e.g. 2026-11-20T15:00:00Z)." });

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    },
    { message: "Invalid calendar date." }
  );

/** Decimal 0–1000 with up to 2dp (max score for an assignment). */
const positiveDecimal = (field: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d{1,4}(\.\d{1,2})?$/.test(v), {
      message: `${field} must be a valid number (up to 2 decimals).`,
    })
    .refine((v) => Number(v) >= 0, {
      message: `${field} cannot be negative.`,
    });

/** Grade score is 0–1000 (matches gradeScore decimal). */
const gradeScore = positiveDecimal("gradeScore");

const assignmentStatus = z.enum(
  ["Pending", "Submitted", "Graded", "Late"],
  {
    errorMap: () => ({
      message: 'Status must be one of: "Pending", "Submitted", "Graded", "Late".',
    }),
  }
);

// ================================================================
// ASSIGNMENTS — CREATE
// ================================================================
const assignmentObjectSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  subjectId: uuid("subject ID"),
  teacherId: uuid("teacher ID"),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
  description: z.string().trim().min(2, "Description must be at least 2 characters.").max(10000),
  attachmentUrl: z.string().url("Attachment must be a valid URL.").optional().nullable(),
  maxScore: positiveDecimal("maxScore").optional().nullable(),
  dueDate: isoDateTime,
  notify: z.boolean().optional().default(true),
});

export const createAssignmentSchema = assignmentObjectSchema
  .refine(
    (d) => {
      const due = new Date(d.dueDate);
      return !Number.isNaN(due.getTime()) && due > new Date();
    },
    {
      message: "dueDate must be in the future.",
      path: ["dueDate"],
    }
  );

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

// ================================================================
// ASSIGNMENTS — UPDATE
// ================================================================
export const updateAssignmentSchema = z
  .object({
    title: z.string().trim().min(2).max(255).optional(),
    description: z.string().trim().min(2).max(10000).optional(),
    attachmentUrl: z.string().url("Attachment must be a valid URL.").optional().nullable(),
    maxScore: positiveDecimal("maxScore").optional().nullable(),
    dueDate: isoDateTime.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

// ================================================================
// ASSIGNMENTS — QUERIES
// ================================================================
export const listAssignmentsQuerySchema = z.object({
  fromDate: isoDateTime.optional(),
  toDate: isoDateTime.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export type ListAssignmentsQueryInput = z.infer<typeof listAssignmentsQuerySchema>;

// ================================================================
// SUBMISSIONS — SUBMIT
// ================================================================
export const submitHomeworkSchema = z
  .object({
    schoolId: uuid("school ID"),
    assignmentId: uuid("assignment ID"),
    studentId: uuid("student ID"),
    submissionText: z.string().trim().max(10000).optional().nullable(),
    attachmentUrl: z.string().url("Attachment must be a valid URL.").optional().nullable(),
  })
  .refine(
    (d) =>
      (d.submissionText && d.submissionText.trim().length > 0) ||
      (d.attachmentUrl && d.attachmentUrl.trim().length > 0),
    {
      message: "Provide submission text or an attachment.",
      path: ["submissionText"],
    }
  );

export type SubmitHomeworkInput = z.infer<typeof submitHomeworkSchema>;

// ================================================================
// SUBMISSIONS — GRADE
// ================================================================
export const gradeSubmissionSchema = z
  .object({
    gradeScore: gradeScore.optional().nullable(),
    teacherFeedback: z.string().trim().max(5000).optional().nullable(),
  })
  .refine(
    (d) => d.gradeScore !== undefined || d.teacherFeedback !== undefined,
    { message: "Provide a grade score or teacher feedback." }
  );

export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

// ================================================================
// SUBMISSIONS — RETURN FOR RESUBMISSION
// ================================================================
export const returnForResubmissionSchema = z.object({
  feedback: z.string().trim().max(5000).optional().nullable(),
});

export type ReturnForResubmissionInput = z.infer<typeof returnForResubmissionSchema>;

// ================================================================
// SUBMISSIONS — BULK GRADE
// ================================================================
export const bulkGradeSubmissionsSchema = z.object({
  items: z
    .array(
      z.object({
        submissionId: uuid("submission ID"),
        gradeScore: gradeScore.optional().nullable(),
        teacherFeedback: z.string().trim().max(5000).optional().nullable(),
      })
    )
    .min(1, "At least one submission is required.")
    .max(200, "Cannot grade more than 200 submissions at once.")
    .refine(
      (items) => new Set(items.map((i) => i.submissionId)).size === items.length,
      { message: "Duplicate submission IDs are not allowed." }
    ),
});

export type BulkGradeSubmissionsInput = z.infer<typeof bulkGradeSubmissionsSchema>;

// ================================================================
// SUBMISSIONS — LIST QUERIES
// ================================================================
export const listSubmissionsQuerySchema = z.object({
  status: assignmentStatus.optional(),
});

export type ListSubmissionsQueryInput = z.infer<typeof listSubmissionsQuerySchema>;

// ================================================================
// ROUTE PARAMS
// ================================================================
export const assignmentIdParamSchema = z.object({
  assignmentId: uuid("assignment ID"),
});

export const submissionIdParamSchema = z.object({
  submissionId: uuid("submission ID"),
});

export const classIdParamSchema = z.object({
  classId: uuid("class ID"),
});

export const subjectIdParamSchema = z.object({
  subjectId: uuid("subject ID"),
});

export const teacherIdParamSchema = z.object({
  teacherId: uuid("teacher ID"),
});

export const studentIdParamSchema = z.object({
  studentId: uuid("student ID"),
});

export const schoolIdParamSchema = z.object({
  schoolId: uuid("school ID"),
});

export const assignmentStudentParamSchema = z.object({
  assignmentId: uuid("assignment ID"),
  studentId: uuid("student ID"),
});