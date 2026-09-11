import { eq, and, inArray } from "drizzle-orm";
import { teacherSubjects, users, subjects } from "../../drizzle/schema";
import { TSelectTeacherSubject, TInsertTeacherSubject } from "../../drizzle/types";
import db from "../../drizzle/db";

export interface TeacherSubjectServiceResponse {
  success: boolean;
  message: string;
  assignmentItem?: TSelectTeacherSubject | any;
  assignments?: TSelectTeacherSubject[] | any[];
}

/**
 * 1. Assign a teacher to a subject
 */
export const assignTeacherSubjectService = async (
  data: TInsertTeacherSubject
): Promise<TeacherSubjectServiceResponse> => {
  try {
    const { teacherId, subjectId } = data;

    // Verify teacher exists
    const teacher = await db.query.users.findFirst({
      where: eq(users.id, teacherId),
    });
    if (!teacher) {
      return { success: false, message: "Teacher not found." };
    }

    // Verify subject exists
    const subject = await db.query.subjects.findFirst({
      where: eq(subjects.id, subjectId),
    });
    if (!subject) {
      return { success: false, message: "Subject not found." };
    }

    // Check for existing assignment
    const existingAssignment = await db.query.teacherSubjects.findFirst({
      where: and(
        eq(teacherSubjects.teacherId, teacherId),
        eq(teacherSubjects.subjectId, subjectId)
      ),
    });

    if (existingAssignment) {
      return { success: false, message: "Teacher is already assigned to this subject." };
    }

    const [newAssignment] = await db.insert(teacherSubjects)
      .values({ teacherId, subjectId })
      .returning();

    return {
      success: true,
      message: "Teacher assigned to subject successfully.",
      assignmentItem: newAssignment,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to assign teacher to subject." };
  }
};

/**
 * 2. Remove a teacher-subject assignment by IDs
 */
export const removeTeacherSubjectService = async (
  teacherId: string,
  subjectId: string
): Promise<TeacherSubjectServiceResponse> => {
  try {
    const [deletedAssignment] = await db.delete(teacherSubjects)
      .where(and(
        eq(teacherSubjects.teacherId, teacherId),
        eq(teacherSubjects.subjectId, subjectId)
      ))
      .returning();

    if (!deletedAssignment) {
      return { success: false, message: "Assignment not found." };
    }

    return {
      success: true,
      message: "Teacher unassigned from subject successfully.",
      assignmentItem: deletedAssignment,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to remove assignment." };
  }
};

/**
 * 3. Get all subjects assigned to a specific teacher
 */
export const getSubjectsByTeacherService = async (
  teacherId: string
): Promise<TeacherSubjectServiceResponse> => {
  try {
    const assignments = await db.query.teacherSubjects.findMany({
      where: eq(teacherSubjects.teacherId, teacherId),
      with: {
        subject: {
          with: {
            school: true,
          },
        },
      },
    });

    return {
      success: true,
      message: "Teacher subjects fetched successfully.",
      assignments,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch subjects for teacher." };
  }
};

/**
 * 4. Get all teachers assigned to a specific subject
 */
export const getTeachersBySubjectService = async (
  subjectId: string
): Promise<TeacherSubjectServiceResponse> => {
  try {
    const assignments = await db.query.teacherSubjects.findMany({
      where: eq(teacherSubjects.subjectId, subjectId),
      with: {
        teacher: {
          columns: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return {
      success: true,
      message: "Subject teachers fetched successfully.",
      assignments,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch teachers for subject." };
  }
};

/**
 * 5. Bulk assign multiple subjects to a single teacher
 */
export const bulkAssignSubjectsToTeacherService = async (
  teacherId: string,
  subjectIds: string[]
): Promise<TeacherSubjectServiceResponse> => {
  try {
    if (!subjectIds || subjectIds.length === 0) {
      return { success: false, message: "No subject IDs provided." };
    }

    // Verify teacher exists
    const teacher = await db.query.users.findFirst({
      where: eq(users.id, teacherId),
    });
    if (!teacher) {
      return { success: false, message: "Teacher not found." };
    }

    // Filter out existing assignments to avoid duplicate key errors
    const existingAssignments = await db.query.teacherSubjects.findMany({
      where: and(
        eq(teacherSubjects.teacherId, teacherId),
        inArray(teacherSubjects.subjectId, subjectIds)
      ),
    });

    const existingSubjectIdsSet = new Set(existingAssignments.map(a => a.subjectId));
    const newSubjectIdsToAssign = subjectIds.filter(id => !existingSubjectIdsSet.has(id));

    if (newSubjectIdsToAssign.length === 0) {
      return { success: false, message: "Teacher is already assigned to all provided subjects." };
    }

    const valuesToInsert = newSubjectIdsToAssign.map(subjectId => ({
      teacherId,
      subjectId,
    }));

    const insertedAssignments = await db.insert(teacherSubjects)
      .values(valuesToInsert)
      .returning();

    return {
      success: true,
      message: `Successfully assigned ${insertedAssignments.length} new subjects to the teacher.`,
      assignments: insertedAssignments,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to bulk assign subjects." };
  }
};

/**
 * 6. Sync/Replace all subject assignments for a teacher (Full overwrite for term updates)
 */
export const syncTeacherSubjectsService = async (
  teacherId: string,
  subjectIds: string[]
): Promise<TeacherSubjectServiceResponse> => {
  try {
    // Verify teacher exists
    const teacher = await db.query.users.findFirst({
      where: eq(users.id, teacherId),
    });
    if (!teacher) {
      return { success: false, message: "Teacher not found." };
    }

    // Use a transaction to clear old and insert new
    const result = await db.transaction(async (tx) => {
      // Remove all current assignments for this teacher
      await tx.delete(teacherSubjects).where(eq(teacherSubjects.teacherId, teacherId));

      if (subjectIds.length === 0) {
        return [];
      }

      // Insert new assignments
      const valuesToInsert = subjectIds.map(subjectId => ({
        teacherId,
        subjectId,
      }));

      return await tx.insert(teacherSubjects).values(valuesToInsert).returning();
    });

    return {
      success: true,
      message: "Teacher subject assignments synced successfully.",
      assignments: result,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to sync teacher subjects." };
  }
};