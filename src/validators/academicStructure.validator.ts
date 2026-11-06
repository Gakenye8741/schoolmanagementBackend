import { z } from "zod";

// ================================================================
// Reusable primitives
// ================================================================

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

/** 4-digit academic year as a string ("2026"). */
const academicYear = z
  .string()
  .regex(/^\d{4}$/, "Academic year must be a 4-digit year (e.g., 2026).")
  .refine((v) => Number(v) >= 2000 && Number(v) <= 2100, {
    message: "Academic year must be between 2000 and 2100.",
  });

/** Short text field with sane bounds. */
const shortText = (field: string, max = 100) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required.`)
    .max(max, `${field} must be ${max} characters or fewer.`);

/** Integer index for sort ordering. */
const sortOrder = z.coerce
  .number()
  .int("sortOrder must be an integer.")
  .min(1, "sortOrder must be at least 1.")
  .max(9999, "sortOrder is too large.");

/** Optional class capacity — positive integer or null. */
const capacity = z
  .number()
  .int("Capacity must be an integer.")
  .min(1, "Capacity must be at least 1.")
  .max(2000, "Capacity cannot exceed 2000.")
  .nullable()
  .optional();

const subjectCategory = z.enum(["Core", "Optional", "Technical", "Other"], {
  errorMap: () => ({
    message: 'Category must be one of: "Core", "Optional", "Technical", "Other".',
  }),
});

/** Subject code: 2–20 chars, letters and digits only (uppercase-normalized in the service). */
const subjectCode = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/\s+/g, "-"))
  .refine((v) => /^[A-Z0-9]{2,20}$/.test(v), {
    message: "Subject code must be 2–20 alphanumeric characters.",
  });

// ================================================================
// GRADE LEVELS
// ================================================================

// ---- RAW OBJECT (no refinements; .partial/.omit work) ----
const gradeLevelObjectSchema = z.object({
  schoolId: uuid("school ID"),
  name: shortText("Grade level name", 50),
  sortOrder: sortOrder,
  educationStage: z
    .string()
    .trim()
    .max(50, "Education stage must be 50 characters or fewer.")
    .optional()
    .nullable(),
  nextGradeLevelId: uuid("next grade level ID").optional().nullable(),
  isFinalGrade: z.boolean().default(false),
});

// ---- CREATE ----
export const createGradeLevelSchema = gradeLevelObjectSchema
  .refine((d) => !(d.isFinalGrade && d.nextGradeLevelId), {
    message: "A final grade level cannot have a next grade level.",
    path: ["nextGradeLevelId"],
  });

export type CreateGradeLevelInput = z.infer<typeof createGradeLevelSchema>;

// ---- UPDATE (schoolId immutable) ----
export const updateGradeLevelSchema = gradeLevelObjectSchema
  .omit({ schoolId: true })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  })
  .refine((d) => !(d.isFinalGrade === true && d.nextGradeLevelId), {
    message: "A final grade level cannot have a next grade level.",
    path: ["nextGradeLevelId"],
  });

export type UpdateGradeLevelInput = z.infer<typeof updateGradeLevelSchema>;

// ---- SET NEXT / FINAL ----
export const setNextGradeLevelSchema = z.object({
  nextGradeLevelId: uuid("next grade level ID").nullable(),
});

export type SetNextGradeLevelInput = z.infer<typeof setNextGradeLevelSchema>;

// ---- LOOKUPS ----
export const listGradeLevelsByStageSchema = z.object({
  stage: shortText("Education stage", 50),
});

export type ListGradeLevelsByStageInput = z.infer<typeof listGradeLevelsByStageSchema>;

export const getGradeLevelByNameSchema = z.object({
  name: shortText("Grade level name", 50),
});

export type GetGradeLevelByNameInput = z.infer<typeof getGradeLevelByNameSchema>;

export const searchGradeLevelsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Provide a search query.")
    .max(50, "Search query must be 50 characters or fewer."),
});

export type SearchGradeLevelsInput = z.infer<typeof searchGradeLevelsSchema>;

// ---- BULK CREATE ----
const gradeLevelWithoutSchool = gradeLevelObjectSchema.omit({ schoolId: true });

export const bulkCreateGradeLevelsSchema = z.object({
  schoolId: uuid("school ID"),
  levels: z
    .array(gradeLevelWithoutSchool)
    .min(1, "At least one grade level is required.")
    .max(50, "Cannot create more than 50 grade levels in one request."),
});

export type BulkCreateGradeLevelsInput = z.infer<typeof bulkCreateGradeLevelsSchema>;

// ---- REORDER ----
export const reorderGradeLevelsSchema = z.object({
  schoolId: uuid("school ID"),
  orderedIds: z
    .array(uuid("grade level ID"))
    .min(1, "Provide at least one grade level ID.")
    .max(100, "Too many IDs in one request.")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Duplicate grade level IDs are not allowed.",
    }),
});

export type ReorderGradeLevelsInput = z.infer<typeof reorderGradeLevelsSchema>;

// ================================================================
// SUBJECTS
// ================================================================

// ---- RAW OBJECT ----
const subjectObjectSchema = z.object({
  schoolId: uuid("school ID"),
  name: shortText("Subject name", 100),
  code: subjectCode,
  category: subjectCategory,
});

// ---- CREATE ----
export const createSubjectSchema = subjectObjectSchema;

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

// ---- UPDATE (schoolId immutable; code optional) ----
export const updateSubjectSchema = subjectObjectSchema
  .omit({ schoolId: true })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;

// ---- LOOKUPS ----
export const getSubjectByCodeSchema = z.object({
  code: subjectCode,
});

export type GetSubjectByCodeInput = z.infer<typeof getSubjectByCodeSchema>;

export const listSubjectsByCategorySchema = z.object({
  category: subjectCategory,
});

export type ListSubjectsByCategoryInput = z.infer<typeof listSubjectsByCategorySchema>;

export const searchSubjectsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Provide a search query.")
    .max(100, "Search query must be 100 characters or fewer."),
});

export type SearchSubjectsInput = z.infer<typeof searchSubjectsSchema>;

// ---- BULK CREATE ----
const subjectWithoutSchool = subjectObjectSchema.omit({ schoolId: true });

export const bulkCreateSubjectsSchema = z.object({
  schoolId: uuid("school ID"),
  subjects: z
    .array(subjectWithoutSchool)
    .min(1, "At least one subject is required.")
    .max(100, "Cannot create more than 100 subjects in one request."),
});

export type BulkCreateSubjectsInput = z.infer<typeof bulkCreateSubjectsSchema>;

// ---- DUPLICATE ----
export const duplicateSubjectSchema = z.object({
  newCode: subjectCode,
});

export type DuplicateSubjectInput = z.infer<typeof duplicateSubjectSchema>;

// ---- RENAME CODE ----
export const renameSubjectCodeSchema = z.object({
  newCode: subjectCode,
});

export type RenameSubjectCodeInput = z.infer<typeof renameSubjectCodeSchema>;

// ---- ASSERT SUBJECT EXISTS (helper) ----
export const assertSubjectExistsSchema = z.object({
  schoolId: uuid("school ID"),
  subjectId: uuid("subject ID"),
});

export type AssertSubjectExistsInput = z.infer<typeof assertSubjectExistsSchema>;

// ================================================================
// CLASSES
// ================================================================

// ---- RAW OBJECT ----
const classObjectSchema = z.object({
  schoolId: uuid("school ID"),
  gradeLevelId: uuid("grade level ID"),
  stream: shortText("Stream", 50),
  academicYear: academicYear,
  classTeacherId: uuid("class teacher ID").optional().nullable(),
  capacity: capacity,
});

// ---- CREATE ----
export const createClassSchema = classObjectSchema;

export type CreateClassInput = z.infer<typeof createClassSchema>;

// ---- UPDATE (schoolId immutable) ----
export const updateClassSchema = classObjectSchema
  .omit({ schoolId: true })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export type UpdateClassInput = z.infer<typeof updateClassSchema>;

// ---- LOOKUPS ----
export const listClassesByYearSchema = z.object({
  academicYear: academicYear,
});

export type ListClassesByYearInput = z.infer<typeof listClassesByYearSchema>;

export const listClassesByGradeLevelSchema = z.object({
  gradeLevelId: uuid("grade level ID"),
});

export type ListClassesByGradeLevelInput = z.infer<typeof listClassesByGradeLevelSchema>;

export const searchClassesSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Provide a search query.")
    .max(50, "Search query must be 50 characters or fewer."),
});

export type SearchClassesInput = z.infer<typeof searchClassesSchema>;

// ---- ASSIGN CLASS TEACHER ----
export const assignClassTeacherSchema = z.object({
  teacherId: uuid("teacher ID").nullable(),
});

export type AssignClassTeacherInput = z.infer<typeof assignClassTeacherSchema>;

// ---- CLASS-SUBJECT LINKAGE ----
export const addSubjectToClassSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  subjectId: uuid("subject ID"),
  teacherId: uuid("teacher ID").optional().nullable(),
});

export type AddSubjectToClassInput = z.infer<typeof addSubjectToClassSchema>;

export const removeSubjectFromClassSchema = z.object({
  classId: uuid("class ID"),
  subjectId: uuid("subject ID"),
});

export type RemoveSubjectFromClassInput = z.infer<typeof removeSubjectFromClassSchema>;

export const assignTeacherToClassSubjectSchema = z.object({
  teacherId: uuid("teacher ID").nullable(),
});

export type AssignTeacherToClassSubjectInput = z.infer<
  typeof assignTeacherToClassSubjectSchema
>;

// ---- BULK CREATE ----
const classWithoutSchool = classObjectSchema.omit({ schoolId: true });

export const bulkCreateClassesSchema = z.object({
  schoolId: uuid("school ID"),
  classes: z
    .array(classWithoutSchool)
    .min(1, "At least one class is required.")
    .max(100, "Cannot create more than 100 classes in one request."),
});

export type BulkCreateClassesInput = z.infer<typeof bulkCreateClassesSchema>;

// ---- ROLL TO NEW YEAR ----
export const rollClassesToYearSchema = z
  .object({
    schoolId: uuid("school ID"),
    fromYear: academicYear,
    toYear: academicYear,
  })
  .refine((d) => d.fromYear !== d.toYear, {
    message: "Target academic year must be different from the source year.",
    path: ["toYear"],
  });

export type RollClassesToYearInput = z.infer<typeof rollClassesToYearSchema>;

// ---- TRANSFER STUDENT BETWEEN CLASSES ----
export const transferStudentBetweenClassesSchema = z.object({
  studentId: uuid("student ID"),
  toClassId: uuid("target class ID"),
});

export type TransferStudentBetweenClassesInput = z.infer<
  typeof transferStudentBetweenClassesSchema
>;

// ---- LINK STUDENT TO CLASS (admission or transfer) ----
export const linkStudentToClassSchema = z.object({
  studentId: uuid("student ID"),
  classId: uuid("class ID"),
  termId: uuid("term ID").optional(),
  requireUnplaced: z.boolean().optional(),
});

export type LinkStudentToClassInput = z.infer<typeof linkStudentToClassSchema>;

// ================================================================
// ROUTE PARAMS
// ================================================================
export const idParamSchema = z.object({
  id: uuid("ID"),
});

export type IdParamInput = z.infer<typeof idParamSchema>;

export const gradeLevelIdParamSchema = z.object({
  gradeLevelId: uuid("grade level ID"),
});

export type GradeLevelIdParamInput = z.infer<typeof gradeLevelIdParamSchema>;

export const subjectIdParamSchema = z.object({
  subjectId: uuid("subject ID"),
});

export type SubjectIdParamInput = z.infer<typeof subjectIdParamSchema>;

export const classIdParamSchema = z.object({
  classId: uuid("class ID"),
});

export type ClassIdParamInput = z.infer<typeof classIdParamSchema>;

export const classSubjectIdParamSchema = z.object({
  classSubjectId: uuid("class-subject link ID"),
});

export type ClassSubjectIdParamInput = z.infer<typeof classSubjectIdParamSchema>;

export const teacherIdParamSchema = z.object({
  teacherId: uuid("teacher ID"),
});

export type TeacherIdParamInput = z.infer<typeof teacherIdParamSchema>;

export const schoolIdParamSchema = z.object({
  schoolId: uuid("school ID"),
});

export type SchoolIdParamInput = z.infer<typeof schoolIdParamSchema>;