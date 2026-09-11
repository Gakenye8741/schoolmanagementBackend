import { z } from "zod";

export const createClassSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID format."),
  gradeLevel: z.string().min(1, "Grade level is required (e.g., Grade 5)."),
  stream: z.string().min(1, "Stream is required (e.g., East)."),
  classTeacherId: z.string().uuid("Invalid teacher ID format.").optional().nullable(),
  academicYear: z.string().min(1, "Academic year is required (e.g., 2026)."),
});

export const updateClassSchema = createClassSchema.partial().omit({ schoolId: true });

export const assignClassTeacherSchema = z.object({
  classTeacherId: z.string().uuid("Invalid teacher ID format.").nullable(),
});

export const createEnrollmentSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID format."),
  classId: z.string().uuid("Invalid class ID format."),
  studentId: z.string().uuid("Invalid student ID format."),
  academicYear: z.string().min(1, "Academic year is required."),
  status: z.enum(["active", "promoted", "repeating", "transferred", "withdrawn"]).default("active"),
});

export const updateEnrollmentSchema = createEnrollmentSchema.partial().omit({ schoolId: true, studentId: true, classId: true });

export const bulkEnrollmentSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID format."),
  classId: z.string().uuid("Invalid class ID format."),
  studentIds: z.array(z.string().uuid("Invalid student ID format.")).min(1, "At least one student ID is required."),
  academicYear: z.string().min(1, "Academic year is required."),
});