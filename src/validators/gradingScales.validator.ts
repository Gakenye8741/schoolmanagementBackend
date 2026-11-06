// validators/gradingScales.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

/** Decimal 0–100 with up to 2dp. */
const score = (field: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), {
      message: `${field} must be a number between 0 and 100 (up to 2 decimals).`,
    })
    .refine((v) => Number(v) >= 0 && Number(v) <= 100, {
      message: `${field} must be between 0 and 100.`,
    });

// ================================================================
// GRADING SCALES
// ================================================================
const scaleObjectSchema = z.object({
  schoolId: uuid("school ID"),
  name: z.string().trim().min(2, "Scale name must be at least 2 characters.").max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export const createGradingScaleSchema = scaleObjectSchema;

export const updateGradingScaleSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    isDefault: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const setDefaultScaleSchema = z.object({
  scaleId: uuid("scale ID"),
});

export const copyGradingScaleSchema = z.object({
  schoolId: uuid("school ID"),
  sourceScaleId: uuid("source scale ID"),
  newName: z.string().trim().min(2).max(100),
});

export const seedDefaultScaleSchema = z.object({
  schoolId: uuid("school ID"),
  template: z.enum(["KCSE", "CBC", "PERCENTAGE_A_E", "IGCSE_1_9"], {
    errorMap: () => ({
      message: 'Template must be one of: "KCSE", "CBC", "PERCENTAGE_A_E", "IGCSE_1_9".',
    }),
  }),
});

// ================================================================
// GRADING BANDS — body-only (scaleId comes from the URL param)
// ================================================================
const bandBodyObjectSchema = z.object({
  minScore: score("minScore"),
  maxScore: score("maxScore"),
  grade: z.string().trim().min(1, "Grade is required.").max(10),
  points: z.coerce.number().int().min(0).max(20).optional().nullable(),
  descriptor: z.string().trim().max(100).optional().nullable(),
  remark: z.string().trim().max(1000).optional().nullable(),
});

export const createGradingBandSchema = bandBodyObjectSchema.refine(
  (d) => Number(d.maxScore) >= Number(d.minScore),
  {
    message: "maxScore must be greater than or equal to minScore.",
    path: ["maxScore"],
  }
);

export const updateGradingBandSchema = z
  .object({
    minScore: score("minScore").optional(),
    maxScore: score("maxScore").optional(),
    grade: z.string().trim().min(1).max(10).optional(),
    points: z.coerce.number().int().min(0).max(20).optional().nullable(),
    descriptor: z.string().trim().max(100).optional().nullable(),
    remark: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

// bulkCreateBandsSchema — body-only, no scaleId
export const bulkCreateBandsSchema = z.object({
  bands: z
    .array(bandBodyObjectSchema)
    .min(1, "At least one band is required.")
    .max(50, "Cannot create more than 50 bands in one request.")
    .refine(
      (bands) => {
        const sorted = [...bands].sort((a, b) => Number(a.minScore) - Number(b.minScore));
        for (let i = 0; i < sorted.length - 1; i++) {
          if (Number(sorted[i].maxScore) >= Number(sorted[i + 1].minScore)) return false;
        }
        return true;
      },
      { message: "Bands overlap — sorted by minScore, no two bands may share a mark." }
    )
    .refine(
      (bands) => new Set(bands.map((b) => b.grade)).size === bands.length,
      { message: "Duplicate grade labels in the same request." }
    ),
});

// ================================================================
// RESOLVE GRADE
// ================================================================
export const resolveGradeSchema = z.object({
  scaleId: uuid("scale ID"),
  mark: score("mark"),
});

// ================================================================
// QUERIES
// ================================================================
export const listBandsQuerySchema = z.object({
  scaleId: uuid("scale ID"),
});

export const searchScalesSchema = z.object({
  query: z.string().trim().min(1, "Provide a search query.").max(100),
});

// ================================================================
// ROUTE PARAMS
// ================================================================
export const scaleIdParamSchema = z.object({ scaleId: uuid("scale ID") });
export const bandIdParamSchema = z.object({ bandId: uuid("band ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });

// ================================================================
// Inferred types
// ================================================================
export type CreateGradingScaleInput = z.infer<typeof createGradingScaleSchema>;
export type UpdateGradingScaleInput = z.infer<typeof updateGradingScaleSchema>;
export type SetDefaultScaleInput = z.infer<typeof setDefaultScaleSchema>;
export type CopyGradingScaleInput = z.infer<typeof copyGradingScaleSchema>;
export type SeedDefaultScaleInput = z.infer<typeof seedDefaultScaleSchema>;
export type CreateGradingBandInput = z.infer<typeof createGradingBandSchema>;
export type UpdateGradingBandInput = z.infer<typeof updateGradingBandSchema>;
export type BulkCreateBandsInput = z.infer<typeof bulkCreateBandsSchema>;
export type ResolveGradeInput = z.infer<typeof resolveGradeSchema>;
export type SearchScalesInput = z.infer<typeof searchScalesSchema>;