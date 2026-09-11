import { eq, and, desc, asc, sql } from "drizzle-orm";
import db from "../../drizzle/db";
import { termExams, cbcAssessments } from "../../drizzle/schema";
import { 
  TInsertTermExam, 
  TSelectTermExam,
  TInsertCbcAssessment,
  TSelectCbcAssessment
} from "../../drizzle/types";

// ==========================================
// TERM EXAMS SERVICES
// ==========================================

/**
 * Create a new term exam record
 */
export const createTermExamService = async (data: TInsertTermExam) => {
  try {
    const [newExam] = await db.insert(termExams).values(data).returning();
    return {
      success: true,
      message: "Term exam created successfully.",
      exam: newExam,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create term exam." };
  }
};

/**
 * Get term exam by ID with academic term relation
 */
export const getTermExamByIdService = async (examId: string) => {
  try {
    const exam = await db.query.termExams.findFirst({
      where: eq(termExams.id, examId),
      with: {
        term: true,
      },
    });

    if (!exam) {
      return { success: false, message: "Term exam not found." };
    }

    return { success: true, exam };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all term exams for a specific academic term
 */
export const getTermExamsByTermService = async (termId: string) => {
  try {
    const exams = await db.query.termExams.findMany({
      where: eq(termExams.termId, termId),
      orderBy: [desc(termExams.startDate)],
    });

    return { success: true, exams };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Update a term exam record
 */
export const updateTermExamService = async (examId: string, data: Partial<TInsertTermExam>) => {
  try {
    const existingExam = await db.query.termExams.findFirst({
      where: eq(termExams.id, examId),
    });

    if (!existingExam) {
      return { success: false, message: "Term exam not found." };
    }

    if (existingExam.isLocked && data.isLocked !== false && Object.keys(data).some(k => k !== "isLocked")) {
      return { success: false, message: "Cannot modify exam details because this exam is locked." };
    }

    const [updatedExam] = await db
      .update(termExams)
      .set(data)
      .where(eq(termExams.id, examId))
      .returning();

    return { success: true, message: "Term exam updated successfully.", exam: updatedExam };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Delete a term exam record
 */
export const deleteTermExamService = async (examId: string) => {
  try {
    const [deletedExam] = await db
      .delete(termExams)
      .where(eq(termExams.id, examId))
      .returning();

    if (!deletedExam) {
      return { success: false, message: "Term exam not found." };
    }

    return { success: true, message: "Term exam deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};


// ==========================================
// CBC ASSESSMENTS SERVICES
// ==========================================

/**
 * Create or record a single CBC assessment score
 */
/**
 * Create or record a single CBC assessment score
 */
export const createCbcAssessmentService = async (data: TInsertCbcAssessment) => {
  try {
    const exam = await db.query.termExams.findFirst({
      where: eq(termExams.id, data.examId),
    });

    if (exam?.isLocked) {
      return { success: false, message: "Cannot add assessments. This exam session is locked." };
    }

    const [assessment] = await db.insert(cbcAssessments)
      .values(data)
      .onConflictDoUpdate({
        target: [cbcAssessments.studentId, cbcAssessments.examId, cbcAssessments.subjectId, cbcAssessments.strand],
        set: {
          subStrand: data.subStrand,
          scoreValue: data.scoreValue,
          outOf: data.outOf,
          performanceLevel: data.performanceLevel,
          teacherRemarks: data.teacherRemarks,
          assessedBy: data.assessedBy,
        },
      })
      .returning();

    return {
      success: true,
      message: "CBC assessment recorded successfully.",
      assessment,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to record CBC assessment." };
  }
};

/**
 * Bulk create or update CBC assessments (ideal for class marksheets)
 */
export const bulkCreateCbcAssessmentsService = async (assessments: TInsertCbcAssessment[]) => {
  try {
    if (!assessments.length) {
      return { success: false, message: "No assessments provided for bulk entry." };
    }

    const examId = assessments[0].examId;
    const exam = await db.query.termExams.findFirst({
      where: eq(termExams.id, examId),
    });

    if (exam?.isLocked) {
      return { success: false, message: "Cannot perform bulk entry. This exam session is locked." };
    }

    const insertedAssessments = await db.transaction(async (tx) => {
      const results = [];
      for (const item of assessments) {
        const [res] = await tx.insert(cbcAssessments)
          .values(item)
          .onConflictDoUpdate({
            target: [cbcAssessments.studentId, cbcAssessments.examId, cbcAssessments.subjectId, cbcAssessments.strand],
            set: {
              subStrand: item.subStrand,
              scoreValue: item.scoreValue,
              outOf: item.outOf,
              performanceLevel: item.performanceLevel,
              teacherRemarks: item.teacherRemarks,
              assessedBy: item.assessedBy,
            },
          })
          .returning();
        results.push(res);
      }
      return results;
    });

    return {
      success: true,
      message: `Successfully processed ${insertedAssessments.length} CBC assessments.`,
      assessments: insertedAssessments,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to process bulk CBC assessments." };
  }
};

/**
 * Get CBC assessment by ID with full relational details
 */
export const getCbcAssessmentByIdService = async (assessmentId: string) => {
  try {
    const assessment = await db.query.cbcAssessments.findFirst({
      where: eq(cbcAssessments.id, assessmentId),
      with: {
        student: true,
        subject: true,
        term: true,
        exam: true,
        assessedByUser: true,
      },
    });

    if (!assessment) {
      return { success: false, message: "CBC assessment not found." };
    }

    return { success: true, assessment };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all CBC assessments for a specific student in an exam/term
 */
export const getStudentCbcAssessmentsService = async (studentId: string, termId?: string, examId?: string) => {
  try {
    const conditions = [eq(cbcAssessments.studentId, studentId)];

    if (termId) conditions.push(eq(cbcAssessments.termId, termId));
    if (examId) conditions.push(eq(cbcAssessments.examId, examId));

    const assessments = await db.query.cbcAssessments.findMany({
      where: and(...conditions),
      with: {
        subject: true,
        exam: true,
        assessedByUser: true,
      },
     });

    return { success: true, assessments };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get class/exam/subject performance analytics (e.g., scores for a subject in a specific exam)
 */
export const getExamSubjectPerformanceService = async (examId: string, subjectId: string) => {
  try {
    const assessments = await db.query.cbcAssessments.findMany({
      where: and(
        eq(cbcAssessments.examId, examId),
        eq(cbcAssessments.subjectId, subjectId)
      ),
      with: {
        student: true,
        assessedByUser: true,
      },
    });

    const levelCounts: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
    let totalScoreSum = 0;
    let validScoreCount = 0;

    for (const item of assessments) {
      if (item.performanceLevel && levelCounts[item.performanceLevel] !== undefined) {
        levelCounts[item.performanceLevel] += 1;
      }
      if (item.scoreValue !== null) {
        totalScoreSum += Number(item.scoreValue);
        validScoreCount += 1;
      }
    }

    const averageScore = validScoreCount > 0 ? totalScoreSum / validScoreCount : 0;

    return {
      success: true,
      analytics: {
        totalStudentsAssessed: assessments.length,
        averageScore: Number(averageScore.toFixed(2)),
        performanceDistribution: levelCounts,
      },
      assessments,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get a complete termly report card summary for a student across all subjects
 */
export const getStudentTermReportCardService = async (studentId: string, termId: string, examId: string) => {
  try {
    const assessments = await db.query.cbcAssessments.findMany({
      where: and(
        eq(cbcAssessments.studentId, studentId),
        eq(cbcAssessments.termId, termId),
        eq(cbcAssessments.examId, examId)
      ),
      with: {
        subject: true,
        assessedByUser: true,
      },
    });

    if (!assessments.length) {
      return { success: false, message: "No assessments found for this student in the specified term and exam." };
    }

    const levelCounts: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
    let totalScore = 0;
    let totalOutOf = 0;

    for (const item of assessments) {
      if (item.performanceLevel && levelCounts[item.performanceLevel] !== undefined) {
        levelCounts[item.performanceLevel] += 1;
      }
      if (item.scoreValue !== null && item.outOf !== null) {
        totalScore += Number(item.scoreValue);
        totalOutOf += Number(item.outOf);
      }
    }

    const aggregatePercentage = totalOutOf > 0 ? (totalScore / totalOutOf) * 100 : 0;

    return {
      success: true,
      reportCard: {
        studentId,
        termId,
        examId,
        totalSubjectsAssessed: assessments.length,
        totalScore: Number(totalScore.toFixed(2)),
        totalOutOf: Number(totalOutOf.toFixed(2)),
        aggregatePercentage: Number(aggregatePercentage.toFixed(2)),
        performanceDistribution: levelCounts,
        assessments,
      },
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get school-wide or grade-level performance summary for an exam
 */
export const getExamSummaryAnalyticsService = async (examId: string) => {
  try {
    const assessments = await db.query.cbcAssessments.findMany({
      where: eq(cbcAssessments.examId, examId),
      with: {
        subject: true,
      },
    });

    const subjectBreakdown: Record<string, { totalScores: number; count: number; eeCount: number; meCount: number; aeCount: number; beCount: number }> = {};

    for (const item of assessments) {
      const subjName = item.subject?.name || "Unknown Subject";
      if (!subjectBreakdown[subjName]) {
        subjectBreakdown[subjName] = { totalScores: 0, count: 0, eeCount: 0, meCount: 0, aeCount: 0, beCount: 0 };
      }

      if (item.scoreValue !== null) {
        subjectBreakdown[subjName].totalScores += Number(item.scoreValue);
      }
      subjectBreakdown[subjName].count += 1;

      if (item.performanceLevel === "EE") subjectBreakdown[subjName].eeCount += 1;
      if (item.performanceLevel === "ME") subjectBreakdown[subjName].meCount += 1;
      if (item.performanceLevel === "AE") subjectBreakdown[subjName].aeCount += 1;
      if (item.performanceLevel === "BE") subjectBreakdown[subjName].beCount += 1;
    }

    const formattedSubjects = Object.keys(subjectBreakdown).map((subj) => {
      const data = subjectBreakdown[subj];
      return {
        subject: subj,
        totalAssessed: data.count,
        averageScore: data.count > 0 ? Number((data.totalScores / data.count).toFixed(2)) : 0,
        distribution: {
          EE: data.eeCount,
          ME: data.meCount,
          AE: data.aeCount,
          BE: data.beCount,
        },
      };
    });

    return {
      success: true,
      examId,
      totalAssessmentsLogged: assessments.length,
      subjectBreakdown: formattedSubjects,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Delete a CBC assessment record
 */
export const deleteCbcAssessmentService = async (assessmentId: string) => {
  try {
    const assessment = await db.query.cbcAssessments.findFirst({
      where: eq(cbcAssessments.id, assessmentId),
      with: { exam: true },
    });

    if (!assessment) {
      return { success: false, message: "CBC assessment not found." };
    }

    if (assessment.exam?.isLocked) {
      return { success: false, message: "Cannot delete assessment. The associated exam session is locked." };
    }

    const [deleted] = await db
      .delete(cbcAssessments)
      .where(eq(cbcAssessments.id, assessmentId))
      .returning();

    return { success: true, message: "CBC assessment deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};