// src/services/timetables/timetables.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, inArray, gte, lte, gt, lt, or,
} from "drizzle-orm";
import { randomUUID } from "crypto";

import {
  schools,
  periods,
  timetables,
  classes,
  subjects,
  users,
  teacherSubjects,
  auditLogs,
  TSelectPeriod,
  TInsertPeriod,
  TSelectTimetable,
  TInsertTimetable,
  TSelectUser,
  TSelectClass,
  TSelectSubject,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// TYPES & CONSTANTS
// ================================================================

type Weekday = NonNullable<TSelectTimetable["dayOfWeek"]>;

const WEEKDAYS: Weekday[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
];

const ALL_WEEKDAYS: Weekday[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/** Standard Kenyan school day — 13 periods including breaks. */
const STANDARD_KENYAN_DAY: Array<Omit<TInsertPeriod, "schoolId">> = [
  { periodNumber: 1,  name: "Morning Assembly / Devotion", startTime: "07:40", endTime: "08:00", isBreak: true  },
  { periodNumber: 2,  name: "Lesson 1",                    startTime: "08:00", endTime: "08:40", isBreak: false },
  { periodNumber: 3,  name: "Lesson 2",                    startTime: "08:40", endTime: "09:20", isBreak: false },
  { periodNumber: 4,  name: "Lesson 3",                    startTime: "09:20", endTime: "10:00", isBreak: false },
  { periodNumber: 5,  name: "Tea Break",                   startTime: "10:00", endTime: "10:20", isBreak: true  },
  { periodNumber: 6,  name: "Lesson 4",                    startTime: "10:20", endTime: "11:00", isBreak: false },
  { periodNumber: 7,  name: "Lesson 5",                    startTime: "11:00", endTime: "11:40", isBreak: false },
  { periodNumber: 8,  name: "Lesson 6",                    startTime: "11:40", endTime: "12:20", isBreak: false },
  { periodNumber: 9,  name: "Lesson 7",                    startTime: "12:20", endTime: "13:00", isBreak: false },
  { periodNumber: 10, name: "Lunch Break",                 startTime: "13:00", endTime: "14:00", isBreak: true  },
  { periodNumber: 11, name: "Lesson 8",                    startTime: "14:00", endTime: "14:40", isBreak: false },
  { periodNumber: 12, name: "Lesson 9",                    startTime: "14:40", endTime: "15:20", isBreak: false },
  { periodNumber: 13, name: "Games / Clubs & Societies",   startTime: "15:20", endTime: "16:20", isBreak: true  },
];

/** A slot enriched with its period (period is NOT a relation in schema). */
export type TimetableSlotWithPeriod = TSelectTimetable & {
  period: TSelectPeriod | null;
  class?: TSelectClass | null;
  subject?: TSelectSubject | null;
  teacher?: TSelectUser | null;
};

export interface GeneratorAllocation {
  classId: string;
  subjectId: string;
  lessonsPerWeek: number;
  requiresDouble: boolean;
  preferredTeacherIds: string[];
}

// ✅ CHANGED — added the 5 extra fields the frontend sends
export interface GeneratorConfig {
  maxPerTeacherPerDay?: number;
  maxPerTeacherPerWeek?: number;
  morningHeavySubjectIds?: string[];
  seed?: number;

  // NEW — must match the frontend
  maxPerSubjectPerDay?: Record<string, number>;   // subjectId -> cap; 0 = blocked
  dailySubjectIds?: string[];                      // must appear every Mon–Fri
  maxDoublesPerDay?: number;
  avoidAdjacentPairs?: [string, string][];
  spreadSubjects?: boolean;
}

export interface GenerateSchoolTimetableInput {
  schoolId: string;
  classIds: string[];
  allocations: GeneratorAllocation[];
  config?: GeneratorConfig;
  options?: {
    clearExisting?: boolean;
    dryRun?: boolean;
  };
}

export interface GeneratedSlot {
  classId: string;
  dayOfWeek: Weekday;
  periodId: string;
  subjectId: string;
  teacherId?: string | null;
  room?: string | null;
}

export interface GeneratorStats {
  perClass: Array<{
    classId: string;
    className: string;
    requested: number;
    placed: number;
    missing: number;
  }>;
  perTeacher: Array<{
    teacherId: string;
    teacherName: string;
    totalLessons: number;
    byDay: Record<string, number>;
  }>;
  coverage: {
    totalSlots: number;
    filledSlots: number;
    percentage: number;
  };
}

export interface TimetableResponse {
  success: boolean;
  message: string;

  period?: TSelectPeriod;
  periods?: TSelectPeriod[];

  slot?: TimetableSlotWithPeriod;
  slots?: TimetableSlotWithPeriod[];

  grid?: Record<string, Record<string, Record<string, TimetableSlotWithPeriod>>>;
  weekly?: Record<string, TimetableSlotWithPeriod[]>;
  slotsPerDay?: Record<string, number>;
  freeSlots?: Array<{ dayOfWeek: Weekday; periodId: string; period: TSelectPeriod }>;
  availability?: Record<string, Record<string, boolean>>;

  workload?: Array<Record<string, any>>;
  allocation?: Array<Record<string, any>>;

  conflicts?: Array<Record<string, any>>;
  valid?: boolean;
  conflict?: boolean;

  teacher?: Record<string, any> | null;
  ranked?: Array<Record<string, any>>;

  coverage?: {
    totalSlots: number;
    filledSlots: number;
    emptySlots: number;
    percentage: number;
  };
  counts?: Record<string, number>;

  stats?: Record<string, any>;
  unplaced?: Array<Record<string, any>>;
  warnings?: string[];
  issues?: string[];

  count?: number;
  rows?: TimetableSlotWithPeriod[];
}

// ================================================================
// HELPERS
// ================================================================

const now = () => new Date();

function nowAsTimeString(): string {
  const d = now();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function todayWeekday(): Weekday {
  const js: Weekday[] = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];
  return js[now().getDay()]!;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

async function attachPeriods<T extends { periodId: string }>(
  slots: T[]
): Promise<Array<T & { period: TSelectPeriod | null }>> {
  if (slots.length === 0) return [];
  const ids = [...new Set(slots.map((s) => s.periodId))];
  const rows = await db
    .select()
    .from(periods)
    .where(inArray(periods.id, ids));
  const byId = new Map<string, TSelectPeriod>();
  for (const p of rows) byId.set(p.id, p as TSelectPeriod);
  return slots.map((s) => ({ ...s, period: byId.get(s.periodId) ?? null }));
}

const logAudit = async (opts: {
  schoolId: string | null;
  userId: string | null;
  action: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await db.insert(auditLogs).values({
      schoolId: opts.schoolId,
      userId: opts.userId,
      action: opts.action,
      entityType: "timetable",
      entityId: opts.entityId ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch {
    // Never let audit logging break a timetable action
  }
};

const assertSchoolExists = async (schoolId: string) =>
  await db.query.schools.findFirst({ where: eq(schools.id, schoolId) });

const genSeed = () => Math.floor(Math.random() * 1_000_000);

function createSeededRng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ================================================================
// 1. PERIODS — CRUD
// ================================================================

export const createPeriodService = async (
  body: TInsertPeriod,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const school = await assertSchoolExists(body.schoolId);
    if (!school) return { success: false, message: "School not found." };

    const dup = await db.query.periods.findFirst({
      where: and(
        eq(periods.schoolId, body.schoolId),
        eq(periods.periodNumber, body.periodNumber)
      ),
    });
    if (dup) {
      return {
        success: false,
        message: `Period number ${body.periodNumber} already exists for this school.`,
      };
    }

    const existing = await db
      .select()
      .from(periods)
      .where(eq(periods.schoolId, body.schoolId));

    const proposed = [
      ...existing.map((p) => ({
        periodNumber: p.periodNumber,
        name: p.name,
        startTime: p.startTime,
        endTime: p.endTime,
        isBreak: p.isBreak,
      })),
      {
        periodNumber: body.periodNumber,
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        isBreak: body.isBreak ?? false,
      },
    ];

    const validation = await validatePeriodScheduleService(body.schoolId, proposed);
    if (!validation.success || !validation.valid) {
      return {
        success: false,
        message: "Period schedule has conflicts.",
        issues: validation.issues ?? [],
      };
    }

    const [created] = await db.insert(periods).values(body).returning();

    await logAudit({
      schoolId: body.schoolId,
      userId: actorId,
      action: "timetable.period.created",
      entityId: created!.id,
      metadata: { periodNumber: body.periodNumber, name: body.name },
    });

    return {
      success: true,
      message: `Period "${body.name}" created.`,
      period: created as TSelectPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create period." };
  }
};

export const bulkCreatePeriodsService = async (
  body: { schoolId: string; periods: Array<Omit<TInsertPeriod, "schoolId">> },
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    if (!body.periods?.length) {
      return { success: false, message: "No periods provided." };
    }

    const school = await assertSchoolExists(body.schoolId);
    if (!school) return { success: false, message: "School not found." };

    const existing = await db
      .select({ id: periods.id })
      .from(periods)
      .where(eq(periods.schoolId, body.schoolId))
      .limit(1);
    if (existing.length > 0) {
      return {
        success: false,
        message: "This school already has periods. Delete existing periods before bulk-creating.",
      };
    }

    const validation = await validatePeriodScheduleService(
      body.schoolId,
      body.periods.map((p) => ({
        periodNumber: p.periodNumber,
        name: p.name,
        startTime: p.startTime,
        endTime: p.endTime,
        isBreak: p.isBreak ?? false,
      }))
    );
    if (!validation.success || !validation.valid) {
      return {
        success: false,
        message: "Proposed period schedule has conflicts.",
        issues: validation.issues ?? [],
      };
    }

    const created = await db
      .insert(periods)
      .values(body.periods.map((p) => ({ ...p, schoolId: body.schoolId })))
      .returning();

    await logAudit({
      schoolId: body.schoolId,
      userId: actorId,
      action: "timetable.periods.bulk_created",
      metadata: { count: created.length },
    });

    return {
      success: true,
      message: `Created ${created.length} periods.`,
      periods: created as TSelectPeriod[],
      count: created.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create periods." };
  }
};

export const getPeriodByIdService = async (
  periodId: string
): Promise<TimetableResponse> => {
  try {
    const row = await db.query.periods.findFirst({
      where: eq(periods.id, periodId),
    });
    if (!row) return { success: false, message: "Period not found." };
    return {
      success: true,
      message: "Period retrieved.",
      period: row as TSelectPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load period." };
  }
};

export const getPeriodByNumberService = async (
  schoolId: string,
  periodNumber: number
): Promise<TimetableResponse> => {
  try {
    const row = await db.query.periods.findFirst({
      where: and(
        eq(periods.schoolId, schoolId),
        eq(periods.periodNumber, periodNumber)
      ),
    });
    if (!row) return { success: false, message: "Period not found." };
    return {
      success: true,
      message: "Period retrieved.",
      period: row as TSelectPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load period." };
  }
};

export const listPeriodsForSchoolService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const rows = await db.query.periods.findMany({
      where: eq(periods.schoolId, schoolId),
      orderBy: [asc(periods.periodNumber)],
    });
    return {
      success: true,
      message: `${rows.length} period(s).`,
      periods: rows as TSelectPeriod[],
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list periods." };
  }
};

export const listTeachingPeriodsService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const rows = await db.query.periods.findMany({
      where: and(eq(periods.schoolId, schoolId), eq(periods.isBreak, false)),
      orderBy: [asc(periods.periodNumber)],
    });
    return {
      success: true,
      message: `${rows.length} teaching period(s).`,
      periods: rows as TSelectPeriod[],
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list teaching periods." };
  }
};

export const listBreakPeriodsService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const rows = await db.query.periods.findMany({
      where: and(eq(periods.schoolId, schoolId), eq(periods.isBreak, true)),
      orderBy: [asc(periods.periodNumber)],
    });
    return {
      success: true,
      message: `${rows.length} break period(s).`,
      periods: rows as TSelectPeriod[],
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list break periods." };
  }
};

export const updatePeriodService = async (
  periodId: string,
  body: Partial<Omit<TInsertPeriod, "schoolId" | "periodNumber">>,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const existing = await db.query.periods.findFirst({
      where: eq(periods.id, periodId),
    });
    if (!existing) return { success: false, message: "Period not found." };

    const merged = {
      periodNumber: existing.periodNumber,
      name: body.name ?? existing.name,
      startTime: body.startTime ?? existing.startTime,
      endTime: body.endTime ?? existing.endTime,
      isBreak: body.isBreak ?? existing.isBreak,
    };

    const siblings = await db
      .select()
      .from(periods)
      .where(
        and(eq(periods.schoolId, existing.schoolId), ne(periods.id, periodId))
      );

    const validation = await validatePeriodScheduleService(existing.schoolId, [
      ...siblings.map((p) => ({
        periodNumber: p.periodNumber,
        name: p.name,
        startTime: p.startTime,
        endTime: p.endTime,
        isBreak: p.isBreak,
      })),
      merged,
    ]);
    if (!validation.success || !validation.valid) {
      return {
        success: false,
        message: "Update would break the schedule.",
        issues: validation.issues ?? [],
      };
    }

    const [updated] = await db
      .update(periods)
      .set({
        name: merged.name,
        startTime: merged.startTime,
        endTime: merged.endTime,
        isBreak: merged.isBreak,
      })
      .where(eq(periods.id, periodId))
      .returning();

    await logAudit({
      schoolId: existing.schoolId,
      userId: actorId,
      action: "timetable.period.updated",
      entityId: periodId,
      metadata: { name: merged.name },
    });

    return {
      success: true,
      message: "Period updated.",
      period: updated as TSelectPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update period." };
  }
};

export const deletePeriodService = async (
  periodId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const existing = await db.query.periods.findFirst({
      where: eq(periods.id, periodId),
    });
    if (!existing) return { success: false, message: "Period not found." };

    const used = await db
      .select({ id: timetables.id })
      .from(timetables)
      .where(eq(timetables.periodId, periodId))
      .limit(1);
    if (used.length > 0) {
      return {
        success: false,
        message:
          "This period is used by at least one timetable slot. Delete or move those slots first.",
      };
    }

    await db.delete(periods).where(eq(periods.id, periodId));

    await logAudit({
      schoolId: existing.schoolId,
      userId: actorId,
      action: "timetable.period.deleted",
      entityId: periodId,
      metadata: { name: existing.name },
    });

    return { success: true, message: `Period "${existing.name}" deleted.` };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete period." };
  }
};

export const reorderPeriodsService = async (
  schoolId: string,
  orderedIds: string[],
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const rows = await db
      .select()
      .from(periods)
      .where(eq(periods.schoolId, schoolId));
    const byId = new Map(rows.map((r) => [r.id, r]));

    for (const id of orderedIds) {
      if (!byId.has(id)) {
        return {
          success: false,
          message: `Period ${id} does not belong to this school.`,
        };
      }
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(periods)
        .set({ periodNumber: -1 * (i + 1001) })
        .where(eq(periods.id, orderedIds[i]!));
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(periods)
        .set({ periodNumber: i + 1 })
        .where(eq(periods.id, orderedIds[i]!));
    }

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.periods.reordered",
      metadata: { orderedIds },
    });

    return { success: true, message: "Periods reordered." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reorder periods." };
  }
};

export const countPeriodsService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const [{ c }] = await db
      .select({ c: count() })
      .from(periods)
      .where(eq(periods.schoolId, schoolId));
    return {
      success: true,
      message: `${Number(c)} period(s).`,
      count: Number(c),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count periods." };
  }
};

export const getFirstPeriodService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const row = await db.query.periods.findFirst({
      where: eq(periods.schoolId, schoolId),
      orderBy: [asc(periods.periodNumber)],
    });
    if (!row) return { success: false, message: "No periods found for this school." };
    return {
      success: true,
      message: "First period retrieved.",
      period: row as TSelectPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find first period." };
  }
};

