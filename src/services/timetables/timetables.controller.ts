// src/services/timetables/timetables.controller.ts
import { Request, Response } from "express";
import {
  createPeriodService,
  bulkCreatePeriodsService,
  getPeriodByIdService,
  getPeriodByNumberService,
  listPeriodsForSchoolService,
  listTeachingPeriodsService,
  listBreakPeriodsService,
  updatePeriodService,
  deletePeriodService,
  validatePeriodScheduleService,
  countPeriodsService,
  getFirstPeriodService,
  getLastPeriodService,
  reorderPeriodsService,
  createTimetableSlotService,
  bulkCreateTimetableService,
  bulkCreateSchoolTimetableService,
  getTimetableSlotByIdService,
  updateTimetableSlotService,
  deleteTimetableSlotService,
  getClassTimetableService,
  getClassTimetableForDayService,
  getTeacherTimetableService,
  getTeacherTimetableForDayService,
  listSlotsForSchoolService,
  getSlotByClassDayPeriodService,
  getCurrentLessonForClassService,
  getNextLessonForClassService,
  getCurrentLessonForTeacherService,
  checkTeacherConflictService,
  checkClassConflictService,
  checkRoomConflictService,
  validateSchoolTimetableService,
  getTeacherFreePeriodsService,
  getTeacherWorkloadService,
  getSubjectAllocationService,
  getClassWorkloadService,
  deleteTimetableForClassService,
  deleteTimetableForSchoolService,
  countSlotsForClassService,
  getClassesWithNoTimetableService,
  getTimetableCoverageStatsService,
  getClassSlotsPerDayService,
  copyTimetableToClassService,
  cloneTimetableService,
  deleteTimetableForDayService,
  deleteSlotByClassDayPeriodService,
  moveTimetableSlotService,
  swapTimetableSlotsService,
  getFreeSlotsForClassService,
  getSlotsBySubjectService,
  getSlotsByTeacherService,
  getSlotsByRoomService,
  assignTeacherToSlotService,
  assignRoomToSlotService,
  getUnassignedTeacherSlotsService,
  getSlotsWithoutRoomService,
  getTeacherAvailabilityMatrixService,
  findLeastLoadedTeacherForSubjectService,
  exportSchoolTimetableService,
  getSchoolTimetableGridService,
  getTeacherWeeklyViewService,
  getUpcomingLessonsForTeacherService,
  getClassTimetableTodayService,
  bulkDeleteSlotsService,
  bulkUpdateSlotsService,
  getActivePeriodService,
  previewSchoolTimetableService,
  generateSchoolTimetableService,
  seedStandardSchoolDayService,
  resetSchoolSetupService,
  duplicateDayService,
  getPerClassCoverageService,
  getPreferredTeachersForSubjectService,
  autoAssignMissingTeachersService,
  getDetailedConflictsService,
} from "./timetables.service";
import {
  createPeriodSchema,
  bulkCreatePeriodsSchema,
  updatePeriodSchema,
  getPeriodByNumberSchema,
  createTimetableSlotSchema,
  bulkCreateTimetableSchema,
  bulkCreateSchoolTimetableSchema,
  updateTimetableSlotSchema,
  checkConflictSchema,
  freePeriodsQuerySchema,
  periodIdParamSchema,
  timetableSlotIdParamSchema,
  classIdParamSchema,
  teacherIdParamSchema,
  schoolIdParamSchema,
  dayOfWeekParamSchema,
} from "../../validators/timetable.validator";

// ================================================================
// Small helpers
// ================================================================
const fail = (res: Response, status: number, message: string, issues?: any) =>
  res.status(status).json({ success: false, message, issues });

const ok = (res: Response, result: any, status = 200) =>
  res.status(status).json(result);

const handleZod = (res: Response, err: any) => {
  const first = err?.errors?.[0];
  const field = first?.path?.join(".") ?? "input";
  return fail(res, 400, `${field}: ${first?.message ?? "invalid value"}`, err?.errors);
};

const isZod = (e: any) => e?.name === "ZodError" || Array.isArray(e?.errors);

