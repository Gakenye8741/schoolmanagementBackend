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

// ================================================================
// Publish / unpublish
// ================================================================
export const publishReportCardsSchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
  classId: uuid("class ID").optional(), // if absent → publish all in the term
});

// ================================================================
// Params
// ================================================================
export const reportCardIdParamSchema = z.object({ reportCardId: uuid("report card ID") });
export const studentIdParamSchema = z.object({ studentId: uuid("student ID") });
export const classIdParamSchema = z.object({ classId: uuid("class ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });
export const termIdParamSchema = z.object({ termId: uuid("term ID") });

// ================================================================
// Query
// ================================================================
export const listReportCardsQuerySchema = z.object({
  termId: uuid("term ID"),
  published: z.enum(["true", "false"]).optional(),
});