export const getLastPeriodService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const row = await db.query.periods.findFirst({
      where: eq(periods.schoolId, schoolId),
      orderBy: [desc(periods.periodNumber)],
    });
    if (!row) return { success: false, message: "No periods found for this school." };
    return {
      success: true,
      message: "Last period retrieved.",
      period: row as TSelectPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find last period." };
  }
};

export const getActivePeriodService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const nowStr = nowAsTimeString();
    const rows = await db
      .select()
      .from(periods)
      .where(eq(periods.schoolId, schoolId))
      .orderBy(asc(periods.periodNumber));
    const active = rows.find((p) => p.startTime <= nowStr && p.endTime > nowStr);
    if (!active) return { success: false, message: "No period is active right now." };
    return {
      success: true,
      message: `Current period: ${active.name}.`,
      period: active as TSelectPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find active period." };
  }
};

export async function validatePeriodScheduleService(
  schoolId: string,
  proposed?: Array<
    Pick<TSelectPeriod, "periodNumber" | "name" | "startTime" | "endTime" | "isBreak">
  >
): Promise<TimetableResponse> {
  try {
    const rows =
      proposed ??
      (
        await db
          .select()
          .from(periods)
          .where(eq(periods.schoolId, schoolId))
          .orderBy(asc(periods.periodNumber))
      ).map((p) => ({
        periodNumber: p.periodNumber,
        name: p.name,
        startTime: p.startTime,
        endTime: p.endTime,
        isBreak: p.isBreak,
      }));

    const issues: string[] = [];
    const warnings: string[] = [];

    if (rows.length === 0) {
      return { success: true, message: "No periods to validate.", valid: true, issues, warnings };
    }

    const seen = new Set<number>();
    for (const p of rows) {
      if (seen.has(p.periodNumber)) {
        issues.push(`Duplicate period number: ${p.periodNumber}`);
      }
      seen.add(p.periodNumber);
      if (timeToMinutes(p.startTime) >= timeToMinutes(p.endTime)) {
        issues.push(
          `Period ${p.periodNumber} ("${p.name}"): start ${p.startTime} must be before end ${p.endTime}`
        );
      }
    }

    const sorted = [...rows].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      const aEnd = timeToMinutes(a.endTime);
      const bStart = timeToMinutes(b.startTime);
      if (aEnd > bStart) {
        issues.push(
          `Overlap: period ${a.periodNumber} ends ${a.endTime}, period ${b.periodNumber} starts ${b.startTime}`
        );
      } else if (aEnd < bStart) {
        warnings.push(
          `Gap of ${bStart - aEnd} min between period ${a.periodNumber} and ${b.periodNumber}`
        );
      }
    }

    return {
      success: true,
      message:
        issues.length === 0
          ? `Schedule valid (${rows.length} periods).`
          : `Schedule has ${issues.length} issue(s).`,
      valid: issues.length === 0,
      issues,
      warnings,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to validate period schedule." };
  }
}

// ================================================================
// 2. TIMETABLE SLOTS — CRUD
// ================================================================

export const createTimetableSlotService = async (
  body: TInsertTimetable,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const classClash = await db.query.timetables.findFirst({
      where: and(
        eq(timetables.classId, body.classId),
        eq(timetables.dayOfWeek, body.dayOfWeek),
        eq(timetables.periodId, body.periodId)
      ),
    });
    if (classClash) {
      return {
        success: false,
        message: "This class already has a lesson at that day/period.",
      };
    }

    if (body.teacherId) {
      const teacherClash = await db.query.timetables.findFirst({
        where: and(
          eq(timetables.teacherId, body.teacherId),
          eq(timetables.dayOfWeek, body.dayOfWeek),
          eq(timetables.periodId, body.periodId)
        ),
      });
      if (teacherClash) {
        return {
          success: false,
          message: "The teacher is already booked at that day/period.",
        };
      }
    }

    const [created] = await db.insert(timetables).values(body).returning();
    const [enriched] = await attachPeriods([created!]);

    await logAudit({
      schoolId: body.schoolId,
      userId: actorId,
      action: "timetable.slot.created",
      entityId: created!.id,
      metadata: {
        classId: body.classId,
        dayOfWeek: body.dayOfWeek,
        periodId: body.periodId,
      },
    });

    return {
      success: true,
      message: "Slot created.",
      slot: enriched as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create slot." };
  }
};

export const bulkCreateTimetableService = async (
  body: {
    schoolId: string;
    classId: string;
    slots: Array<Omit<TInsertTimetable, "schoolId" | "classId">>;
  },
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    if (!body.slots?.length) return { success: false, message: "No slots provided." };

    const periodIds = [...new Set(body.slots.map((s) => s.periodId))];

    const existing = await db
      .select({
        dayOfWeek: timetables.dayOfWeek,
        periodId: timetables.periodId,
      })
      .from(timetables)
      .where(
        and(
          eq(timetables.classId, body.classId),
          inArray(timetables.periodId, periodIds)
        )
      );
    const classBusy = new Set(
      existing.map((s) => `${s.dayOfWeek}::${s.periodId}`)
    );

    const teacherIds = [
      ...new Set(body.slots.map((s) => s.teacherId).filter(Boolean)),
    ] as string[];
    const teacherSlots = teacherIds.length
      ? await db
          .select({
            teacherId: timetables.teacherId,
            dayOfWeek: timetables.dayOfWeek,
            periodId: timetables.periodId,
          })
          .from(timetables)
          .where(
            and(
              inArray(timetables.teacherId, teacherIds),
              inArray(timetables.periodId, periodIds)
            )
          )
      : [];
    const teacherBusy = new Set(
      teacherSlots.map((s) => `${s.teacherId}::${s.dayOfWeek}::${s.periodId}`)
    );

    const toInsert: TInsertTimetable[] = [];
    const skipped: any[] = [];

    for (const s of body.slots) {
      const classKey = `${s.dayOfWeek}::${s.periodId}`;
      if (classBusy.has(classKey)) {
        skipped.push({ ...s, reason: "class slot already booked" });
        continue;
      }
      if (s.teacherId) {
        const teacherKey = `${s.teacherId}::${s.dayOfWeek}::${s.periodId}`;
        if (teacherBusy.has(teacherKey)) {
          skipped.push({ ...s, reason: "teacher already booked" });
          continue;
        }
        teacherBusy.add(teacherKey);
      }
      classBusy.add(classKey);
      toInsert.push({
        schoolId: body.schoolId,
        classId: body.classId,
        dayOfWeek: s.dayOfWeek,
        periodId: s.periodId,
        subjectId: s.subjectId,
        teacherId: s.teacherId ?? null,
        room: s.room ?? null,
      });
    }

    const created = toInsert.length
      ? await db.insert(timetables).values(toInsert).returning()
      : [];
    const enriched = await attachPeriods(created);

    await logAudit({
      schoolId: body.schoolId,
      userId: actorId,
      action: "timetable.slots.bulk_created",
      metadata: {
        classId: body.classId,
        inserted: created.length,
        skipped: skipped.length,
      },
    });

    return {
      success: true,
      message: `Inserted ${created.length}, skipped ${skipped.length}.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
      stats: { inserted: created.length, skipped: skipped.length },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create class timetable." };
  }
};

export const bulkCreateSchoolTimetableService = async (
  body: { schoolId: string; slots: TInsertTimetable[] },
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    if (!body.slots?.length) return { success: false, message: "No slots provided." };

    const classIds = [...new Set(body.slots.map((s) => s.classId))];
    const periodIds = [...new Set(body.slots.map((s) => s.periodId))];

    const existing = await db
      .select({
        classId: timetables.classId,
        dayOfWeek: timetables.dayOfWeek,
        periodId: timetables.periodId,
      })
      .from(timetables)
      .where(
        and(
          inArray(timetables.classId, classIds),
          inArray(timetables.periodId, periodIds)
        )
      );
    const classBusy = new Set(
      existing.map((s) => `${s.classId}::${s.dayOfWeek}::${s.periodId}`)
    );

    const teacherIds = [
      ...new Set(body.slots.map((s) => s.teacherId).filter(Boolean)),
    ] as string[];
    const teacherSlots = teacherIds.length
      ? await db
          .select({
            teacherId: timetables.teacherId,
            dayOfWeek: timetables.dayOfWeek,
            periodId: timetables.periodId,
          })
          .from(timetables)
          .where(
            and(
              inArray(timetables.teacherId, teacherIds),
              inArray(timetables.periodId, periodIds)
            )
          )
      : [];
    const teacherBusy = new Set(
      teacherSlots.map((s) => `${s.teacherId}::${s.dayOfWeek}::${s.periodId}`)
    );

    const toInsert: TInsertTimetable[] = [];
    const skipped: any[] = [];

    for (const s of body.slots) {
      const classKey = `${s.classId}::${s.dayOfWeek}::${s.periodId}`;
      if (classBusy.has(classKey)) {
        skipped.push({ ...s, reason: "class slot already booked" });
        continue;
      }
      if (s.teacherId) {
        const teacherKey = `${s.teacherId}::${s.dayOfWeek}::${s.periodId}`;
        if (teacherBusy.has(teacherKey)) {
          skipped.push({ ...s, reason: "teacher already booked" });
          continue;
        }
        teacherBusy.add(teacherKey);
      }
      classBusy.add(classKey);
      toInsert.push({ ...s, schoolId: body.schoolId });
    }

    const created = toInsert.length
      ? await db.insert(timetables).values(toInsert).returning()
      : [];
    const enriched = await attachPeriods(created);

    await logAudit({
      schoolId: body.schoolId,
      userId: actorId,
      action: "timetable.school.bulk_created",
      metadata: { inserted: created.length, skipped: skipped.length },
    });

    return {
      success: true,
      message: `Inserted ${created.length}, skipped ${skipped.length}.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
      stats: { inserted: created.length, skipped: skipped.length },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create school timetable." };
  }
};