const resolveSchoolId = (req: Request): string | null => {
  const user = (req as any).user;
  if (!user) return null;
  if (user.role === "admin") return null;
  return user.schoolId ?? null;
};

const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Shared validator for generator payloads — used by preview & generate.
 * Validates classIds / allocations AND every field of `config` so bad
 * input is rejected before it reaches the placement loop.
 */
function validateGeneratorPayload(body: any): string | null {
  const { classIds, allocations, config } = body ?? {};
  if (!Array.isArray(classIds) || classIds.length === 0) {
    return "'classIds' must be a non-empty array.";
  }
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return "'allocations' must be a non-empty array.";
  }
  for (const a of allocations) {
    if (!isUuid(a?.classId)) return "Each allocation must have a valid 'classId'.";
    if (!isUuid(a?.subjectId)) return "Each allocation must have a valid 'subjectId'.";
    if (typeof a?.lessonsPerWeek !== "number" || a.lessonsPerWeek < 0) {
      return "'lessonsPerWeek' must be a non-negative number.";
    }
  }

  // ── config (all fields optional) ─────────────────────────
  if (config !== undefined && config !== null) {
    if (typeof config !== "object" || Array.isArray(config)) {
      return "'config' must be an object if provided.";
    }

    if (
      config.maxPerTeacherPerDay !== undefined &&
      (typeof config.maxPerTeacherPerDay !== "number" ||
        !Number.isInteger(config.maxPerTeacherPerDay) ||
        config.maxPerTeacherPerDay < 1)
    ) {
      return "'config.maxPerTeacherPerDay' must be a positive integer.";
    }

    if (
      config.maxPerTeacherPerWeek !== undefined &&
      (typeof config.maxPerTeacherPerWeek !== "number" ||
        !Number.isInteger(config.maxPerTeacherPerWeek) ||
        config.maxPerTeacherPerWeek < 1)
    ) {
      return "'config.maxPerTeacherPerWeek' must be a positive integer.";
    }

    if (
      config.maxDoublesPerDay !== undefined &&
      (typeof config.maxDoublesPerDay !== "number" ||
        !Number.isInteger(config.maxDoublesPerDay) ||
        config.maxDoublesPerDay < 0)
    ) {
      return "'config.maxDoublesPerDay' must be a non-negative integer.";
    }

    if (
      config.spreadSubjects !== undefined &&
      typeof config.spreadSubjects !== "boolean"
    ) {
      return "'config.spreadSubjects' must be a boolean.";
    }

    if (config.morningHeavySubjectIds !== undefined) {
      if (
        !Array.isArray(config.morningHeavySubjectIds) ||
        !config.morningHeavySubjectIds.every(isUuid)
      ) {
        return "'config.morningHeavySubjectIds' must be an array of valid subject IDs.";
      }
    }

    if (config.dailySubjectIds !== undefined) {
      if (
        !Array.isArray(config.dailySubjectIds) ||
        !config.dailySubjectIds.every(isUuid)
      ) {
        return "'config.dailySubjectIds' must be an array of valid subject IDs.";
      }
    }

    if (config.maxPerSubjectPerDay !== undefined) {
      if (
        typeof config.maxPerSubjectPerDay !== "object" ||
        Array.isArray(config.maxPerSubjectPerDay) ||
        config.maxPerSubjectPerDay === null
      ) {
        return "'config.maxPerSubjectPerDay' must be an object { subjectId: cap }.";
      }
      for (const [sid, cap] of Object.entries(config.maxPerSubjectPerDay)) {
        if (!isUuid(sid)) {
          return "'config.maxPerSubjectPerDay' keys must be valid subject IDs.";
        }
        if (typeof cap !== "number" || !Number.isInteger(cap) || cap < 0) {
          return "'config.maxPerSubjectPerDay' values must be non-negative integers (0 = blocked).";
        }
      }
    }

    if (config.avoidAdjacentPairs !== undefined) {
      if (!Array.isArray(config.avoidAdjacentPairs)) {
        return "'config.avoidAdjacentPairs' must be an array of [subjectA, subjectB] pairs.";
      }
      for (const pair of config.avoidAdjacentPairs) {
        if (
          !Array.isArray(pair) ||
          pair.length !== 2 ||
          !isUuid(pair[0]) ||
          !isUuid(pair[1])
        ) {
          return "'config.avoidAdjacentPairs' entries must be [subjectA, subjectB] pairs of subject IDs.";
        }
      }
    }
  }

  return null;
}

