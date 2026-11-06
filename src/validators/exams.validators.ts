// validators/exams.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

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

const isoTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Time must be HH:MM or HH:MM:SS.");

/** Non-negative decimal, up to 2dp. */
const decimal = (field: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      message: `${field} must be a valid number (up to 2 decimals).`,
    })
    .refine((v) => Number(v) >= 0, { message: `${field} cannot be negative.` });

const examCategory = z.enum(
  [
    "Mid-Term",
    "End-Term",
    "Continuous Assessment",
    "Project",
    "Practical",
    "Opening",
    "Formative",
    "Summative",
    "Mock",
    "End of Year",
  ],
  { errorMap: () => ({ message: "Invalid exam category." }) }
);

// ================================================================
// EXAMS
// ================================================================
const examObjectSchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
  examTitle: z.string().trim().min(2, "Exam title must be at least 2 characters.").max(100),
  examCategory: examCategory,
  weighting: decimal("weighting").optional().nullable(),
  gradingScaleId: uuid("grading scale ID").optional().nullable(),
  startDate: isoDate.optional().nullable(),
  endDate: isoDate.optional().nullable(),
});

export const createExamSchema = examObjectSchema.refine(
  (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate,
  { message: "endDate must not be before startDate.", path: ["endDate"] }
);

export const updateExamSchema = z
  .object({
    examTitle: z.string().trim().min(2).max(100).optional(),
    examCategory: examCategory.optional(),
    weighting: decimal("weighting").optional().nullable(),
    gradingScaleId: uuid("grading scale ID").optional().nullable(),
    startDate: isoDate.optional().nullable(),
    endDate: isoDate.optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "endDate must not be before startDate.",
    path: ["endDate"],
  });

export const listExamsByCategorySchema = z.object({
  category: examCategory,
});

// ================================================================
// EXAM SCHEDULES
// ================================================================
const scheduleEntrySchema = z
  .object({
    classId: uuid("class ID"),
    subjectId: uuid("subject ID"),
    examDate: isoDate,
    startTime: isoTime.optional().nullable(),
    endTime: isoTime.optional().nullable(),
    venue: z.string().trim().max(100).optional().nullable(),
    invigilatorId: uuid("invigilator ID").optional().nullable(),
  })
  .refine((d) => !d.startTime || !d.endTime || d.endTime > d.startTime, {
    message: "endTime must be after startTime.",
    path: ["endTime"],
  });

export const createScheduleSchema = scheduleEntrySchema.and(
  z.object({
    schoolId: uuid("school ID"),
    examId: uuid("exam ID"),
  })
);

export const bulkCreateSchedulesSchema = z.object({
  schoolId: uuid("school ID"),
  examId: uuid("exam ID"),
  schedules: z
    .array(scheduleEntrySchema)
    .min(1, "At least one schedule is required.")
    .max(200, "Cannot create more than 200 schedules in one request."),
});

export const updateScheduleSchema = z
  .object({
    examDate: isoDate.optional(),
    startTime: isoTime.optional().nullable(),
    endTime: isoTime.optional().nullable(),
    venue: z.string().trim().max(100).optional().nullable(),
    invigilatorId: uuid("invigilator ID").optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  })
  .refine((d) => !d.startTime || !d.endTime || d.endTime > d.startTime, {
    message: "endTime must be after startTime.",
    path: ["endTime"],
  });

export const listSchedulesByDateSchema = z.object({
  examDate: isoDate,
});

// ================================================================
// EXAM RESULTS — MARK ENTRY
// ================================================================
export const enterMarkSchema = z
  .object({
    schoolId: uuid("school ID"),
    examId: uuid("exam ID"),
    studentId: uuid("student ID"),
    subjectId: uuid("subject ID"),
    classId: uuid("class ID").optional().nullable(),
    marks: decimal("marks").optional().nullable(),
    outOf: decimal("outOf").optional().default("100.00"),
    isAbsent: z.boolean().optional().default(false),
    remarks: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => d.isAbsent === true || d.marks !== null, {
    message: "Provide marks, or mark the student as absent.",
    path: ["marks"],
  })
  .refine((d) => d.marks === null || d.marks === undefined || Number(d.marks) <= Number(d.outOf ?? "100"), {
    message: "Marks cannot exceed outOf.",
    path: ["marks"],
  });

export const bulkEnterMarksSchema = z.object({
  schoolId: uuid("school ID"),
  examId: uuid("exam ID"),
  subjectId: uuid("subject ID"),
  entries: z
    .array(
      z
        .object({
          studentId: uuid("student ID"),
          classId: uuid("class ID").optional().nullable(),
          marks: decimal("marks").optional().nullable(),
          outOf: decimal("outOf").optional().default("100.00"),
          isAbsent: z.boolean().optional().default(false),
          remarks: z.string().trim().max(1000).optional().nullable(),
        })
        .refine((d) => d.isAbsent === true || d.marks !== null, {
          message: "Provide marks, or mark the student as absent.",
          path: ["marks"],
        })
    )
    .min(1, "At least one mark is required.")
    .max(500, "Cannot enter more than 500 marks in one request.")
    .refine(
      (entries) => new Set(entries.map((e) => e.studentId)).size === entries.length,
      { message: "Duplicate student IDs in entries." }
    ),
});

export const updateMarkSchema = z
  .object({
    marks: decimal("marks").optional().nullable(),
    outOf: decimal("outOf").optional(),
    isAbsent: z.boolean().optional(),
    remarks: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const markAbsentSchema = z.object({
  schoolId: uuid("school ID"),
  examId: uuid("exam ID"),
  studentId: uuid("student ID"),
  subjectId: uuid("subject ID"),
});

// ================================================================
// ROUTE PARAMS
// ================================================================
export const examIdParamSchema = z.object({ examId: uuid("exam ID") });
export const scheduleIdParamSchema = z.object({ scheduleId: uuid("schedule ID") });
export const markIdParamSchema = z.object({ markId: uuid("mark ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });
export const termIdParamSchema = z.object({ termId: uuid("term ID") });
export const subjectIdParamSchema = z.object({ subjectId: uuid("subject ID") });
export const classIdParamSchema = z.object({ classId: uuid("class ID") });
export const studentIdParamSchema = z.object({ studentId: uuid("student ID") });

// ================================================================
// Inferred types
// ================================================================
export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type ListExamsByCategoryInput = z.infer<typeof listExamsByCategorySchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type BulkCreateSchedulesInput = z.infer<typeof bulkCreateSchedulesSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type ListSchedulesByDateInput = z.infer<typeof listSchedulesByDateSchema>;
export type EnterMarkInput = z.infer<typeof enterMarkSchema>;
export type BulkEnterMarksInput = z.infer<typeof bulkEnterMarksSchema>;
export type UpdateMarkInput = z.infer<typeof updateMarkSchema>;
export type MarkAbsentInput = z.infer<typeof markAbsentSchema>;