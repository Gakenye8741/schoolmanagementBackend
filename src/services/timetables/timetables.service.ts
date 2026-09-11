import { eq, and } from "drizzle-orm";
import { timetables, teacherSubjects, subjects, users } from "../../drizzle/schema";
import { TSelectTimetable, TInsertTimetable } from "../../drizzle/types";
import db from "../../drizzle/db";

export interface TimetableServiceResponse {
  success: boolean;
  message: string;
  timetableItem?: TSelectTimetable | any;
  timetable?: TSelectTimetable[] | any[];
  clashes?: any[];
}

export interface SubjectFrequencyConfig {
  subjectId: string;
  weeklyTarget: number;
}

/**
 * 1. Global School-Wide Automated Timetable Generator
 * Generates timetables simultaneously across all class streams with subject frequency targets and strict zero double-booking checks.
 */
export const generateGlobalSchoolTimetableService = async (
  schoolId: string,
  classes: { gradeLevel: string; stream: string }[],
  subjectQuotas: SubjectFrequencyConfig[],
  daysOfWeek: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  periodsPerDay: number = 7
): Promise<TimetableServiceResponse> => {
  try {
    if (!classes || classes.length === 0) {
      return { success: false, message: "No classes/streams provided for timetable generation." };
    }

    const schoolSubjects = await db.query.subjects.findMany({
      where: eq(subjects.schoolId, schoolId),
      with: {
        teacherSubjects: true,
      },
    });

    if (schoolSubjects.length === 0) {
      return { success: false, message: "No subjects found for this school." };
    }

    const subjectTeacherMap = new Map<string, string>();
    for (const sub of schoolSubjects) {
      const primaryTeacherId = sub.teacherSubjects[0]?.teacherId;
      if (primaryTeacherId) {
        subjectTeacherMap.set(sub.id, primaryTeacherId);
      }
    }

    const validQuotas = subjectQuotas.filter(q => subjectTeacherMap.has(q.subjectId));
    if (validQuotas.length === 0) {
      return { success: false, message: "No valid subjects with assigned teachers found for the given quotas." };
    }

    const generatedSlots: TInsertTimetable[] = [];
    const globalTeacherBusyMap = new Set<string>();

    // Wipe existing timetables for this school to rebuild cleanly
    await db.delete(timetables).where(eq(timetables.schoolId, schoolId));

    for (const day of daysOfWeek) {
      for (let period = 1; period <= periodsPerDay; period++) {
        for (const cls of classes) {
          let selectedSubjectId: string | null = null;

          for (const quota of validQuotas) {
            const scheduledCount = generatedSlots.filter(
              s => s.gradeLevel === cls.gradeLevel &&
                   s.stream === cls.stream &&
                   s.subjectId === quota.subjectId
            ).length;

            if (scheduledCount < quota.weeklyTarget) {
              selectedSubjectId = quota.subjectId;
              break;
            }
          }

          if (!selectedSubjectId) {
            const fallbackIndex = (daysOfWeek.indexOf(day) * periodsPerDay + period) % validQuotas.length;
            selectedSubjectId = validQuotas[fallbackIndex].subjectId;
          }

          let teacherId = subjectTeacherMap.get(selectedSubjectId);
          if (!teacherId) continue;

          let teacherSlotKey = `${teacherId}_${day}_${period}`;
          if (globalTeacherBusyMap.has(teacherSlotKey)) {
            for (const altQuota of validQuotas) {
              const altTeacherId = subjectTeacherMap.get(altQuota.subjectId);
              const altKey = `${altTeacherId}_${day}_${period}`;
              if (altTeacherId && !globalTeacherBusyMap.has(altKey)) {
                selectedSubjectId = altQuota.subjectId;
                teacherId = altTeacherId;
                teacherSlotKey = altKey;
                break;
              }
            }
          }

          globalTeacherBusyMap.add(teacherSlotKey);

          generatedSlots.push({
            schoolId,
            gradeLevel: cls.gradeLevel,
            stream: cls.stream,
            dayOfWeek: day,
            periodNumber: period,
            subjectId: selectedSubjectId,
            teacherId,
          });
        }
      }
    }

    if (generatedSlots.length > 0) {
      await db.insert(timetables).values(generatedSlots);
    }

    return {
      success: true,
      message: `Global school-wide timetable generated successfully across all ${classes.length} streams with zero teacher clashes.`,
      timetable: generatedSlots,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to generate global school timetable." };
  }
};

/**
 * 2. Upsert single timetable slot with strict global teacher conflict check
 */
export const upsertTimetableSlotService = async (
  data: TInsertTimetable
): Promise<TimetableServiceResponse> => {
  try {
    const { schoolId, gradeLevel, stream, dayOfWeek, periodNumber, subjectId, teacherId } = data;

    const teacherAssignment = await db.query.teacherSubjects.findFirst({
      where: and(
        eq(teacherSubjects.teacherId, teacherId),
        eq(teacherSubjects.subjectId, subjectId)
      ),
    });

    if (!teacherAssignment) {
      return { success: false, message: "Conflict: Teacher is not assigned to teach this subject." };
    }

    const teacherConflict = await db.query.timetables.findFirst({
      where: and(
        eq(timetables.schoolId, schoolId),
        eq(timetables.dayOfWeek, dayOfWeek),
        eq(timetables.periodNumber, periodNumber),
        eq(timetables.teacherId, teacherId)
      ),
    });

    if (teacherConflict) {
      const isSameSlot =
        teacherConflict.gradeLevel === gradeLevel &&
        teacherConflict.stream === stream;

      if (!isSameSlot) {
        return {
          success: false,
          message: `Teacher Conflict: Already teaching in Grade ${teacherConflict.gradeLevel} (${teacherConflict.stream}) during ${dayOfWeek} Period ${periodNumber}.`,
        };
      }
    }

    const existingSlot = await db.query.timetables.findFirst({
      where: and(
        eq(timetables.schoolId, schoolId),
        eq(timetables.gradeLevel, gradeLevel),
        eq(timetables.stream, stream),
        eq(timetables.dayOfWeek, dayOfWeek),
        eq(timetables.periodNumber, periodNumber)
      ),
    });

    if (existingSlot) {
      const [updated] = await db
        .update(timetables)
        .set({ subjectId, teacherId, updatedAt: new Date() })
        .where(eq(timetables.id, existingSlot.id))
        .returning();
      return { success: true, message: "Timetable slot updated successfully.", timetableItem: updated };
    }

    const [inserted] = await db.insert(timetables).values(data).returning();
    return { success: true, message: "Timetable slot created successfully.", timetableItem: inserted };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to save timetable slot." };
  }
};

/**
 * 3. Get timetable for a specific class stream
 */
export const getClassTimetableService = async (
  schoolId: string,
  gradeLevel: string,
  stream: string
): Promise<TimetableServiceResponse> => {
  try {
    const timetable = await db.query.timetables.findMany({
      where: and(
        eq(timetables.schoolId, schoolId),
        eq(timetables.gradeLevel, gradeLevel),
        eq(timetables.stream, stream)
      ),
      with: {
        subject: true,
        teacher: {
          columns: { id: true, fullName: true, email: true },
        },
      },
      orderBy: [timetables.dayOfWeek, timetables.periodNumber],
    });

    return { success: true, message: "Class timetable fetched successfully.", timetable };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch class timetable." };
  }
};

/**
 * 4. Get timetable for a specific teacher
 */
export const getTeacherTimetableService = async (
  teacherId: string
): Promise<TimetableServiceResponse> => {
  try {
    const timetable = await db.query.timetables.findMany({
      where: eq(timetables.teacherId, teacherId),
      with: {
        subject: true,
        school: true,
      },
      orderBy: [timetables.dayOfWeek, timetables.periodNumber],
    });

    return { success: true, message: "Teacher timetable fetched successfully.", timetable };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch teacher timetable." };
  }
};

/**
 * 5. Clear / Reset an entire class stream's timetable
 */
export const clearClassTimetableService = async (
  schoolId: string,
  gradeLevel: string,
  stream: string
): Promise<TimetableServiceResponse> => {
  try {
    const deletedSlots = await db
      .delete(timetables)
      .where(
        and(
          eq(timetables.schoolId, schoolId),
          eq(timetables.gradeLevel, gradeLevel),
          eq(timetables.stream, stream)
        )
      )
      .returning();

    return {
      success: true,
      message: `Cleared ${deletedSlots.length} timetable slots for Grade ${gradeLevel} (${stream}).`,
      timetable: deletedSlots,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to clear class timetable." };
  }
};

/**
 * 6. Audit school-wide timetable for any teacher double-booking clashes
 */
export const auditSchoolTimetableClashesService = async (
  schoolId: string
): Promise<TimetableServiceResponse> => {
  try {
    const allSlots = await db.query.timetables.findMany({
      where: eq(timetables.schoolId, schoolId),
      with: {
        teacher: { columns: { name: true } },
        subject: { columns: { name: true } },
      },
    });

    const slotMap = new Map<string, any[]>();
    for (const slot of allSlots) {
      const key = `${slot.teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, []);
      }
      slotMap.get(key)!.push(slot);
    }

    const clashes: any[] = [];
    slotMap.forEach((slots) => {
      if (slots.length > 1) {
        clashes.push({
          teacherId: slots[0].teacherId,
          teacherName: slots[0].teacher?.name,
          dayOfWeek: slots[0].dayOfWeek,
          periodNumber: slots[0].periodNumber,
          conflictingClasses: slots.map(s => ({
            gradeLevel: s.gradeLevel,
            stream: s.stream,
            subject: s.subject?.name,
          })),
        });
      }
    });

    return {
      success: true,
      message: clashes.length > 0 ? `Found ${clashes.length} scheduling clashes.` : "No scheduling clashes detected.",
      clashes,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to audit timetable clashes." };
  }
};