// ================================================================
// PERIODS
// ================================================================

export const createPeriodController = async (req: Request, res: Response) => {
  try {
    const body = createPeriodSchema.parse(req.body);
    const forced = resolveSchoolId(req);
    if (forced && forced !== body.schoolId) {
      return fail(res, 403, "You can only create periods for your own school.");
    }
    const result = await createPeriodService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Something went wrong while creating the period.", e?.message);
  }
};

export const bulkCreatePeriodsController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreatePeriodsSchema.parse(req.body);
    const forced = resolveSchoolId(req);
    if (forced && forced !== body.schoolId) {
      return fail(res, 403, "You can only create periods for your own school.");
    }
    const result = await bulkCreatePeriodsService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Something went wrong while creating periods in bulk.", e?.message);
  }
};

export const getPeriodByIdController = async (req: Request, res: Response) => {
  try {
    const { periodId } = periodIdParamSchema.parse(req.params);
    const result = await getPeriodByIdService(periodId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load that period.", e?.message);
  }
};

export const getPeriodByNumberController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { periodNumber } = getPeriodByNumberSchema.parse(req.params);
    const result = await getPeriodByNumberService(schoolId, periodNumber);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load that period.", e?.message);
  }
};

export const listPeriodsForSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await listPeriodsForSchoolService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list the periods.", e?.message);
  }
};

export const listTeachingPeriodsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await listTeachingPeriodsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list teaching periods.", e?.message);
  }
};

export const listBreakPeriodsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await listBreakPeriodsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list break periods.", e?.message);
  }
};

export const updatePeriodController = async (req: Request, res: Response) => {
  try {
    const { periodId } = periodIdParamSchema.parse(req.params);
    const body = updatePeriodSchema.parse(req.body);
    const result = await updatePeriodService(periodId, body);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update that period.", e?.message);
  }
};

export const deletePeriodController = async (req: Request, res: Response) => {
  try {
    const { periodId } = periodIdParamSchema.parse(req.params);
    const result = await deletePeriodService(periodId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete that period.", e?.message);
  }
};

export const validatePeriodScheduleController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await validatePeriodScheduleService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not validate the period schedule.", e?.message);
  }
};

export const countPeriodsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await countPeriodsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not count the periods.", e?.message);
  }
};

export const getFirstPeriodController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getFirstPeriodService(schoolId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not find the first period.", e?.message);
  }
};

export const getLastPeriodController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getLastPeriodService(schoolId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not find the last period.", e?.message);
  }
};

export const reorderPeriodsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const orderedIds: string[] = req.body?.orderedIds;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return fail(res, 400, "Please send a non-empty 'orderedIds' array.");
    }
    const result = await reorderPeriodsService(schoolId, orderedIds);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not reorder the periods.", e?.message);
  }
};

export const getActivePeriodController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getActivePeriodService(schoolId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not find the active period.", e?.message);
  }
};

// ================================================================
// TIMETABLE SLOTS
// ================================================================

export const createTimetableSlotController = async (req: Request, res: Response) => {
  try {
    const body = createTimetableSlotSchema.parse(req.body);
    const forced = resolveSchoolId(req);
    if (forced && forced !== body.schoolId) {
      return fail(res, 403, "You can only create slots for your own school.");
    }
    const result = await createTimetableSlotService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Something went wrong while creating the slot.", e?.message);
  }
};

export const bulkCreateTimetableController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreateTimetableSchema.parse(req.body);
    const forced = resolveSchoolId(req);
    if (forced && forced !== body.schoolId) {
      return fail(res, 403, "You can only create slots for your own school.");
    }
    const result = await bulkCreateTimetableService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Something went wrong while creating the class timetable.", e?.message);
  }
};