export const getTimetableSlotByIdService = async (
  slotId: string
): Promise<TimetableResponse> => {
  try {
    const slot = await db.query.timetables.findFirst({
      where: eq(timetables.id, slotId),
      with: {
        class: true,
        subject: true,
        teacher: true,
      },
    });
    if (!slot) return { success: false, message: "Slot not found." };
    const [enriched] = await attachPeriods([slot as any]);
    return {
      success: true,
      message: "Slot retrieved.",
      slot: enriched as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load slot." };
  }
};

export const updateTimetableSlotService = async (
  slotId: string,
  body: Partial<Pick<TInsertTimetable, "subjectId" | "teacherId" | "room">>,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const existing = await db.query.timetables.findFirst({
      where: eq(timetables.id, slotId),
    });
    if (!existing) return { success: false, message: "Slot not found." };

    const [updated] = await db
      .update(timetables)
      .set({
        subjectId: body.subjectId ?? existing.subjectId,
        teacherId: body.teacherId !== undefined ? body.teacherId : existing.teacherId,
        room: body.room !== undefined ? body.room : existing.room,
        updatedAt: now(),
      })
      .where(eq(timetables.id, slotId))
      .returning();

    const [enriched] = await attachPeriods([updated as any]);

    await logAudit({
      schoolId: existing.schoolId,
      userId: actorId,
      action: "timetable.slot.updated",
      entityId: slotId,
      metadata: body as Record<string, unknown>,
    });

    return {
      success: true,
      message: "Slot updated.",
      slot: enriched as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update slot." };
  }
};

export const deleteTimetableSlotService = async (
  slotId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const existing = await db.query.timetables.findFirst({
      where: eq(timetables.id, slotId),
    });
    if (!existing) return { success: false, message: "Slot not found." };

    await db.delete(timetables).where(eq(timetables.id, slotId));

    await logAudit({
      schoolId: existing.schoolId,
      userId: actorId,
      action: "timetable.slot.deleted",
      entityId: slotId,
    });

    return { success: true, message: "Slot deleted." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete slot." };
  }
};

export const moveTimetableSlotService = async (
  slotId: string,
  dayOfWeek: Weekday,
  periodId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const existing = await db.query.timetables.findFirst({
      where: eq(timetables.id, slotId),
    });
    if (!existing) return { success: false, message: "Slot not found." };

    const clash = await db.query.timetables.findFirst({
      where: and(
        eq(timetables.classId, existing.classId),
        eq(timetables.dayOfWeek, dayOfWeek),
        eq(timetables.periodId, periodId),
        ne(timetables.id, slotId)
      ),
    });
    if (clash) {
      return { success: false, message: "The target slot is already occupied." };
    }

    const [updated] = await db
      .update(timetables)
      .set({ dayOfWeek, periodId, updatedAt: now() })
      .where(eq(timetables.id, slotId))
      .returning();
    const [enriched] = await attachPeriods([updated as any]);

    await logAudit({
      schoolId: existing.schoolId,
      userId: actorId,
      action: "timetable.slot.moved",
      entityId: slotId,
      metadata: { dayOfWeek, periodId },
    });

    return {
      success: true,
      message: "Slot moved.",
      slot: enriched as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to move slot." };
  }
};

export const swapTimetableSlotsService = async (
  slotAId: string,
  slotBId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const [a, b] = await Promise.all([
      db.query.timetables.findFirst({ where: eq(timetables.id, slotAId) }),
      db.query.timetables.findFirst({ where: eq(timetables.id, slotBId) }),
    ]);
    if (!a || !b) return { success: false, message: "One or both slots not found." };
    if (a.classId !== b.classId) {
      return { success: false, message: "Cannot swap slots from different classes." };
    }

    await db.transaction(async (tx) => {
      await tx.delete(timetables).where(inArray(timetables.id, [slotAId, slotBId]));
      await tx.insert(timetables).values([
        {
          id: a.id,
          schoolId: a.schoolId,
          classId: a.classId,
          dayOfWeek: b.dayOfWeek,
          periodId: b.periodId,
          subjectId: a.subjectId,
          teacherId: a.teacherId,
          room: a.room,
          updatedAt: now(),
        },
        {
          id: b.id,
          schoolId: b.schoolId,
          classId: b.classId,
          dayOfWeek: a.dayOfWeek,
          periodId: a.periodId,
          subjectId: b.subjectId,
          teacherId: b.teacherId,
          room: b.room,
          updatedAt: now(),
        },
      ]);
    });

    await logAudit({
      schoolId: a.schoolId,
      userId: actorId,
      action: "timetable.slots.swapped",
      metadata: { slotAId, slotBId },
    });

    return { success: true, message: "Slots swapped." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to swap slots." };
  }
};

export const assignTeacherToSlotService = async (
  slotId: string,
  teacherId: string | null,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const existing = await db.query.timetables.findFirst({
      where: eq(timetables.id, slotId),
    });
    if (!existing) return { success: false, message: "Slot not found." };

    if (teacherId) {
      const clash = await db.query.timetables.findFirst({
        where: and(
          eq(timetables.teacherId, teacherId),
          eq(timetables.dayOfWeek, existing.dayOfWeek),
          eq(timetables.periodId, existing.periodId),
          ne(timetables.id, slotId)
        ),
      });
      if (clash) {
        return { success: false, message: "Teacher is already booked at this time." };
      }
    }

    const [updated] = await db
      .update(timetables)
      .set({ teacherId, updatedAt: now() })
      .where(eq(timetables.id, slotId))
      .returning();
    const [enriched] = await attachPeriods([updated as any]);

    await logAudit({
      schoolId: existing.schoolId,
      userId: actorId,
      action: teacherId ? "timetable.slot.teacher_assigned" : "timetable.slot.teacher_removed",
      entityId: slotId,
      metadata: { teacherId },
    });

    return {
      success: true,
      message: teacherId ? "Teacher assigned." : "Teacher removed.",
      slot: enriched as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to assign teacher." };
  }
};

export const assignRoomToSlotService = async (
  slotId: string,
  room: string | null,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const existing = await db.query.timetables.findFirst({
      where: eq(timetables.id, slotId),
    });
    if (!existing) return { success: false, message: "Slot not found." };

    const [updated] = await db
      .update(timetables)
      .set({ room, updatedAt: now() })
      .where(eq(timetables.id, slotId))
      .returning();
    const [enriched] = await attachPeriods([updated as any]);

    await logAudit({
      schoolId: existing.schoolId,
      userId: actorId,
      action: "timetable.slot.room_assigned",
      entityId: slotId,
      metadata: { room },
    });

    return {
      success: true,
      message: room ? "Room assigned." : "Room removed.",
      slot: enriched as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to assign room." };
  }
};

export const bulkDeleteSlotsService = async (
  schoolId: string,
  slotIds: string[],
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    if (!slotIds?.length) return { success: false, message: "No slot IDs provided." };

    const deleted = await db
      .delete(timetables)
      .where(and(eq(timetables.schoolId, schoolId), inArray(timetables.id, slotIds)))
      .returning({ id: timetables.id });

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.slots.bulk_deleted",
      metadata: { deleted: deleted.length, slotIds },
    });

    return {
      success: true,
      message: `Deleted ${deleted.length} slot(s).`,
      count: deleted.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-delete slots." };
  }
};

export const bulkUpdateSlotsService = async (
  schoolId: string,
  slotIds: string[],
  patch: { subjectId?: string; teacherId?: string | null; room?: string | null },
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    if (!slotIds?.length) return { success: false, message: "No slot IDs provided." };

    const updates: Record<string, any> = { updatedAt: now() };
    if (patch.subjectId !== undefined) updates.subjectId = patch.subjectId;
    if (patch.teacherId !== undefined) updates.teacherId = patch.teacherId;
    if (patch.room !== undefined) updates.room = patch.room;

    const updated = await db
      .update(timetables)
      .set(updates)
      .where(and(eq(timetables.schoolId, schoolId), inArray(timetables.id, slotIds)))
      .returning({ id: timetables.id });

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.slots.bulk_updated",
      metadata: { updated: updated.length, patch },
    });

    return {
      success: true,
      message: `Updated ${updated.length} slot(s).`,
      count: updated.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-update slots." };
  }
};

// ================================================================
// 3. COPY & CLONE
// ================================================================

export const copyTimetableToClassService = async (
  sourceClassId: string,
  targetClassId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const source = await db
      .select()
      .from(timetables)
      .where(eq(timetables.classId, sourceClassId));
    if (source.length === 0) {
      return { success: false, message: "Source class has no timetable slots." };
    }

    await db.delete(timetables).where(eq(timetables.classId, targetClassId));

    const toInsert: TInsertTimetable[] = source.map((s) => ({
      schoolId: s.schoolId,
      classId: targetClassId,
      dayOfWeek: s.dayOfWeek,
      periodId: s.periodId,
      subjectId: s.subjectId,
      teacherId: s.teacherId,
      room: s.room,
    }));
    const created = await db.insert(timetables).values(toInsert).returning();
    const enriched = await attachPeriods(created);

    await logAudit({
      schoolId: source[0]!.schoolId,
      userId: actorId,
      action: "timetable.copied",
      metadata: {
        sourceClassId,
        targetClassId,
        inserted: created.length,
      },
    });

    return {
      success: true,
      message: `Copied ${created.length} slot(s).`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to copy timetable." };
  }
};

export const cloneTimetableService = async (
  schoolId: string,
  sourceClassId: string,
  targetClassId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  return copyTimetableToClassService(sourceClassId, targetClassId, actorId);
};

// ================================================================
// 4. CLASS TIMETABLE VIEWS
// ================================================================

export const getClassTimetableService = async (
  classId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: eq(timetables.classId, classId),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) for this class.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load class timetable." };
  }
};

export const getClassTimetableForDayService = async (
  classId: string,
  dayOfWeek: Weekday
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.classId, classId),
        eq(timetables.dayOfWeek, dayOfWeek)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) for ${dayOfWeek}.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load day timetable." };
  }
};

export const getClassTimetableTodayService = async (
  classId: string
): Promise<TimetableResponse> => {
  try {
    const day = todayWeekday();
    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.classId, classId),
        eq(timetables.dayOfWeek, day)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) for ${day}.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
      stats: { dayOfWeek: day },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load today's timetable." };
  }
};

