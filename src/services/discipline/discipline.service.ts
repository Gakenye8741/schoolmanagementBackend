// src/services/discipline/discipline.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, inArray, gte, lte,
} from "drizzle-orm";

import {
  disciplinaryRecords,
  students,
  studentGuardians,
  users,
  notifications,
  classes,
  TSelectDisciplinaryRecord,
  TSelectStudent,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Input types
// ================================================================
export type IncidentType = "Merit" | "Warning" | "Late-coming" | "Detention" | "Suspension";

export interface RecordIncidentInput {
  schoolId: string;
  studentId: string;
  recordedBy: string;
  incidentType: IncidentType;
  description: string;
  actionTaken?: string | null;
  parentNotified?: boolean;
  date?: string | null;
  notify?: boolean;
}

export interface BulkRecordIncidentsInput {
  schoolId: string;
  recordedBy: string;
  incidents: Array<{
    studentId: string;
    incidentType: IncidentType;
    description: string;
    actionTaken?: string | null;
    date?: string | null;
  }>;
  notify?: boolean;
}

export interface UpdateIncidentInput {
  incidentType?: IncidentType;
  description?: string;
  actionTaken?: string | null;
  parentNotified?: boolean;
  date?: string | null;
}

// ================================================================
// Response envelope
// ================================================================
export interface DisciplineResponse {
  success: boolean;
  message: string;
  record?: TSelectDisciplinaryRecord;
  records?: TSelectDisciplinaryRecord[];
  summary?: {
    studentId: string;
    totalIncidents: number;
    byType: Record<string, number>;
    merits: number;
    warnings: number;
    detentions: number;
    suspensions: number;
    latestIncident: string | null;
  };
  stats?: Record<string, any>;
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const isValidIncidentType = (t: string): t is IncidentType =>
  ["Merit", "Warning", "Late-coming", "Detention", "Suspension"].includes(t);

/**
 * Notify the guardians of a student about a discipline incident.
 * Uses the notifications table directly (best-effort, does not throw).
 */
const notifyGuardiansOfIncident = async (
  schoolId: string,
  studentId: string,
  incidentType: IncidentType,
  description: string,
  recordId: string
): Promise<number> => {
  try {
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
      columns: { firstName: true, lastName: true },
    });
    if (!student) return 0;

    const guardians = await db.query.studentGuardians.findMany({
      where: eq(studentGuardians.studentId, studentId),
      columns: { guardianUserId: true },
    });
    if (guardians.length === 0) return 0;

    const titleMap: Record<IncidentType, string> = {
      Merit: `Merit awarded to ${student.firstName}`,
      Warning: `Warning issued to ${student.firstName}`,
      "Late-coming": `${student.firstName} was late`,
      Detention: `${student.firstName} has been given detention`,
      Suspension: `${student.firstName} has been suspended`,
    };

    const values = guardians.map((g) => ({
      schoolId,
      userId: g.guardianUserId,
      type: "Discipline" as const,
      title: titleMap[incidentType],
      body: description.slice(0, 500),
      data: { incidentId: recordId, studentId, incidentType },
    }));

    let inserted = 0;
    for (let i = 0; i < values.length; i += 100) {
      const chunk = values.slice(i, i + 100);
      const res = await db.insert(notifications).values(chunk).returning({ id: notifications.id });
      inserted += res.length;
    }
    return inserted;
  } catch (e: any) {
    console.error("Discipline notification failed:", e?.message);
    return 0;
  }
};