// ✅ FIX #1 — map schoolId onto each slot before calling the service
export const bulkCreateSchoolTimetableController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreateSchoolTimetableSchema.parse(req.body);
    const forced = resolveSchoolId(req);
    if (forced && forced !== body.schoolId) {
      return fail(res, 403, "You can only create slots for your own school.");
    }
    const result = await bulkCreateSchoolTimetableService({
      schoolId: body.schoolId,
      slots: body.slots.map((s) => ({ ...s, schoolId: body.schoolId })),
    });
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Something went wrong while creating the school timetable.", e?.message);
  }
};

export const getTimetableSlotByIdController = async (req: Request, res: Response) => {
  try {
    const { slotId } = timetableSlotIdParamSchema.parse(req.params);
    const result = await getTimetableSlotByIdService(slotId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load that slot.", e?.message);
  }
};

export const updateTimetableSlotController = async (req: Request, res: Response) => {
  try {
    const { slotId } = timetableSlotIdParamSchema.parse(req.params);
    const body = updateTimetableSlotSchema.parse(req.body);
    const result = await updateTimetableSlotService(slotId, body);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update that slot.", e?.message);
  }
};

export const deleteTimetableSlotController = async (req: Request, res: Response) => {
  try {
    const { slotId } = timetableSlotIdParamSchema.parse(req.params);
    const result = await deleteTimetableSlotService(slotId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete that slot.", e?.message);
  }
};

export const moveTimetableSlotController = async (req: Request, res: Response) => {
  try {
    const { slotId } = timetableSlotIdParamSchema.parse(req.params);
    const { dayOfWeek, periodId } = req.body ?? {};
    if (!dayOfWeek || !periodId) {
      return fail(res, 400, "Please provide both 'dayOfWeek' and 'periodId'.");
    }
    const result = await moveTimetableSlotService(slotId, dayOfWeek, periodId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not move that slot.", e?.message);
  }
};

export const swapTimetableSlotsController = async (req: Request, res: Response) => {
  try {
    const { slotAId, slotBId } = req.body ?? {};
    if (!slotAId || !slotBId) {
      return fail(res, 400, "Please provide both 'slotAId' and 'slotBId'.");
    }
    const result = await swapTimetableSlotsService(slotAId, slotBId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not swap the slots.", e?.message);
  }
};

export const assignTeacherToSlotController = async (req: Request, res: Response) => {
  try {
    const { slotId } = timetableSlotIdParamSchema.parse(req.params);
    const teacherId = req.body?.teacherId ?? null;
    const result = await assignTeacherToSlotService(slotId, teacherId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not assign the teacher.", e?.message);
  }
};

export const assignRoomToSlotController = async (req: Request, res: Response) => {
  try {
    const { slotId } = timetableSlotIdParamSchema.parse(req.params);
    const room = req.body?.room ?? null;
    const result = await assignRoomToSlotService(slotId, room);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not assign the room.", e?.message);
  }
};

export const bulkDeleteSlotsController = async (req: Request, res: Response) => {
  try {
    const schoolId = req.body?.schoolId ?? (req as any).user?.schoolId;
    const slotIds: string[] = req.body?.slotIds;
    if (!schoolId) return fail(res, 400, "schoolId is required.");
    if (!Array.isArray(slotIds) || slotIds.length === 0) {
      return fail(res, 400, "Please send a non-empty 'slotIds' array.");
    }
    const result = await bulkDeleteSlotsService(schoolId, slotIds);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-delete the slots.", e?.message);
  }
};

export const bulkUpdateSlotsController = async (req: Request, res: Response) => {
  try {
    const schoolId = req.body?.schoolId ?? (req as any).user?.schoolId;
    const slotIds: string[] = req.body?.slotIds;
    const patch = req.body?.patch ?? {
      subjectId: req.body?.subjectId,
      teacherId: req.body?.teacherId,
      room: req.body?.room,
    };
    if (!schoolId) return fail(res, 400, "schoolId is required.");
    if (!Array.isArray(slotIds) || slotIds.length === 0) {
      return fail(res, 400, "Please send a non-empty 'slotIds' array.");
    }
    const result = await bulkUpdateSlotsService(schoolId, slotIds, patch);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-update the slots.", e?.message);
  }
};

export const copyTimetableToClassController = async (req: Request, res: Response) => {
  try {
    const { sourceClassId, targetClassId } = req.body ?? {};
    if (!sourceClassId || !targetClassId) {
      return fail(res, 400, "Please provide both 'sourceClassId' and 'targetClassId'.");
    }
    const result = await copyTimetableToClassService(sourceClassId, targetClassId);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not copy the timetable.", e?.message);
  }
};

export const cloneTimetableController = async (req: Request, res: Response) => {
  try {
    const { schoolId, sourceClassId, targetClassId } = req.body ?? {};
    if (!schoolId || !sourceClassId || !targetClassId) {
      return fail(res, 400, "Please provide 'schoolId', 'sourceClassId' and 'targetClassId'.");
    }
    const result = await cloneTimetableService(schoolId, sourceClassId, targetClassId);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not clone the timetable.", e?.message);
  }
};

// ================================================================
// VIEWS — CLASS
// ================================================================

export const getClassTimetableController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const result = await getClassTimetableService(classId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load the class timetable.", e?.message);
  }
};

export const getClassTimetableForDayController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const { dayOfWeek } = dayOfWeekParamSchema.parse(req.params);
    const result = await getClassTimetableForDayService(classId, dayOfWeek);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load that day's timetable.", e?.message);
  }
};

export const getClassTimetableTodayController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const result = await getClassTimetableTodayService(classId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load today's timetable.", e?.message);
  }
};

export const getSlotByClassDayPeriodController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const { dayOfWeek } = dayOfWeekParamSchema.parse(req.params);
    const { periodId } = periodIdParamSchema.parse(req.params);
    const result = await getSlotByClassDayPeriodService(classId, dayOfWeek, periodId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not find that slot.", e?.message);
  }
};