export const getSlotByClassDayPeriodService = async (
  classId: string,
  dayOfWeek: Weekday,
  periodId: string
): Promise<TimetableResponse> => {
  try {
    const slot = await db.query.timetables.findFirst({
      where: and(
        eq(timetables.classId, classId),
        eq(timetables.dayOfWeek, dayOfWeek),
        eq(timetables.periodId, periodId)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    if (!slot) return { success: false, message: "Slot not found." };
    const [enriched] = await attachPeriods([slot as any]);
    return {
      success: true,
      message: "Slot retrieved.",
      slot: enriched as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find slot." };
  }
};

export const deleteSlotByClassDayPeriodService = async (
  classId: string,
  dayOfWeek: Weekday,
  periodId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const deleted = await db
      .delete(timetables)
      .where(
        and(
          eq(timetables.classId, classId),
          eq(timetables.dayOfWeek, dayOfWeek),
          eq(timetables.periodId, periodId)
        )
      )
      .returning({ id: timetables.id });

    if (deleted.length === 0) {
      return { success: false, message: "Slot not found." };
    }

    await logAudit({
      schoolId: null,
      userId: actorId,
      action: "timetable.slot.deleted_by_key",
      metadata: { classId, dayOfWeek, periodId },
    });

    return { success: true, message: "Slot deleted." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete slot." };
  }
};

export const getCurrentLessonForClassService = async (
  classId: string
): Promise<TimetableResponse> => {
  try {
    const day = todayWeekday();
    const nowStr = nowAsTimeString();

    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.classId, classId),
        eq(timetables.dayOfWeek, day)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    if (slots.length === 0) {
      return { success: false, message: "Class has no lessons today." };
    }

    const enriched = await attachPeriods(slots);
    const active = enriched.find(
      (s) => s.period && s.period.startTime <= nowStr && s.period.endTime > nowStr
    );
    if (!active) {
      return { success: false, message: "Class has no lesson in the current period." };
    }
    return {
      success: true,
      message: "Current lesson retrieved.",
      slot: active as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find current lesson." };
  }
};

export const getNextLessonForClassService = async (
  classId: string
): Promise<TimetableResponse> => {
  try {
    const day = todayWeekday();
    const nowStr = nowAsTimeString();

    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.classId, classId),
        eq(timetables.dayOfWeek, day)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    const upcoming = enriched
      .filter((s) => s.period && s.period.startTime > nowStr)
      .sort((a, b) => (a.period!.startTime < b.period!.startTime ? -1 : 1));
    if (!upcoming[0]) {
      return { success: false, message: "No upcoming lesson today." };
    }
    return {
      success: true,
      message: "Next lesson retrieved.",
      slot: upcoming[0] as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find next lesson." };
  }
};

export const getFreeSlotsForClassService = async (
  classId: string
): Promise<TimetableResponse> => {
  try {
    const cls = await db.query.classes.findFirst({
      where: eq(classes.id, classId),
    });
    if (!cls) return { success: false, message: "Class not found." };

    const allTeaching = await db
      .select()
      .from(periods)
      .where(and(eq(periods.schoolId, cls.schoolId), eq(periods.isBreak, false)));

    const taken = await db
      .select({
        dayOfWeek: timetables.dayOfWeek,
        periodId: timetables.periodId,
      })
      .from(timetables)
      .where(eq(timetables.classId, classId));
    const takenSet = new Set(taken.map((t) => `${t.dayOfWeek}::${t.periodId}`));

    const free: Array<{ dayOfWeek: Weekday; periodId: string; period: TSelectPeriod }> = [];
    for (const day of WEEKDAYS) {
      for (const p of allTeaching) {
        if (!takenSet.has(`${day}::${p.id}`)) {
          free.push({ dayOfWeek: day, periodId: p.id, period: p as TSelectPeriod });
        }
      }
    }

    return {
      success: true,
      message: `${free.length} free slot(s).`,
      freeSlots: free,
      count: free.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load free slots." };
  }
};

export const getClassSlotsPerDayService = async (
  classId: string
): Promise<TimetableResponse> => {
  try {
    const rows = await db
      .select({ dayOfWeek: timetables.dayOfWeek, total: count() })
      .from(timetables)
      .where(eq(timetables.classId, classId))
      .groupBy(timetables.dayOfWeek);

    const slotsPerDay: Record<string, number> = {};
    for (const d of ALL_WEEKDAYS) slotsPerDay[d] = 0;
    for (const r of rows) slotsPerDay[r.dayOfWeek] = Number(r.total);

    return {
      success: true,
      message: "Slots per day computed.",
      slotsPerDay,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count slots per day." };
  }
};

export const getClassWorkloadService = async (
  classId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: eq(timetables.classId, classId),
      with: { subject: true },
    });

    const map = new Map<
      string,
      { subjectId: string; subjectName: string; lessonCount: number }
    >();
    for (const s of slots) {
      const entry = map.get(s.subjectId);
      if (entry) entry.lessonCount += 1;
      else
        map.set(s.subjectId, {
          subjectId: s.subjectId,
          subjectName: s.subject?.name ?? "Unknown subject",
          lessonCount: 1,
        });
    }

    const workload = Array.from(map.values()).sort(
      (a, b) => b.lessonCount - a.lessonCount
    );

    return {
      success: true,
      message: `Workload across ${workload.length} subject(s).`,
      workload,
      count: workload.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute workload." };
  }
};

export const countSlotsForClassService = async (
  classId: string
): Promise<TimetableResponse> => {
  try {
    const [{ c }] = await db
      .select({ c: count() })
      .from(timetables)
      .where(eq(timetables.classId, classId));
    return {
      success: true,
      message: `${Number(c)} slot(s).`,
      count: Number(c),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count slots." };
  }
};

export const deleteTimetableForClassService = async (
  classId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const cls = await db.query.classes.findFirst({
      where: eq(classes.id, classId),
    });

    const deleted = await db
      .delete(timetables)
      .where(eq(timetables.classId, classId))
      .returning({ id: timetables.id });

    await logAudit({
      schoolId: cls?.schoolId ?? null,
      userId: actorId,
      action: "timetable.class.cleared",
      metadata: { classId, deleted: deleted.length },
    });

    return {
      success: true,
      message: `Deleted ${deleted.length} slot(s).`,
      count: deleted.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to clear class timetable." };
  }
};

// ================================================================
// 5. TEACHER VIEWS
// ================================================================

export const getTeacherTimetableService = async (
  teacherId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: eq(timetables.teacherId, teacherId),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) for this teacher.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load teacher timetable." };
  }
};

export const getTeacherTimetableForDayService = async (
  teacherId: string,
  dayOfWeek: Weekday
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.teacherId, teacherId),
        eq(timetables.dayOfWeek, dayOfWeek)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) for ${dayOfWeek}.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load teacher day." };
  }
};

export const getTeacherWeeklyViewService = async (
  teacherId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: eq(timetables.teacherId, teacherId),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);

    const weekly: Record<string, TimetableSlotWithPeriod[]> = {};
    for (const d of ALL_WEEKDAYS) weekly[d] = [];
    for (const s of enriched) weekly[s.dayOfWeek]!.push(s as TimetableSlotWithPeriod);

    return {
      success: true,
      message: `Weekly view for teacher.`,
      weekly,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build teacher weekly view." };
  }
};

export const getCurrentLessonForTeacherService = async (
  teacherId: string
): Promise<TimetableResponse> => {
  try {
    const day = todayWeekday();
    const nowStr = nowAsTimeString();

    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.teacherId, teacherId),
        eq(timetables.dayOfWeek, day)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    if (slots.length === 0) {
      return { success: false, message: "Teacher has no lessons today." };
    }

    const enriched = await attachPeriods(slots);
    const active = enriched.find(
      (s) => s.period && s.period.startTime <= nowStr && s.period.endTime > nowStr
    );
    if (!active) {
      return { success: false, message: "Teacher has no lesson right now." };
    }
    return {
      success: true,
      message: "Current lesson retrieved.",
      slot: active as TimetableSlotWithPeriod,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find current lesson." };
  }
};

export const getTeacherFreePeriodsService = async (
  teacherId: string,
  dayOfWeek: Weekday
): Promise<TimetableResponse> => {
  try {
    const teacher = await db.query.users.findFirst({
      where: eq(users.id, teacherId),
    });
    if (!teacher || !teacher.schoolId) {
      return { success: false, message: "Teacher not found." };
    }

    const allTeaching = await db
      .select()
      .from(periods)
      .where(and(eq(periods.schoolId, teacher.schoolId), eq(periods.isBreak, false)))
      .orderBy(asc(periods.periodNumber));

    const taken = await db
      .select({ periodId: timetables.periodId })
      .from(timetables)
      .where(
        and(
          eq(timetables.teacherId, teacherId),
          eq(timetables.dayOfWeek, dayOfWeek)
        )
      );
    const takenSet = new Set(taken.map((t) => t.periodId));

    const free = allTeaching.filter((p) => !takenSet.has(p.id));

    return {
      success: true,
      message: `${free.length} free period(s) on ${dayOfWeek}.`,
      periods: free as TSelectPeriod[],
      count: free.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute free periods." };
  }
};

export const getTeacherWorkloadService = async (
  teacherId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: eq(timetables.teacherId, teacherId),
      with: { subject: true, class: true },
    });

    const map = new Map<
      string,
      {
        subjectId: string;
        subjectName: string;
        classId: string;
        className: string;
        lessonCount: number;
      }
    >();

    for (const s of slots) {
      const key = `${s.subjectId}::${s.classId}`;
      const entry = map.get(key);
      if (entry) entry.lessonCount += 1;
      else
        map.set(key, {
          subjectId: s.subjectId,
          subjectName: s.subject?.name ?? "Unknown subject",
          classId: s.classId,
          className: s.class?.stream ?? "Unknown class",
          lessonCount: 1,
        });
    }

    const workload = Array.from(map.values()).sort(
      (a, b) => b.lessonCount - a.lessonCount
    );

    return {
      success: true,
      message: `Workload across ${workload.length} subject/class combo(s).`,
      workload,
      count: workload.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute teacher workload." };
  }
};

export const getTeacherAvailabilityMatrixService = async (
  teacherId: string
): Promise<TimetableResponse> => {
  try {
    const teacher = await db.query.users.findFirst({
      where: eq(users.id, teacherId),
    });
    if (!teacher || !teacher.schoolId) {
      return { success: false, message: "Teacher not found." };
    }

    const allTeaching = await db
      .select()
      .from(periods)
      .where(and(eq(periods.schoolId, teacher.schoolId), eq(periods.isBreak, false)));

    const taken = await db
      .select({
        dayOfWeek: timetables.dayOfWeek,
        periodId: timetables.periodId,
      })
      .from(timetables)
      .where(eq(timetables.teacherId, teacherId));
    const takenSet = new Set(taken.map((t) => `${t.dayOfWeek}::${t.periodId}`));

    const availability: Record<string, Record<string, boolean>> = {};
    for (const day of WEEKDAYS) {
      availability[day] = {};
      for (const p of allTeaching) {
        availability[day]![p.id] = !takenSet.has(`${day}::${p.id}`);
      }
    }

    return {
      success: true,
      message: "Availability matrix built.",
      availability,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build availability matrix." };
  }
};

export const getUpcomingLessonsForTeacherService = async (
  teacherId: string,
  withinMinutes = 30
): Promise<TimetableResponse> => {
  try {
    const day = todayWeekday();
    const n = now();
    const cutoff = n.getHours() * 60 + n.getMinutes() + withinMinutes;
    const nowStr = nowAsTimeString();

    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.teacherId, teacherId),
        eq(timetables.dayOfWeek, day)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);

    const upcoming = enriched
      .filter((s) => {
        if (!s.period) return false;
        if (s.period.startTime < nowStr) return false;
        return timeToMinutes(s.period.startTime) <= cutoff;
      })
      .sort((a, b) => (a.period!.startTime < b.period!.startTime ? -1 : 1));

    return {
      success: true,
      message: `${upcoming.length} upcoming lesson(s) within ${withinMinutes} minutes.`,
      slots: upcoming as TimetableSlotWithPeriod[],
      count: upcoming.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch upcoming lessons." };
  }
};

export const findLeastLoadedTeacherForSubjectService = async (
  schoolId: string,
  subjectId: string
): Promise<TimetableResponse> => {
  try {
    const allTeachers = await db.query.users.findMany({
      where: and(
        eq(users.schoolId, schoolId),
        or(eq(users.role, "teacher"), sql`'teacher' = ANY(${users.roles})`)
      ),
      columns: { id: true, name: true, email: true },
    });
    if (allTeachers.length === 0) {
      return { success: false, message: "No teachers found for this school." };
    }

    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.schoolId, schoolId),
        eq(timetables.subjectId, subjectId)
      ),
      columns: { teacherId: true },
    });

    const loadMap = new Map<string, number>();
    for (const s of slots) {
      if (s.teacherId) {
        loadMap.set(s.teacherId, (loadMap.get(s.teacherId) ?? 0) + 1);
      }
    }

    const ranked = allTeachers
      .map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        lessonCount: loadMap.get(t.id) ?? 0,
      }))
      .sort((a, b) => a.lessonCount - b.lessonCount);

    return {
      success: true,
      message: `Least-loaded teacher: ${ranked[0]?.name ?? "none"}.`,
      teacher: ranked[0] ?? null,
      ranked,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to rank teachers." };
  }
};

// ================================================================
// 6. SCHOOL VIEWS
// ================================================================

export const listSlotsForSchoolService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: eq(timetables.schoolId, schoolId),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s).`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list slots." };
  }
};

export const getSchoolTimetableGridService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: eq(timetables.schoolId, schoolId),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);

    const grid: Record<string, Record<string, Record<string, TimetableSlotWithPeriod>>> = {};
    for (const s of enriched) {
      const cls = s.classId;
      if (!grid[cls]) grid[cls] = {};
      if (!grid[cls]![s.dayOfWeek]) grid[cls]![s.dayOfWeek] = {};
      grid[cls]![s.dayOfWeek]![s.periodId] = s as TimetableSlotWithPeriod;
    }

    return {
      success: true,
      message: "School grid built.",
      grid,
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build school grid." };
  }
};

export const exportSchoolTimetableService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: eq(timetables.schoolId, schoolId),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} row(s) exported.`,
      rows: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to export timetable." };
  }
};

export const getSubjectAllocationService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: eq(timetables.schoolId, schoolId),
      with: { subject: true },
    });

    const map = new Map<
      string,
      { subjectId: string; subjectName: string; lessonCount: number }
    >();
    for (const s of slots) {
      const entry = map.get(s.subjectId);
      if (entry) entry.lessonCount += 1;
      else
        map.set(s.subjectId, {
          subjectId: s.subjectId,
          subjectName: s.subject?.name ?? "Unknown subject",
          lessonCount: 1,
        });
    }

    const allocation = Array.from(map.values())
      .map((x) => ({
        ...x,
        hours: Math.round(((x.lessonCount * 40) / 60) * 10) / 10,
      }))
      .sort((a, b) => b.lessonCount - a.lessonCount);

    return {
      success: true,
      message: `Allocation across ${allocation.length} subject(s).`,
      allocation,
      count: allocation.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute subject allocation." };
  }
};

export const getClassesWithNoTimetableService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const allClasses = await db.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
      columns: { id: true, stream: true, gradeLevelId: true },
      with: { timetables: { columns: { id: true } } },
    });

    const empty = allClasses
      .filter((c) => c.timetables.length === 0)
      .map((c) => ({ id: c.id, stream: c.stream, gradeLevelId: c.gradeLevelId }));

    return {
      success: true,
      message: `${empty.length} class(es) without a timetable.`,
      stats: { classes: empty },
      count: empty.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find empty classes." };
  }
};

