import { z } from "zod";

// ================================================================
// Reusable primitives
// ================================================================

/** YYYY-MM-DD with real calendar validation (rejects 2026-02-30). */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    },
    { message: "Invalid calendar date (e.g., 2026-02-30 does not exist)." }
  );

/** 4-digit academic year as a string ("2026"). */
const academicYear = z
  .string()
  .regex(/^\d{4}$/, "Academic year must be a 4-digit year (e.g., 2026).")
  .refine((v) => Number(v) >= 2000 && Number(v) <= 2100, {
    message: "Academic year must be between 2000 and 2100.",
  });

/** Term name — accepts "Term 1", "Semester 1", "Term I", "Trimester 2". */
const termName = z
  .string()
  .trim()
  .min(1, "Term name is required (e.g., Term 1).")
  .max(50, "Term name must be 50 characters or fewer.")
  .regex(
    /^[A-Za-z][A-Za-z0-9 \-_.]{0,49}$/,
    "Term name may only contain letters, digits, spaces, hyphens, dots, and underscores."
  );

const termStatus = z.enum(["upcoming", "active", "completed", "archived"], {
  errorMap: () => ({ message: "Status must be one of: upcoming, active, completed, archived." }),
});

const windowType = z.enum(
  ["mid_term_break", "cat_week", "exam_week", "registration_deadline"],
  { errorMap: () => ({ message: "Invalid window type." }) }
);

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

/** Title used for term windows — factored out so create + bulk-create stay in sync. */
const windowTitle = z
  .string()
  .trim()
  .min(2, "Title is required and must be at least 2 characters.")
  .max(100, "Title must be 100 characters or fewer.");

// ================================================================
// ACADEMIC TERM — RAW OBJECT (no refinements, so .partial/.omit work)
// ================================================================
const academicTermObjectSchema = z.object({
  // schoolId is accepted on create only; update derives from this then omits it.
  schoolId: uuid("school ID"),
  academicYear: academicYear,
  termName: termName,
  startDate: isoDate,
  endDate: isoDate,
  status: termStatus.default("upcoming"),
  isCurrentTerm: z.boolean().default(false),
});

// ================================================================
// ACADEMIC TERM — CREATE (raw + refinements)
// ================================================================
export const createAcademicTermSchema = academicTermObjectSchema
  .refine((d) => d.endDate > d.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  })
  .refine((d) => !(d.isCurrentTerm && d.status !== "active"), {
    message: 'A current term must have status "active".',
    path: ["status"],
  });

export type CreateAcademicTermInput = z.infer<typeof createAcademicTermSchema>;

// ================================================================
// ACADEMIC TERM — UPDATE (derived from raw object, schoolId omitted, then refined)
// ================================================================
export const updateAcademicTermSchema = academicTermObjectSchema
  .omit({ schoolId: true })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  })
  .refine((d) => !(d.startDate && d.endDate) || d.endDate > d.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  })
  .refine((d) => !(d.isCurrentTerm === true && d.status && d.status !== "active"), {
    message: 'A current term must have status "active".',
    path: ["status"],
  });

export type UpdateAcademicTermInput = z.infer<typeof updateAcademicTermSchema>;

// ================================================================
// ACADEMIC TERM — SET CURRENT (one-click activation)
// ================================================================
export const setCurrentAcademicTermSchema = z.object({
  termId: uuid("academic term ID"),
});

export type SetCurrentAcademicTermInput = z.infer<typeof setCurrentAcademicTermSchema>;

// ================================================================
// ACADEMIC TERM — CHANGE STATUS
// ================================================================
export const changeTermStatusSchema = z.object({
  status: termStatus,
});

export type ChangeTermStatusInput = z.infer<typeof changeTermStatusSchema>;

// ================================================================
// ACADEMIC TERM — LOOKUPS
// ================================================================
export const getTermByYearAndNameSchema = z.object({
  academicYear: academicYear,
  termName: termName,
});

export type GetTermByYearAndNameInput = z.infer<typeof getTermByYearAndNameSchema>;

export const listTermsByStatusSchema = z.object({
  status: termStatus,
});

export type ListTermsByStatusInput = z.infer<typeof listTermsByStatusSchema>;

export const listTermsByYearSchema = z.object({
  academicYear: academicYear,
});