export const deleteSlotByClassDayPeriodController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const { dayOfWeek } = dayOfWeekParamSchema.parse(req.params);
    const { periodId } = periodIdParamSchema.parse(req.params);
    const result = await deleteSlotByClassDayPeriodService(classId, dayOfWeek, periodId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete that slot.", e?.message);
  }
};

export const getCurrentLessonForClassController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const result = await getCurrentLessonForClassService(classId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not figure out the current lesson.", e?.message);
  }
};

export const getNextLessonForClassController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const result = await getNextLessonForClassService(classId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not figure out the next lesson.", e?.message);
  }
};

export const getFreeSlotsForClassController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const result = await getFreeSlotsForClassService(classId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not work out the class's free slots.", e?.message);
  }
};

export const getClassSlotsPerDayController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const result = await getClassSlotsPerDayService(classId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not count the class's slots per day.", e?.message);
  }
};

export const getClassWorkloadController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const result = await getClassWorkloadService(classId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute the class workload.", e?.message);
  }
};

export const countSlotsForClassController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const result = await countSlotsForClassService(classId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not count the class's slots.", e?.message);
  }
};

export const deleteTimetableForClassController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const result = await deleteTimetableForClassService(classId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not clear the class timetable.", e?.message);
  }
};

// ================================================================
// VIEWS — TEACHER
// ================================================================

export const getTeacherTimetableController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const result = await getTeacherTimetableService(teacherId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load the teacher's timetable.", e?.message);
  }
};

export const getTeacherTimetableForDayController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const { dayOfWeek } = dayOfWeekParamSchema.parse(req.params);
    const result = await getTeacherTimetableForDayService(teacherId, dayOfWeek);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load that day for the teacher.", e?.message);
  }
};

export const getCurrentLessonForTeacherController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const result = await getCurrentLessonForTeacherService(teacherId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not figure out the teacher's current lesson.", e?.message);
  }
};

// ✅ FIX #2 — guard dayOfWeek (was Weekday | undefined)
export const getTeacherFreePeriodsController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const { dayOfWeek } = freePeriodsQuerySchema.parse(req.query);
    if (!dayOfWeek) {
      return fail(res, 400, "dayOfWeek query parameter is required.");
    }
    const result = await getTeacherFreePeriodsService(teacherId, dayOfWeek);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not work out the teacher's free periods.", e?.message);
  }
};