export const getTimetableCoverageStatsService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const [{ c: classCount }] = await db
      .select({ c: count() })
      .from(classes)
      .where(eq(classes.schoolId, schoolId));

    const [{ c: periodCount }] = await db
      .select({ c: count() })
      .from(periods)
      .where(and(eq(periods.schoolId, schoolId), eq(periods.isBreak, false)));

    const [{ c: slotCount }] = await db
      .select({ c: count() })
      .from(timetables)
      .where(eq(timetables.schoolId, schoolId));

    const totalSlots = Number(classCount) * Number(periodCount) * 5;
    const filled = Number(slotCount);

    return {
      success: true,
      message: `Coverage: ${filled}/${totalSlots}.`,
      coverage: {
        totalSlots,
        filledSlots: filled,
        emptySlots: Math.max(0, totalSlots - filled),
        percentage: totalSlots > 0 ? Math.round((filled / totalSlots) * 1000) / 10 : 0,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute coverage." };
  }
};

export const getUnassignedTeacherSlotsService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.schoolId, schoolId),
        sql`${timetables.teacherId} IS NULL`
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) without a teacher.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find unassigned slots." };
  }
};

export const getSlotsWithoutRoomService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.schoolId, schoolId),
        sql`(${timetables.room} IS NULL OR ${timetables.room} = '')`
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) without a room.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find slots without room." };
  }
};

export const getSlotsBySubjectService = async (
  schoolId: string,
  subjectId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.schoolId, schoolId),
        eq(timetables.subjectId, subjectId)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) for this subject.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch slots for subject." };
  }
};

export const getSlotsByTeacherService = async (
  schoolId: string,
  teacherId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.schoolId, schoolId),
        eq(timetables.teacherId, teacherId)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) for this teacher.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch slots for teacher." };
  }
};

export const getSlotsByRoomService = async (
  schoolId: string,
  room: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.schoolId, schoolId),
        eq(timetables.room, room)
      ),
      with: { class: true, subject: true, teacher: true },
    });
    const enriched = await attachPeriods(slots);
    return {
      success: true,
      message: `${enriched.length} slot(s) in ${room}.`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch slots for room." };
  }
};

export const deleteTimetableForSchoolService = async (
  schoolId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const deleted = await db
      .delete(timetables)
      .where(eq(timetables.schoolId, schoolId))
      .returning({ id: timetables.id });

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.school.cleared",
      metadata: { deleted: deleted.length },
    });

    return {
      success: true,
      message: `Deleted ${deleted.length} slot(s) school-wide.`,
      count: deleted.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to clear school timetable." };
  }
};

export const deleteTimetableForDayService = async (
  schoolId: string,
  dayOfWeek: Weekday,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const deleted = await db
      .delete(timetables)
      .where(
        and(
          eq(timetables.schoolId, schoolId),
          eq(timetables.dayOfWeek, dayOfWeek)
        )
      )
      .returning({ id: timetables.id });

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.day.cleared",
      metadata: { dayOfWeek, deleted: deleted.length },
    });

    return {
      success: true,
      message: `Deleted ${deleted.length} slot(s) for ${dayOfWeek}.`,
      count: deleted.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete day." };
  }
};

// ================================================================
// 7. CONFLICT CHECKS
// ================================================================

