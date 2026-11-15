// src/validators/curriculum.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

// ================================================================
// STRANDS
// ================================================================
export const createStrandSchema = z.object({
  schoolId: uuid("school ID"),
  subjectId: uuid("subject ID"),
  gradeLevelId: uuid("grade level ID"),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(255),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
});

export const bulkCreateStrandsSchema = z.object({
  schoolId: uuid("school ID"),
  subjectId: uuid("subject ID"),
  gradeLevelId: uuid("grade level ID"),
  strands: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(255),
        sortOrder: z.coerce.number().int().min(0).optional(),
      })
    )
    .min(1, "At least one strand is required.")
    .max(100, "Cannot create more than 100 strands at once.")
    .refine(
      (arr) => new Set(arr.map((s) => s.name.toLowerCase())).size === arr.length,
      { message: "Duplicate strand names in the same request." }
    ),
});

export const updateStrandSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const reorderStrandsSchema = z.object({
  orderedIds: z.array(uuid("strand ID")).min(1, "At least one strand ID required."),
});

export const listStrandsQuerySchema = z.object({
  subjectId: uuid("subject ID").optional(),
  gradeLevelId: uuid("grade level ID").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// ================================================================
// SUB-STRANDS
// ================================================================
export const createSubStrandSchema = z.object({
  schoolId: uuid("school ID"),
  strandId: uuid("strand ID"),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(255),
  learningOutcomes: z.string().trim().max(10000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
});

export const bulkCreateSubStrandsSchema = z.object({
  schoolId: uuid("school ID"),
  strandId: uuid("strand ID"),
  subStrands: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(255),
        learningOutcomes: z.string().trim().max(10000).optional().nullable(),
        sortOrder: z.coerce.number().int().min(0).optional(),
      })
    )
    .min(1, "At least one sub-strand is required.")
    .max(100, "Cannot create more than 100 sub-strands at once.")
    .refine(
      (arr) => new Set(arr.map((s) => s.name.toLowerCase())).size === arr.length,
      { message: "Duplicate sub-strand names in the same request." }
    ),
});

export const updateSubStrandSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    learningOutcomes: z.string().trim().max(10000).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const reorderSubStrandsSchema = z.object({
  orderedIds: z.array(uuid("sub-strand ID")).min(1, "At least one sub-strand ID required."),
});

export const searchSubStrandsSchema = z.object({
  q: z.string().trim().min(1, "Search query is required.").max(255),
  subjectId: uuid("subject ID").optional(),
  gradeLevelId: uuid("grade level ID").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listSubStrandsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  withOutcomesOnly: z.enum(["true", "false"]).optional().default("false"),
});

// ================================================================
// TREE / COVERAGE / COPY
// ================================================================
export const getCurriculumTreeQuerySchema = z.object({
  subjectId: uuid("subject ID"),
  gradeLevelId: uuid("grade level ID"),
});

export const copyCurriculumSchema = z.object({
  schoolId: uuid("school ID"),
  sourceSchoolId: uuid("source school ID"),
  subjectId: uuid("subject ID"),
  gradeLevelId: uuid("grade level ID"),
  overwriteExisting: z.boolean().optional().default(false),
});

export const getCurriculumCoverageQuerySchema = z.object({
  subjectId: uuid("subject ID"),
  gradeLevelId: uuid("grade level ID"),
  termId: uuid("term ID"),
});

// ================================================================
// PARAMS
// ================================================================
export const strandIdParamSchema = z.object({ strandId: uuid("strand ID") });
export const subStrandIdParamSchema = z.object({ subStrandId: uuid("sub-strand ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });

// ================================================================
// Inferred types
// ================================================================
export type CreateStrandInput = z.infer<typeof createStrandSchema>;
export type UpdateStrandInput = z.infer<typeof updateStrandSchema>;
export type CreateSubStrandInput = z.infer<typeof createSubStrandSchema>;
export type UpdateSubStrandInput = z.infer<typeof updateSubStrandSchema>;
export type CopyCurriculumInput = z.infer<typeof copyCurriculumSchema>;