export const getTeacherWorkloadController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const result = await getTeacherWorkloadService(teacherId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute the teacher's workload.", e?.message);
  }
};

export const getTeacherAvailabilityMatrixController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const result = await getTeacherAvailabilityMatrixService(teacherId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not build the availability matrix.", e?.message);
  }
};

export const getTeacherWeeklyViewController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const result = await getTeacherWeeklyViewService(teacherId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not build the teacher's weekly view.", e?.message);
  }
};

export const getUpcomingLessonsForTeacherController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const withinMinutes = Number(req.query?.withinMinutes ?? 30);
    const result = await getUpcomingLessonsForTeacherService(teacherId, withinMinutes);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not fetch upcoming lessons.", e?.message);
  }
};

// ================================================================
// VIEWS — SCHOOL
// ================================================================

export const listSlotsForSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await listSlotsForSchoolService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list the slots.", e?.message);
  }
};

export const getSchoolTimetableGridController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getSchoolTimetableGridService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not build the school grid.", e?.message);
  }
};

export const exportSchoolTimetableController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await exportSchoolTimetableService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not export the timetable.", e?.message);
  }
};

export const getSubjectAllocationController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getSubjectAllocationService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute subject allocation.", e?.message);
  }
};

export const getClassesWithNoTimetableController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getClassesWithNoTimetableService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not find classes without a timetable.", e?.message);
  }
};

export const getTimetableCoverageStatsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getTimetableCoverageStatsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute coverage stats.", e?.message);
  }
};

export const getUnassignedTeacherSlotsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getUnassignedTeacherSlotsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not fetch slots without a teacher.", e?.message);
  }
};

export const getSlotsWithoutRoomController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getSlotsWithoutRoomService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not fetch slots without a room.", e?.message);
  }
};

export const getSlotsBySubjectController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const subjectId = req.params.subjectId;
    if (!subjectId || typeof subjectId !== "string") {
      return fail(res, 400, "Please provide a valid subject ID.");
    }
    const result = await getSlotsBySubjectService(schoolId, subjectId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not fetch slots for that subject.", e?.message);
  }
};

export const getSlotsByTeacherController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const result = await getSlotsByTeacherService(schoolId, teacherId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not fetch slots for that teacher.", e?.message);
  }
};

export const getSlotsByRoomController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const room = req.params.room;
    if (!room || typeof room !== "string") {
      return fail(res, 400, "Please provide a valid room name.");
    }
    const result = await getSlotsByRoomService(schoolId, room);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not fetch slots for that room.", e?.message);
  }
};

export const findLeastLoadedTeacherForSubjectController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const subjectId = req.params.subjectId;
    if (!subjectId || typeof subjectId !== "string") {
      return fail(res, 400, "Please provide a valid subject ID.");
    }
    const result = await findLeastLoadedTeacherForSubjectService(schoolId, subjectId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not rank teachers by load.", e?.message);
  }
};

export const deleteTimetableForSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await deleteTimetableForSchoolService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not clear the school timetable.", e?.message);
  }
};

export const deleteTimetableForDayController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { dayOfWeek } = dayOfWeekParamSchema.parse(req.params);
    const result = await deleteTimetableForDayService(schoolId, dayOfWeek);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete that day's timetable.", e?.message);
  }
};

// ================================================================
// CONFLICT CHECKS
// ================================================================

export const checkTeacherConflictController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const { dayOfWeek } = dayOfWeekParamSchema.parse(req.query);
    const periodId = req.query.periodId;
    if (!periodId || typeof periodId !== "string") {
      return fail(res, 400, "periodId query parameter is required.");
    }
    const excludeSlotId = typeof req.query.excludeSlotId === "string"
      ? req.query.excludeSlotId
      : undefined;
    const result = await checkTeacherConflictService(teacherId, dayOfWeek, periodId, excludeSlotId);
    return ok(res, result, result.success ? 200 : 409);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not check the teacher's conflicts.", e?.message);
  }
};

