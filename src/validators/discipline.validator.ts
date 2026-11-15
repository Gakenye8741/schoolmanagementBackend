// src/services/discipline/discipline.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

const isoDateTime = z
  .string()
  .datetime({ message: "Must be a valid ISO 8601 datetime (e.g. 2026-11-06T14:30:00Z)." });

const incidentType = z.enum(
  ["Merit", "Warning", "Late-coming", "Detention", "Suspension"],
  {
    errorMap: () => ({
      message: 'Incident type must be one of: "Merit", "Warning", "Late-coming", "Detention", "Suspension".',
    }),
  }
);

const description = z
  .string()
  .trim()
  .min(2, "Description must be at least 2 characters.")
  .max(5000, "Description must be 5000 characters or fewer.");

const actionTaken = z
  .string()
  .trim()
  .max(2000, "Action taken must be 2000 characters or fewer.")
  .optional()
  .nullable();

// ================================================================
// RECORD INCIDENT — single
// ================================================================
export const recordIncidentSchema = z.object({
  schoolId: uuid("school ID"),
  studentId: uuid("student ID"),
  incidentType: incidentType,
  description: description,
  actionTaken: actionTaken,
  parentNotified: z.boolean().optional().default(false),
  date: isoDateTime.optional().nullable(),
  notify: z.boolean().optional().default(true),
});

export type RecordIncidentInput = z.infer<typeof recordIncidentSchema>;

// ================================================================
// BULK RECORD INCIDENTS
// ================================================================
const bulkIncidentItemSchema = z.object({
  studentId: uuid("student ID"),
  incidentType: incidentType,
  description: description,
  actionTaken: actionTaken,
  date: isoDateTime.optional().nullable(),
});

export const bulkRecordIncidentsSchema = z.object({
  schoolId: uuid("school ID"),
  notify: z.boolean().optional().default(true),
  incidents: z
    .array(bulkIncidentItemSchema)
    .min(1, "At least one incident is required.")
    .max(500, "Cannot record more than 500 incidents at once."),
});

export type BulkRecordIncidentsInput = z.infer<typeof bulkRecordIncidentsSchema>;

// ================================================================
// UPDATE INCIDENT
// ================================================================
export const updateIncidentSchema = z
  .object({
    incidentType: incidentType.optional(),
    description: description.optional(),
    actionTaken: actionTaken,
    parentNotified: z.boolean().optional(),
    date: isoDateTime.optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });



// ================================================================
// LIST QUERIES
// ================================================================
export const listIncidentsForStudentSchema = z.object({
  fromDate: isoDateTime.optional(),
  toDate: isoDateTime.optional(),
  type: incidentType.optional(),
});

export type ListIncidentsForStudentInput = z.infer<typeof listIncidentsForStudentSchema>;

export const listIncidentsForClassSchema = z.object({
  fromDate: isoDateTime.optional(),
  toDate: isoDateTime.optional(),
});

export type ListIncidentsForClassInput = z.infer<typeof listIncidentsForClassSchema>;

export const listIncidentsForSchoolSchema = z.object({
  fromDate: isoDateTime.optional(),
  toDate: isoDateTime.optional(),
  type: incidentType.optional(),
  studentId: uuid("student ID").optional(),
  classId: uuid("class ID").optional(),
  parentNotified: z.coerce.boolean().optional(),
});

export type ListIncidentsForSchoolInput = z.infer<typeof listIncidentsForSchoolSchema>;

export const listIncidentsByDateRangeSchema = z
  .object({
    fromDate: isoDateTime,
    toDate: isoDateTime,
  })
  .refine((d) => new Date(d.toDate) >= new Date(d.fromDate), {
    message: "toDate must be on or after fromDate.",
    path: ["toDate"],
  });

export type ListIncidentsByDateRangeInput = z.infer<typeof listIncidentsByDateRangeSchema>;

// ================================================================
// TREND QUERY
// ================================================================
export const disciplineTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

export type DisciplineTrendQueryInput = z.infer<typeof disciplineTrendQuerySchema>;

// ================================================================
// ROUTE PARAMS
// ================================================================
export const incidentIdParamSchema = z.object({
  incidentId: uuid("incident ID"),
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

