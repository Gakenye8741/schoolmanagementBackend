// src/services/events/events.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, inArray, gte, lte, or, gt, isNotNull,
} from "drizzle-orm";

import {
  schoolEvents,
  coCurricularActivities,
  studentActivityMemberships,
  schools,
  users,
  students,
  academicTerms,
  TSelectSchoolEvent,
  TSelectCoCurricularActivity,
  TSelectStudentActivityMembership,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Types
// ================================================================
export type EventCategory =
  | "Academic" | "Sports" | "Cultural" | "Club"
  | "Meeting" | "Holiday" | "General" | "Other";

export interface EventsResponse {
  success: boolean;
  message: string;
  event?: TSelectSchoolEvent;
  events?: TSelectSchoolEvent[];
  activity?: TSelectCoCurricularActivity;
  activities?: TSelectCoCurricularActivity[];
  membership?: TSelectStudentActivityMembership;
  memberships?: TSelectStudentActivityMembership[];
  calendar?: Array<{
    month: string; // "2026-11"
    label: string; // "November 2026"
    events: Array<{
      id: string;
      title: string;
      category: string;
      startDate: string;
      endDate: string;
      location: string | null;
    }>;
  }>;
  stats?: Record<string, any>;
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const now = () => new Date();
const nowIso = () => now().toISOString();
const toIso = (d: Date | string) => new Date(d).toISOString();

const assertSchoolExists = async (schoolId: string) =>
  await db.query.schools.findFirst({ where: eq(schools.id, schoolId) });

const monthLabel = (yearMonth: string): string => {
  const [y, m] = yearMonth.split("-");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const idx = Number(m) - 1;
  return `${months[idx] ?? "?"} ${y}`;
};

// ================================================================
// SCHOOL EVENTS — 12 services
// ================================================================

// 1. Create
export const createSchoolEventService = async (
  data: {
    schoolId: string;
    title: string;
    description?: string | null;
    category: EventCategory;
    location?: string | null;
    startDate: string;
    endDate: string;
  },
  postedBy: string
): Promise<EventsResponse> => {
  try {
    const school = await assertSchoolExists(data.schoolId);
    if (!school) return { success: false, message: "School not found." };

    const [row] = await db
      .insert(schoolEvents)
      .values({
        schoolId: data.schoolId,
        title: data.title.trim(),
        description: data.description?.trim() ?? null,
        category: data.category,
        location: data.location?.trim() ?? null,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        postedBy,
      })
      .returning();

    return { success: true, message: `Event "${row.title}" created.`, event: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create event." };
  }
};

// 2. Bulk create
export const bulkCreateSchoolEventsService = async (
  data: {
    schoolId: string;
    events: Array<{
      title: string;
      description?: string | null;
      category: EventCategory;
      location?: string | null;
      startDate: string;
      endDate: string;
    }>;
  },
  postedBy: string
): Promise<EventsResponse> => {
  try {
    const school = await assertSchoolExists(data.schoolId);
    if (!school) return { success: false, message: "School not found." };

    const issues: string[] = [];
    const rows: TSelectSchoolEvent[] = [];

    await db.transaction(async (tx) => {
      for (const e of data.events) {
        try {
          const [row] = await tx
            .insert(schoolEvents)
            .values({
              schoolId: data.schoolId,
              title: e.title.trim(),
              description: e.description?.trim() ?? null,
              category: e.category,
              location: e.location?.trim() ?? null,
              startDate: new Date(e.startDate),
              endDate: new Date(e.endDate),
              postedBy,
            })
            .returning();
          rows.push(row);
        } catch (err: any) {
          issues.push(`${e.title}: ${err?.message ?? "insert failed"}`);
        }
      }
    });

    return {
      success: rows.length > 0,
      message: `Created ${rows.length} of ${data.events.length} event(s).`,
      events: rows,
      count: rows.length,
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk create events." };
  }
};

// 3. Get by ID
export const getSchoolEventByIdService = async (
  id: string
): Promise<EventsResponse> => {
  try {
    const row = await db.query.schoolEvents.findFirst({
      where: eq(schoolEvents.id, id),
      with: {
        school: { columns: { id: true, name: true } },
        postedByUser: { columns: { id: true, name: true } },
      },
    });
    if (!row) return { success: false, message: "Event not found." };
    return { success: true, message: "Event retrieved.", event: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch event." };
  }
};

// 4. List for school (filters: category, range, upcoming)
export const listSchoolEventsForSchoolService = async (
  schoolId: string,
  opts: {
    category?: EventCategory;
    from?: string;
    to?: string;
    upcomingOnly?: boolean;
    page: number;
    limit: number;
  }
): Promise<EventsResponse> => {
  try {
    const filters: any[] = [eq(schoolEvents.schoolId, schoolId)];
    if (opts.category) filters.push(eq(schoolEvents.category, opts.category));
    if (opts.from) filters.push(gte(schoolEvents.startDate, new Date(opts.from)));
    if (opts.to) filters.push(lte(schoolEvents.endDate, new Date(opts.to)));
    if (opts.upcomingOnly) filters.push(gte(schoolEvents.endDate, now()));

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.schoolEvents.findMany({
        where: and(...filters),
        with: { postedByUser: { columns: { id: true, name: true } } },
        orderBy: [asc(schoolEvents.startDate)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(schoolEvents).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} event(s) on this page.`,
      events: rows as any,
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list events." };
  }
};

// 5. Upcoming (within N days)
export const listUpcomingSchoolEventsService = async (
  schoolId: string,
  withinDays: number,
  limit: number
): Promise<EventsResponse> => {
  try {
    const cutoff = new Date(now().getTime() + withinDays * 86_400_000);

    const rows = await db.query.schoolEvents.findMany({
      where: and(
        eq(schoolEvents.schoolId, schoolId),
        gte(schoolEvents.endDate, now()),
        lte(schoolEvents.startDate, cutoff)
      ),
      orderBy: [asc(schoolEvents.startDate)],
      limit,
    });

    return {
      success: true,
      message: `${rows.length} upcoming event(s) within ${withinDays} day(s).`,
      events: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list upcoming events." };
  }
};

// 6. List by category
export const listSchoolEventsByCategoryService = async (
  schoolId: string,
  category: EventCategory
): Promise<EventsResponse> => {
  try {
    const rows = await db.query.schoolEvents.findMany({
      where: and(
        eq(schoolEvents.schoolId, schoolId),
        eq(schoolEvents.category, category)
      ),
      orderBy: [desc(schoolEvents.startDate)],
    });
    return {
      success: true,
      message: `${rows.length} ${category} event(s).`,
      events: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list events." };
  }
};

// 7. List events in a date range
export const listSchoolEventsInRangeService = async (
  schoolId: string,
  from: string,
  to: string
): Promise<EventsResponse> => {
  try {
    const rows = await db.query.schoolEvents.findMany({
      where: and(
        eq(schoolEvents.schoolId, schoolId),
        gte(schoolEvents.endDate, new Date(from)),
        lte(schoolEvents.startDate, new Date(to))
      ),
      orderBy: [asc(schoolEvents.startDate)],
    });
    return {
      success: true,
      message: `${rows.length} event(s) in range.`,
      events: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list events in range." };
  }
};

// 8. Today's events
export const getSchoolEventsTodayService = async (
  schoolId: string
): Promise<EventsResponse> => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const rows = await db.query.schoolEvents.findMany({
      where: and(
        eq(schoolEvents.schoolId, schoolId),
        lte(schoolEvents.startDate, end),
        gte(schoolEvents.endDate, start)
      ),
      orderBy: [asc(schoolEvents.startDate)],
    });

    return {
      success: true,
      message: `${rows.length} event(s) today.`,
      events: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load today's events." };
  }
};

// 9. Update
export const updateSchoolEventService = async (
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    category?: EventCategory;
    location?: string | null;
    startDate?: string;
    endDate?: string;
  }
): Promise<EventsResponse> => {
  try {
    const existing = await db.query.schoolEvents.findFirst({
      where: eq(schoolEvents.id, id),
    });
    if (!existing) return { success: false, message: "Event not found." };

    const newStart = patch.startDate ? new Date(patch.startDate) : new Date(existing.startDate);
    const newEnd = patch.endDate ? new Date(patch.endDate) : new Date(existing.endDate);
    if (newEnd < newStart) {
      return { success: false, message: "endDate must be on or after startDate." };
    }

    const [row] = await db
      .update(schoolEvents)
      .set({
        ...(patch.title !== undefined && { title: patch.title.trim() }),
        ...(patch.description !== undefined && {
          description: patch.description?.trim() ?? null,
        }),
        ...(patch.category !== undefined && { category: patch.category }),
        ...(patch.location !== undefined && { location: patch.location?.trim() ?? null }),
        ...(patch.startDate !== undefined && { startDate: newStart }),
        ...(patch.endDate !== undefined && { endDate: newEnd }),
      })
      .where(eq(schoolEvents.id, id))
      .returning();

    return { success: true, message: "Event updated.", event: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update event." };
  }
};

// 10. Delete
export const deleteSchoolEventService = async (
  id: string
): Promise<EventsResponse> => {
  try {
    const [row] = await db.delete(schoolEvents).where(eq(schoolEvents.id, id)).returning();
    if (!row) return { success: false, message: "Event not found." };
    return { success: true, message: "Event deleted.", event: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete event." };
  }
};

// 11. Calendar view (grouped by month)
export const getSchoolEventsCalendarService = async (
  schoolId: string,
  opts: { from?: string; to?: string } = {}
): Promise<EventsResponse> => {
  try {
    const filters: any[] = [eq(schoolEvents.schoolId, schoolId)];
    if (opts.from) filters.push(gte(schoolEvents.endDate, new Date(opts.from)));
    if (opts.to) filters.push(lte(schoolEvents.startDate, new Date(opts.to)));

    const rows = await db.query.schoolEvents.findMany({
      where: and(...filters),
      orderBy: [asc(schoolEvents.startDate)],
    });

    const grouped = new Map<string, TSelectSchoolEvent[]>();
    for (const e of rows) {
      const ym = toIso(e.startDate).slice(0, 7); // "YYYY-MM"
      const arr = grouped.get(ym) ?? [];
      arr.push(e);
      grouped.set(ym, arr);
    }

    const calendar = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, events]) => ({
        month,
        label: monthLabel(month),
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          startDate: toIso(e.startDate),
          endDate: toIso(e.endDate),
          location: e.location,
        })),
      }));

    return {
      success: true,
      message: `Calendar across ${calendar.length} month(s).`,
      calendar,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build calendar." };
  }
};

// 12. Stats
export const getSchoolEventStatsService = async (
  schoolId: string
): Promise<EventsResponse> => {
  try {
    const [total] = await db
      .select({ c: count() })
      .from(schoolEvents)
      .where(eq(schoolEvents.schoolId, schoolId));

    const [upcoming] = await db
      .select({ c: count() })
      .from(schoolEvents)
      .where(and(eq(schoolEvents.schoolId, schoolId), gte(schoolEvents.endDate, now())));

    const byCategory = await db
      .select({ category: schoolEvents.category, c: count() })
      .from(schoolEvents)
      .where(eq(schoolEvents.schoolId, schoolId))
      .groupBy(schoolEvents.category);

    return {
      success: true,
      message: `${total?.c ?? 0} event(s), ${upcoming?.c ?? 0} upcoming.`,
      stats: {
        total: Number(total?.c ?? 0),
        upcoming: Number(upcoming?.c ?? 0),
        past: Number(total?.c ?? 0) - Number(upcoming?.c ?? 0),
        byCategory: byCategory.reduce<Record<string, number>>((acc, r) => {
          acc[r.category] = Number(r.c);
          return acc;
        }, {}),
      },
      count: Number(total?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute stats." };
  }
};

// ================================================================
// CO-CURRICULAR ACTIVITIES — 10 services
// ================================================================

// 13. Create activity
export const createActivityService = async (data: {
  schoolId: string;
  name: string;
  category: string;
  patronTeacherId?: string | null;
}): Promise<EventsResponse> => {
  try {
    const school = await assertSchoolExists(data.schoolId);
    if (!school) return { success: false, message: "School not found." };

    if (data.patronTeacherId) {
      const teacher = await db.query.users.findFirst({
        where: and(
          eq(users.id, data.patronTeacherId),
          eq(users.schoolId, data.schoolId),
          isNull(users.deletedAt)
        ),
      });
      if (!teacher) return { success: false, message: "Patron teacher not found in this school." };
    }

    const [row] = await db
      .insert(coCurricularActivities)
      .values({
        schoolId: data.schoolId,
        name: data.name.trim(),
        category: data.category.trim(),
        patronTeacherId: data.patronTeacherId ?? null,
      })
      .returning();

    return { success: true, message: `Activity "${row.name}" created.`, activity: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create activity." };
  }
};

// 14. Get by ID
export const getActivityByIdService = async (
  id: string
): Promise<EventsResponse> => {
  try {
    const row = await db.query.coCurricularActivities.findFirst({
      where: eq(coCurricularActivities.id, id),
      with: {
        school: { columns: { id: true, name: true } },
        patronTeacher: { columns: { id: true, name: true, email: true } },
      },
    });
    if (!row) return { success: false, message: "Activity not found." };
    return { success: true, message: "Activity retrieved.", activity: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch activity." };
  }
};

// 15. List for school
export const listActivitiesForSchoolService = async (
  schoolId: string,
  opts: { category?: string; page: number; limit: number }
): Promise<EventsResponse> => {
  try {
    const filters: any[] = [eq(coCurricularActivities.schoolId, schoolId)];
    if (opts.category) filters.push(eq(coCurricularActivities.category, opts.category));

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.coCurricularActivities.findMany({
        where: and(...filters),
        with: { patronTeacher: { columns: { id: true, name: true } } },
        orderBy: [asc(coCurricularActivities.name)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(coCurricularActivities).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} activity/activities on this page.`,
      activities: rows as any,
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list activities." };
  }
};

// 16. List by category
export const listActivitiesByCategoryService = async (
  schoolId: string,
  category: string
): Promise<EventsResponse> => {
  try {
    const rows = await db.query.coCurricularActivities.findMany({
      where: and(
        eq(coCurricularActivities.schoolId, schoolId),
        eq(coCurricularActivities.category, category)
      ),
      orderBy: [asc(coCurricularActivities.name)],
    });
    return {
      success: true,
      message: `${rows.length} activity/activities in "${category}".`,
      activities: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list activities." };
  }
};

// 17. List by patron
export const listActivitiesByPatronService = async (
  teacherId: string
): Promise<EventsResponse> => {
  try {
    const rows = await db.query.coCurricularActivities.findMany({
      where: eq(coCurricularActivities.patronTeacherId, teacherId),
      orderBy: [asc(coCurricularActivities.name)],
    });
    return {
      success: true,
      message: `${rows.length} activity/activities under this patron.`,
      activities: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list activities." };
  }
};

// 18. Update activity
export const updateActivityService = async (
  id: string,
  patch: { name?: string; category?: string; patronTeacherId?: string | null }
): Promise<EventsResponse> => {
  try {
    const existing = await db.query.coCurricularActivities.findFirst({
      where: eq(coCurricularActivities.id, id),
    });
    if (!existing) return { success: false, message: "Activity not found." };

    if (patch.patronTeacherId) {
      const teacher = await db.query.users.findFirst({
        where: and(
          eq(users.id, patch.patronTeacherId),
          eq(users.schoolId, existing.schoolId),
          isNull(users.deletedAt)
        ),
      });
      if (!teacher) return { success: false, message: "Patron teacher not found in this school." };
    }

    const [row] = await db
      .update(coCurricularActivities)
      .set({
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.category !== undefined && { category: patch.category.trim() }),
        ...(patch.patronTeacherId !== undefined && {
          patronTeacherId: patch.patronTeacherId,
        }),
      })
      .where(eq(coCurricularActivities.id, id))
      .returning();

    return { success: true, message: "Activity updated.", activity: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update activity." };
  }
};

// 19. Assign / unassign patron
export const assignPatronService = async (
  id: string,
  patronTeacherId: string | null
): Promise<EventsResponse> => {
  try {
    const existing = await db.query.coCurricularActivities.findFirst({
      where: eq(coCurricularActivities.id, id),
    });
    if (!existing) return { success: false, message: "Activity not found." };

    if (patronTeacherId) {
      const teacher = await db.query.users.findFirst({
        where: and(
          eq(users.id, patronTeacherId),
          eq(users.schoolId, existing.schoolId),
          isNull(users.deletedAt)
        ),
      });
      if (!teacher) return { success: false, message: "Patron teacher not found in this school." };
    }

    const [row] = await db
      .update(coCurricularActivities)
      .set({ patronTeacherId })
      .where(eq(coCurricularActivities.id, id))
      .returning();

    return {
      success: true,
      message: patronTeacherId ? "Patron assigned." : "Patron unassigned.",
      activity: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to assign patron." };
  }
};

// 20. Delete activity (cascades to memberships)
export const deleteActivityService = async (
  id: string
): Promise<EventsResponse> => {
  try {
    const [row] = await db
      .delete(coCurricularActivities)
      .where(eq(coCurricularActivities.id, id))
      .returning();
    if (!row) return { success: false, message: "Activity not found." };
    return { success: true, message: "Activity deleted.", activity: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete activity." };
  }
};

// 21. List distinct categories (useful for filters / UI)
export const listActivityCategoriesService = async (
  schoolId: string
): Promise<EventsResponse> => {
  try {
    const rows = await db
      .selectDistinct({ category: coCurricularActivities.category })
      .from(coCurricularActivities)
      .where(eq(coCurricularActivities.schoolId, schoolId))
      .orderBy(asc(coCurricularActivities.category));

    return {
      success: true,
      message: `${rows.length} distinct categor${rows.length === 1 ? "y" : "ies"}.`,
      stats: { categories: rows.map((r) => r.category) },
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list categories." };
  }
};

// 22. Activity stats (member count + roles)
export const getActivityStatsService = async (
  id: string
): Promise<EventsResponse> => {
  try {
    const activity = await db.query.coCurricularActivities.findFirst({
      where: eq(coCurricularActivities.id, id),
    });
    if (!activity) return { success: false, message: "Activity not found." };

    const [total] = await db
      .select({ c: count() })
      .from(studentActivityMemberships)
      .where(eq(studentActivityMemberships.activityId, id));

    const byTerm = await db
      .select({ termId: studentActivityMemberships.termId, c: count() })
      .from(studentActivityMemberships)
      .where(eq(studentActivityMemberships.activityId, id))
      .groupBy(studentActivityMemberships.termId);

    return {
      success: true,
      message: `${total?.c ?? 0} membership(s) across ${byTerm.length} term(s).`,
      stats: {
        totalMemberships: Number(total?.c ?? 0),
        byTerm: byTerm.reduce<Record<string, number>>((acc, r) => {
          acc[r.termId] = Number(r.c);
          return acc;
        }, {}),
      },
      count: Number(total?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute stats." };
  }
};

// ================================================================
// STUDENT ACTIVITY MEMBERSHIPS — 10 services
// ================================================================

// 23. Add one student (upsert on studentId+activityId+termId)
export const addStudentToActivityService = async (data: {
  schoolId: string;
  studentId: string;
  activityId: string;
  termId: string;
  performanceRole?: string | null;
}): Promise<EventsResponse> => {
  try {
    const [student, activity, term] = await Promise.all([
      db.query.students.findFirst({
        where: and(eq(students.id, data.studentId), eq(students.schoolId, data.schoolId)),
      }),
      db.query.coCurricularActivities.findFirst({
        where: and(
          eq(coCurricularActivities.id, data.activityId),
          eq(coCurricularActivities.schoolId, data.schoolId)
        ),
      }),
      db.query.academicTerms.findFirst({
        where: and(eq(academicTerms.id, data.termId), eq(academicTerms.schoolId, data.schoolId)),
      }),
    ]);

    if (!student) return { success: false, message: "Student not found in this school." };
    if (!activity) return { success: false, message: "Activity not found in this school." };
    if (!term) return { success: false, message: "Term not found in this school." };

    const [row] = await db
      .insert(studentActivityMemberships)
      .values({
        schoolId: data.schoolId,
        studentId: data.studentId,
        activityId: data.activityId,
        termId: data.termId,
        performanceRole: data.performanceRole?.trim() ?? null,
      })
      .onConflictDoUpdate({
        target: [
          studentActivityMemberships.studentId,
          studentActivityMemberships.activityId,
          studentActivityMemberships.termId,
        ],
        set: {
          performanceRole: data.performanceRole?.trim() ?? null,
        },
      })
      .returning();

    return { success: true, message: "Student added to activity.", membership: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to add student." };
  }
};

// 24. Bulk add (all student IDs must belong to the school)
export const bulkAddStudentsToActivityService = async (data: {
  schoolId: string;
  activityId: string;
  termId: string;
  studentIds: string[];
  performanceRole?: string | null;
}): Promise<EventsResponse> => {
  try {
    const activity = await db.query.coCurricularActivities.findFirst({
      where: and(
        eq(coCurricularActivities.id, data.activityId),
        eq(coCurricularActivities.schoolId, data.schoolId)
      ),
    });
    if (!activity) return { success: false, message: "Activity not found in this school." };

    const term = await db.query.academicTerms.findFirst({
      where: and(eq(academicTerms.id, data.termId), eq(academicTerms.schoolId, data.schoolId)),
    });
    if (!term) return { success: false, message: "Term not found in this school." };

    // Validate all students belong to the school
    const validStudents = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, data.schoolId),
        inArray(students.id, data.studentIds)
      ),
      columns: { id: true },
    });
    const validIds = new Set(validStudents.map((s) => s.id));
    const invalidIds = data.studentIds.filter((id) => !validIds.has(id));

    if (validIds.size === 0) {
      return {
        success: false,
        message: "None of the provided student IDs belong to this school.",
        issues: invalidIds.slice(0, 20),
      };
    }

    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(studentActivityMemberships)
        .values(
          [...validIds].map((sid) => ({
            schoolId: data.schoolId,
            studentId: sid,
            activityId: data.activityId,
            termId: data.termId,
            performanceRole: data.performanceRole?.trim() ?? null,
          }))
        )
        .onConflictDoUpdate({
          target: [
            studentActivityMemberships.studentId,
            studentActivityMemberships.activityId,
            studentActivityMemberships.termId,
          ],
          set: {
            performanceRole: data.performanceRole?.trim() ?? null,
          },
        })
        .returning();
      return inserted;
    });

    return {
      success: true,
      message: `Added/updated ${result.length} student(s).${
        invalidIds.length ? ` ${invalidIds.length} skipped (not in this school).` : ""
      }`,
      memberships: result,
      count: result.length,
      issues: invalidIds.length ? invalidIds.slice(0, 20) : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk add students." };
  }
};

// 25. Get membership by ID
export const getMembershipByIdService = async (
  id: string
): Promise<EventsResponse> => {
  try {
    const row = await db.query.studentActivityMemberships.findFirst({
      where: eq(studentActivityMemberships.id, id),
      with: {
        student: { columns: { id: true, admissionNumber: true, firstName: true, lastName: true } },
        activity: { columns: { id: true, name: true, category: true } },
        term: { columns: { id: true, termName: true, academicYear: true } },
      },
    });
    if (!row) return { success: false, message: "Membership not found." };
    return { success: true, message: "Membership retrieved.", membership: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch membership." };
  }
};

// 26. List activities for a student
export const listActivitiesForStudentService = async (
  studentId: string,
  termId?: string
): Promise<EventsResponse> => {
  try {
    const filters: any[] = [eq(studentActivityMemberships.studentId, studentId)];
    if (termId) filters.push(eq(studentActivityMemberships.termId, termId));

    const rows = await db.query.studentActivityMemberships.findMany({
      where: and(...filters),
      with: {
        activity: { columns: { id: true, name: true, category: true } },
        term: { columns: { id: true, termName: true, academicYear: true } },
      },
      orderBy: [desc(studentActivityMemberships.schoolId)],
    });

    return {
      success: true,
      message: `${rows.length} activity/activities for this student.`,
      memberships: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list student activities." };
  }
};

// 27. List memberships for an activity
export const listMembershipsForActivityService = async (
  activityId: string,
  opts: { termId?: string; page: number; limit: number }
): Promise<EventsResponse> => {
  try {
    const filters: any[] = [eq(studentActivityMemberships.activityId, activityId)];
    if (opts.termId) filters.push(eq(studentActivityMemberships.termId, opts.termId));

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.studentActivityMemberships.findMany({
        where: and(...filters),
        with: {
          student: {
            columns: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
              classId: true,
            },
          },
          term: { columns: { id: true, termName: true, academicYear: true } },
        },
        orderBy: [asc(studentActivityMemberships.schoolId)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(studentActivityMemberships).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} member(s) on this page.`,
      memberships: rows as any,
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list members." };
  }
};

// 28. List memberships for a term (school-wide)
export const listMembershipsForTermService = async (
  schoolId: string,
  termId: string,
  opts: { page: number; limit: number }
): Promise<EventsResponse> => {
  try {
    const offset = (opts.page - 1) * opts.limit;
    const filters = and(
      eq(studentActivityMemberships.schoolId, schoolId),
      eq(studentActivityMemberships.termId, termId)
    );

    const [rows, [totals]] = await Promise.all([
      db.query.studentActivityMemberships.findMany({
        where: filters,
        with: {
          student: { columns: { id: true, firstName: true, lastName: true } },
          activity: { columns: { id: true, name: true, category: true } },
        },
        orderBy: [asc(studentActivityMemberships.activityId)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(studentActivityMemberships).where(filters),
    ]);

    return {
      success: true,
      message: `${rows.length} membership(s) on this page.`,
      memberships: rows as any,
      count: Number(totals?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list memberships." };
  }
};

// 29. Update performance role
export const updateMembershipRoleService = async (
  id: string,
  performanceRole: string | null
): Promise<EventsResponse> => {
  try {
    const existing = await db.query.studentActivityMemberships.findFirst({
      where: eq(studentActivityMemberships.id, id),
    });
    if (!existing) return { success: false, message: "Membership not found." };

    const [row] = await db
      .update(studentActivityMemberships)
      .set({ performanceRole: performanceRole?.trim() ?? null })
      .where(eq(studentActivityMemberships.id, id))
      .returning();

    return { success: true, message: "Performance role updated.", membership: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update role." };
  }
};

// 30. Remove one student from an activity (by membership ID)
export const removeStudentFromActivityService = async (
  id: string
): Promise<EventsResponse> => {
  try {
    const [row] = await db
      .delete(studentActivityMemberships)
      .where(eq(studentActivityMemberships.id, id))
      .returning();
    if (!row) return { success: false, message: "Membership not found." };
    return { success: true, message: "Student removed from activity.", membership: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to remove student." };
  }
};

// 31. List students NOT in an activity (for the "add members" picker)
export const listStudentsNotInActivityService = async (
  schoolId: string,
  activityId: string,
  termId: string
): Promise<EventsResponse> => {
  try {
    const activity = await db.query.coCurricularActivities.findFirst({
      where: and(
        eq(coCurricularActivities.id, activityId),
        eq(coCurricularActivities.schoolId, schoolId)
      ),
    });
    if (!activity) return { success: false, message: "Activity not found in this school." };

    const inActivity = await db.query.studentActivityMemberships.findMany({
      where: and(
        eq(studentActivityMemberships.activityId, activityId),
        eq(studentActivityMemberships.termId, termId)
      ),
      columns: { studentId: true },
    });
    const excluded = new Set(inActivity.map((m) => m.studentId));

    const allStudents = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
      columns: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        classId: true,
      },
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });

    const notIn = allStudents.filter((s) => !excluded.has(s.id));

    return {
      success: true,
      message: `${notIn.length} student(s) not yet in this activity.`,
      stats: { students: notIn },
      count: notIn.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list eligible students." };
  }
};

// 32. Student activity summary (count + breakdown)
export const getStudentActivitySummaryService = async (
  studentId: string,
  termId?: string
): Promise<EventsResponse> => {
  try {
    const filters: any[] = [eq(studentActivityMemberships.studentId, studentId)];
    if (termId) filters.push(eq(studentActivityMemberships.termId, termId));

    const rows = await db.query.studentActivityMemberships.findMany({
      where: and(...filters),
      with: {
        activity: { columns: { id: true, name: true, category: true } },
        term: { columns: { id: true, termName: true, academicYear: true } },
      },
    });

    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      const cat = (r as any).activity?.category ?? "Unknown";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }

    return {
      success: true,
      message: `${rows.length} activity/activities across ${Object.keys(byCategory).length} categor${Object.keys(byCategory).length === 1 ? "y" : "ies"}.`,
      stats: {
        totalActivities: rows.length,
        byCategory,
        activities: rows.map((r) => ({
          membershipId: r.id,
          activityId: r.activityId,
          activityName: (r as any).activity?.name,
          category: (r as any).activity?.category,
          termId: r.termId,
          performanceRole: r.performanceRole,
        })),
      },
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute summary." };
  }
};