export const checkClassConflictController = async (req: Request, res: Response) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);
    const { dayOfWeek } = dayOfWeekParamSchema.parse(req.query);
    const periodId = req.query.periodId;
    if (!periodId || typeof periodId !== "string") {
      return fail(res, 400, "periodId query parameter is required.");
    }
    const excludeSlotId = typeof req.query.excludeSlotId === "string"
      ? req.query.excludeSlotId
      : undefined;
    const result = await checkClassConflictService(classId, dayOfWeek, periodId, excludeSlotId);
    return ok(res, result, result.success ? 200 : 409);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not check the class's conflicts.", e?.message);
  }
};

export const checkRoomConflictController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { dayOfWeek } = dayOfWeekParamSchema.parse(req.query);
    const room = req.query.room;
    const periodId = req.query.periodId;
    if (!room || typeof room !== "string") {
      return fail(res, 400, "room query parameter is required.");
    }
    if (!periodId || typeof periodId !== "string") {
      return fail(res, 400, "periodId query parameter is required.");
    }
    const excludeSlotId = typeof req.query.excludeSlotId === "string"
      ? req.query.excludeSlotId
      : undefined;
    const result = await checkRoomConflictService(schoolId, room, dayOfWeek, periodId, excludeSlotId);
    return ok(res, result, result.success ? 200 : 409);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not check the room's conflicts.", e?.message);
  }
};

export const validateSchoolTimetableController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await validateSchoolTimetableService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not validate the timetable.", e?.message);
  }
};

// ================================================================
// WHOLE-SCHOOL TIMETABLE GENERATOR
// ================================================================

/**
 * POST /schools/:schoolId/timetable/generate/preview
 * Dry-run — returns what WOULD be created without writing to the DB.
 */
export const previewSchoolTimetableController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const forced = resolveSchoolId(req);
    if (forced && forced !== schoolId) {
      return fail(res, 403, "You can only generate timetables for your own school.");
    }

    const validationError = validateGeneratorPayload(req.body);
    if (validationError) return fail(res, 400, validationError);

    const { classIds, allocations, config } = req.body;
    const actorId = (req as any).user?.id ?? null;
    const result = await previewSchoolTimetableService(
      { schoolId, classIds, allocations, config },
      actorId
    );
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not preview the timetable.", e?.message);
  }
};

/**
 * POST /schools/:schoolId/timetable/generate
 * Generates + saves the whole school timetable.
 */
export const generateSchoolTimetableController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const forced = resolveSchoolId(req);
    if (forced && forced !== schoolId) {
      return fail(res, 403, "You can only generate timetables for your own school.");
    }

    const validationError = validateGeneratorPayload(req.body);
    if (validationError) return fail(res, 400, validationError);

    const { classIds, allocations, config, options } = req.body;
    const actorId = (req as any).user?.id ?? null;
    const result = await generateSchoolTimetableService(
      { schoolId, classIds, allocations, config, options },
      actorId
    );

    const isDry = (result.stats as any)?.dryRun === true;
    return ok(res, result, result.success ? (isDry ? 200 : 201) : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not generate the timetable.", e?.message);
  }
};

// ================================================================
// SETUP & RESET
// ================================================================

/**
 * POST /schools/:schoolId/periods/seed-standard
 */
export const seedStandardSchoolDayController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const forced = resolveSchoolId(req);
    if (forced && forced !== schoolId) {
      return fail(res, 403, "You can only seed periods for your own school.");
    }

    const actorId = (req as any).user?.id ?? null;
    const result = await seedStandardSchoolDayService(schoolId, actorId);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not seed the standard school day.", e?.message);
  }
};

/**
 * DELETE /schools/:schoolId/timetable/reset?confirm=true
 * Destructive — deletes ALL slots + periods.
 */
export const resetSchoolSetupController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const forced = resolveSchoolId(req);
    if (forced && forced !== schoolId) {
      return fail(res, 403, "You can only reset your own school's setup.");
    }

    const confirm =
      req.query?.confirm === "true" ||
      req.query?.confirm === "1" ||
      req.body?.confirm === true;

    const actorId = (req as any).user?.id ?? null;
    const result = await resetSchoolSetupService(schoolId, confirm, actorId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not reset the school setup.", e?.message);
  }
};