// ================================================================
// 1. RECORD INCIDENT
// ================================================================
export const recordIncidentService = async (
  data: RecordIncidentInput
): Promise<DisciplineResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.studentId) return { success: false, message: "studentId is required." };
    if (!data.recordedBy) return { success: false, message: "recordedBy is required." };
    if (!data.incidentType || !isValidIncidentType(data.incidentType))
      return { success: false, message: "Invalid incident type." };
    if (!data.description || data.description.trim().length < 2)
      return { success: false, message: "Description must be at least 2 characters." };

    const student = await db.query.students.findFirst({
      where: and(
        eq(students.id, data.studentId),
        eq(students.schoolId, data.schoolId)
      ),
    });
    if (!student) return { success: false, message: "Student not found in this school." };

    const recordedByUser = await db.query.users.findFirst({
      where: and(eq(users.id, data.recordedBy), eq(users.schoolId, data.schoolId)),
    });
    if (!recordedByUser) return { success: false, message: "Recording user not found in this school." };

    const date = data.date ? new Date(data.date) : new Date();
    if (Number.isNaN(date.getTime()))
      return { success: false, message: "Invalid date." };

    const [row] = await db
      .insert(disciplinaryRecords)
      .values({
        schoolId: data.schoolId,
        studentId: data.studentId,
        recordedBy: data.recordedBy,
        incidentType: data.incidentType,
        description: data.description.trim(),
        actionTaken: data.actionTaken ?? null,
        parentNotified: data.parentNotified ?? false,
        date,
      })
      .returning();

    // Optional: notify parents
    let notified = 0;
    if (data.notify !== false) {
      notified = await notifyGuardiansOfIncident(
        data.schoolId,
        data.studentId,
        data.incidentType,
        row.description,
        row.id
      );

      if (notified > 0 && !row.parentNotified) {
        await db
          .update(disciplinaryRecords)
          .set({ parentNotified: true })
          .where(eq(disciplinaryRecords.id, row.id));
        row.parentNotified = true;
      }
    }

    return {
      success: true,
      message:
        `${data.incidentType} recorded for ${student.firstName} ${student.lastName}` +
        (notified > 0 ? ` — ${notified} guardian(s) notified.` : "."),
      record: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to record incident." };
  }
};

// ================================================================
// 2. BULK RECORD INCIDENTS
// ================================================================
export const bulkRecordIncidentsService = async (
  data: BulkRecordIncidentsInput
): Promise<DisciplineResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.recordedBy) return { success: false, message: "recordedBy is required." };
    if (!data.incidents || data.incidents.length === 0)
      return { success: false, message: "At least one incident is required." };

    const recordedByUser = await db.query.users.findFirst({
      where: and(eq(users.id, data.recordedBy), eq(users.schoolId, data.schoolId)),
    });
    if (!recordedByUser) return { success: false, message: "Recording user not found in this school." };

    const studentIds = [...new Set(data.incidents.map((i) => i.studentId))];
    const validStudents = await db.query.students.findMany({
      where: and(eq(students.schoolId, data.schoolId), inArray(students.id, studentIds)),
      columns: { id: true },
    });
    const validSet = new Set(validStudents.map((s) => s.id));

    const issues: string[] = [];
    const values: Array<{
      schoolId: string;
      studentId: string;
      recordedBy: string;
      incidentType: IncidentType;
      description: string;
      actionTaken: string | null;
      date: Date;
    }> = [];

    for (let i = 0; i < data.incidents.length; i++) {
      const inc = data.incidents[i];
      if (!validSet.has(inc.studentId)) {
        issues.push(`Row ${i + 1}: student not in this school`);
        continue;
      }
      if (!isValidIncidentType(inc.incidentType)) {
        issues.push(`Row ${i + 1}: invalid incident type`);
        continue;
      }
      if (!inc.description || inc.description.trim().length < 2) {
        issues.push(`Row ${i + 1}: description too short`);
        continue;
      }
      const date = inc.date ? new Date(inc.date) : new Date();
      if (Number.isNaN(date.getTime())) {
        issues.push(`Row ${i + 1}: invalid date`);
        continue;
      }
      values.push({
        schoolId: data.schoolId,
        studentId: inc.studentId,
        recordedBy: data.recordedBy,
        incidentType: inc.incidentType,
        description: inc.description.trim(),
        actionTaken: inc.actionTaken ?? null,
        date,
      });
    }

    if (values.length === 0) {
      return {
        success: false,
        message: `No valid incidents to record.${issues.length > 0 ? " " + issues.slice(0, 5).join("; ") : ""}`,
        issues,
      };
    }

    const inserted = await db.insert(disciplinaryRecords).values(values).returning();

    // Notify guardians for each (best effort)
    let totalNotified = 0;
    if (data.notify !== false) {
      for (const rec of inserted) {
        const n = await notifyGuardiansOfIncident(
          data.schoolId,
          rec.studentId,
          rec.incidentType as IncidentType,
          rec.description,
          rec.id
        );
        totalNotified += n;
      }
      if (totalNotified > 0) {
        const ids = inserted.map((r) => r.id);
        await db
          .update(disciplinaryRecords)
          .set({ parentNotified: true })
          .where(inArray(disciplinaryRecords.id, ids));
      }
    }

    return {
      success: true,
      message:
        `Recorded ${inserted.length} incident(s)${totalNotified > 0 ? ` — ${totalNotified} guardian notification(s) sent.` : "."}` +
        (issues.length > 0 ? ` ${issues.length} row(s) skipped.` : ""),
      records: inserted,
      count: inserted.length,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-record incidents." };
  }
};