export const checkTeacherConflictService = async (
  teacherId: string,
  dayOfWeek: Weekday,
  periodId: string,
  excludeSlotId?: string
): Promise<TimetableResponse> => {
  try {
    const where = excludeSlotId
      ? and(
          eq(timetables.teacherId, teacherId),
          eq(timetables.dayOfWeek, dayOfWeek),
          eq(timetables.periodId, periodId),
          ne(timetables.id, excludeSlotId)
        )
      : and(
          eq(timetables.teacherId, teacherId),
          eq(timetables.dayOfWeek, dayOfWeek),
          eq(timetables.periodId, periodId)
        );
    const conflicts = await db.select().from(timetables).where(where);
    return {
      success: true,
      message: conflicts.length > 0 ? "Teacher has a conflict." : "No conflict.",
      conflict: conflicts.length > 0,
      conflicts,
      count: conflicts.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to check teacher conflict." };
  }
};

export const checkClassConflictService = async (
  classId: string,
  dayOfWeek: Weekday,
  periodId: string,
  excludeSlotId?: string
): Promise<TimetableResponse> => {
  try {
    const where = excludeSlotId
      ? and(
          eq(timetables.classId, classId),
          eq(timetables.dayOfWeek, dayOfWeek),
          eq(timetables.periodId, periodId),
          ne(timetables.id, excludeSlotId)
        )
      : and(
          eq(timetables.classId, classId),
          eq(timetables.dayOfWeek, dayOfWeek),
          eq(timetables.periodId, periodId)
        );
    const conflicts = await db.select().from(timetables).where(where);
    return {
      success: true,
      message: conflicts.length > 0 ? "Class has a conflict." : "No conflict.",
      conflict: conflicts.length > 0,
      conflicts,
      count: conflicts.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to check class conflict." };
  }
};

export const checkRoomConflictService = async (
  schoolId: string,
  room: string,
  dayOfWeek: Weekday,
  periodId: string,
  excludeSlotId?: string
): Promise<TimetableResponse> => {
  try {
    const where = excludeSlotId
      ? and(
          eq(timetables.schoolId, schoolId),
          eq(timetables.room, room),
          eq(timetables.dayOfWeek, dayOfWeek),
          eq(timetables.periodId, periodId),
          ne(timetables.id, excludeSlotId)
        )
      : and(
          eq(timetables.schoolId, schoolId),
          eq(timetables.room, room),
          eq(timetables.dayOfWeek, dayOfWeek),
          eq(timetables.periodId, periodId)
        );
    const conflicts = await db.select().from(timetables).where(where);
    return {
      success: true,
      message: conflicts.length > 0 ? "Room has a conflict." : "No conflict.",
      conflict: conflicts.length > 0,
      conflicts,
      count: conflicts.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to check room conflict." };
  }
};

export const validateSchoolTimetableService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const slots = await db
      .select()
      .from(timetables)
      .where(eq(timetables.schoolId, schoolId));

    const conflicts: any[] = [];

    const byTeacher = new Map<string, TSelectTimetable[]>();
    for (const s of slots) {
      if (!s.teacherId) continue;
      const key = `${s.teacherId}::${s.dayOfWeek}::${s.periodId}`;
      if (!byTeacher.has(key)) byTeacher.set(key, []);
      byTeacher.get(key)!.push(s);
    }
    for (const [key, arr] of byTeacher) {
      if (arr.length > 1) {
        const [teacherId, day, period] = key.split("::");
        conflicts.push({
          type: "teacher-double-booked",
          teacherId,
          dayOfWeek: day,
          periodId: period,
          slotIds: arr.map((s) => s.id),
          reason: `Teacher booked ${arr.length} times at same day/period`,
        });
      }
    }

    const byRoom = new Map<string, TSelectTimetable[]>();
    for (const s of slots) {
      if (!s.room) continue;
      const key = `${s.room}::${s.dayOfWeek}::${s.periodId}`;
      if (!byRoom.has(key)) byRoom.set(key, []);
      byRoom.get(key)!.push(s);
    }
    for (const [key, arr] of byRoom) {
      if (arr.length > 1) {
        const [room, day, period] = key.split("::");
        conflicts.push({
          type: "room-double-booked",
          room,
          dayOfWeek: day,
          periodId: period,
          slotIds: arr.map((s) => s.id),
          reason: `Room "${room}" booked ${arr.length} times at same day/period`,
        });
      }
    }

    return {
      success: true,
      message:
        conflicts.length === 0
          ? `Timetable valid (${slots.length} slots).`
          : `${conflicts.length} conflict(s) detected.`,
      valid: conflicts.length === 0,
      conflicts,
      count: slots.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to validate timetable." };
  }
};

// ================================================================
// 8. WHOLE-SCHOOL TIMETABLE GENERATOR
// ================================================================

export const previewSchoolTimetableService = async (
  input: GenerateSchoolTimetableInput,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  return generateSchoolTimetableService(
    { ...input, options: { ...input.options, dryRun: true } },
    actorId
  );
};

export const generateSchoolTimetableService = async (
  input: GenerateSchoolTimetableInput,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const { schoolId, classIds, allocations, config: rawConfig, options = {} } = input;
    const { clearExisting = true, dryRun = false } = options;

    if (!classIds?.length) {
      return { success: false, message: "classIds must be a non-empty array." };
    }
    if (!allocations?.length) {
      return { success: false, message: "allocations must be a non-empty array." };
    }

    // ✅ CHANGED — normalise every field the frontend sends
    const config = {
      maxPerTeacherPerDay: rawConfig?.maxPerTeacherPerDay ?? 6,
      maxPerTeacherPerWeek: rawConfig?.maxPerTeacherPerWeek ?? 28,
      morningHeavySubjectIds: rawConfig?.morningHeavySubjectIds ?? [],
      seed: rawConfig?.seed ?? genSeed(),
      maxPerSubjectPerDay: rawConfig?.maxPerSubjectPerDay ?? {},
      dailySubjectIds: rawConfig?.dailySubjectIds ?? [],
      maxDoublesPerDay: rawConfig?.maxDoublesPerDay ?? 1,
      avoidAdjacentPairs: rawConfig?.avoidAdjacentPairs ?? [],
      spreadSubjects: rawConfig?.spreadSubjects ?? true,
    };

    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const [cls, allUsers, allPeriods] = await Promise.all([
      db.select().from(classes).where(
        and(eq(classes.schoolId, schoolId), inArray(classes.id, classIds))
      ),
      db.select().from(users).where(eq(users.schoolId, schoolId)),
      db.select().from(periods).where(
        and(eq(periods.schoolId, schoolId), eq(periods.isBreak, false))
      ),
    ]);

    if (cls.length === 0) {
      return { success: false, message: "No matching classes found for this school." };
    }

    const teachingPeriods = [...allPeriods].sort(
      (a, b) => a.periodNumber - b.periodNumber
    );
    if (teachingPeriods.length === 0) {
      return {
        success: false,
        message: "No teaching periods configured. Set up the school day first.",
      };
    }

    const teachers = allUsers.filter(
      (u) =>
        u.role === "teacher" ||
        (Array.isArray(u.roles) && u.roles.includes("teacher"))
    );
    if (teachers.length === 0) {
      return { success: false, message: "No teachers found for this school." };
    }

    const allocByClass = new Map<string, GeneratorAllocation[]>();
    for (const a of allocations) {
      if (!allocByClass.has(a.classId)) allocByClass.set(a.classId, []);
      allocByClass.get(a.classId)!.push(a);
    }

    const result = runGenerator(
      cls,
      teachers,
      teachingPeriods,
      allocByClass,
      config
    );

    const stats = buildGeneratorStats(
      result.slots,
      cls,
      teachers,
      teachingPeriods,
      allocByClass
    );

    // ✅ NEW — produce human-readable rule violations
    const ruleIssues = checkGeneratedRules(
      result.slots,
      teachingPeriods,
      allocByClass,
      config,
      cls
    );

    if (dryRun) {
      return {
        success: true,
        message: `Preview: would generate ${result.slots.length} slot(s) for ${cls.length} class(es).`,
        slots: result.slots as any,
        count: result.slots.length,
        warnings: result.warnings,
        issues: ruleIssues,
        unplaced: result.unplaced,
        stats: {
          ...stats,
          seed: config.seed,
          dryRun: true,
        },
      };
    }

    if (clearExisting) {
      await db.delete(timetables).where(
        and(
          eq(timetables.schoolId, schoolId),
          inArray(timetables.classId, classIds)
        )
      );
    }

    let inserted: TSelectTimetable[] = [];
    if (result.slots.length > 0) {
      inserted = await db
        .insert(timetables)
        .values(
          result.slots.map((s) => ({
            schoolId,
            classId: s.classId,
            dayOfWeek: s.dayOfWeek,
            periodId: s.periodId,
            subjectId: s.subjectId,
            teacherId: s.teacherId ?? null,
            room: s.room ?? null,
          }))
        )
        .returning();
    }

    const enriched = await attachPeriods(inserted);

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.school.generated",
      metadata: {
        inserted: inserted.length,
        classesProcessed: cls.length,
        teachingPeriods: teachingPeriods.length,
        teachersConsidered: teachers.length,
        seed: config.seed,
        warnings: result.warnings.length,
        issues: ruleIssues.length,
      },
    });

    return {
      success: true,
      message: `Generated ${inserted.length} slot(s) for ${cls.length} class(es).`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
      warnings: result.warnings,
      issues: ruleIssues,
      unplaced: result.unplaced,
      stats: {
        ...stats,
        seed: config.seed,
        generatedAt: now().toISOString(),
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to generate timetable." };
  }
};

// ================================================================
// 8a. GENERATOR — core loop (CHANGED)
// ================================================================

function runGenerator(
  cls: TSelectClass[],
  teachers: TSelectUser[],
  teachingPeriods: TSelectPeriod[],
  allocByClass: Map<string, GeneratorAllocation[]>,
  config: Required<Omit<GeneratorConfig, "seed">> & { seed: number }
): {
  slots: GeneratedSlot[];
  warnings: string[];
  unplaced: Array<{
    classId: string;
    className: string;
    subjectId: string;
    isDouble: boolean;
    reason: string;
  }>;
} {
  const rng = createSeededRng(config.seed);
  const slots: GeneratedSlot[] = [];
  const warnings: string[] = [];
  const unplaced: ReturnType<typeof runGenerator>["unplaced"] = [];

  // ── existing teacher tracking ─────────────────────────────
  const teacherDayLoad = new Map<string, Map<Weekday, number>>();
  const teacherWeekLoad = new Map<string, number>();
  const teacherBusy = new Map<string, Set<string>>();
  for (const t of teachers) {
    teacherDayLoad.set(t.id, new Map());
    teacherWeekLoad.set(t.id, 0);
    teacherBusy.set(t.id, new Set());
  }

  // ── existing class tracking ───────────────────────────────
  const classBusy = new Map<string, Set<string>>();
  for (const c of cls) classBusy.set(c.id, new Set());

  // ── NEW per-class rule state ──────────────────────────────
  const subjectDayCount = new Map<string, Map<Weekday, Map<string, number>>>();
  const doubleDayCount = new Map<string, Map<Weekday, number>>();
  const classSlotSubject = new Map<string, Map<string, string>>(); // `${day}::${periodId}` -> subjectId
  for (const c of cls) {
    subjectDayCount.set(c.id, new Map());
    doubleDayCount.set(c.id, new Map());
    classSlotSubject.set(c.id, new Map());
  }

  const caps = config.maxPerSubjectPerDay ?? {};
  const dailyIds = config.dailySubjectIds ?? [];
  const maxDoubles = config.maxDoublesPerDay ?? 1;
  const pairsToAvoid = config.avoidAdjacentPairs ?? [];
  const spread = config.spreadSubjects !== false;

  const countOnDay = (classId: string, day: Weekday, sid: string) =>
    subjectDayCount.get(classId)!.get(day)?.get(sid) ?? 0;

  const recordSlot = (s: GeneratedSlot) => {
    const m = subjectDayCount.get(s.classId)!;
    if (!m.has(s.dayOfWeek)) m.set(s.dayOfWeek, new Map());
    m.get(s.dayOfWeek)!.set(
      s.subjectId,
      (m.get(s.dayOfWeek)!.get(s.subjectId) ?? 0) + 1
    );
    classBusy.get(s.classId)!.add(`${s.dayOfWeek}::${s.periodId}`);
    classSlotSubject.get(s.classId)!.set(`${s.dayOfWeek}::${s.periodId}`, s.subjectId);
    if (s.teacherId) {
      const dl = teacherDayLoad.get(s.teacherId)!;
      dl.set(s.dayOfWeek, (dl.get(s.dayOfWeek) ?? 0) + 1);
      teacherWeekLoad.set(
        s.teacherId,
        (teacherWeekLoad.get(s.teacherId) ?? 0) + 1
      );
      teacherBusy.get(s.teacherId)!.add(`${s.dayOfWeek}::${s.periodId}`);
    }
  };

  const sorted = [...cls].sort((a, b) => {
    const sumA = (allocByClass.get(a.id) ?? []).reduce(
      (s, x) => s + x.lessonsPerWeek,
      0
    );
    const sumB = (allocByClass.get(b.id) ?? []).reduce(
      (s, x) => s + x.lessonsPerWeek,
      0
    );
    return sumB - sumA;
  });

  for (const klass of sorted) {
    const allocs = allocByClass.get(klass.id) ?? [];
    const className = klass.stream ?? klass.id.slice(0, 8);

    // ── build flat lesson list ──────────────────────────────
    const lessons: Array<{
      subjectId: string;
      isDouble: boolean;
      preferredTeacherIds: string[];
    }> = [];
    for (const a of allocs) {
      if (a.requiresDouble) {
        const pairs = Math.floor(a.lessonsPerWeek / 2);
        const singles = a.lessonsPerWeek % 2;
        for (let i = 0; i < pairs; i++) {
          lessons.push({
            subjectId: a.subjectId,
            isDouble: true,
            preferredTeacherIds: a.preferredTeacherIds,
          });
        }
        for (let i = 0; i < singles; i++) {
          lessons.push({
            subjectId: a.subjectId,
            isDouble: false,
            preferredTeacherIds: a.preferredTeacherIds,
          });
        }
      } else {
        for (let i = 0; i < a.lessonsPerWeek; i++) {
          lessons.push({
            subjectId: a.subjectId,
            isDouble: false,
            preferredTeacherIds: a.preferredTeacherIds,
          });
        }
      }
    }

    // ══════════════════════════════════════════════════════
    // PRE-PASS: seed each daily subject 1× on every school day
    // ══════════════════════════════════════════════════════
    const seededCount = new Map<string, number>();
    for (const sid of dailyIds) {
      const alloc = allocs.find((a) => a.subjectId === sid);
      if (!alloc) continue;

      if (alloc.lessonsPerWeek < WEEKDAYS.length) {
        warnings.push(
          `${className}: "${sid.slice(0, 8)}" is marked daily but only has ${alloc.lessonsPerWeek} lesson(s)/week — needs ≥5.`
        );
        continue;
      }

      const cap = caps[sid];
      if (cap === 0) {
        warnings.push(
          `${className}: "${sid.slice(0, 8)}" is daily but its per-day cap is 0 (blocked).`
        );
        continue;
      }

      let seeded = 0;
      const seedsNeeded = Math.min(WEEKDAYS.length, alloc.lessonsPerWeek);

      for (const day of WEEKDAYS) {
        if (seeded >= seedsNeeded) break;
        const placed = tryPlaceOneOnDay(
          klass.id,
          sid,
          day,
          alloc.preferredTeacherIds,
          teachingPeriods,
          config,
          rng,
          teacherDayLoad,
          teacherWeekLoad,
          teacherBusy,
          classBusy,
          subjectDayCount,
          classSlotSubject,
          caps,
          pairsToAvoid,
          spread
        );
        if (placed) {
          slots.push(placed);
          recordSlot(placed);
          seeded++;
        }
      }
      seededCount.set(sid, seeded);

      if (seeded < seedsNeeded) {
        warnings.push(
          `${className}: only seeded "${sid.slice(0, 8)}" on ${seeded}/${seedsNeeded} days (no free slot with a free teacher).`
        );
      }
    }

    // ══════════════════════════════════════════════════════
    // MAIN PASS
    // ══════════════════════════════════════════════════════
    const shuffled = shuffleArray(lessons, rng);
    shuffled.sort((a, b) => {
      if (a.isDouble !== b.isDouble) return a.isDouble ? -1 : 1;
      const aM = config.morningHeavySubjectIds.includes(a.subjectId);
      const bM = config.morningHeavySubjectIds.includes(b.subjectId);
      if (aM !== bM) return aM ? -1 : 1;
      return 0;
    });

    for (const lesson of shuffled) {
      // Skip lessons that the pre-pass already seeded
      const remaining = seededCount.get(lesson.subjectId) ?? 0;
      if (remaining > 0) {
        seededCount.set(lesson.subjectId, remaining - 1);
        continue;
      }

      const candidates =
        lesson.preferredTeacherIds.length > 0
          ? teachers.filter((t) => lesson.preferredTeacherIds.includes(t.id))
          : teachers;

      const placed = tryPlaceLesson(
        klass.id,
        lesson,
        candidates,
        teachingPeriods,
        config,
        rng,
        teacherDayLoad,
        teacherWeekLoad,
        teacherBusy,
        classBusy,
        subjectDayCount,
        doubleDayCount,
        classSlotSubject,
        caps,
        maxDoubles,
        pairsToAvoid,
        spread
      );

      if (placed.length > 0) {
        if (placed.length > 1 && placed[0]!.subjectId === placed[1]!.subjectId) {
          const day = placed[0]!.dayOfWeek;
          const dm = doubleDayCount.get(klass.id)!;
          dm.set(day, (dm.get(day) ?? 0) + 1);
        }
        for (const s of placed) {
          slots.push(s);
          recordSlot(s);
        }
      } else {
        const reason =
          lesson.preferredTeacherIds.length > 0
            ? "No preferred teacher available at any valid slot"
            : "No valid slot (would break a cap/adjacency rule, or no free teacher)";
        warnings.push(
          `Could not place ${lesson.isDouble ? "double " : ""}lesson (subject ${lesson.subjectId.slice(0, 8)}) in ${className}: ${reason}`
        );
        unplaced.push({
          classId: klass.id,
          className,
          subjectId: lesson.subjectId,
          isDouble: lesson.isDouble,
          reason,
        });
      }
    }
  }

  return { slots, warnings, unplaced };
}

// ================================================================
// 8b. GENERATOR — placement primitives (CHANGED)
// ================================================================

/**
 * Place a single (non-double) lesson on an EXACT day.
 * Used by the pre-pass to force daily subjects onto every school day.
 */
function tryPlaceOneOnDay(
  classId: string,
  subjectId: string,
  day: Weekday,
  preferredTeacherIds: string[],
  teachingPeriods: TSelectPeriod[],
  config: Required<Omit<GeneratorConfig, "seed">> & { seed: number },
  rng: () => number,
  teacherDayLoad: Map<string, Map<Weekday, number>>,
  teacherWeekLoad: Map<string, number>,
  teacherBusy: Map<string, Set<string>>,
  classBusy: Map<string, Set<string>>,
  subjectDayCount: Map<string, Map<Weekday, Map<string, number>>>,
  classSlotSubject: Map<string, Map<string, string>>,
  caps: Record<string, number>,
  pairsToAvoid: [string, string][],
  spread: boolean
): GeneratedSlot | null {
  const cap = caps[subjectId];
  if (cap === 0) return null;

  const dayCount =
    subjectDayCount.get(classId)?.get(day)?.get(subjectId) ?? 0;
  if (cap !== undefined && dayCount >= cap) return null;

  const teacherIds = [...teacherDayLoad.keys()];
  const pool =
    preferredTeacherIds.length > 0
      ? teacherIds.filter((id) => preferredTeacherIds.includes(id))
      : teacherIds;

  const shuffledPeriods = shuffleArray(teachingPeriods, rng);
  const busySet = classBusy.get(classId)!;
  const slotMap = classSlotSubject.get(classId)!;

  for (const period of shuffledPeriods) {
    if (busySet.has(`${day}::${period.id}`)) continue;
    if (!canPlaceAdjacent(day, period.id, subjectId, teachingPeriods, slotMap, pairsToAvoid, spread))
      continue;

    for (const tid of pool) {
      const dayLoad = teacherDayLoad.get(tid)?.get(day) ?? 0;
      if (dayLoad >= config.maxPerTeacherPerDay) continue;
      const weekLoad = teacherWeekLoad.get(tid) ?? 0;
      if (weekLoad >= config.maxPerTeacherPerWeek) continue;
      const tBusy = teacherBusy.get(tid)!;
      if (tBusy.has(`${day}::${period.id}`)) continue;

      return {
        classId,
        dayOfWeek: day,
        periodId: period.id,
        subjectId,
        teacherId: tid,
      };
    }
  }
  return null;
}

/**
 * Main placement function — respects caps, doubles-per-day,
 * "spread", and "never adjacent" rules.
 */
function tryPlaceLesson(
  classId: string,
  lesson: { subjectId: string; isDouble: boolean; preferredTeacherIds: string[] },
  teacherCandidates: TSelectUser[],
  teachingPeriods: TSelectPeriod[],
  config: Required<Omit<GeneratorConfig, "seed">> & { seed: number },
  rng: () => number,
  teacherDayLoad: Map<string, Map<Weekday, number>>,
  teacherWeekLoad: Map<string, number>,
  teacherBusy: Map<string, Set<string>>,
  classBusy: Map<string, Set<string>>,
  subjectDayCount: Map<string, Map<Weekday, Map<string, number>>>,
  doubleDayCount: Map<string, Map<Weekday, number>>,
  classSlotSubject: Map<string, Map<string, string>>,
  caps: Record<string, number>,
  maxDoubles: number,
  pairsToAvoid: [string, string][],
  spread: boolean
): GeneratedSlot[] {
  const classBusySet = classBusy.get(classId)!;
  const slotMap = classSlotSubject.get(classId)!;
  const shuffledDays = shuffleArray(WEEKDAYS, rng);
  const periodOrder = config.morningHeavySubjectIds.includes(lesson.subjectId)
    ? teachingPeriods
    : shuffleArray(teachingPeriods, rng);

  const cap = caps[lesson.subjectId];
  if (cap === 0) return []; // blocked

  for (const day of shuffledDays) {
    const dayCount =
      subjectDayCount.get(classId)?.get(day)?.get(lesson.subjectId) ?? 0;
    const needed = lesson.isDouble ? 2 : 1;

    if (cap !== undefined && dayCount + needed > cap) continue;

    if (lesson.isDouble) {
      const dblToday = doubleDayCount.get(classId)?.get(day) ?? 0;
      if (dblToday >= maxDoubles) continue;
    }

    for (let i = 0; i < periodOrder.length; i++) {
      const period = periodOrder[i]!;
      if (classBusySet.has(`${day}::${period.id}`)) continue;

      // Single lesson — check both immediate neighbours
      if (!lesson.isDouble) {
        if (
          !canPlaceAdjacent(day, period.id, lesson.subjectId, teachingPeriods, slotMap, pairsToAvoid, spread)
        )
          continue;
      }

      let nextPeriod: TSelectPeriod | undefined;
      if (lesson.isDouble) {
        const idx = teachingPeriods.findIndex((p) => p.id === period.id);
        nextPeriod = teachingPeriods[idx + 1];
        if (!nextPeriod) continue;
        if (classBusySet.has(`${day}::${nextPeriod.id}`)) continue;

        // Double lesson — only the OUTER neighbours matter
        const prevOuter = teachingPeriods[idx - 1];
        const nextOuter = teachingPeriods[idx + 2];
        if (
          !canPlaceSingleNeighbour(day, prevOuter, lesson.subjectId, slotMap, pairsToAvoid, spread) ||
          !canPlaceSingleNeighbour(day, nextOuter, lesson.subjectId, slotMap, pairsToAvoid, spread)
        )
          continue;
      }

      for (const teacher of teacherCandidates) {
        const dayLoad = teacherDayLoad.get(teacher.id)?.get(day) ?? 0;
        if (dayLoad >= config.maxPerTeacherPerDay) continue;
        const weekLoad = teacherWeekLoad.get(teacher.id) ?? 0;
        if (weekLoad >= config.maxPerTeacherPerWeek) continue;

        const busy = teacherBusy.get(teacher.id)!;
        if (busy.has(`${day}::${period.id}`)) continue;
        if (nextPeriod && busy.has(`${day}::${nextPeriod.id}`)) continue;

        const base: GeneratedSlot = {
          classId,
          dayOfWeek: day,
          periodId: period.id,
          subjectId: lesson.subjectId,
          teacherId: teacher.id,
        };

        if (lesson.isDouble && nextPeriod) {
          return [
            base,
            {
              classId,
              dayOfWeek: day,
              periodId: nextPeriod.id,
              subjectId: lesson.subjectId,
              teacherId: teacher.id,
            },
          ];
        }
        return [base];
      }
    }
  }

  return [];
}

/**
 * Check whether placing `subjectId` at `periodId` breaks the "spread"
 * rule (same subject cannot be next to itself) or the "never next to"
 * rule. Used for single-lesson placements where BOTH neighbours matter.
 */
function canPlaceAdjacent(
  day: Weekday,
  periodId: string,
  subjectId: string,
  teachingPeriods: TSelectPeriod[],
  slotMap: Map<string, string>,
  pairsToAvoid: [string, string][],
  spread: boolean
): boolean {
  const idx = teachingPeriods.findIndex((p) => p.id === periodId);
  if (idx < 0) return true;

  const prev = teachingPeriods[idx - 1];
  const next = teachingPeriods[idx + 1];
  return (
    canPlaceSingleNeighbour(day, prev, subjectId, slotMap, pairsToAvoid, spread) &&
    canPlaceSingleNeighbour(day, next, subjectId, slotMap, pairsToAvoid, spread)
  );
}

/** Check one neighbour slot against spread + never-adjacent rules. */
function canPlaceSingleNeighbour(
  day: Weekday,
  neighbour: TSelectPeriod | undefined,
  subjectId: string,
  slotMap: Map<string, string>,
  pairsToAvoid: [string, string][],
  spread: boolean
): boolean {
  if (!neighbour) return true;
  const neighbourSub = slotMap.get(`${day}::${neighbour.id}`);
  if (!neighbourSub) return true;
  if (spread && neighbourSub === subjectId) return false;
  if (
    pairsToAvoid.some(
      ([a, b]) =>
        (a === neighbourSub && b === subjectId) ||
        (a === subjectId && b === neighbourSub)
    )
  )
    return false;
  return true;
}

// ================================================================
// 8c. GENERATOR — stats (unchanged) + rule report (NEW)
// ================================================================

function buildGeneratorStats(
  slots: GeneratedSlot[],
  cls: TSelectClass[],
  teachers: TSelectUser[],
  teachingPeriods: TSelectPeriod[],
  allocByClass: Map<string, GeneratorAllocation[]>
): GeneratorStats {
  const perClass = cls.map((c) => {
    const requested = (allocByClass.get(c.id) ?? []).reduce(
      (s, a) => s + a.lessonsPerWeek,
      0
    );
    const placed = slots.filter((s) => s.classId === c.id).length;
    return {
      classId: c.id,
      className: c.stream ?? c.id.slice(0, 8),
      requested,
      placed,
      missing: Math.max(0, requested - placed),
    };
  });

  const perTeacher = teachers
    .map((t) => {
      const teacherSlots = slots.filter((s) => s.teacherId === t.id);
      const byDay: Record<string, number> = {};
      for (const s of teacherSlots) {
        byDay[s.dayOfWeek] = (byDay[s.dayOfWeek] ?? 0) + 1;
      }
      return {
        teacherId: t.id,
        teacherName: t.name,
        totalLessons: teacherSlots.length,
        byDay,
      };
    })
    .filter((t) => t.totalLessons > 0)
    .sort((a, b) => b.totalLessons - a.totalLessons);

  const totalSlots = cls.length * teachingPeriods.length * WEEKDAYS.length;
  const filled = slots.length;

  return {
    perClass,
    perTeacher,
    coverage: {
      totalSlots,
      filledSlots: filled,
      percentage:
        totalSlots > 0 ? Math.round((filled / totalSlots) * 1000) / 10 : 0,
    },
  };
}

/**
 * Post-flight rule report — tells the caller exactly which caps /
 * daily / doubles rules the generated timetable breaks. Empty array
 * means the timetable satisfies every configured rule.
 */
function checkGeneratedRules(
  slots: GeneratedSlot[],
  teachingPeriods: TSelectPeriod[],
  allocByClass: Map<string, GeneratorAllocation[]>,
  config: Required<Omit<GeneratorConfig, "seed">> & { seed: number },
  cls: TSelectClass[]
): string[] {
  const issues: string[] = [];
  const caps = config.maxPerSubjectPerDay ?? {};
  const dailyIds = config.dailySubjectIds ?? [];
  const maxDoubles = config.maxDoublesPerDay ?? 1;

  const className = (cid: string) =>
    cls.find((c) => c.id === cid)?.stream ?? cid.slice(0, 8);

  const byClass = new Map<string, GeneratedSlot[]>();
  for (const s of slots) {
    if (!byClass.has(s.classId)) byClass.set(s.classId, []);
    byClass.get(s.classId)!.push(s);
  }

  for (const klass of cls) {
    const mine = byClass.get(klass.id) ?? [];

    for (const day of WEEKDAYS) {
      const daySlots = mine.filter((s) => s.dayOfWeek === day);
      const counts: Record<string, number> = {};
      for (const s of daySlots) {
        counts[s.subjectId] = (counts[s.subjectId] ?? 0) + 1;
      }

      for (const [sid, n] of Object.entries(counts)) {
        const cap = caps[sid];
        if (cap === 0) {
          issues.push(
            `${className(klass.id)} · ${day}: ${sid.slice(0, 8)} is blocked (0/day) but placed ${n}×`
          );
        } else if (cap !== undefined && n > cap) {
          issues.push(
            `${className(klass.id)} · ${day}: ${sid.slice(0, 8)} appears ${n}× (cap ${cap})`
          );
        }
      }

      for (const sid of dailyIds) {
        const alloc = (allocByClass.get(klass.id) ?? []).find(
          (a) => a.subjectId === sid
        );
        if (!alloc || alloc.lessonsPerWeek < WEEKDAYS.length) continue;
        if (!counts[sid]) {
          issues.push(
            `${className(klass.id)} · ${day}: ${sid.slice(0, 8)} missing (marked daily)`
          );
        }
      }

      // doubles count
      let doublesToday = 0;
      for (let i = 0; i < teachingPeriods.length - 1; i++) {
        const p1 = daySlots.find((s) => s.periodId === teachingPeriods[i]!.id);
        const p2 = daySlots.find((s) => s.periodId === teachingPeriods[i + 1]!.id);
        if (p1 && p2 && p1.subjectId === p2.subjectId) doublesToday++;
      }
      if (doublesToday > maxDoubles) {
        issues.push(
          `${className(klass.id)} · ${day}: ${doublesToday} doubles (cap ${maxDoubles})`
        );
      }
    }
  }
  return issues;
}

// ================================================================
// 9. ADDITIONAL SERVICES (unchanged)
// ================================================================

export const seedStandardSchoolDayService = async (
  schoolId: string,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const existing = await db
      .select({ id: periods.id })
      .from(periods)
      .where(eq(periods.schoolId, schoolId))
      .limit(1);
    if (existing.length > 0) {
      return {
        success: false,
        message:
          "This school already has periods. Delete them first or use createPeriodService to add more.",
      };
    }

    const created = await db
      .insert(periods)
      .values(STANDARD_KENYAN_DAY.map((p) => ({ ...p, schoolId })))
      .returning();

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.periods.seeded_standard",
      metadata: { count: created.length },
    });

    return {
      success: true,
      message: `Seeded ${created.length} periods (standard Kenyan day).`,
      periods: created as TSelectPeriod[],
      count: created.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to seed standard school day." };
  }
};