// ================================================================
// BULK OPERATIONS
// ================================================================

/**
 * POST /schools/:schoolId/timetable/duplicate-day
 * Body: { sourceDay, targetDay, classIds? }
 */
export const duplicateDayController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const forced = resolveSchoolId(req);
    if (forced && forced !== schoolId) {
      return fail(res, 403, "You can only duplicate days for your own school.");
    }

    const { sourceDay, targetDay, classIds } = req.body ?? {};
    const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    if (!VALID_DAYS.includes(sourceDay)) {
      return fail(res, 400, "'sourceDay' must be a valid weekday.");
    }
    if (!VALID_DAYS.includes(targetDay)) {
      return fail(res, 400, "'targetDay' must be a valid weekday.");
    }
    if (sourceDay === targetDay) {
      return fail(res, 400, "'sourceDay' and 'targetDay' must differ.");
    }
    if (classIds !== undefined && !Array.isArray(classIds)) {
      return fail(res, 400, "'classIds' must be an array if provided.");
    }

    const actorId = (req as any).user?.id ?? null;
    const result = await duplicateDayService(
      { schoolId, sourceDay, targetDay, classIds },
      actorId
    );
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not duplicate the day.", e?.message);
  }
};

/**
 * PATCH /schools/:schoolId/timetable/auto-assign-teachers
 */
export const autoAssignMissingTeachersController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const forced = resolveSchoolId(req);
    if (forced && forced !== schoolId) {
      return fail(res, 403, "You can only auto-assign teachers for your own school.");
    }

    const { maxPerTeacherPerDay, maxPerTeacherPerWeek, preferSubjectQualified } =
      req.body ?? {};

    if (
      maxPerTeacherPerDay !== undefined &&
      (typeof maxPerTeacherPerDay !== "number" || maxPerTeacherPerDay < 1)
    ) {
      return fail(res, 400, "'maxPerTeacherPerDay' must be >= 1.");
    }
    if (
      maxPerTeacherPerWeek !== undefined &&
      (typeof maxPerTeacherPerWeek !== "number" || maxPerTeacherPerWeek < 1)
    ) {
      return fail(res, 400, "'maxPerTeacherPerWeek' must be >= 1.");
    }

    const actorId = (req as any).user?.id ?? null;
    const result = await autoAssignMissingTeachersService(
      schoolId,
      { maxPerTeacherPerDay, maxPerTeacherPerWeek, preferSubjectQualified },
      actorId
    );
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not auto-assign teachers.", e?.message);
  }
};

// ================================================================
// ANALYTICS
// ================================================================

/**
 * GET /schools/:schoolId/timetable/per-class-coverage
 */
export const getPerClassCoverageController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const forced = resolveSchoolId(req);
    if (forced && forced !== schoolId) {
      return fail(res, 403, "You can only view coverage for your own school.");
    }

    const result = await getPerClassCoverageService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute per-class coverage.", e?.message);
  }
};

/**
 * GET /schools/:schoolId/subjects/:subjectId/preferred-teachers
 */
export const getPreferredTeachersForSubjectController = async (
  req: Request,
  res: Response
) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const subjectId = req.params.subjectId;
    if (!subjectId || typeof subjectId !== "string") {
      return fail(res, 400, "Please provide a valid subject ID.");
    }
    const forced = resolveSchoolId(req);
    if (forced && forced !== schoolId) {
      return fail(res, 403, "You can only view teachers for your own school.");
    }

    const result = await getPreferredTeachersForSubjectService(schoolId, subjectId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load preferred teachers.", e?.message);
  }
};

/**
 * GET /schools/:schoolId/timetable/conflicts-detailed
 */
export const getDetailedConflictsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const forced = resolveSchoolId(req);
    if (forced && forced !== schoolId) {
      return fail(res, 403, "You can only view conflicts for your own school.");
    }

    const result = await getDetailedConflictsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute detailed conflicts.", e?.message);
  }
};