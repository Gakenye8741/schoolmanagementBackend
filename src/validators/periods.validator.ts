// src/services/timetables/periods.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

const isoTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Time must be HH:MM or HH:MM:SS.");

// ================================================================
// PERIOD — CREATE
// ================================================================
const periodObjectSchema = z.object({
  schoolId: uuid("school ID"),
  periodNumber: z.coerce.number().int().min(1, "periodNumber must be at least 1.").max(30),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(50),
  startTime: isoTime,
  endTime: isoTime,
  isBreak: z.boolean().optional().default(false),
});

export const createPeriodSchema = periodObjectSchema.refine(
  (d) => d.endTime > d.startTime,
  { message: "endTime must be after startTime.", path: ["endTime"] }
);

export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;

// ================================================================
// PERIOD — UPDATE
// ================================================================
export const updatePeriodSchema = z
  .object({
    periodNumber: z.coerce.number().int().min(1).max(30).optional(),
    name: z.string().trim().min(2).max(50).optional(),
    startTime: isoTime.optional(),
    endTime: isoTime.optional(),
    isBreak: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export type UpdatePeriodInput = z.infer<typeof updatePeriodSchema>;

// ================================================================
// PERIOD — BULK CREATE
// ================================================================
export const bulkCreatePeriodsSchema = z.object({
  schoolId: uuid("school ID"),
  periods: z
    .array(
      z.object({
        periodNumber: z.coerce.number().int().min(1).max(30),
        name: z.string().trim().min(2).max(50),
        startTime: isoTime,
        endTime: isoTime,
        isBreak: z.boolean().optional().default(false),
      })
    )
    .min(1, "At least one period is required.")
    .max(50, "Cannot create more than 50 periods in one request.")
    .refine((periods) => periods.every((p) => p.endTime > p.startTime), {
      message: "Every period must have endTime after startTime.",
    })
    .refine((periods) => {
      const nums = periods.map((p) => p.periodNumber);
      return new Set(nums).size === nums.length;
    }, { message: "Duplicate period numbers in the same request." }),
});

export type BulkCreatePeriodsInput = z.infer<typeof bulkCreatePeriodsSchema>;

// ================================================================
// LOOKUP QUERIES
// ================================================================
export const getPeriodByNumberSchema = z.object({
  periodNumber: z.coerce.number().int().min(1).max(30),
});

export type GetPeriodByNumberInput = z.infer<typeof getPeriodByNumberSchema>;

// ================================================================
// ROUTE PARAMS
// ================================================================
export const periodIdParamSchema = z.object({
  periodId: uuid("period ID"),
});

export const schoolIdParamSchema = z.object({
  schoolId: uuid("school ID"),
});