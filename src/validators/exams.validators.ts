import { z } from "zod";

/**
 * Zod validation schema for creating a term exam
 */
export const createTermExamSchema = z.object({
  termId: z.string().uuid({ message: "Invalid academic term ID format." }),
  examTitle: z.string().min(1, { message: "Exam title is required." }).max(100, { message: "Exam title cannot exceed 100 characters." }),
  examCategory: z.enum([
    "Mid-Term",
    "End-Term",
    "Continuous Assessment",
    "Project",
    "Practical",
    "Opening",
    "Formative",
    "Summative",
    "Mock",
    "End of Year"
  ], { message: "Invalid exam category." }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Start date must be in YYYY-MM-DD format." }).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "End date must be in YYYY-MM-DD format." }).optional(),
  isLocked: z.boolean().optional(),
});

/**
 * Zod validation schema for updating a term exam
 */
export const updateTermExamSchema = z.object({
  termId: z.string().uuid({ message: "Invalid academic term ID format." }).optional(),
  examTitle: z.string().min(1, { message: "Exam title is required." }).max(100, { message: "Exam title cannot exceed 100 characters." }).optional(),
  examCategory: z.enum([
    "Mid-Term",
    "End-Term",
    "Continuous Assessment",
    "Project",
    "Practical",
    "Opening",
    "Formative",
    "Summative",
    "Mock",
    "End of Year"
  ], { message: "Invalid exam category." }).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Start date must be in YYYY-MM-DD format." }).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "End date must be in YYYY-MM-DD format." }).optional(),
  isLocked: z.boolean().optional(),
});

/**
 * Zod validation schema for creating a single CBC assessment score
 */
export const createCbcAssessmentSchema = z.object({
  studentId: z.string().uuid({ message: "Invalid student ID format." }),
  subjectId: z.string().uuid({ message: "Invalid subject ID format." }),
  termId: z.string().uuid({ message: "Invalid term ID format." }),
  examId: z.string().uuid({ message: "Invalid exam ID format." }),
  strand: z.string().min(1, { message: "Strand is required." }).max(255, { message: "Strand cannot exceed 255 characters." }),
  subStrand: z.string().max(255, { message: "Sub-strand cannot exceed 255 characters." }).optional(),
  scoreValue: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
  outOf: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
  performanceLevel: z.enum([
    "EE", // Exceeding Expectation
    "ME", // Meeting Expectation
    "AE", // Approaching Expectation
    "BE"  // Below Expectation
  ], { message: "Invalid performance level. Must be EE, ME, AE, or BE." }),
  teacherRemarks: z.string().optional(),
  assessedBy: z.string().uuid({ message: "Invalid assessor user ID format." }),
});

/**
 * Zod validation schema for bulk CBC assessments entry (class marksheets)
 */
export const bulkCbcAssessmentsSchema = z.array(createCbcAssessmentSchema).min(1, { message: "Assessment array cannot be empty." });

/**
 * Zod validation schema for updating a CBC assessment score
 */
export const updateCbcAssessmentSchema = z.object({
  studentId: z.string().uuid({ message: "Invalid student ID format." }).optional(),
  subjectId: z.string().uuid({ message: "Invalid subject ID format." }).optional(),
  termId: z.string().uuid({ message: "Invalid term ID format." }).optional(),
  examId: z.string().uuid({ message: "Invalid exam ID format." }).optional(),
  strand: z.string().min(1, { message: "Strand is required." }).max(255, { message: "Strand cannot exceed 255 characters." }).optional(),
  subStrand: z.string().max(255, { message: "Sub-strand cannot exceed 255 characters." }).optional(),
  scoreValue: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
  outOf: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
  performanceLevel: z.enum([
    "EE",
    "ME",
    "AE",
    "BE"
  ], { message: "Invalid performance level. Must be EE, ME, AE, or BE." }).optional(),
  teacherRemarks: z.string().optional(),
  assessedBy: z.string().uuid({ message: "Invalid assessor user ID format." }).optional(),
});