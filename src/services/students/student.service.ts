import { eq } from "drizzle-orm";
import db from "../../drizzle/db";
import { classes, schools, studentEnrollmentHistory, students, users } from "../../drizzle/schema";
import { TInsertStudent, TInsertStudentEnrollmentHistory, TSelectStudent } from "../../drizzle/types";

/**
 * Create a new student record
 */
export const createStudentService = async (data: TInsertStudent): Promise<{ success: boolean; message: string; student?: TSelectStudent; error?: string }> => {
  try {
    const [newStudent] = await db.insert(students).values(data).returning();
    return {
      success: true,
      message: "Student registered successfully.",
      student: newStudent,
    };
  } catch (error: any) {
    return {
      success: false,
      message: "Failed to register student.",
      error: error.message,
    };
  }
};

/**
 * Get student by ID with full relations (school, user, parent, class, enrollment history)
 */
export const getStudentByIdService = async (studentId: string) => {
  try {
    const rows = await db
      .select({
        student: students,
        school: schools,
        parent: users,
        class: classes,
      })
      .from(students)
      .leftJoin(schools as any, eq(students.schoolId, schools.id))
      .leftJoin(users as any, eq(students.parentId, users.id))
      .leftJoin(classes as any, eq(students.classId, classes.id))
      .where(eq(students.id, studentId));

    if (rows.length === 0) {
      return { success: false, message: "Student not found." };
    }

    const history = await db
      .select()
      .from(studentEnrollmentHistory)
      .where(eq(studentEnrollmentHistory.studentId, studentId));

    const data = Object.assign({}, rows[0].student, {
      school: rows[0].school,
      parent: rows[0].parent,
      class: rows[0].class,
      enrollmentHistory: history,
    });

    return { success: true, data };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

/**
 * Get all students belonging to a specific school
 */
export const getStudentsBySchoolService = async (schoolId: string) => {
  try {
    const schoolStudents = await db.query.students.findMany({
      where: eq(students.schoolId, schoolId),
      with: {
        class: true,
        parent: true,
      },
    });

    return { success: true, students: schoolStudents };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Update student profile details
 */
export const updateStudentService = async (studentId: string, data: Partial<TInsertStudent>) => {
  try {
    const [updatedStudent] = await db
      .update(students)
      .set(data)
      .where(eq(students.id, studentId))
      .returning();

    if (!updatedStudent) {
      return { success: false, message: "Student not found or update failed." };
    }

    return { success: true, message: "Student updated successfully.", student: updatedStudent };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Delete a student record
 */
export const deleteStudentService = async (studentId: string) => {
  try {
    const [deletedStudent] = await db
      .delete(students)
      .where(eq(students.id, studentId))
      .returning();

    if (!deletedStudent) {
      return { success: false, message: "Student not found." };
    }

    return { success: true, message: "Student deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Create a student enrollment history record
 */
export const createEnrollmentHistoryService = async (data: TInsertStudentEnrollmentHistory) => {
  try {
    const [historyRecord] = await db.insert(studentEnrollmentHistory).values(data).returning();
    return {
      success: true,
      message: "Enrollment history recorded successfully.",
      history: historyRecord,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get enrollment history records for a specific student
 */
export const getStudentEnrollmentHistoryService = async (studentId: string) => {
  try {
    const history = await db.query.studentEnrollmentHistory.findMany({
      where: eq(studentEnrollmentHistory.studentId, studentId),
      with: {
        term: true,
      },
    });

    return { success: true, enrollmentHistory: history };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};