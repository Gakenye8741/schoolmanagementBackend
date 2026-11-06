// validators/attendance.validator.ts
import { z } from "zod";

// ================================================================
// Reusable primitives
// ================================================================
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

const attendanceStatus = z.enum(["Present", "Absent", "Late", "Excused"], {
  errorMap: () => ({
    message: 'Status must be one of: "Present", "Absent", "Late", "Excused".',
  }),
});

// ================================================================
// MARK — single student, single day
// ================================================================
export const markAttendanceSchema = z.object({
  schoolId: uuid("school ID"),
  studentId: uuid("student ID"),
  classId: uuid("class ID"),
  date: isoDate,
  status: attendanceStatus,
  remarks: z.string().trim().max(255).optional().nullable(),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

// ================================================================
// BULK MARK — whole class, one day
// ================================================================
const bulkEntrySchema = z.object({
  studentId: uuid("student ID"),
  status: attendanceStatus,
  remarks: z.string().trim().max(255).optional().nullable(),
});

export const bulkMarkAttendanceSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  date: isoDate,
  entries: z
    .array(bulkEntrySchema)
    .min(1, "At least one student entry is required.")
    .max(200, "Cannot mark more than 200 students in one request.")
    .refine(
      (entries) => new Set(entries.map((e) => e.studentId)).size === entries.length,
      { message: "Duplicate student IDs in entries — each student should appear once." }
    ),
});

export type BulkMarkAttendanceInput = z.infer<typeof bulkMarkAttendanceSchema>;

// ================================================================
// UPDATE
// ================================================================
export const updateAttendanceSchema = z
  .object({
    status: attendanceStatus.optional(),
    remarks: z.string().trim().max(255).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

// ================================================================
// QUERIES
// ================================================================
export const listAbsenteesSchema = z.object({
  date: isoDate,
});

export const attendanceHistoryQuerySchema = z.object({
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
  status: attendanceStatus.optional(),
});

export const classAttendanceSummaryQuerySchema = z.object({
  date: isoDate,
});

export const classMonthlyRegisterQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const chronicAbsenteesQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(100).default(80),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
});

export const attendanceTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).default(30),
});

export const attendanceStatsQuerySchema = z.object({
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
});

export const countByStatusQuerySchema = z.object({
  date: isoDate.optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
});

// ================================================================
// BULK UPSERT
// ================================================================
export const bulkUpsertAttendanceSchema = bulkMarkAttendanceSchema;

// ================================================================
// COPY
// ================================================================
export const copyAttendanceSchema = z
  .object({
    schoolId: uuid("school ID"),
    classId: uuid("class ID"),
    fromDate: isoDate,
    toDate: isoDate,
  })
  .refine((d) => d.fromDate !== d.toDate, {
    message: "Source and target dates must be different.",
    path: ["toDate"],
  });

export type CopyAttendanceInput = z.infer<typeof copyAttendanceSchema>;

// ================================================================
// VALIDATE DATE (helper endpoint)
// ================================================================
export const validateDateSchema = z.object({
  date: isoDate,
});

// ================================================================
// IMPORT (CSV rows)
// ================================================================
export const importAttendanceSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  rows: z
    .array(
      z.object({
        admissionNumber: z.string().trim().min(1, "Admission number is required.").max(50),
        date: isoDate,
        status: attendanceStatus,
        remarks: z.string().trim().max(255).optional().nullable(),
      })
    )
    .min(1, "At least one row is required.")
    .max(500, "Maximum 500 rows per import."),
});

export type ImportAttendanceInput = z.infer<typeof importAttendanceSchema>;

// ================================================================
// ROUTE PARAMS
// ================================================================
export const attendanceIdParamSchema = z.object({
  attendanceId: uuid("attendance ID"),
});

export const studentIdParamSchema = z.object({
  studentId: uuid("student ID"),
});

export const classIdParamSchema = z.object({
  classId: uuid("class ID"),
});

export const schoolIdParamSchema = z.object({
  schoolId: uuid("school ID"),
});

export const userIdParamSchema = z.object({
  userId: uuid("user ID"),
});

export const studentDateParamSchema = z.object({
  studentId: uuid("student ID"),
  date: isoDate,
});

export const classDateParamSchema = z.object({
  classId: uuid("class ID"),
  date: isoDate,
});

// ================================================================
// Inferred types
// ================================================================
export type ListAbsenteesInput = z.infer<typeof listAbsenteesSchema>;
export type AttendanceHistoryQueryInput = z.infer<typeof attendanceHistoryQuerySchema>;
export type ClassAttendanceSummaryQueryInput = z.infer<typeof classAttendanceSummaryQuerySchema>;
export type ClassMonthlyRegisterQueryInput = z.infer<typeof classMonthlyRegisterQuerySchema>;
export type ChronicAbsenteesQueryInput = z.infer<typeof chronicAbsenteesQuerySchema>;
export type AttendanceTrendQueryInput = z.infer<typeof attendanceTrendQuerySchema>;
export type AttendanceStatsQueryInput = z.infer<typeof attendanceStatsQuerySchema>;
export type CountByStatusQueryInput = z.infer<typeof countByStatusQuerySchema>;
export type BulkUpsertAttendanceInput = z.infer<typeof bulkUpsertAttendanceSchema>;
export type ValidateDateInput = z.infer<typeof validateDateSchema>;