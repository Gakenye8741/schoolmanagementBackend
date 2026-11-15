// src/validators/lessonPlans.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const approvalStatusEnum = z.enum(["Draft", "Submitted", "Approved", "Rejected"]);

// ================================================================
// SCHEMES OF WORK
// ================================================================
export const createSchemeSchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
  classId: uuid("class ID"),
  subjectId: uuid("subject ID"),
  teacherId: uuid("teacher ID").optional(), // defaults to req.user.id
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
});

export const bulkCreateSchemesSchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
  teacherId: uuid("teacher ID").optional(),
  schemes: z
    .array(
      z.object({
        classId: uuid("class ID"),
        subjectId: uuid("subject ID"),
        title: z.string().trim().min(2).max(255),
      })
    )
    .min(1, "At least one scheme is required.")
    .max(50, "Cannot create more than 50 schemes at once."),
});

export const updateSchemeSchema = z
  .object({
    title: z.string().trim().min(2).max(255).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const rejectSchema = z.object({
  reviewComments: z.string().trim().min(5, "Please provide review comments.").max(5000),
});

export const listSchemesQuerySchema = z.object({
  termId: uuid("term ID").optional(),
  classId: uuid("class ID").optional(),
  subjectId: uuid("subject ID").optional(),
  teacherId: uuid("teacher ID").optional(),
  status: approvalStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ================================================================
// SCHEME ENTRIES
// ================================================================
export const createEntrySchema = z.object({
  schemeId: uuid("scheme ID"),
  weekNumber: z.coerce.number().int().min(1).max(52),
  lessonNumber: z.coerce.number().int().min(1).max(50),
  topic: z.string().trim().min(2, "Topic must be at least 2 characters.").max(255),
  strandId: uuid("strand ID").optional().nullable(),
  subStrandId: uuid("sub-strand ID").optional().nullable(),
  objectives: z.string().trim().max(5000).optional().nullable(),
  learningActivities: z.string().trim().max(5000).optional().nullable(),
  resources: z.string().trim().max(5000).optional().nullable(),
  assessmentMethods: z.string().trim().max(5000).optional().nullable(),
  remarks: z.string().trim().max(5000).optional().nullable(),
});

export const bulkCreateEntriesSchema = z.object({
  schemeId: uuid("scheme ID"),
  entries: z
    .array(
      z.object({
        weekNumber: z.coerce.number().int().min(1).max(52),
        lessonNumber: z.coerce.number().int().min(1).max(50),
        topic: z.string().trim().min(2).max(255),
        strandId: uuid("strand ID").optional().nullable(),
        subStrandId: uuid("sub-strand ID").optional().nullable(),
        objectives: z.string().trim().max(5000).optional().nullable(),
        learningActivities: z.string().trim().max(5000).optional().nullable(),
        resources: z.string().trim().max(5000).optional().nullable(),
        assessmentMethods: z.string().trim().max(5000).optional().nullable(),
        remarks: z.string().trim().max(5000).optional().nullable(),
      })
    )
    .min(1, "At least one entry is required.")
    .max(200, "Cannot create more than 200 entries at once.")
    .refine(
      (arr) =>
        new Set(arr.map((e) => `${e.weekNumber}::${e.lessonNumber}`)).size === arr.length,
      { message: "Duplicate (week, lesson) pairs in the same request." }
    ),
});

export const updateEntrySchema = z
  .object({
    weekNumber: z.coerce.number().int().min(1).max(52).optional(),
    lessonNumber: z.coerce.number().int().min(1).max(50).optional(),
    topic: z.string().trim().min(2).max(255).optional(),
    strandId: uuid("strand ID").optional().nullable(),
    subStrandId: uuid("sub-strand ID").optional().nullable(),
    objectives: z.string().trim().max(5000).optional().nullable(),
    learningActivities: z.string().trim().max(5000).optional().nullable(),
    resources: z.string().trim().max(5000).optional().nullable(),
    assessmentMethods: z.string().trim().max(5000).optional().nullable(),
    remarks: z.string().trim().max(5000).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const markCoveredSchema = z.object({
  coveredOn: isoDate.optional(), // defaults to today
});

export const reorderEntriesSchema = z.object({
  orderedIds: z.array(uuid("entry ID")).min(1, "At least one entry ID required."),
});

// ================================================================
// LESSON PLANS
// ================================================================
export const createLessonPlanSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  subjectId: uuid("subject ID"),
  teacherId: uuid("teacher ID").optional(), // defaults to req.user.id
  schemeEntryId: uuid("scheme entry ID").optional().nullable(),
  lessonDate: isoDate,
  topic: z.string().trim().min(2, "Topic must be at least 2 characters.").max(255),
  objectives: z.string().trim().max(5000).optional().nullable(),
  introduction: z.string().trim().max(5000).optional().nullable(),
  development: z.string().trim().max(10000).optional().nullable(),
  conclusion: z.string().trim().max(5000).optional().nullable(),
  resources: z.string().trim().max(5000).optional().nullable(),
  assessment: z.string().trim().max(5000).optional().nullable(),
});

export const bulkCreateLessonPlansSchema = z.object({
  schoolId: uuid("school ID"),
  plans: z
    .array(
      z.object({
        classId: uuid("class ID"),
        subjectId: uuid("subject ID"),
        teacherId: uuid("teacher ID").optional(),
        schemeEntryId: uuid("scheme entry ID").optional().nullable(),
        lessonDate: isoDate,
        topic: z.string().trim().min(2).max(255),
        objectives: z.string().trim().max(5000).optional().nullable(),
        introduction: z.string().trim().max(5000).optional().nullable(),
        development: z.string().trim().max(10000).optional().nullable(),
        conclusion: z.string().trim().max(5000).optional().nullable(),
        resources: z.string().trim().max(5000).optional().nullable(),
        assessment: z.string().trim().max(5000).optional().nullable(),
      })
    )
    .min(1, "At least one lesson plan is required.")
    .max(50, "Cannot create more than 50 lesson plans at once."),
});

export const updateLessonPlanSchema = z
  .object({
    schemeEntryId: uuid("scheme entry ID").optional().nullable(),
    lessonDate: isoDate.optional(),
    topic: z.string().trim().min(2).max(255).optional(),
    objectives: z.string().trim().max(5000).optional().nullable(),
    introduction: z.string().trim().max(5000).optional().nullable(),
    development: z.string().trim().max(10000).optional().nullable(),
    conclusion: z.string().trim().max(5000).optional().nullable(),
    resources: z.string().trim().max(5000).optional().nullable(),
    assessment: z.string().trim().max(5000).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const addReflectionSchema = z.object({
  reflection: z.string().trim().min(5, "Reflection must be at least 5 characters.").max(5000),
});

export const listLessonPlansQuerySchema = z.object({
  classId: uuid("class ID").optional(),
  subjectId: uuid("subject ID").optional(),
  teacherId: uuid("teacher ID").optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: approvalStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ================================================================
// ROUTE PARAMS
// ================================================================
export const schemeIdParamSchema = z.object({ schemeId: uuid("scheme ID") });
export const entryIdParamSchema = z.object({ entryId: uuid("entry ID") });
export const lessonPlanIdParamSchema = z.object({ lessonPlanId: uuid("lesson plan ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });
export const teacherIdParamSchema = z.object({ teacherId: uuid("teacher ID") });

// ================================================================
// Inferred types
// ================================================================
export type CreateSchemeInput = z.infer<typeof createSchemeSchema>;
export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type CreateLessonPlanInput = z.infer<typeof createLessonPlanSchema>;