export const resetSchoolSetupService = async (
  schoolId: string,
  confirm: boolean,
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    if (!confirm) {
      return {
        success: false,
        message:
          "This will delete ALL timetable slots and periods for this school. Set confirm=true to proceed.",
      };
    }

    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const deletedSlots = await db
      .delete(timetables)
      .where(eq(timetables.schoolId, schoolId))
      .returning({ id: timetables.id });

    const deletedPeriods = await db
      .delete(periods)
      .where(eq(periods.schoolId, schoolId))
      .returning({ id: periods.id });

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.school.reset",
      metadata: {
        deletedSlots: deletedSlots.length,
        deletedPeriods: deletedPeriods.length,
      },
    });

    return {
      success: true,
      message: `Reset complete: deleted ${deletedSlots.length} slot(s) and ${deletedPeriods.length} period(s).`,
      stats: {
        deletedSlots: deletedSlots.length,
        deletedPeriods: deletedPeriods.length,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reset school setup." };
  }
};

export const duplicateDayService = async (
  input: {
    schoolId: string;
    sourceDay: Weekday;
    targetDay: Weekday;
    classIds?: string[];
  },
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const { schoolId, sourceDay, targetDay, classIds } = input;

    if (sourceDay === targetDay) {
      return { success: false, message: "Source and target day must be different." };
    }

    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const where = classIds?.length
      ? and(
          eq(timetables.schoolId, schoolId),
          eq(timetables.dayOfWeek, sourceDay),
          inArray(timetables.classId, classIds)
        )
      : and(
          eq(timetables.schoolId, schoolId),
          eq(timetables.dayOfWeek, sourceDay)
        );

    const sourceSlots = await db.select().from(timetables).where(where);
    if (sourceSlots.length === 0) {
      return {
        success: false,
        message: `No slots found on ${sourceDay} to duplicate.`,
      };
    }

    const targetWhere = classIds?.length
      ? and(
          eq(timetables.schoolId, schoolId),
          eq(timetables.dayOfWeek, targetDay),
          inArray(timetables.classId, classIds)
        )
      : and(
          eq(timetables.schoolId, schoolId),
          eq(timetables.dayOfWeek, targetDay)
        );
    const targetSlots = await db.select().from(timetables).where(targetWhere);
    const targetBusy = new Set(
      targetSlots.map((s) => `${s.classId}::${s.periodId}`)
    );

    const teacherIds = [
      ...new Set(sourceSlots.map((s) => s.teacherId).filter(Boolean)),
    ] as string[];
    const teacherTargetSlots = teacherIds.length
      ? await db
          .select({
            teacherId: timetables.teacherId,
            periodId: timetables.periodId,
          })
          .from(timetables)
          .where(
            and(
              eq(timetables.schoolId, schoolId),
              eq(timetables.dayOfWeek, targetDay),
              inArray(timetables.teacherId, teacherIds)
            )
          )
      : [];
    const teacherTargetBusy = new Set(
      teacherTargetSlots.map((s) => `${s.teacherId}::${s.periodId}`)
    );

    const toInsert: TInsertTimetable[] = [];
    const skipped: any[] = [];

    for (const s of sourceSlots) {
      const classKey = `${s.classId}::${s.periodId}`;
      if (targetBusy.has(classKey)) {
        skipped.push({ classId: s.classId, periodId: s.periodId, reason: "class slot already booked" });
        continue;
      }
      if (s.teacherId) {
        const teacherKey = `${s.teacherId}::${s.periodId}`;
        if (teacherTargetBusy.has(teacherKey)) {
          skipped.push({ classId: s.classId, periodId: s.periodId, reason: "teacher already booked" });
          continue;
        }
        teacherTargetBusy.add(teacherKey);
      }
      targetBusy.add(classKey);
      toInsert.push({
        schoolId,
        classId: s.classId,
        dayOfWeek: targetDay,
        periodId: s.periodId,
        subjectId: s.subjectId,
        teacherId: s.teacherId,
        room: s.room,
      });
    }

    const created = toInsert.length
      ? await db.insert(timetables).values(toInsert).returning()
      : [];
    const enriched = await attachPeriods(created);

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.day.duplicated",
      metadata: {
        sourceDay,
        targetDay,
        inserted: created.length,
        skipped: skipped.length,
      },
    });

    return {
      success: true,
      message: `Duplicated ${created.length} slot(s) from ${sourceDay} to ${targetDay} (${skipped.length} skipped).`,
      slots: enriched as TimetableSlotWithPeriod[],
      count: enriched.length,
      stats: { inserted: created.length, skipped: skipped.length },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to duplicate day." };
  }
};

