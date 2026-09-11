import { eq, and, desc, asc, sql } from "drizzle-orm";
import db from "../../drizzle/db";
import { attendance, disciplinaryRecords, students, users } from "../../drizzle/schema";
import { 
  TInsertAttendance, 
  TSelectAttendance,
  TInsertDisciplinaryRecord,
  TSelectDisciplinaryRecord
} from "../../drizzle/types";

// ==========================================
// ATTENDANCE SERVICES
// ==========================================

/**
 * Create or record single student attendance (with upsert handling for unique student-date constraint)
 */
export const createAttendanceService = async (data: TInsertAttendance) => {
  try {
    const [record] = await db.insert(attendance)
      .values(data)
      .onConflictDoUpdate({
        target: [attendance.studentId, attendance.date],
        set: {
          status: data.status,
          markedBy: data.markedBy,
        },
      })
      .returning();

    return {
      success: true,
      message: "Attendance recorded successfully.",
      attendance: record,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to record attendance." };
  }
};

/**
 * Bulk create or update attendance records (ideal for class-wide register submission)
 */
export const bulkCreateAttendanceService = async (records: TInsertAttendance[]) => {
  try {
    if (!records.length) {
      return { success: false, message: "No attendance records provided for bulk entry." };
    }

    const insertedRecords = await db.transaction(async (tx) => {
      const results = [];
      for (const item of records) {
        const [res] = await tx.insert(attendance)
          .values(item)
          .onConflictDoUpdate({
            target: [attendance.studentId, attendance.date],
            set: {
              status: item.status,
              markedBy: item.markedBy,
            },
          })
          .returning();
        results.push(res);
      }
      return results;
    });

    return {
      success: true,
      message: `Successfully processed attendance for ${insertedRecords.length} students.`,
      attendanceRecords: insertedRecords,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to process bulk attendance records." };
  }
};

/**
 * Get attendance record by ID with full relations
 */
export const getAttendanceByIdService = async (attendanceId: string) => {
  try {
    const record = await db.query.attendance.findFirst({
      where: eq(attendance.id, attendanceId),
      with: {
        student: true,
        markedByUser: true,
      },
    });

    if (!record) {
      return { success: false, message: "Attendance record not found." };
    }

    return { success: true, attendance: record };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get attendance history for a specific student
 */
export const getStudentAttendanceService = async (studentId: string, startDate?: string, endDate?: string) => {
  try {
    const conditions = [eq(attendance.studentId, studentId)];

    const records = await db.query.attendance.findMany({
      where: and(...conditions),
      with: {
        markedByUser: true,
      },
      orderBy: [desc(attendance.date)],
    });

    // Summary calculations
    const stats = {
      Present: 0,
      Absent: 0,
      Late: 0,
      Excused: 0,
      TotalLogged: records.length,
    };

    for (const r of records) {
      if (stats[r.status as keyof typeof stats] !== undefined) {
        stats[r.status as keyof typeof stats] += 1;
      }
    }

    return {
      success: true,
      stats,
      records,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Delete an attendance record
 */
export const deleteAttendanceService = async (attendanceId: string) => {
  try {
    const [deleted] = await db
      .delete(attendance)
      .where(eq(attendance.id, attendanceId))
      .returning();

    if (!deleted) {
      return { success: false, message: "Attendance record not found." };
    }

    return { success: true, message: "Attendance record deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};


// ==========================================
// DISCIPLINARY RECORDS SERVICES
// ==========================================

/**
 * Create a new disciplinary record
 */
export const createDisciplinaryRecordService = async (data: TInsertDisciplinaryRecord) => {
  try {
    const [record] = await db.insert(disciplinaryRecords)
      .values(data)
      .returning();

    return {
      success: true,
      message: "Disciplinary record logged successfully.",
      disciplinaryRecord: record,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to log disciplinary record." };
  }
};

/**
 * Get disciplinary record by ID with relations
 */
export const getDisciplinaryRecordByIdService = async (recordId: string) => {
  try {
    const record = await db.query.disciplinaryRecords.findFirst({
      where: eq(disciplinaryRecords.id, recordId),
      with: {
        student: true,
        recordedByUser: true,
      },
    });

    if (!record) {
      return { success: false, message: "Disciplinary record not found." };
    }

    return { success: true, disciplinaryRecord: record };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all disciplinary records for a specific student
 */
export const getStudentDisciplinaryRecordsService = async (studentId: string) => {
  try {
    const records = await db.query.disciplinaryRecords.findMany({
      where: eq(disciplinaryRecords.studentId, studentId),
      with: {
        recordedByUser: true,
      },
      orderBy: [desc(disciplinaryRecords.date)],
    });

    return {
      success: true,
      totalIncidents: records.length,
      records,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Update an existing disciplinary record
 */
export const updateDisciplinaryRecordService = async (recordId: string, data: Partial<TInsertDisciplinaryRecord>) => {
  try {
    const existing = await db.query.disciplinaryRecords.findFirst({
      where: eq(disciplinaryRecords.id, recordId),
    });

    if (!existing) {
      return { success: false, message: "Disciplinary record not found." };
    }

    const [updated] = await db
      .update(disciplinaryRecords)
      .set(data)
      .where(eq(disciplinaryRecords.id, recordId))
      .returning();

    return {
      success: true,
      message: "Disciplinary record updated successfully.",
      disciplinaryRecord: updated,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update disciplinary record." };
  }
};

/**
 * Delete a disciplinary record
 */
export const deleteDisciplinaryRecordService = async (recordId: string) => {
  try {
    const [deleted] = await db
      .delete(disciplinaryRecords)
      .where(eq(disciplinaryRecords.id, recordId))
      .returning();

    if (!deleted) {
      return { success: false, message: "Disciplinary record not found." };
    }

    return { success: true, message: "Disciplinary record deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};