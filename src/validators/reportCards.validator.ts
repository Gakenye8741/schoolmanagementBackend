// src/services/reportCards/reportCards.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

// ================================================================
// Generate (single / class / school)
// ================================================================
export const generateReportCardSchema = z.object({
  schoolId: uuid("school ID"),
  studentId: uuid("student ID"),
  termId: uuid("term ID"),
  examIds: z.array(uuid("exam ID")).optional(), // if omitted → all published exams in the term
  classTeacherRemarks: z.string().trim().max(2000).optional().nullable(),
  principalRemarks: z.string().trim().max(2000).optional().nullable(),
});

export const generateReportCardsForClassSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  termId: uuid("term ID"),
  examIds: z.array(uuid("exam ID")).optional(),
});

export const generateReportCardsForSchoolSchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
  examIds: z.array(uuid("exam ID")).optional(),
});

// ================================================================
// Preview (dry-run — same body as generate, nothing saved)
// Added because the controller imports `previewReportCardSchema`.
// ================================================================
export const previewReportCardSchema = z.object({
  schoolId: uuid("school ID"),
  studentId: uuid("student ID"),
  termId: uuid("term ID"),
  examIds: z.array(uuid("exam ID")).optional(),
  classTeacherRemarks: z.string().trim().max(2000).optional().nullable(),
  principalRemarks: z.string().trim().max(2000).optional().nullable(),
});

// ================================================================
// Update remarks
// ================================================================
export const updateReportCardRemarksSchema = z
  .object({
    classTeacherRemarks: z.string().trim().max(2000).optional().nullable(),
    principalRemarks: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

// Alias the controller imports — same schema, canonical name preserved
export const updateRemarksSchema = updateReportCardRemarksSchema;

// ================================================================
// Override fields (admin correction)
// Matches overrideReportCardFieldsService's accepted patch shape.
// ================================================================
export const overrideReportCardFieldsSchema = z
  .object({
    meanScore: z.string().optional().nullable(),
    classPosition: z.number().int().nonnegative().optional().nullable(),
    streamSize: z.number().int().nonnegative().optional().nullable(),
    attendanceDays: z.number().int().nonnegative().optional().nullable(),
    classTeacherRemarks: z.string().trim().max(2000).optional().nullable(),
    principalRemarks: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for override.",
  });

// ================================================================
// Publish / unpublish
// ================================================================
export const publishReportCardsSchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
  classId: uuid("class ID").optional(), // if absent → publish all in the term
});

// Class variant — classId REQUIRED (controller does v.data.classId, no fallback)
export const publishReportCardsForClassSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  termId: uuid("term ID"),
});

// ================================================================
// Params
// ================================================================
export const reportCardIdParamSchema = z.object({ reportCardId: uuid("report card ID") });
export const studentIdParamSchema = z.object({ studentId: uuid("student ID") });
export const classIdParamSchema = z.object({ classId: uuid("class ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });
export const termIdParamSchema = z.object({ termId: uuid("term ID") });

// Combined params for /student/:studentId/term/:termId
export const studentTermParamSchema = z.object({
  studentId: uuid("student ID"),
  termId: uuid("term ID"),
});

// ================================================================
// Query
// ================================================================
export const listReportCardsQuerySchema = z.object({
  termId: uuid("term ID"),
  published: z.enum(["true", "false"]).optional(),
});

// /term/:termId route — termId lives in path, only classId is an optional filter
export const listReportCardsForTermSchema = z.object({
  classId: uuid("class ID").optional(),
});

// /student/:studentId and /class/:classId/:termId routes
// (imported by controller but not currently read — kept valid for future params)
export const listReportCardsForStudentSchema = z.object({}).optional();
export const listReportCardsForClassSchema = z.object({}).optional();