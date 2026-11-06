// services/attendance.service.ts
import {
  eq, and, asc, desc, count, sql, isNull, inArray, gte, lte,
} from "drizzle-orm";

import {
  attendance,
  students,
  classes,
  users,
  schools,
  academicTerms,
  termWindows,
  TSelectAttendance,
  TSelectStudent,
  TSelectClass,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Input types — declared locally, not imported from validators
// ================================================================
type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused";

export interface MarkAttendanceInput {
  schoolId: string;
  studentId: string;
  classId: string;
  date: string;
  status: AttendanceStatus;
  remarks?: string | null;
}

export interface BulkMarkAttendanceInput {
  schoolId: string;
  classId: string;
  date: string;
  entries: Array<{
    studentId: string;
    status: AttendanceStatus;
    remarks?: string | null;
  }>;
}

export interface UpdateAttendanceInput {
  status?: AttendanceStatus;
  remarks?: string | null;
}

export interface CopyAttendanceInput {
  schoolId: string;
  classId: string;
  fromDate: string;
  toDate: string;
}

export interface ImportAttendanceInput {
  schoolId: string;
  classId: string;
  rows: Array<{
    admissionNumber: string;
    date: string;
    status: AttendanceStatus;
    remarks?: string | null;
  }>;
}

// ================================================================
// Response envelope
// ================================================================
export interface AttendanceResponse {
  success: boolean;
  message: string;
  attendance?: TSelectAttendance;
  attendanceRecords?: TSelectAttendance[];
  student?: TSelectStudent;
  classRow?: TSelectClass;
  absentees?: Array<TSelectAttendance & { student?: TSelectStudent }>;
  lateArrivals?: Array<TSelectAttendance & { student?: TSelectStudent }>;
  summary?: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    attendanceRate: number;
  };
  register?: Array<{
    studentId: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    attendance: Array<{ date: string; status: string }>;
  }>;
  trend?: Array<{ date: string; present: number; absent: number; late: number; excused: number }>;
  breakdown?: Record<string, number>;
  stats?: Record<string, any>;
  issues?: string[];
  count?: number;
}

// ================================================================
// Helpers
// ================================================================
const today = () => new Date().toISOString().split("T")[0];

const studentIsActive = (s: TSelectStudent) =>
  s.isEnrolled === true && s.deletedAt === null;

const getCurrentTerm = async (schoolId: string) => {
  return await db.query.academicTerms.findFirst({
    where: and(
      eq(academicTerms.schoolId, schoolId),
      eq(academicTerms.isCurrentTerm, true)
    ),
  });
};

const validateAttendanceDateInternal = async (
  schoolId: string,
  date: string
): Promise<{ valid: boolean; message?: string }> => {
  if (date > today()) {
    return { valid: false, message: "Cannot mark attendance for a future date." };
  }

  const currentTerm = await getCurrentTerm(schoolId);
  if (!currentTerm) {
    return {
      valid: false,
      message:
        "No current academic term is set for this school. Attendance requires an active term.",
    };
  }

  if (date < currentTerm.startDate || date > currentTerm.endDate) {
    return {
      valid: false,
      message: `Date ${date} is outside the current term (${currentTerm.startDate} → ${currentTerm.endDate}).`,
    };
  }

  const windows = await db.query.termWindows.findMany({
    where: eq(termWindows.termId, currentTerm.id),
  });
  const onBreak = windows.find(
    (w) =>
      w.windowType === "mid_term_break" &&
      date >= w.startDate &&
      date <= w.endDate
  );
  if (onBreak) {
    return {
      valid: false,
      message: `Cannot mark attendance on ${date} — the school is on "${onBreak.title}".`,
    };
  }

  return { valid: true };
};

const canMarkInternal = async (
  userId: string,
  classId: string
): Promise<{ allowed: boolean; message?: string }> => {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) return { allowed: false, message: "User not found." };

  const roles = u.roles ?? [u.role];
  if (
    roles.includes("school_admin") ||
    roles.includes("principal") ||
    roles.includes("deputy_principal") ||
    roles.includes("super_admin")
  ) {
    return { allowed: true };
  }

  if (roles.includes("teacher")) {
    const c = await db.query.classes.findFirst({
      where: and(eq(classes.id, classId), eq(classes.schoolId, u.schoolId ?? "")),
    });
    if (!c) return { allowed: false, message: "Class not found in your school." };
    if (c.classTeacherId === userId) return { allowed: true };
    return {
      allowed: false,
      message: "You are not the class teacher for this class.",
    };
  }

  return { allowed: false, message: "You don't have permission to mark attendance." };
};