export type ListTermsByYearInput = z.infer<typeof listTermsByYearSchema>;

// ================================================================
// TERM WINDOW — RAW OBJECT (no refinements)
// ================================================================
const termWindowObjectSchema = z.object({
  termId: uuid("academic term ID"),
  windowType: windowType,
  title: windowTitle,
  startDate: isoDate,
  endDate: isoDate,
});

// ================================================================
// TERM WINDOW — CREATE (raw + refinement)
// ================================================================
export const createTermWindowSchema = termWindowObjectSchema.refine(
  (d) => d.endDate >= d.startDate,
  { message: "Window end date must be on or after start date.", path: ["endDate"] }
);

export type CreateTermWindowInput = z.infer<typeof createTermWindowSchema>;

// ================================================================
// TERM WINDOW — UPDATE (raw minus required termId, made partial, then refined)
// ================================================================
export const updateTermWindowSchema = termWindowObjectSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  })
  .refine((d) => !(d.startDate && d.endDate) || d.endDate >= d.startDate, {
    message: "Window end date must be on or after start date.",
    path: ["endDate"],
  });

export type UpdateTermWindowInput = z.infer<typeof updateTermWindowSchema>;

// ================================================================
// TERM WINDOW — LOOKUPS
// ================================================================
export const listTermWindowsByTypeSchema = z.object({
  windowType: windowType,
});

export type ListTermWindowsByTypeInput = z.infer<typeof listTermWindowsByTypeSchema>;

export const activeWindowsOnDateSchema = z.object({
  onDate: isoDate,
});

export type ActiveWindowsOnDateInput = z.infer<typeof activeWindowsOnDateSchema>;

// ================================================================
// TERM WINDOW — COPY FROM SOURCE TERM
// ================================================================
export const copyTermWindowsSchema = z
  .object({
    sourceTermId: uuid("source term ID"),
    targetTermId: uuid("target term ID"),
  })
  .refine((d) => d.sourceTermId !== d.targetTermId, {
    message: "Source and target terms must be different.",
    path: ["targetTermId"],
  });

export type CopyTermWindowsInput = z.infer<typeof copyTermWindowsSchema>;

// ================================================================
// TERM WINDOW — UPCOMING (next N days)
// ================================================================
export const upcomingWindowsSchema = z.object({
  daysAhead: z.coerce
    .number()
    .int("daysAhead must be an integer.")
    .min(1, "daysAhead must be at least 1.")
    .max(365, "daysAhead cannot exceed 365.")
    .default(30),
});

export type UpcomingWindowsInput = z.infer<typeof upcomingWindowsSchema>;

// ================================================================
// TERM WINDOW — BULK CREATE
// Derived from the RAW object (so .omit works), then refined.
// ================================================================
const windowWithoutTermSchema = termWindowObjectSchema
  .omit({ termId: true })
  .refine(
    (d) => d.endDate >= d.startDate,
    { message: "Window end date must be on or after start date.", path: ["endDate"] }
  );

export const bulkCreateTermWindowsSchema = z.object({
  termId: uuid("academic term ID"),
  windows: z
    .array(windowWithoutTermSchema)
    .min(1, "At least one window is required.")
    .max(50, "Cannot create more than 50 windows in one request."),
});

export type BulkCreateTermWindowsInput = z.infer<typeof bulkCreateTermWindowsSchema>;

// ================================================================
// ROUTE PARAMS
// ================================================================
export const idParamSchema = z.object({
  id: uuid("ID"),
});

export type IdParamInput = z.infer<typeof idParamSchema>;

export const termIdParamSchema = z.object({
  termId: uuid("academic term ID"),
});

export type TermIdParamInput = z.infer<typeof termIdParamSchema>;

export const schoolIdParamSchema = z.object({
  schoolId: uuid("school ID"),
});

export type SchoolIdParamInput = z.infer<typeof schoolIdParamSchema>;

// ================================================================
// OPTIONAL — list-query helper (order + limit) if you paginate later
// ================================================================
export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: z.enum(["startDate", "endDate", "academicYear", "termName"]).default("startDate"),
  orderDir: z.enum(["asc", "desc"]).default("asc"),
});

export type ListQueryInput = z.infer<typeof listQuerySchema>;