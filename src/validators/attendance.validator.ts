import { z } from "zod";

// ==========================================
// ATTENDANCE VALIDATORS
// ==========================================

export const createAttendanceSchema = z.object({
  studentId: z.string().uuid("Invalid student ID format."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in the format YYYY-MM-DD."),
  status: z.enum(["Present", "Absent", "Late", "Excused"], {
    errorMap: () => ({ message: "Status must be one of: Present, Absent, Late, Excused." }),
  }),
  markedBy: z.string().uuid("Invalid user ID format for markedBy."),
});

export const bulkAttendanceSchema = z.array(createAttendanceSchema).min(1, "Attendance array cannot be empty.");

export const updateAttendanceSchema = createAttendanceSchema.partial();


// ==========================================
// DISCIPLINARY RECORDS VALIDATORS
// ==========================================

export const createDisciplinaryRecordSchema = z.object({
  studentId: z.string().uuid("Invalid student ID format."),
  recordedBy: z.string().uuid("Invalid user ID format for recordedBy."),
  incidentType: z.enum(["Merit", "Warning", "Late-coming"], {
    errorMap: () => ({ message: "Invalid incident type specified. Must be Merit, Warning, or Late-coming." }),
  }),
  description: z.string().min(5, "Description must be at least 5 characters long."),
  actionTaken: z.string().optional().nullable(),
  date: z.string().datetime({ message: "Date must be a valid ISO 8601 timestamp string." }).optional().transform((val) => val ? new Date(val) : undefined),
});

export const updateDisciplinaryRecordSchema = createDisciplinaryRecordSchema.partial();

// TypeScript Type Inference
export type TCreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type TBulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
export type TUpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

export type TCreateDisciplinaryRecordInput = z.infer<typeof createDisciplinaryRecordSchema>;
export type TUpdateDisciplinaryRecordInput = z.infer<typeof updateDisciplinaryRecordSchema>;