const summarize = (rows: TSelectAttendance[]) => {
  const total = rows.length;
  const present = rows.filter((r) => r.status === "Present").length;
  const absent = rows.filter((r) => r.status === "Absent").length;
  const late = rows.filter((r) => r.status === "Late").length;
  const excused = rows.filter((r) => r.status === "Excused").length;
  return {
    present,
    absent,
    late,
    excused,
    total,
    attendanceRate:
      total === 0
        ? 0
        : Math.round(((present + late) / total) * 10000) / 100,
  };
};

// ================================================================
// 1. MARK — single student, single day
// ================================================================
export const markAttendanceService = async (
  data: MarkAttendanceInput,
  markedBy: string
): Promise<AttendanceResponse> => {
  try {
    const perm = await canMarkInternal(markedBy, data.classId);
    if (!perm.allowed) return { success: false, message: perm.message! };

    const dateCheck = await validateAttendanceDateInternal(data.schoolId, data.date);
    if (!dateCheck.valid) return { success: false, message: dateCheck.message! };

    const student = await db.query.students.findFirst({
      where: and(
        eq(students.id, data.studentId),
        eq(students.schoolId, data.schoolId)
      ),
    });
    if (!student) return { success: false, message: "Student not found in this school." };
    if (!studentIsActive(student))
      return { success: false, message: "Student is not active (withdrawn or deleted)." };
    if (student.classId !== data.classId)
      return {
        success: false,
        message: "Student is not in the selected class. Refresh the roster and try again.",
      };

    const existing = await db.query.attendance.findFirst({
      where: and(eq(attendance.studentId, data.studentId), eq(attendance.date, data.date)),
    });

    if (existing) {
      const [updated] = await db
        .update(attendance)
        .set({ status: data.status, remarks: data.remarks ?? null, markedBy })
        .where(eq(attendance.id, existing.id))
        .returning();
      return {
        success: true,
        message: `Attendance updated for ${student.firstName} ${student.lastName} on ${data.date}.`,
        attendance: updated,
      };
    }

    const [row] = await db
      .insert(attendance)
      .values({
        schoolId: data.schoolId,
        studentId: data.studentId,
        classId: data.classId,
        date: data.date,
        status: data.status,
        remarks: data.remarks ?? null,
        markedBy,
      })
      .returning();

    return {
      success: true,
      message: `Attendance marked for ${student.firstName} ${student.lastName} on ${data.date}.`,
      attendance: row,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return {
        success: false,
        message: "Attendance already exists for this student on this date.",
      };
    return { success: false, message: e?.message || "Failed to mark attendance." };
  }
};

// ================================================================
// 2. BULK MARK — whole class, one day
// ================================================================
export const bulkMarkAttendanceService = async (
  data: BulkMarkAttendanceInput,
  markedBy: string
): Promise<AttendanceResponse> => {
  try {
    const perm = await canMarkInternal(markedBy, data.classId);
    if (!perm.allowed) return { success: false, message: perm.message! };

    const dateCheck = await validateAttendanceDateInternal(data.schoolId, data.date);
    if (!dateCheck.valid) return { success: false, message: dateCheck.message! };

    const roster = await db.query.students.findMany({
      where: and(
        eq(students.classId, data.classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
    });
    const rosterIds = new Set(roster.map((s) => s.id));

    for (const entry of data.entries) {
      if (!rosterIds.has(entry.studentId)) {
        return {
          success: false,
          message: `Student ${entry.studentId} is not on this class's active roster.`,
        };
      }
    }

    const result = await db.transaction(async (tx) => {
      const rows: TSelectAttendance[] = [];
      for (const entry of data.entries) {
        const existing = await tx.query.attendance.findFirst({
          where: and(
            eq(attendance.studentId, entry.studentId),
            eq(attendance.date, data.date)
          ),
        });

        if (existing) {
          const [updated] = await tx
            .update(attendance)
            .set({ status: entry.status, remarks: entry.remarks ?? null, markedBy })
            .where(eq(attendance.id, existing.id))
            .returning();
          rows.push(updated);
        } else {
          const [inserted] = await tx
            .insert(attendance)
            .values({
              schoolId: data.schoolId,
              studentId: entry.studentId,
              classId: data.classId,
              date: data.date,
              status: entry.status,
              remarks: entry.remarks ?? null,
              markedBy,
            })
            .returning();
          rows.push(inserted);
        }
      }
      return rows;
    });

    return {
      success: true,
      message: `Marked attendance for ${result.length} student(s) on ${data.date}.`,
      attendanceRecords: result,
      count: result.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-mark attendance." };
  }
};

// ================================================================
// 3. UPDATE — single row
// ================================================================
export const updateAttendanceService = async (
  id: string,
  patch: UpdateAttendanceInput,
  markedBy: string
): Promise<AttendanceResponse> => {
  try {
    const existing = await db.query.attendance.findFirst({
      where: eq(attendance.id, id),
    });
    if (!existing) return { success: false, message: "Attendance record not found." };
    if (!existing.classId) return { success: false, message: "Attendance has no class reference." };

    const perm = await canMarkInternal(markedBy, existing.classId);
    if (!perm.allowed) return { success: false, message: perm.message! };

    const [updated] = await db
      .update(attendance)
      .set({
        ...(patch.status && { status: patch.status }),
        ...(patch.remarks !== undefined && { remarks: patch.remarks }),
        markedBy,
      })
      .where(eq(attendance.id, id))
      .returning();

    return { success: true, message: "Attendance updated.", attendance: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update attendance." };
  }
};

// ================================================================
// 4. DELETE
// ================================================================
export const deleteAttendanceService = async (
  id: string,
  userId: string
): Promise<AttendanceResponse> => {
  try {
    const existing = await db.query.attendance.findFirst({
      where: eq(attendance.id, id),
    });
    if (!existing) return { success: false, message: "Attendance record not found." };
    if (!existing.classId) return { success: false, message: "Attendance has no class reference." };

    const perm = await canMarkInternal(userId, existing.classId);
    if (!perm.allowed) return { success: false, message: perm.message! };

    const [deleted] = await db.delete(attendance).where(eq(attendance.id, id)).returning();
    return { success: true, message: "Attendance deleted.", attendance: deleted };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete attendance." };
  }
};

// ================================================================
// 5. AUTO-MARK ABSENTEES — for a class on a day
// ================================================================
export const markAbsentFromSheetService = async (
  classId: string,
  date: string,
  markedBy: string
): Promise<AttendanceResponse> => {
  try {
    const c = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!c) return { success: false, message: "Class not found." };

    const perm = await canMarkInternal(markedBy, classId);
    if (!perm.allowed) return { success: false, message: perm.message! };

    const dateCheck = await validateAttendanceDateInternal(c.schoolId, date);
    if (!dateCheck.valid) return { success: false, message: dateCheck.message! };

    const roster = await db.query.students.findMany({
      where: and(
        eq(students.classId, classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
    });

    const marked = await db.query.attendance.findMany({
      where: and(eq(attendance.classId, classId), eq(attendance.date, date)),
    });
    const markedIds = new Set(marked.map((a) => a.studentId));

    const missing = roster.filter((s) => !markedIds.has(s.id));
    if (missing.length === 0) {
      return {
        success: true,
        message: "All students already have attendance recorded for this date.",
        count: 0,
      };
    }

    const inserted = await db
      .insert(attendance)
      .values(
        missing.map((s) => ({
          schoolId: c.schoolId,
          studentId: s.id,
          classId,
          date,
          status: "Absent" as const,
          remarks: "Auto-marked as absent (not recorded by teacher).",
          markedBy,
        }))
      )
      .returning();

    return {
      success: true,
      message: `Auto-marked ${inserted.length} missing student(s) as absent.`,
      attendanceRecords: inserted,
      count: inserted.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to auto-mark absentees." };
  }
};

// ================================================================
// 6. READ — single
// ================================================================
export const getAttendanceByIdService = async (
  id: string
): Promise<AttendanceResponse> => {
  try {
    const row = await db.query.attendance.findFirst({ where: eq(attendance.id, id) });
    if (!row) return { success: false, message: "Attendance record not found." };
    return { success: true, message: "Attendance retrieved.", attendance: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch attendance." };
  }
};

// ================================================================
// 7. READ — student / date
// ================================================================
export const getStudentAttendanceForDateService = async (
  studentId: string,
  date: string
): Promise<AttendanceResponse> => {
  try {
    const row = await db.query.attendance.findFirst({
      where: and(eq(attendance.studentId, studentId), eq(attendance.date, date)),
    });
    if (!row)
      return {
        success: false,
        message: `No attendance record for this student on ${date}.`,
      };
    return { success: true, message: "Attendance retrieved.", attendance: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch attendance." };
  }
};

// ================================================================
// 8. READ — student history
// ================================================================
export const getStudentAttendanceHistoryService = async (
  studentId: string,
  opts?: { fromDate?: string; toDate?: string; status?: AttendanceStatus }
): Promise<AttendanceResponse> => {
  try {
    const conditions: any[] = [eq(attendance.studentId, studentId)];
    if (opts?.fromDate) conditions.push(gte(attendance.date, opts.fromDate));
    if (opts?.toDate) conditions.push(lte(attendance.date, opts.toDate));
    if (opts?.status) conditions.push(eq(attendance.status, opts.status));

    const rows = await db.query.attendance.findMany({
      where: and(...conditions),
      orderBy: [desc(attendance.date)],
    });

    return {
      success: true,
      message: `Fetched ${rows.length} attendance record(s).`,
      attendanceRecords: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch attendance history." };
  }
};

// ================================================================
// 9. READ — class / date
// ================================================================
export const getClassAttendanceForDateService = async (
  classId: string,
  date: string
): Promise<AttendanceResponse> => {
  try {
    const rows = await db.query.attendance.findMany({
      where: and(eq(attendance.classId, classId), eq(attendance.date, date)),
      with: { student: true, markedByUser: true },
      orderBy: [asc(attendance.createdAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} attendance record(s) for this class on ${date}.`,
      attendanceRecords: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch class attendance." };
  }
};

// ================================================================
// 10. SUMMARY — class / date
// ================================================================
export const getClassAttendanceSummaryService = async (
  classId: string,
  date: string
): Promise<AttendanceResponse> => {
  try {
    const rows = await db.query.attendance.findMany({
      where: and(eq(attendance.classId, classId), eq(attendance.date, date)),
    });
    const s = summarize(rows);
    return {
      success: true,
      message: `Summary for ${s.total} student(s) on ${date}.`,
      summary: s,
      count: s.total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute summary." };
  }
};

// ================================================================
// 11. SUMMARY — school / date
// ================================================================
export const getSchoolAttendanceForDateService = async (
  schoolId: string,
  date: string
): Promise<AttendanceResponse> => {
  try {
    const rows = await db.query.attendance.findMany({
      where: and(eq(attendance.schoolId, schoolId), eq(attendance.date, date)),
    });
    const s = summarize(rows);
    return {
      success: true,
      message: `School-wide summary for ${s.total} student(s) on ${date}.`,
      summary: s,
      count: s.total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute school summary." };
  }
};

// ================================================================
// 12. MONTHLY REGISTER — full grid
// ================================================================
export const getMonthlyAttendanceRegisterService = async (
  classId: string,
  year: number,
  month: number
): Promise<AttendanceResponse> => {
  try {
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const roster = await db.query.students.findMany({
      where: and(
        eq(students.classId, classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });

    const records = await db.query.attendance.findMany({
      where: and(
        eq(attendance.classId, classId),
        gte(attendance.date, monthStart),
        sql`${attendance.date} < ${nextMonth}`
      ),
    });

    const byStudent: Record<string, Array<{ date: string; status: string }>> = {};
    for (const r of records) {
      if (!byStudent[r.studentId]) byStudent[r.studentId] = [];
      byStudent[r.studentId].push({ date: r.date, status: r.status });
    }

    const register = roster.map((s) => ({
      studentId: s.id,
      admissionNumber: s.admissionNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      attendance: (byStudent[s.id] ?? []).sort((a, b) => a.date.localeCompare(b.date)),
    }));

    return {
      success: true,
      message: `Monthly register for ${register.length} student(s), ${month}/${year}.`,
      register,
      count: register.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build monthly register." };
  }
};

// ================================================================
// 13. STUDENT STATS
// ================================================================
export const getStudentAttendanceStatsService = async (
  studentId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<AttendanceResponse> => {
  try {
    const conditions: any[] = [eq(attendance.studentId, studentId)];
    if (opts?.fromDate) conditions.push(gte(attendance.date, opts.fromDate));
    if (opts?.toDate) conditions.push(lte(attendance.date, opts.toDate));

    const rows = await db.query.attendance.findMany({ where: and(...conditions) });
    const s = summarize(rows);

    return {
      success: true,
      message:
        s.total === 0
          ? "No attendance records for this student."
          : `Attendance rate: ${s.attendanceRate}%.`,
      stats: s,
      count: s.total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute student stats." };
  }
};

// ================================================================
// 14. ABSENTEES
// ================================================================
export const listAbsenteesForDateService = async (
  schoolId: string,
  date: string
): Promise<AttendanceResponse> => {
  try {
    const rows = await db.query.attendance.findMany({
      where: and(
        eq(attendance.schoolId, schoolId),
        eq(attendance.date, date),
        inArray(attendance.status, ["Absent", "Late"])
      ),
      with: { student: true },
      orderBy: [asc(attendance.createdAt)],
    });
    return {
      success: true,
      message: `Found ${rows.length} absentee(s) on ${date}.`,
      absentees: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list absentees." };
  }
};

// ================================================================
// 15. LATE ARRIVALS
// ================================================================
export const listLateArrivalsForDateService = async (
  schoolId: string,
  date: string
): Promise<AttendanceResponse> => {
  try {
    const rows = await db.query.attendance.findMany({
      where: and(
        eq(attendance.schoolId, schoolId),
        eq(attendance.date, date),
        eq(attendance.status, "Late")
      ),
      with: { student: true },
    });
    return {
      success: true,
      message: `Found ${rows.length} late arrival(s) on ${date}.`,
      lateArrivals: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list late arrivals." };
  }
};

// ================================================================
// 16. CHRONIC ABSENTEES
// ================================================================
export const listChronicAbsenteesService = async (
  schoolId: string,
  opts?: { threshold?: number; fromDate?: string; toDate?: string }
): Promise<AttendanceResponse> => {
  try {
    const threshold = opts?.threshold ?? 80;
    const conditions: any[] = [eq(attendance.schoolId, schoolId)];
    if (opts?.fromDate) conditions.push(gte(attendance.date, opts.fromDate));
    if (opts?.toDate) conditions.push(lte(attendance.date, opts.toDate));

    const rows = await db.query.attendance.findMany({ where: and(...conditions) });

    const byStudent: Record<string, { present: number; total: number }> = {};
    for (const r of rows) {
      if (!byStudent[r.studentId]) byStudent[r.studentId] = { present: 0, total: 0 };
      byStudent[r.studentId].total++;
      if (r.status === "Present" || r.status === "Late") byStudent[r.studentId].present++;
    }

    const belowThreshold = Object.entries(byStudent)
      .map(([studentId, s]) => ({
        studentId,
        attendanceRate:
          s.total === 0 ? 0 : Math.round((s.present / s.total) * 10000) / 100,
        present: s.present,
        total: s.total,
      }))
      .filter((s) => s.attendanceRate < threshold)
      .sort((a, b) => a.attendanceRate - b.attendanceRate);

    const ids = belowThreshold.map((b) => b.studentId);
    const studentRows = ids.length
      ? await db.query.students.findMany({ where: inArray(students.id, ids) })
      : [];
    const byId = new Map(studentRows.map((s) => [s.id, s]));

    return {
      success: true,
      message: `${belowThreshold.length} student(s) below ${threshold}% attendance.`,
      stats: {
        threshold,
        students: belowThreshold.map((b) => ({ ...b, student: byId.get(b.studentId) })),
      },
      count: belowThreshold.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list chronic absentees." };
  }
};

// ================================================================
// 17. STUDENTS NOT MARKED
// ================================================================
export const listStudentsNotMarkedService = async (
  classId: string,
  date: string
): Promise<AttendanceResponse> => {
  try {
    const roster = await db.query.students.findMany({
      where: and(
        eq(students.classId, classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });
    const marked = await db.query.attendance.findMany({
      where: and(eq(attendance.classId, classId), eq(attendance.date, date)),
    });
    const markedIds = new Set(marked.map((a) => a.studentId));
    const missing = roster.filter((s) => !markedIds.has(s.id));

    return {
      success: true,
      message: `${missing.length} student(s) not yet marked on ${date}.`,
      attendanceRecords: [] as any,
      stats: { studentsNotMarked: missing },
      count: missing.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list unmarked students." };
  }
};

// ================================================================
// 18. ATTENDANCE RATE BY CLASS
// ================================================================
export const getAttendanceRateByClassService = async (
  classId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<AttendanceResponse> => {
  try {
    const conditions: any[] = [eq(attendance.classId, classId)];
    if (opts?.fromDate) conditions.push(gte(attendance.date, opts.fromDate));
    if (opts?.toDate) conditions.push(lte(attendance.date, opts.toDate));

    const rows = await db.query.attendance.findMany({ where: and(...conditions) });
    const s = summarize(rows);

    return {
      success: true,
      message:
        s.total === 0
          ? "No attendance data for this class in the given range."
          : `Attendance rate: ${s.attendanceRate}% across ${s.total} record(s).`,
      summary: s,
      count: s.total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute class rate." };
  }
};

// ================================================================
// 19. COUNT BY STATUS
// ================================================================
export const countAttendanceByStatusService = async (
  schoolId: string,
  opts?: { date?: string; fromDate?: string; toDate?: string }
): Promise<AttendanceResponse> => {
  try {
    const conditions: any[] = [eq(attendance.schoolId, schoolId)];
    if (opts?.date) conditions.push(eq(attendance.date, opts.date));
    if (opts?.fromDate) conditions.push(gte(attendance.date, opts.fromDate));
    if (opts?.toDate) conditions.push(lte(attendance.date, opts.toDate));

    const rows = await db
      .select({ status: attendance.status, count: count() })
      .from(attendance)
      .where(and(...conditions))
      .groupBy(attendance.status);

    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      breakdown[r.status] = Number(r.count);
      total += Number(r.count);
    }

    return {
      success: true,
      message: `Counted ${total} attendance record(s) across statuses.`,
      breakdown,
      count: total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count by status." };
  }
};

// ================================================================
// 20. TREND
// ================================================================
export const getAttendanceTrendService = async (
  classId: string,
  days: number = 30
): Promise<AttendanceResponse> => {
  try {
    const startDate = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .split("T")[0];

    const rows = await db.query.attendance.findMany({
      where: and(eq(attendance.classId, classId), gte(attendance.date, startDate)),
    });

    const byDate: Record<string, { present: number; absent: number; late: number; excused: number }> = {};
    for (const r of rows) {
      if (!byDate[r.date]) byDate[r.date] = { present: 0, absent: 0, late: 0, excused: 0 };
      if (r.status === "Present") byDate[r.date].present++;
      else if (r.status === "Absent") byDate[r.date].absent++;
      else if (r.status === "Late") byDate[r.date].late++;
      else if (r.status === "Excused") byDate[r.date].excused++;
    }

    const trend = Object.entries(byDate)
      .map(([date, s]) => ({ date, ...s }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      message: `Trend across ${trend.length} day(s).`,
      trend,
      count: trend.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build trend." };
  }
};

// ================================================================
// 21. BY GENDER
// ================================================================
export const getAttendanceByGenderService = async (
  schoolId: string,
  opts?: { date?: string; fromDate?: string; toDate?: string }
): Promise<AttendanceResponse> => {
  try {
    const conditions: any[] = [eq(attendance.schoolId, schoolId)];
    if (opts?.date) conditions.push(eq(attendance.date, opts.date));
    if (opts?.fromDate) conditions.push(gte(attendance.date, opts.fromDate));
    if (opts?.toDate) conditions.push(lte(attendance.date, opts.toDate));

    const rows = await db.query.attendance.findMany({
      where: and(...conditions),
      with: { student: true },
    });

    const breakdown: Record<
      string,
      { present: number; absent: number; late: number; excused: number; total: number }
    > = {};
    for (const r of rows) {
      const g = (r as any).student?.gender ?? "Unknown";
      if (!breakdown[g]) breakdown[g] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      breakdown[g].total++;
      if (r.status === "Present") breakdown[g].present++;
      else if (r.status === "Absent") breakdown[g].absent++;
      else if (r.status === "Late") breakdown[g].late++;
      else if (r.status === "Excused") breakdown[g].excused++;
    }

    return {
      success: true,
      message: `Attendance breakdown by gender across ${rows.length} record(s).`,
      stats: { breakdown },
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute by gender." };
  }
};

// ================================================================
// 22. SCHOOL STATS
// ================================================================
export const getSchoolAttendanceStatsService = async (
  schoolId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<AttendanceResponse> => {
  try {
    const conditions: any[] = [eq(attendance.schoolId, schoolId)];
    if (opts?.fromDate) conditions.push(gte(attendance.date, opts.fromDate));
    if (opts?.toDate) conditions.push(lte(attendance.date, opts.toDate));

    const rows = await db.query.attendance.findMany({ where: and(...conditions) });
    const s = summarize(rows);
    const uniqueStudents = new Set(rows.map((r) => r.studentId)).size;

    return {
      success: true,
      message: `School stats across ${s.total} record(s) covering ${uniqueStudents} student(s).`,
      stats: { ...s, uniqueStudents },
      count: s.total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute school stats." };
  }
};

// ================================================================
// 23. COMPARISON — this month vs last month
// ================================================================
export const getAttendanceComparisonService = async (
  schoolId: string
): Promise<AttendanceResponse> => {
  try {
    const now = new Date();
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthStart =
      now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12-01`
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}-01`;

    const [thisMonthRows, lastMonthRows] = await Promise.all([
      db.query.attendance.findMany({
        where: and(eq(attendance.schoolId, schoolId), gte(attendance.date, thisMonthStart)),
      }),
      db.query.attendance.findMany({
        where: and(
          eq(attendance.schoolId, schoolId),
          gte(attendance.date, lastMonthStart),
          sql`${attendance.date} < ${thisMonthStart}`
        ),
      }),
    ]);

    const thisStats = summarize(thisMonthRows);
    const lastStats = summarize(lastMonthRows);
    const delta = thisStats.attendanceRate - lastStats.attendanceRate;

    return {
      success: true,
      message: `This month: ${thisStats.attendanceRate}% — last month: ${lastStats.attendanceRate}% (${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%).`,
      stats: {
        thisMonth: thisStats,
        lastMonth: lastStats,
        delta: Math.round(delta * 100) / 100,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compare months." };
  }
};

// ================================================================
// 24. BULK UPSERT — idempotent
// ================================================================
export const bulkUpsertAttendanceService = async (
  data: BulkMarkAttendanceInput,
  markedBy: string
): Promise<AttendanceResponse> => {
  return await bulkMarkAttendanceService(data, markedBy);
};

// ================================================================
// 25. COPY — fromDate → toDate for a class
// ================================================================
export const copyAttendanceFromDateService = async (
  data: CopyAttendanceInput,
  markedBy: string
): Promise<AttendanceResponse> => {
  try {
    const perm = await canMarkInternal(markedBy, data.classId);
    if (!perm.allowed) return { success: false, message: perm.message! };

    const source = await db.query.attendance.findMany({
      where: and(eq(attendance.classId, data.classId), eq(attendance.date, data.fromDate)),
    });
    if (source.length === 0)
      return {
        success: false,
        message: `No attendance records on ${data.fromDate} to copy.`,
      };

    const existing = await db.query.attendance.findMany({
      where: and(eq(attendance.classId, data.classId), eq(attendance.date, data.toDate)),
    });
    if (existing.length > 0)
      return {
        success: false,
        message: `Attendance already exists on ${data.toDate}. Use bulk-mark to update.`,
      };

    const classRow = await db.query.classes.findFirst({
      where: eq(classes.id, data.classId),
    });
    if (!classRow) return { success: false, message: "Class not found." };

    const inserted = await db
      .insert(attendance)
      .values(
        source.map((r) => ({
          schoolId: classRow.schoolId,
          studentId: r.studentId,
          classId: data.classId,
          date: data.toDate,
          status: r.status,
          remarks: r.remarks,
          markedBy,
        }))
      )
      .returning();

    return {
      success: true,
      message: `Copied ${inserted.length} attendance record(s) from ${data.fromDate} to ${data.toDate}.`,
      attendanceRecords: inserted,
      count: inserted.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to copy attendance." };
  }
};

// ================================================================
// 26. IMPORT — from CSV rows
// ================================================================
export const importAttendanceCsvService = async (
  data: ImportAttendanceInput,
  markedBy: string
): Promise<AttendanceResponse> => {
  try {
    const perm = await canMarkInternal(markedBy, data.classId);
    if (!perm.allowed) return { success: false, message: perm.message! };

    const classRow = await db.query.classes.findFirst({
      where: eq(classes.id, data.classId),
    });
    if (!classRow) return { success: false, message: "Class not found." };

    const admissionNumbers = [...new Set(data.rows.map((r) => r.admissionNumber))];
    const studentRows = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, data.schoolId),
        eq(students.classId, data.classId),
        inArray(students.admissionNumber, admissionNumbers)
      ),
    });
    const byAdmission = new Map(studentRows.map((s) => [s.admissionNumber, s.id]));

    const issues: string[] = [];
    const prepared: Array<{
      schoolId: string;
      studentId: string;
      classId: string;
      date: string;
      status: AttendanceStatus;
      remarks: string | null;
      markedBy: string;
    }> = [];

    for (const row of data.rows) {
      const sid = byAdmission.get(row.admissionNumber);
      if (!sid) {
        issues.push(`Unknown admission number: ${row.admissionNumber}`);
        continue;
      }
      prepared.push({
        schoolId: data.schoolId,
        studentId: sid,
        classId: data.classId,
        date: row.date,
        status: row.status,
        remarks: row.remarks ?? null,
        markedBy,
      });
    }

    if (prepared.length === 0) {
      return {
        success: false,
        message: `No valid rows to import.${issues.length ? " " + issues.slice(0, 3).join("; ") : ""}`,
        issues,
      };
    }

    const inserted = await db.insert(attendance).values(prepared).returning();

    return {
      success: true,
      message: `Imported ${inserted.length} of ${data.rows.length} row(s).${issues.length ? ` ${issues.length} skipped.` : ""}`,
      attendanceRecords: inserted,
      count: inserted.length,
      issues,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "One or more rows already have attendance on that date." };
    return { success: false, message: e?.message || "Failed to import attendance." };
  }
};

// ================================================================
// 27. VALIDATE DATE — expose internal helper
// ================================================================
export const validateAttendanceDateService = async (
  schoolId: string,
  date: string
): Promise<AttendanceResponse> => {
  const result = await validateAttendanceDateInternal(schoolId, date);
  return {
    success: result.valid,
    message: result.valid ? "Date is valid for attendance marking." : result.message!,
  };
};

// ================================================================
// 28. CAN MARK — expose internal helper
// ================================================================
export const canMarkAttendanceService = async (
  userId: string,
  classId: string
): Promise<AttendanceResponse> => {
  const result = await canMarkInternal(userId, classId);
  return {
    success: result.allowed,
    message: result.allowed
      ? "User is allowed to mark attendance for this class."
      : result.message!,
  };
};

// ================================================================
// 29. AUDIT TRAIL — who marked what, when
// ================================================================
export const getAttendanceAuditTrailService = async (
  classId: string,
  date: string
): Promise<AttendanceResponse> => {
  try {
    const rows = await db.query.attendance.findMany({
      where: and(eq(attendance.classId, classId), eq(attendance.date, date)),
      with: {
        student: true,
        markedByUser: {
          columns: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: [asc(attendance.createdAt)],
    });

    return {
      success: true,
      message: `Audit trail for ${rows.length} record(s) on ${date}.`,
      attendanceRecords: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build audit trail." };
  }
};

// ================================================================
// 30. SETTINGS — per-school attendance thresholds
// ================================================================
export const getAttendanceSettingsService = async (
  schoolId: string
): Promise<AttendanceResponse> => {
  try {
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    });

    const settings = (school?.settings ?? {}) as Record<string, any>;
    const attendanceSettings = settings?.attendance ?? {};

    return {
      success: true,
      message: "Attendance settings retrieved.",
      stats: {
        chronicAbsenteeThreshold: attendanceSettings.chronicAbsenteeThreshold ?? 80,
        absentSmsThreshold: attendanceSettings.absentSmsThreshold ?? 3,
        allowFutureDates: false,
        requireClassTeacher: attendanceSettings.requireClassTeacher ?? true,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch settings." };
  }
};