export const getPerClassCoverageService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const [allClasses, teachingPeriods] = await Promise.all([
      db.query.classes.findMany({
        where: eq(classes.schoolId, schoolId),
        columns: { id: true, stream: true, gradeLevelId: true },
        with: { timetables: { columns: { id: true, dayOfWeek: true } } },
      }),
      db
        .select({ id: periods.id })
        .from(periods)
        .where(and(eq(periods.schoolId, schoolId), eq(periods.isBreak, false))),
    ]);

    const capacityPerClass = teachingPeriods.length * WEEKDAYS.length;

    const breakdown = allClasses.map((c) => {
      const filled = c.timetables.length;
      return {
        classId: c.id,
        stream: c.stream,
        gradeLevelId: c.gradeLevelId,
        filled,
        capacity: capacityPerClass,
        missing: Math.max(0, capacityPerClass - filled),
        percentage:
          capacityPerClass > 0
            ? Math.round((filled / capacityPerClass) * 1000) / 10
            : 0,
      };
    });

    breakdown.sort((a, b) => a.percentage - b.percentage);

    const overallFilled = breakdown.reduce((s, x) => s + x.filled, 0);
    const overallCapacity = breakdown.reduce((s, x) => s + x.capacity, 0);

    return {
      success: true,
      message: `Overall coverage: ${overallFilled}/${overallCapacity}.`,
      coverage: {
        totalSlots: overallCapacity,
        filledSlots: overallFilled,
        emptySlots: Math.max(0, overallCapacity - overallFilled),
        percentage:
          overallCapacity > 0
            ? Math.round((overallFilled / overallCapacity) * 1000) / 10
            : 0,
      },
      stats: { perClass: breakdown },
      count: breakdown.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute per-class coverage." };
  }
};

export const getPreferredTeachersForSubjectService = async (
  schoolId: string,
  subjectId: string
): Promise<TimetableResponse> => {
  try {
    const links = await db.query.teacherSubjects.findMany({
      where: eq(teacherSubjects.subjectId, subjectId),
      with: { teacher: true, subject: true },
    });

    const filtered = links
      .filter((l) => l.teacher && l.teacher.schoolId === schoolId)
      .map((l) => ({
        teacherId: l.teacherId,
        teacherName: l.teacher!.name,
        teacherEmail: l.teacher!.email,
        subjectId: l.subjectId,
        subjectName: l.subject?.name ?? null,
      }));

    const slots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.schoolId, schoolId),
        eq(timetables.subjectId, subjectId)
      ),
      columns: { teacherId: true },
    });
    const loadMap = new Map<string, number>();
    for (const s of slots) {
      if (s.teacherId) {
        loadMap.set(s.teacherId, (loadMap.get(s.teacherId) ?? 0) + 1);
      }
    }

    const ranked = filtered
      .map((t) => ({
        ...t,
        currentLoad: loadMap.get(t.teacherId) ?? 0,
      }))
      .sort((a, b) => a.currentLoad - b.currentLoad);

    return {
      success: true,
      message: `${ranked.length} teacher(s) qualified for this subject.`,
      ranked,
      count: ranked.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load preferred teachers." };
  }
};

export const autoAssignMissingTeachersService = async (
  schoolId: string,
  config: {
    maxPerTeacherPerDay?: number;
    maxPerTeacherPerWeek?: number;
    preferSubjectQualified?: boolean;
  } = {},
  actorId: string | null = null
): Promise<TimetableResponse> => {
  try {
    const maxPerDay = config.maxPerTeacherPerDay ?? 6;
    const maxPerWeek = config.maxPerTeacherPerWeek ?? 28;
    const preferQualified = config.preferSubjectQualified ?? true;

    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const unassigned = await db
      .select()
      .from(timetables)
      .where(
        and(
          eq(timetables.schoolId, schoolId),
          sql`${timetables.teacherId} IS NULL`
        )
      );

    if (unassigned.length === 0) {
      return {
        success: true,
        message: "No unassigned slots found — nothing to do.",
        count: 0,
      };
    }

    const allTeachers = await db.query.users.findMany({
      where: and(
        eq(users.schoolId, schoolId),
        or(eq(users.role, "teacher"), sql`'teacher' = ANY(${users.roles})`)
      ),
      columns: { id: true, name: true, email: true },
    });
    if (allTeachers.length === 0) {
      return { success: false, message: "No teachers found for this school." };
    }

    const assignedSlots = await db.query.timetables.findMany({
      where: and(
        eq(timetables.schoolId, schoolId),
        sql`${timetables.teacherId} IS NOT NULL`
      ),
      columns: { teacherId: true, dayOfWeek: true, periodId: true, subjectId: true },
    });

    const teacherDayLoad = new Map<string, Map<Weekday, number>>();
    const teacherWeekLoad = new Map<string, number>();
    const teacherBusy = new Map<string, Set<string>>();
    for (const t of allTeachers) {
      teacherDayLoad.set(t.id, new Map());
      teacherWeekLoad.set(t.id, 0);
      teacherBusy.set(t.id, new Set());
    }
    for (const s of assignedSlots) {
      if (!s.teacherId) continue;
      const dl = teacherDayLoad.get(s.teacherId);
      if (dl) dl.set(s.dayOfWeek, (dl.get(s.dayOfWeek) ?? 0) + 1);
      teacherWeekLoad.set(
        s.teacherId,
        (teacherWeekLoad.get(s.teacherId) ?? 0) + 1
      );
      teacherBusy.get(s.teacherId)!.add(`${s.dayOfWeek}::${s.periodId}`);
    }

    const links = await db.query.teacherSubjects.findMany({
      where: eq(teacherSubjects.subjectId, unassigned[0]!.subjectId),
    });
    const qualifiedBySubject = new Map<string, Set<string>>();
    for (const l of links) {
      if (!qualifiedBySubject.has(l.subjectId)) {
        qualifiedBySubject.set(l.subjectId, new Set());
      }
      qualifiedBySubject.get(l.subjectId)!.add(l.teacherId);
    }
    const otherSubjectIds = [...new Set(unassigned.map((s) => s.subjectId))];
    if (otherSubjectIds.length > 1) {
      const allLinks = await db.query.teacherSubjects.findMany({
        where: inArray(teacherSubjects.subjectId, otherSubjectIds),
      });
      for (const l of allLinks) {
        if (!qualifiedBySubject.has(l.subjectId)) {
          qualifiedBySubject.set(l.subjectId, new Set());
        }
        qualifiedBySubject.get(l.subjectId)!.add(l.teacherId);
      }
    }

    const assignments: Array<{ slotId: string; teacherId: string }> = [];
    const skipped: any[] = [];

    for (const slot of unassigned) {
      const qualified = qualifiedBySubject.get(slot.subjectId) ?? new Set();
      const preferred = preferQualified
        ? allTeachers.filter((t) => qualified.has(t.id))
        : allTeachers;
      const pool = preferred.length > 0 ? preferred : allTeachers;

      const ranked = [...pool].sort((a, b) => {
        const loadA = teacherWeekLoad.get(a.id) ?? 0;
        const loadB = teacherWeekLoad.get(b.id) ?? 0;
        return loadA - loadB;
      });

      let assigned: string | null = null;
      for (const t of ranked) {
        const dayLoad = teacherDayLoad.get(t.id)?.get(slot.dayOfWeek) ?? 0;
        if (dayLoad >= maxPerDay) continue;
        const weekLoad = teacherWeekLoad.get(t.id) ?? 0;
        if (weekLoad >= maxPerWeek) continue;
        const busy = teacherBusy.get(t.id)!;
        if (busy.has(`${slot.dayOfWeek}::${slot.periodId}`)) continue;

        assigned = t.id;
        break;
      }

      if (assigned) {
        assignments.push({ slotId: slot.id, teacherId: assigned });
        const dl = teacherDayLoad.get(assigned)!;
        dl.set(slot.dayOfWeek, (dl.get(slot.dayOfWeek) ?? 0) + 1);
        teacherWeekLoad.set(
          assigned,
          (teacherWeekLoad.get(assigned) ?? 0) + 1
        );
        teacherBusy.get(assigned)!.add(`${slot.dayOfWeek}::${slot.periodId}`);
      } else {
        skipped.push({
          slotId: slot.id,
          dayOfWeek: slot.dayOfWeek,
          periodId: slot.periodId,
          subjectId: slot.subjectId,
          reason: "No teacher available (all at limit or busy)",
        });
      }
    }

    for (const a of assignments) {
      await db
        .update(timetables)
        .set({ teacherId: a.teacherId, updatedAt: now() })
        .where(eq(timetables.id, a.slotId));
    }

    await logAudit({
      schoolId,
      userId: actorId,
      action: "timetable.slots.auto_assigned_teachers",
      metadata: {
        considered: unassigned.length,
        assigned: assignments.length,
        skipped: skipped.length,
      },
    });

    return {
      success: true,
      message: `Assigned ${assignments.length} teacher(s), skipped ${skipped.length}.`,
      count: assignments.length,
      stats: {
        considered: unassigned.length,
        assigned: assignments.length,
        skipped: skipped.length,
        skippedDetails: skipped,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to auto-assign teachers." };
  }
};

export const getDetailedConflictsService = async (
  schoolId: string
): Promise<TimetableResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const slots = await db.query.timetables.findMany({
      where: eq(timetables.schoolId, schoolId),
      with: { class: true, subject: true, teacher: true },
    });

    const periodIds = [...new Set(slots.map((s) => s.periodId))];
    const periodRows = periodIds.length
      ? await db
          .select()
          .from(periods)
          .where(inArray(periods.id, periodIds))
      : [];
    const periodById = new Map<string, TSelectPeriod>();
    for (const p of periodRows) periodById.set(p.id, p as TSelectPeriod);

    type Enriched = (typeof slots)[number] & { period: TSelectPeriod | null };
    const enriched: Enriched[] = slots.map((s) => ({
      ...s,
      period: periodById.get(s.periodId) ?? null,
    }));

    const conflicts: any[] = [];

    const byTeacher = new Map<string, Enriched[]>();
    for (const s of enriched) {
      if (!s.teacherId) continue;
      const key = `${s.teacherId}::${s.dayOfWeek}::${s.periodId}`;
      if (!byTeacher.has(key)) byTeacher.set(key, []);
      byTeacher.get(key)!.push(s);
    }
    for (const [, arr] of byTeacher) {
      if (arr.length > 1) {
        const first = arr[0]!;
        conflicts.push({
          type: "teacher-double-booked",
          dayOfWeek: first.dayOfWeek,
          period: first.period
            ? { id: first.period.id, name: first.period.name, startTime: first.period.startTime, endTime: first.period.endTime }
            : null,
          teacher: first.teacher
            ? { id: first.teacher.id, name: first.teacher.name, email: first.teacher.email }
            : null,
          conflicts: arr.map((s) => ({
            slotId: s.id,
            class: s.class ? { id: s.class.id, stream: s.class.stream } : null,
            subject: s.subject ? { id: s.subject.id, name: s.subject.name } : null,
            room: s.room,
          })),
          reason: `Teacher booked ${arr.length} times at same day/period`,
        });
      }
    }

    const byRoom = new Map<string, Enriched[]>();
    for (const s of enriched) {
      if (!s.room) continue;
      const key = `${s.room}::${s.dayOfWeek}::${s.periodId}`;
      if (!byRoom.has(key)) byRoom.set(key, []);
      byRoom.get(key)!.push(s);
    }
    for (const [, arr] of byRoom) {
      if (arr.length > 1) {
        const first = arr[0]!;
        conflicts.push({
          type: "room-double-booked",
          dayOfWeek: first.dayOfWeek,
          period: first.period
            ? { id: first.period.id, name: first.period.name, startTime: first.period.startTime, endTime: first.period.endTime }
            : null,
          room: first.room,
          conflicts: arr.map((s) => ({
            slotId: s.id,
            class: s.class ? { id: s.class.id, stream: s.class.stream } : null,
            subject: s.subject ? { id: s.subject.id, name: s.subject.name } : null,
            teacher: s.teacher ? { id: s.teacher.id, name: s.teacher.name } : null,
          })),
          reason: `Room "${first.room}" booked ${arr.length} times at same day/period`,
        });
      }
    }

    return {
      success: true,
      message:
        conflicts.length === 0
          ? `No conflicts (${slots.length} slots checked).`
          : `${conflicts.length} conflict(s) detected.`,
      valid: conflicts.length === 0,
      conflicts,
      count: conflicts.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute detailed conflicts." };
  }
};