// ================================================================
// 3. UPDATE INCIDENT
// ================================================================
export const updateIncidentService = async (
  id: string,
  patch: UpdateIncidentInput
): Promise<DisciplineResponse> => {
  try {
    const existing = await db.query.disciplinaryRecords.findFirst({
      where: eq(disciplinaryRecords.id, id),
    });
    if (!existing) return { success: false, message: "Incident not found." };

    if (patch.incidentType && !isValidIncidentType(patch.incidentType))
      return { success: false, message: "Invalid incident type." };

    const [row] = await db
      .update(disciplinaryRecords)
      .set({
        ...(patch.incidentType && { incidentType: patch.incidentType }),
        ...(patch.description !== undefined && { description: patch.description.trim() }),
        ...(patch.actionTaken !== undefined && { actionTaken: patch.actionTaken }),
        ...(patch.parentNotified !== undefined && { parentNotified: patch.parentNotified }),
        ...(patch.date !== undefined && { date: patch.date ? new Date(patch.date) : existing.date }),
      })
      .where(eq(disciplinaryRecords.id, id))
      .returning();
    return { success: true, message: "Incident updated.", record: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update incident." };
  }
};

// ================================================================
// 4. MARK PARENT NOTIFIED
// ================================================================
export const markParentNotifiedService = async (
  id: string
): Promise<DisciplineResponse> => {
  try {
    const [row] = await db
      .update(disciplinaryRecords)
      .set({ parentNotified: true })
      .where(eq(disciplinaryRecords.id, id))
      .returning();
    if (!row) return { success: false, message: "Incident not found." };
    return { success: true, message: "Marked as parent-notified.", record: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to mark parent notified." };
  }
};

// ================================================================
// 5. DELETE INCIDENT
// ================================================================
export const deleteIncidentService = async (id: string): Promise<DisciplineResponse> => {
  try {
    const [row] = await db
      .delete(disciplinaryRecords)
      .where(eq(disciplinaryRecords.id, id))
      .returning();
    if (!row) return { success: false, message: "Incident not found." };
    return { success: true, message: "Incident deleted.", record: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete incident." };
  }
};

// ================================================================
// 6. GET INCIDENT BY ID
// ================================================================
export const getIncidentByIdService = async (
  id: string
): Promise<DisciplineResponse> => {
  try {
    const row = await db.query.disciplinaryRecords.findFirst({
      where: eq(disciplinaryRecords.id, id),
      with: { student: true, recordedByUser: true },
    });
    if (!row) return { success: false, message: "Incident not found." };
    return { success: true, message: "Incident retrieved.", record: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch incident." };
  }
};

// ================================================================
// 7. LIST FOR STUDENT
// ================================================================
export const listIncidentsForStudentService = async (
  studentId: string,
  opts?: { fromDate?: string; toDate?: string; type?: IncidentType }
): Promise<DisciplineResponse> => {
  try {
    const filters: any[] = [eq(disciplinaryRecords.studentId, studentId)];
    if (opts?.fromDate) filters.push(gte(disciplinaryRecords.date, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(disciplinaryRecords.date, new Date(opts.toDate)));
    if (opts?.type) filters.push(eq(disciplinaryRecords.incidentType, opts.type));

    const rows = await db.query.disciplinaryRecords.findMany({
      where: and(...filters),
      orderBy: [desc(disciplinaryRecords.date)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} incident(s).`,
      records: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list student incidents." };
  }
};

// ================================================================
// 8. LIST FOR CLASS
// ================================================================
export const listIncidentsForClassService = async (
  classId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<DisciplineResponse> => {
  try {
    const roster = await db.query.students.findMany({
      where: and(eq(students.classId, classId), isNull(students.deletedAt)),
      columns: { id: true },
    });
    if (roster.length === 0)
      return { success: true, message: "No students in this class.", count: 0 };

    const ids = roster.map((s) => s.id);
    const filters: any[] = [inArray(disciplinaryRecords.studentId, ids)];
    if (opts?.fromDate) filters.push(gte(disciplinaryRecords.date, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(disciplinaryRecords.date, new Date(opts.toDate)));

    const rows = await db.query.disciplinaryRecords.findMany({
      where: and(...filters),
      with: { student: { columns: { id: true, admissionNumber: true, firstName: true, lastName: true } } },
      orderBy: [desc(disciplinaryRecords.date)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} incident(s) for this class.`,
      records: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list class incidents." };
  }
};

// ================================================================
// 9. LIST FOR SCHOOL
// ================================================================
export const listIncidentsForSchoolService = async (
  schoolId: string,
  opts?: {
    fromDate?: string;
    toDate?: string;
    type?: IncidentType;
    studentId?: string;
    classId?: string;
    parentNotified?: boolean;
  }
): Promise<DisciplineResponse> => {
  try {
    const filters: any[] = [eq(disciplinaryRecords.schoolId, schoolId)];
    if (opts?.fromDate) filters.push(gte(disciplinaryRecords.date, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(disciplinaryRecords.date, new Date(opts.toDate)));
    if (opts?.type) filters.push(eq(disciplinaryRecords.incidentType, opts.type));
    if (opts?.studentId) filters.push(eq(disciplinaryRecords.studentId, opts.studentId));
    if (opts?.parentNotified !== undefined)
      filters.push(eq(disciplinaryRecords.parentNotified, opts.parentNotified));

    if (opts?.classId) {
      const roster = await db.query.students.findMany({
        where: eq(students.classId, opts.classId),
        columns: { id: true },
      });
      if (roster.length === 0)
        return { success: true, message: "No students in this class.", count: 0 };
      filters.push(inArray(disciplinaryRecords.studentId, roster.map((s) => s.id)));
    }

    const rows = await db.query.disciplinaryRecords.findMany({
      where: and(...filters),
      with: { student: { columns: { id: true, admissionNumber: true, firstName: true, lastName: true } } },
      orderBy: [desc(disciplinaryRecords.date)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} incident(s).`,
      records: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list school incidents." };
  }
};

// ================================================================
// 10. LIST BY TYPE
// ================================================================
export const listIncidentsByTypeService = async (
  schoolId: string,
  type: IncidentType
): Promise<DisciplineResponse> => {
  return listIncidentsForSchoolService(schoolId, { type });
};

// ================================================================
// 11. LIST BY DATE RANGE
// ================================================================
export const listIncidentsByDateRangeService = async (
  schoolId: string,
  fromDate: string,
  toDate: string
): Promise<DisciplineResponse> => {
  return listIncidentsForSchoolService(schoolId, { fromDate, toDate });
};

// ================================================================
// 12. STUDENT DISCIPLINE SUMMARY
// ================================================================
export const getStudentDisciplineSummaryService = async (
  studentId: string
): Promise<DisciplineResponse> => {
  try {
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
      columns: { id: true, firstName: true, lastName: true },
    });
    if (!student) return { success: false, message: "Student not found." };

    const rows = await db.query.disciplinaryRecords.findMany({
      where: eq(disciplinaryRecords.studentId, studentId),
      orderBy: [desc(disciplinaryRecords.date)],
    });

    const byType: Record<string, number> = {};
    for (const r of rows) {
      byType[r.incidentType] = (byType[r.incidentType] ?? 0) + 1;
    }

    return {
      success: true,
      message: `${rows.length} total incident(s) recorded for ${student.firstName} ${student.lastName}.`,
      summary: {
        studentId,
        totalIncidents: rows.length,
        byType,
        merits: byType["Merit"] ?? 0,
        warnings: byType["Warning"] ?? 0,
        detentions: byType["Detention"] ?? 0,
        suspensions: byType["Suspension"] ?? 0,
        latestIncident: rows[0]?.date?.toISOString() ?? null,
      },
      records: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute summary." };
  }
};

// ================================================================
// 13. CLASS DISCIPLINE SUMMARY
// ================================================================
export const getClassDisciplineSummaryService = async (
  classId: string
): Promise<DisciplineResponse> => {
  try {
    const roster = await db.query.students.findMany({
      where: and(eq(students.classId, classId), isNull(students.deletedAt)),
      columns: { id: true, firstName: true, lastName: true },
    });
    if (roster.length === 0)
      return { success: true, message: "No students in this class.", count: 0 };

    const ids = roster.map((s) => s.id);
    const rows = await db.query.disciplinaryRecords.findMany({
      where: inArray(disciplinaryRecords.studentId, ids),
    });

    const byType: Record<string, number> = {};
    for (const r of rows) {
      byType[r.incidentType] = (byType[r.incidentType] ?? 0) + 1;
    }

    const perStudent: Record<string, { firstName: string; lastName: string; count: number }> = {};
    for (const s of roster) {
      perStudent[s.id] = { firstName: s.firstName, lastName: s.lastName, count: 0 };
    }
    for (const r of rows) {
      if (perStudent[r.studentId]) perStudent[r.studentId].count++;
    }

    const topOffenders = Object.entries(perStudent)
      .map(([studentId, v]) => ({ studentId, ...v }))
      .filter((v) => v.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      success: true,
      message: `${rows.length} incident(s) across ${roster.length} student(s).`,
      stats: {
        totalIncidents: rows.length,
        byType,
        topOffenders,
      },
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute class summary." };
  }
};

// ================================================================
// 14. SCHOOL DISCIPLINE STATS
// ================================================================
export const getSchoolDisciplineStatsService = async (
  schoolId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<DisciplineResponse> => {
  try {
    const filters: any[] = [eq(disciplinaryRecords.schoolId, schoolId)];
    if (opts?.fromDate) filters.push(gte(disciplinaryRecords.date, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(disciplinaryRecords.date, new Date(opts.toDate)));

    const rows = await db.query.disciplinaryRecords.findMany({
      where: and(...filters),
    });

    const byType: Record<string, number> = {};
    const uniqueStudents = new Set<string>();
    const uniqueRecordedBy = new Set<string>();
    for (const r of rows) {
      byType[r.incidentType] = (byType[r.incidentType] ?? 0) + 1;
      uniqueStudents.add(r.studentId);
      uniqueRecordedBy.add(r.recordedBy);
    }

    return {
      success: true,
      message: `${rows.length} incident(s) across ${uniqueStudents.size} student(s).`,
      stats: {
        totalIncidents: rows.length,
        uniqueStudents: uniqueStudents.size,
        uniqueRecorders: uniqueRecordedBy.size,
        byType,
      },
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute school stats." };
  }
};

// ================================================================
// 15. DISCIPLINE TREND (over N days)
// ================================================================
export const getDisciplineTrendService = async (
  schoolId: string,
  days: number = 30
): Promise<DisciplineResponse> => {
  try {
    const startDate = new Date(Date.now() - days * 86_400_000);

    const rows = await db.query.disciplinaryRecords.findMany({
      where: and(
        eq(disciplinaryRecords.schoolId, schoolId),
        gte(disciplinaryRecords.date, startDate)
      ),
      orderBy: [asc(disciplinaryRecords.date)],
    });

    const byDate: Record<string, { count: number; byType: Record<string, number> }> = {};
    for (const r of rows) {
      const key = r.date.toISOString().split("T")[0];
      if (!byDate[key]) byDate[key] = { count: 0, byType: {} };
      byDate[key].count++;
      byDate[key].byType[r.incidentType] = (byDate[key].byType[r.incidentType] ?? 0) + 1;
    }

    const trend = Object.entries(byDate)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      message: `Trend across ${trend.length} day(s) with incidents.`,
      stats: { trend },
      count: trend.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build trend." };
  }
};

// ================================================================
// 16. MERIT STUDENTS (students with merit records only)
// ================================================================
export const getMeritStudentsService = async (
  schoolId: string
): Promise<DisciplineResponse> => {
  try {
    const rows = await db.query.disciplinaryRecords.findMany({
      where: and(
        eq(disciplinaryRecords.schoolId, schoolId),
        eq(disciplinaryRecords.incidentType, "Merit")
      ),
      with: { student: { columns: { id: true, admissionNumber: true, firstName: true, lastName: true } } },
      orderBy: [desc(disciplinaryRecords.date)],
    });

    // Group by student, count merits
    const byStudent = new Map<string, { student: any; meritCount: number }>();
    for (const r of rows) {
      const existing = byStudent.get(r.studentId);
      if (existing) existing.meritCount++;
      else byStudent.set(r.studentId, { student: (r as any).student, meritCount: 1 });
    }

    const ranked = [...byStudent.values()].sort((a, b) => b.meritCount - a.meritCount);

    return {
      success: true,
      message: `Found ${ranked.length} student(s) with merit records.`,
      stats: { meritStudents: ranked },
      count: ranked.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch merit students." };
  }
};