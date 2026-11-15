// src/services/timetables/timetables.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

const isoTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Time must be HH:MM or HH:MM:SS.");

const weekday = z.enum(
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  { errorMap: () => ({ message: "Invalid weekday." }) }
);

// ================================================================
// PERIODS
// ================================================================
const periodObjectSchema = z.object({
  schoolId: uuid("school ID"),
  periodNumber: z.coerce.number().int().min(1).max(30),
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
    .max(50, "Cannot create more than 50 periods at once.")
    .refine((ps) => ps.every((p) => p.endTime > p.startTime), {
      message: "Every period must have endTime after startTime.",
    })
    .refine((ps) => new Set(ps.map((p) => p.periodNumber)).size === ps.length, {
      message: "Duplicate period numbers in the same request.",
    }),
});

export type BulkCreatePeriodsInput = z.infer<typeof bulkCreatePeriodsSchema>;

export const getPeriodByNumberSchema = z.object({
  periodNumber: z.coerce.number().int().min(1).max(30),
});

export type GetPeriodByNumberInput = z.infer<typeof getPeriodByNumberSchema>;

export const periodIdParamSchema = z.object({ periodId: uuid("period ID") });

// ================================================================
// TIMETABLES
// ================================================================
const timetableSlotObjectSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  dayOfWeek: weekday,
  periodId: uuid("period ID"),
  subjectId: uuid("subject ID"),
  teacherId: uuid("teacher ID").optional().nullable(),
  room: z.string().trim().max(50).optional().nullable(),
});

export const createTimetableSlotSchema = timetableSlotObjectSchema;

export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;

export const bulkCreateTimetableSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  slots: z
    .array(
      z.object({
        dayOfWeek: weekday,
        periodId: uuid("period ID"),
        subjectId: uuid("subject ID"),
        teacherId: uuid("teacher ID").optional().nullable(),
        room: z.string().trim().max(50).optional().nullable(),
      })
    )
    .min(1, "At least one slot is required.")
    .max(100, "Cannot create more than 100 slots at once.")
    .refine(
      (slots) => new Set(slots.map((s) => `${s.dayOfWeek}::${s.periodId}`)).size === slots.length,
      { message: "Duplicate (day, period) pairs in the same request." }
    ),
});

export type BulkCreateTimetableInput = z.infer<typeof bulkCreateTimetableSchema>;

export const bulkCreateSchoolTimetableSchema = z.object({
  schoolId: uuid("school ID"),
  slots: z
    .array(
      z.object({
        classId: uuid("class ID"),
        dayOfWeek: weekday,
        periodId: uuid("period ID"),
        subjectId: uuid("subject ID"),
        teacherId: uuid("teacher ID").optional().nullable(),
        room: z.string().trim().max(50).optional().nullable(),
      })
    )
    .min(1, "At least one slot is required.")
    .max(500, "Cannot create more than 500 slots at once.")
    .refine(
      (slots) =>
        new Set(slots.map((s) => `${s.classId}::${s.dayOfWeek}::${s.periodId}`)).size === slots.length,
      { message: "Duplicate (class, day, period) tuples in the same request." }
    ),
});

export type BulkCreateSchoolTimetableInput = z.infer<typeof bulkCreateSchoolTimetableSchema>;

export const updateTimetableSlotSchema = z
  .object({
    dayOfWeek: weekday.optional(),
    periodId: uuid("period ID").optional(),
    subjectId: uuid("subject ID").optional(),
    teacherId: uuid("teacher ID").optional().nullable(),
    room: z.string().trim().max(50).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export type UpdateTimetableSlotInput = z.infer<typeof updateTimetableSlotSchema>;

export const checkConflictSchema = z
  .object({
    classId: uuid("class ID").optional(),
    teacherId: uuid("teacher ID").optional(),
    room: z.string().trim().max(50).optional(),
    dayOfWeek: weekday,
    periodId: uuid("period ID"),
    excludeSlotId: uuid("slot ID").optional(),
  })
  .refine(
    (d) => !!d.classId || !!d.teacherId || !!d.room,
    { message: "Provide at least one of: classId, teacherId, room." }
  );

export type CheckConflictInput = z.infer<typeof checkConflictSchema>;

export const freePeriodsQuerySchema = z.object({
  dayOfWeek: weekday.optional(),
});

export type FreePeriodsQueryInput = z.infer<typeof freePeriodsQuerySchema>;

export const timetableSlotIdParamSchema = z.object({ slotId: uuid("slot ID") });
export const classIdParamSchema = z.object({ classId: uuid("class ID") });
export const teacherIdParamSchema = z.object({ teacherId: uuid("teacher ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });
export const dayOfWeekParamSchema = z.object({ dayOfWeek: weekday });