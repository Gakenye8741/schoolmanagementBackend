import { eq, and, desc, asc, sql } from "drizzle-orm";
import db from "../../drizzle/db";
import { homeworkAssignments, homeworkSubmissions, classes, subjects, users, students } from "../../drizzle/schema";
import { 
  TInsertHomeworkAssignment, 
  TSelectHomeworkAssignment,
  TInsertHomeworkSubmission,
  TSelectHomeworkSubmission
} from "../../drizzle/types";

// ==========================================
// HOMEWORK ASSIGNMENTS SERVICES
// ==========================================

/**
 * Create a new homework assignment for a class and subject
 */
export const createHomeworkAssignmentService = async (data: TInsertHomeworkAssignment) => {
  try {
    const [assignment] = await db.insert(homeworkAssignments)
      .values(data)
      .returning();

    return {
      success: true,
      message: "Homework assignment created successfully.",
      assignment,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create homework assignment." };
  }
};

/**
 * Get homework assignment by ID with full relations (class, subject, teacher, and submission statistics)
 */
export const getHomeworkAssignmentByIdService = async (assignmentId: string) => {
  try {
    const assignment = await db.query.homeworkAssignments.findFirst({
      where: eq(homeworkAssignments.id, assignmentId),
      with: {
        class: true,
        subject: true,
        teacher: true,
        submissions: {
          with: {
            student: true,
          },
        },
      },
    });

    if (!assignment) {
      return { success: false, message: "Homework assignment not found." };
    }

    // Detailed submission analytics breakdown
    const totalSubmissions = assignment.submissions.length;
    const statusCounts: Record<string, number> = { Pending: 0, Submitted: 0, Graded: 0, Late: 0 };
    let totalScoreSum = 0;
    let gradedCount = 0;

    for (const sub of assignment.submissions) {
      if (statusCounts[sub.status] !== undefined) {
        statusCounts[sub.status] += 1;
      }
      if (sub.gradeScore !== null) {
        totalScoreSum += Number(sub.gradeScore);
        gradedCount += 1;
      }
    }

    const averageGradeScore = gradedCount > 0 ? totalScoreSum / gradedCount : 0;

    return {
      success: true,
      assignment: {
        ...assignment,
        analytics: {
          totalSubmissionsLogged: totalSubmissions,
          statusDistribution: statusCounts,
          averageGradeScore: Number(averageGradeScore.toFixed(2)),
          gradedCount,
        },
      },
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all homework assignments for a specific class
 */
export const getHomeworkAssignmentsByClassService = async (classId: string) => {
  try {
    const assignments = await db.query.homeworkAssignments.findMany({
      where: eq(homeworkAssignments.classId, classId),
      with: {
        subject: true,
        teacher: true,
        submissions: true,
      },
      orderBy: [desc(homeworkAssignments.dueDate)],
    });

    const detailedAssignments = assignments.map((item) => {
      return {
        ...item,
        totalSubmissionsCount: item.submissions.length,
      };
    });

    return {
      success: true,
      totalAssignments: detailedAssignments.length,
      assignments: detailedAssignments,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all homework assignments created by a specific teacher
 */
export const getHomeworkAssignmentsByTeacherService = async (teacherId: string) => {
  try {
    const assignments = await db.query.homeworkAssignments.findMany({
      where: eq(homeworkAssignments.teacherId, teacherId),
      with: {
        class: true,
        subject: true,
        submissions: true,
      },
      orderBy: [desc(homeworkAssignments.createdAt)],
    });

    return {
      success: true,
      totalAssignments: assignments.length,
      assignments,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Update an existing homework assignment
 */
export const updateHomeworkAssignmentService = async (assignmentId: string, data: Partial<TInsertHomeworkAssignment>) => {
  try {
    const existing = await db.query.homeworkAssignments.findFirst({
      where: eq(homeworkAssignments.id, assignmentId),
    });

    if (!existing) {
      return { success: false, message: "Homework assignment not found." };
    }

    const [updated] = await db
      .update(homeworkAssignments)
      .set(data)
      .where(eq(homeworkAssignments.id, assignmentId))
      .returning();

    return {
      success: true,
      message: "Homework assignment updated successfully.",
      assignment: updated,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update homework assignment." };
  }
};

/**
 * Delete a homework assignment record
 */
export const deleteHomeworkAssignmentService = async (assignmentId: string) => {
  try {
    const [deleted] = await db
      .delete(homeworkAssignments)
      .where(eq(homeworkAssignments.id, assignmentId))
      .returning();

    if (!deleted) {
      return { success: false, message: "Homework assignment not found." };
    }

    return { success: true, message: "Homework assignment deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};


// ==========================================
// HOMEWORK SUBMISSIONS SERVICES
// ==========================================

/**
 * Create or update a student homework submission (with unique upsert handling)
 */
export const upsertHomeworkSubmissionService = async (data: TInsertHomeworkSubmission) => {
  try {
    const [submission] = await db.insert(homeworkSubmissions)
      .values(data)
      .onConflictDoUpdate({
        target: [homeworkSubmissions.assignmentId, homeworkSubmissions.studentId],
        set: {
          submissionText: data.submissionText,
          status: data.status,
          gradeScore: data.gradeScore,
          submittedAt: data.submittedAt || new Date(),
        },
      })
      .returning();

    return {
      success: true,
      message: "Homework submission recorded successfully.",
      submission,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to record homework submission." };
  }
};

/**
 * Get homework submission by ID with relational details
 */
export const getHomeworkSubmissionByIdService = async (submissionId: string) => {
  try {
    const submission = await db.query.homeworkSubmissions.findFirst({
      where: eq(homeworkSubmissions.id, submissionId),
      with: {
        assignment: {
          with: {
            subject: true,
            class: true,
            teacher: true,
          },
        },
        student: true,
      },
    });

    if (!submission) {
      return { success: false, message: "Homework submission not found." };
    }

    return { success: true, submission };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all homework submissions for a specific student across assignments
 */
export const getStudentHomeworkSubmissionsService = async (studentId: string) => {
  try {
    const submissions = await db.query.homeworkSubmissions.findMany({
      where: eq(homeworkSubmissions.studentId, studentId),
      with: {
        assignment: {
          with: {
            subject: true,
            teacher: true,
          },
        },
      },
      orderBy: [desc(homeworkSubmissions.submittedAt)],
    });

    const stats = {
      TotalSubmissions: submissions.length,
      Pending: 0,
      Submitted: 0,
      Graded: 0,
      Late: 0,
      AverageGradeScore: 0,
    };

    let totalScoreSum = 0;
    let gradedCount = 0;

    for (const sub of submissions) {
      if (stats[sub.status as keyof typeof stats] !== undefined) {
        (stats[sub.status as keyof typeof stats] as number) += 1;
      }
      if (sub.gradeScore !== null) {
        totalScoreSum += Number(sub.gradeScore);
        gradedCount += 1;
      }
    }

    if (gradedCount > 0) {
      stats.AverageGradeScore = Number((totalScoreSum / gradedCount).toFixed(2));
    }

    return {
      success: true,
      stats,
      submissions,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Grade a student homework submission
 */
export const gradeHomeworkSubmissionService = async (submissionId: string, gradeScore: string | number, teacherRemarks?: string) => {
  try {
    const existing = await db.query.homeworkSubmissions.findFirst({
      where: eq(homeworkSubmissions.id, submissionId),
    });

    if (!existing) {
      return { success: false, message: "Homework submission not found." };
    }

    const [graded] = await db
      .update(homeworkSubmissions)
      .set({
        gradeScore: String(gradeScore),
        status: "Graded",
      })
      .where(eq(homeworkSubmissions.id, submissionId))
      .returning();

    return {
      success: true,
      message: "Homework submission graded successfully.",
      submission: graded,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to grade homework submission." };
  }
};

/**
 * Delete a homework submission record
 */
export const deleteHomeworkSubmissionService = async (submissionId: string) => {
  try {
    const [deleted] = await db
      .delete(homeworkSubmissions)
      .where(eq(homeworkSubmissions.id, submissionId))
      .returning();

    if (!deleted) {
      return { success: false, message: "Homework submission not found." };
    }

    return { success: true, message: "Homework submission deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};