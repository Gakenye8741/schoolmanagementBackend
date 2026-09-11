import { z } from "zod";

export const createAcademicTermSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID format."),
  academicYear: z.string().min(1, "Academic year is required (e.g., 2026)."),
  termName: z.string().min(1, "Term name is required (e.g., Term 1)."),
  startDate: z.string().min(1, "Start date is required."),
  endDate: z.string().min(1, "End date is required."),
  status: z.enum(["upcoming", "active", "completed", "archived"]).default("upcoming"),
  isCurrentTerm: z.boolean().default(false),
});

export const updateAcademicTermSchema = createAcademicTermSchema.partial().omit({ schoolId: true });

export const createTermWindowSchema = z.object({
  termId: z.string().uuid("Invalid academic term ID format."),
  windowType: z.enum(["mid_term_break", "cat_week", "exam_week", "registration_deadline"], {
    errorMap: () => ({ message: "Invalid window type." }),
  }),
  title: z.string().min(2, "Title is required and must be at least 2 characters."),
  startDate: z.string().min(1, "Start date is required."),
  endDate: z.string().min(1, "End date is required."),
});

export const updateTermWindowSchema = createTermWindowSchema.partial().omit({ termId: true });