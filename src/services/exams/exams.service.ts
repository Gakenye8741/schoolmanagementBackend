// services/exams.service.ts
import {
  eq, and, ne, asc, desc, count, sql, ilike, isNull, inArray, gte, lte,
} from "drizzle-orm";

import {
  termExams,
  examSchedules,
  examResults,
  academicTerms,
  gradingScales,
  gradingBands,
  classes,
  subjects,
  students,
  TSelectTermExam,
  TSelectExamSchedule,
  TSelectExamResult,
  TSelectGradingScale,
  TSelectGradingBand,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Input types
// ================================================================
type ExamCategory =
  | "Mid-Term" | "End-Term" | "Continuous Assessment" | "Project"
  | "Practical" | "Opening" | "Formative" | "Summative"
  | "Mock" | "End of Year";

export interface CreateExamInput {
  schoolId: string;
  termId: string;
  examTitle: string;
  examCategory: ExamCategory;
  weighting?: string | null;
  gradingScaleId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateExamInput {
  examTitle?: string;
  examCategory?: ExamCategory;
  weighting?: string | null;
  gradingScaleId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CreateScheduleInput {
  schoolId: string;
  examId: string;
  classId: string;
  subjectId: string;
  examDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  invigilatorId?: string | null;
}

export interface BulkCreateSchedulesInput {
  schoolId: string;
  examId: string;
  schedules: Array<{
    classId: string;
    subjectId: string;
    examDate: string;
    startTime?: string | null;
    endTime?: string | null;
    venue?: string | null;
    invigilatorId?: string | null;
  }>;
}

export interface EnterMarkInput {
  schoolId: string;
  examId: string;
  studentId: string;
  subjectId: string;
  classId?: string | null;
  marks?: string | null;
  outOf?: string;
  isAbsent?: boolean;
  remarks?: string | null;
  enteredBy: string;
}

export interface BulkEnterMarksInput {
  schoolId: string;
  examId: string;
  subjectId: string;
  enteredBy: string;
  entries: Array<{
    studentId: string;
    classId?: string | null;
    marks?: string | null;
    outOf?: string;
    isAbsent?: boolean;
    remarks?: string | null;
  }>;
}

// ================================================================
// Response envelope
// ================================================================
export interface ExamResponse {
  success: boolean;
  message: string;
  exam?: TSelectTermExam;
  exams?: TSelectTermExam[];
  schedule?: TSelectExamSchedule;
  schedules?: TSelectExamSchedule[];
  result?: TSelectExamResult;
  results?: TSelectExamResult[];
  marksheet?: {
    examId: string;
    subjectId: string;
    classId: string;
    scaleId: string | null;
    rows: Array<{
      studentId: string;
      admissionNumber: string;
      firstName: string;
      lastName: string;
      marks: string | null;
      outOf: string;
      grade: string | null;
      points: number | null;
      isAbsent: boolean;
      remarks: string | null;
    }>;
  };
  ranking?: Array<{
    studentId: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    totalMarks: string;
    totalOutOf: string;
    meanScore: string;
    meanGrade: string;
    position: number;
    subjectsCount: number;
  }>;
  statistics?: Record<string, any>;
  transcript?: Array<{
    examId: string;
    examTitle: string;
    termName: string;
    academicYear: string;
    results: TSelectExamResult[];
  }>;
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const fmt = (n: number) => n.toFixed(2);

const assertTermInSchool = async (schoolId: string, termId: string) => {
  return await db.query.academicTerms.findFirst({
    where: and(eq(academicTerms.id, termId), eq(academicTerms.schoolId, schoolId)),
  });
};

const assertExamInSchool = async (schoolId: string, examId: string) => {
  return await db.query.termExams.findFirst({
    where: and(eq(termExams.id, examId), eq(termExams.schoolId, schoolId)),
  });
};

/** Returns the effective scale (exam-specific or school default) + its bands. */
const getEffectiveScale = async (
  schoolId: string,
  examScaleId: string | null
): Promise<{ scale: TSelectGradingScale | null; bands: TSelectGradingBand[] }> => {
  let scale: TSelectGradingScale | null = null;

  if (examScaleId) {
    const found = await db.query.gradingScales.findFirst({
      where: eq(gradingScales.id, examScaleId),
    });
    scale = found ?? null;   // ← FIX: undefined → null
  }

  if (!scale) {
    const found = await db.query.gradingScales.findFirst({
      where: and(eq(gradingScales.schoolId, schoolId), eq(gradingScales.isDefault, true)),
    });
    scale = found ?? null;   // ← FIX
  }

  if (!scale) return { scale: null, bands: [] };

  const bands = await db.query.gradingBands.findMany({
    where: eq(gradingBands.scaleId, scale.id),
    orderBy: [desc(gradingBands.minScore)],
  });
  return { scale, bands };
};

/** Finds the grading band whose [minScore, maxScore] range contains `percentage`. */
const resolveBand = (
  bands: TSelectGradingBand[],
  percentage: number
): TSelectGradingBand | null => {
  for (const b of bands) {
    if (percentage >= Number(b.minScore) && percentage <= Number(b.maxScore)) {
      return b;
    }
  }
  return null;
};

// ================================================================
// 1. CREATE EXAM
// ================================================================
export const createExamService = async (data: CreateExamInput): Promise<ExamResponse> => {
  try {
    const term = await assertTermInSchool(data.schoolId, data.termId);
    if (!term) return { success: false, message: "Term not found in this school." };

    if (data.gradingScaleId) {
      const scale = await db.query.gradingScales.findFirst({
        where: and(
          eq(gradingScales.id, data.gradingScaleId),
          eq(gradingScales.schoolId, data.schoolId)
        ),
      });
      if (!scale) return { success: false, message: "Grading scale not found in this school." };
    }

    if (data.startDate && data.endDate && data.startDate > data.endDate)
      return { success: false, message: "startDate must not be after endDate." };

    const [row] = await db
      .insert(termExams)
      .values({
        schoolId: data.schoolId,
        termId: data.termId,
        examTitle: data.examTitle.trim(),
        examCategory: data.examCategory,
        weighting: data.weighting ?? null,
        gradingScaleId: data.gradingScaleId ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        isLocked: false,
      })
      .returning();

    return { success: true, message: `Exam "${row.examTitle}" created.`, exam: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create exam." };
  }
};

// ================================================================
// 2. GET EXAM BY ID
// ================================================================
export const getExamByIdService = async (id: string): Promise<ExamResponse> => {
  try {
    const exam = await db.query.termExams.findFirst({
      where: eq(termExams.id, id),
      with: { term: true, gradingScale: true },
    });
    if (!exam) return { success: false, message: "Exam not found." };
    return { success: true, message: "Exam retrieved.", exam: exam as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch exam." };
  }
};

// ================================================================
// 3. LIST EXAMS BY TERM
// ================================================================
export const listExamsByTermService = async (
  schoolId: string,
  termId: string
): Promise<ExamResponse> => {
  try {
    const rows = await db.query.termExams.findMany({
      where: and(eq(termExams.schoolId, schoolId), eq(termExams.termId, termId)),
      orderBy: [asc(termExams.startDate), asc(termExams.examTitle)],
    });
    return { success: true, message: `Fetched ${rows.length} exam(s).`, exams: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list exams." };
  }
};

// ================================================================
// 4. LIST EXAMS BY SCHOOL
// ================================================================
export const listExamsBySchoolService = async (schoolId: string): Promise<ExamResponse> => {
  try {
    const rows = await db.query.termExams.findMany({
      where: eq(termExams.schoolId, schoolId),
      orderBy: [desc(termExams.startDate)],
    });
    return { success: true, message: `Fetched ${rows.length} exam(s).`, exams: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list exams." };
  }
};

// ================================================================
// 5. LIST EXAMS BY CATEGORY
// ================================================================
export const listExamsByCategoryService = async (
  schoolId: string,
  category: ExamCategory
): Promise<ExamResponse> => {
  try {
    const rows = await db.query.termExams.findMany({
      where: and(eq(termExams.schoolId, schoolId), eq(termExams.examCategory, category)),
      orderBy: [desc(termExams.startDate)],
    });
    return { success: true, message: `Fetched ${rows.length} ${category} exam(s).`, exams: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list exams." };
  }
};

// ================================================================
// 6. UPDATE EXAM
// ================================================================
export const updateExamService = async (
  id: string,
  patch: UpdateExamInput
): Promise<ExamResponse> => {
  try {
    const existing = await db.query.termExams.findFirst({ where: eq(termExams.id, id) });
    if (!existing) return { success: false, message: "Exam not found." };
    if (existing.isLocked)
      return { success: false, message: "Exam is locked. Unlock it before editing." };

    const [row] = await db
      .update(termExams)
      .set({
        ...(patch.examTitle && { examTitle: patch.examTitle.trim() }),
        ...(patch.examCategory && { examCategory: patch.examCategory }),
        ...(patch.weighting !== undefined && { weighting: patch.weighting }),
        ...(patch.gradingScaleId !== undefined && { gradingScaleId: patch.gradingScaleId }),
        ...(patch.startDate !== undefined && { startDate: patch.startDate }),
        ...(patch.endDate !== undefined && { endDate: patch.endDate }),
      })
      .where(eq(termExams.id, id))
      .returning();
    return { success: true, message: "Exam updated.", exam: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update exam." };
  }
};

// ================================================================
// 7. LOCK EXAM
// ================================================================
export const lockExamService = async (id: string): Promise<ExamResponse> => {
  try {
    const [row] = await db
      .update(termExams)
      .set({ isLocked: true })
      .where(eq(termExams.id, id))
      .returning();
    if (!row) return { success: false, message: "Exam not found." };
    return { success: true, message: "Exam locked. Marks can no longer be edited.", exam: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to lock exam." };
  }
};

// ================================================================
// 8. UNLOCK EXAM
// ================================================================
export const unlockExamService = async (id: string): Promise<ExamResponse> => {
  try {
    const [row] = await db
      .update(termExams)
      .set({ isLocked: false })
      .where(eq(termExams.id, id))
      .returning();
    if (!row) return { success: false, message: "Exam not found." };
    return { success: true, message: "Exam unlocked.", exam: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to unlock exam." };
  }
};

// ================================================================
// 9. DELETE EXAM
// ================================================================
export const deleteExamService = async (id: string): Promise<ExamResponse> => {
  try {
    const existing = await db.query.termExams.findFirst({ where: eq(termExams.id, id) });
    if (!existing) return { success: false, message: "Exam not found." };
    if (existing.isLocked)
      return { success: false, message: "Cannot delete a locked exam." };

    const [row] = await db.delete(termExams).where(eq(termExams.id, id)).returning();
    return { success: true, message: "Exam deleted.", exam: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete exam." };
  }
};

// ================================================================
// 10. EXAM STATISTICS
// ================================================================
export const getExamStatisticsService = async (id: string): Promise<ExamResponse> => {
  try {
    const exam = await db.query.termExams.findFirst({ where: eq(termExams.id, id) });
    if (!exam) return { success: false, message: "Exam not found." };

    const allResults = await db.query.examResults.findMany({
      where: eq(examResults.examId, id),
    });

    const totalResults = allResults.length;
    const absentCount = allResults.filter((r) => r.isAbsent).length;
    const present = allResults.filter((r) => !r.isAbsent && r.marks !== null);
    const totalMarks = present.reduce((s, r) => s + Number(r.marks ?? 0), 0);
    const totalOutOf = present.reduce((s, r) => s + Number(r.outOf), 0);
    const mean = present.length === 0 ? 0 : totalMarks / present.length;

    const gradeDistribution: Record<string, number> = {};
    for (const r of present) {
      const g = r.grade ?? "N/A";
      gradeDistribution[g] = (gradeDistribution[g] ?? 0) + 1;
    }

    return {
      success: true,
      message: `Statistics for "${exam.examTitle}".`,
      statistics: {
        examTitle: exam.examTitle,
        isLocked: exam.isLocked,
        totalResults,
        absentCount,
        completed: present.length,
        mean: fmt(mean),
        meanPercentage: totalOutOf === 0 ? "0.00" : fmt((totalMarks / totalOutOf) * 100),
        uniqueStudents: new Set(allResults.map((r) => r.studentId)).size,
        uniqueSubjects: new Set(allResults.map((r) => r.subjectId)).size,
        gradeDistribution,
      },
      exam,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute exam statistics." };
  }
};

// ================================================================
// 11. CREATE SCHEDULE
// ================================================================
export const createScheduleService = async (data: CreateScheduleInput): Promise<ExamResponse> => {
  try {
    const exam = await assertExamInSchool(data.schoolId, data.examId);
    if (!exam) return { success: false, message: "Exam not found in this school." };

    const cls = await db.query.classes.findFirst({
      where: and(eq(classes.id, data.classId), eq(classes.schoolId, data.schoolId)),
    });
    if (!cls) return { success: false, message: "Class not found in this school." };

    const subject = await db.query.subjects.findFirst({
      where: and(eq(subjects.id, data.subjectId), eq(subjects.schoolId, data.schoolId)),
    });
    if (!subject) return { success: false, message: "Subject not found in this school." };

    const [row] = await db
      .insert(examSchedules)
      .values({
        schoolId: data.schoolId,
        examId: data.examId,
        classId: data.classId,
        subjectId: data.subjectId,
        examDate: data.examDate,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        venue: data.venue ?? null,
        invigilatorId: data.invigilatorId ?? null,
      })
      .returning();

    return { success: true, message: "Exam schedule created.", schedule: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "This class already has a schedule for that subject." };
    return { success: false, message: e?.message || "Failed to create schedule." };
  }
};

// ================================================================
// 12. BULK CREATE SCHEDULES
// ================================================================
export const bulkCreateSchedulesService = async (
  data: BulkCreateSchedulesInput
): Promise<ExamResponse> => {
  try {
    const exam = await assertExamInSchool(data.schoolId, data.examId);
    if (!exam) return { success: false, message: "Exam not found in this school." };
    if (data.schedules.length === 0)
      return { success: false, message: "No schedules provided." };

    const classIds = [...new Set(data.schedules.map((s) => s.classId))];
    const subjectIds = [...new Set(data.schedules.map((s) => s.subjectId))];

    const validClasses = await db.query.classes.findMany({
      where: and(eq(classes.schoolId, data.schoolId), inArray(classes.id, classIds)),
    });
    if (validClasses.length !== classIds.length)
      return { success: false, message: "One or more class IDs don't belong to this school." };

    const validSubjects = await db.query.subjects.findMany({
      where: and(eq(subjects.schoolId, data.schoolId), inArray(subjects.id, subjectIds)),
    });
    if (validSubjects.length !== subjectIds.length)
      return { success: false, message: "One or more subject IDs don't belong to this school." };

    const result = await db.transaction(async (tx) => {
      const rows: TSelectExamSchedule[] = [];
      for (const s of data.schedules) {
        const [row] = await tx
          .insert(examSchedules)
          .values({
            schoolId: data.schoolId,
            examId: data.examId,
            classId: s.classId,
            subjectId: s.subjectId,
            examDate: s.examDate,
            startTime: s.startTime ?? null,
            endTime: s.endTime ?? null,
            venue: s.venue ?? null,
            invigilatorId: s.invigilatorId ?? null,
          })
          .onConflictDoUpdate({
            target: [examSchedules.examId, examSchedules.classId, examSchedules.subjectId],
            set: {
              examDate: s.examDate,
              startTime: s.startTime ?? null,
              endTime: s.endTime ?? null,
              venue: s.venue ?? null,
              invigilatorId: s.invigilatorId ?? null,
            },
          })
          .returning();
        rows.push(row);
      }
      return rows;
    });

    return { success: true, message: `Upserted ${result.length} schedule row(s).`, schedules: result, count: result.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create schedules." };
  }
};

// ================================================================
// 13. GET SCHEDULE BY ID
// ================================================================
export const getScheduleByIdService = async (id: string): Promise<ExamResponse> => {
  try {
    const row = await db.query.examSchedules.findFirst({
      where: eq(examSchedules.id, id),
      with: { exam: true, class: true, subject: true, invigilator: true },
    });
    if (!row) return { success: false, message: "Schedule not found." };
    return { success: true, message: "Schedule retrieved.", schedule: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch schedule." };
  }
};

// ================================================================
// 14. LIST SCHEDULES BY EXAM
// ================================================================
export const listSchedulesByExamService = async (examId: string): Promise<ExamResponse> => {
  try {
    const rows = await db.query.examSchedules.findMany({
      where: eq(examSchedules.examId, examId),
      with: { class: true, subject: true, invigilator: true },
      orderBy: [asc(examSchedules.examDate), asc(examSchedules.startTime)],
    });
    return { success: true, message: `Fetched ${rows.length} schedule(s).`, schedules: rows as any, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list schedules." };
  }
};

// ================================================================
// 15. LIST SCHEDULES BY CLASS
// ================================================================
export const listSchedulesByClassService = async (
  schoolId: string,
  classId: string
): Promise<ExamResponse> => {
  try {
    const rows = await db.query.examSchedules.findMany({
      where: and(eq(examSchedules.schoolId, schoolId), eq(examSchedules.classId, classId)),
      with: { exam: true, subject: true },
      orderBy: [asc(examSchedules.examDate)],
    });
    return { success: true, message: `Fetched ${rows.length} schedule(s).`, schedules: rows as any, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list schedules." };
  }
};

// ================================================================
// 16. LIST SCHEDULES BY DATE
// ================================================================
export const listSchedulesByDateService = async (
  schoolId: string,
  examDate: string
): Promise<ExamResponse> => {
  try {
    const rows = await db.query.examSchedules.findMany({
      where: and(eq(examSchedules.schoolId, schoolId), eq(examSchedules.examDate, examDate)),
      with: { exam: true, class: true, subject: true },
      orderBy: [asc(examSchedules.startTime)],
    });
    return { success: true, message: `Fetched ${rows.length} schedule(s) for ${examDate}.`, schedules: rows as any, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list schedules." };
  }
};

// ================================================================
// 17. UPDATE SCHEDULE
// ================================================================
export const updateScheduleService = async (
  id: string,
  patch: Partial<CreateScheduleInput>
): Promise<ExamResponse> => {
  try {
    const existing = await db.query.examSchedules.findFirst({ where: eq(examSchedules.id, id) });
    if (!existing) return { success: false, message: "Schedule not found." };

    const [row] = await db
      .update(examSchedules)
      .set({
        ...(patch.examDate !== undefined && { examDate: patch.examDate }),
        ...(patch.startTime !== undefined && { startTime: patch.startTime }),
        ...(patch.endTime !== undefined && { endTime: patch.endTime }),
        ...(patch.venue !== undefined && { venue: patch.venue }),
        ...(patch.invigilatorId !== undefined && { invigilatorId: patch.invigilatorId }),
      })
      .where(eq(examSchedules.id, id))
      .returning();
    return { success: true, message: "Schedule updated.", schedule: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update schedule." };
  }
};

// ================================================================
// 18. DELETE SCHEDULE
// ================================================================
export const deleteScheduleService = async (id: string): Promise<ExamResponse> => {
  try {
    const [row] = await db.delete(examSchedules).where(eq(examSchedules.id, id)).returning();
    if (!row) return { success: false, message: "Schedule not found." };
    return { success: true, message: "Schedule deleted.", schedule: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete schedule." };
  }
};

// ================================================================
// 19. ENTER A MARK (auto-computes grade)
// ================================================================
export const enterMarkService = async (data: EnterMarkInput): Promise<ExamResponse> => {
  try {
    const exam = await assertExamInSchool(data.schoolId, data.examId);
    if (!exam) return { success: false, message: "Exam not found in this school." };
    if (exam.isLocked) return { success: false, message: "Exam is locked. Marks cannot be edited." };

    const student = await db.query.students.findFirst({
      where: and(eq(students.id, data.studentId), eq(students.schoolId, data.schoolId)),
    });
    if (!student) return { success: false, message: "Student not found in this school." };

    const subject = await db.query.subjects.findFirst({
      where: and(eq(subjects.id, data.subjectId), eq(subjects.schoolId, data.schoolId)),
    });
    if (!subject) return { success: false, message: "Subject not found in this school." };

    const outOf = data.outOf ?? "100.00";
    const isAbsent = data.isAbsent ?? false;
    const marks = isAbsent ? null : data.marks ?? null;

    if (!isAbsent && marks !== null) {
      if (Number(marks) < 0 || Number(marks) > Number(outOf))
        return { success: false, message: `Marks must be between 0 and ${outOf}.` };
    }

    let grade: string | null = null;
    let points: number | null = null;
    if (!isAbsent && marks !== null) {
      const { bands } = await getEffectiveScale(data.schoolId, exam.gradingScaleId);
      if (bands.length > 0) {
        const percentage = (Number(marks) / Number(outOf)) * 100;
        const band = resolveBand(bands, percentage);
        if (band) { grade = band.grade; points = band.points; }
      }
    }

    const existing = await db.query.examResults.findFirst({
      where: and(
        eq(examResults.examId, data.examId),
        eq(examResults.studentId, data.studentId),
        eq(examResults.subjectId, data.subjectId)
      ),
    });

    if (existing) {
      const [row] = await db
        .update(examResults)
        .set({
          marks, outOf, isAbsent, grade, points,
          remarks: data.remarks ?? null,
          classId: data.classId ?? existing.classId,
          enteredBy: data.enteredBy,
          updatedAt: new Date(),
        })
        .where(eq(examResults.id, existing.id))
        .returning();
      return {
        success: true,
        message: `Mark updated for ${student.firstName} ${student.lastName} — ${subject.name}${isAbsent ? " (absent)" : `: ${marks}/${outOf} → ${grade ?? "no grade"}`}.`,
        result: row,
      };
    }

    const [row] = await db
      .insert(examResults)
      .values({
        schoolId: data.schoolId,
        examId: data.examId,
        studentId: data.studentId,
        subjectId: data.subjectId,
        classId: data.classId ?? student.classId,
        marks, outOf, isAbsent, grade, points,
        remarks: data.remarks ?? null,
        enteredBy: data.enteredBy,
      })
      .returning();

    return {
      success: true,
      message: `Mark entered for ${student.firstName} ${student.lastName} — ${subject.name}${isAbsent ? " (absent)" : `: ${marks}/${outOf} → ${grade ?? "no grade"}`}.`,
      result: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to enter mark." };
  }
};

// ================================================================
// 20. BULK ENTER MARKS
// ================================================================
export const bulkEnterMarksService = async (data: BulkEnterMarksInput): Promise<ExamResponse> => {
  try {
    const exam = await assertExamInSchool(data.schoolId, data.examId);
    if (!exam) return { success: false, message: "Exam not found in this school." };
    if (exam.isLocked) return { success: false, message: "Exam is locked. Marks cannot be edited." };

    const subject = await db.query.subjects.findFirst({
      where: and(eq(subjects.id, data.subjectId), eq(subjects.schoolId, data.schoolId)),
    });
    if (!subject) return { success: false, message: "Subject not found in this school." };

    const { bands } = await getEffectiveScale(data.schoolId, exam.gradingScaleId);

    const studentIds = [...new Set(data.entries.map((e) => e.studentId))];
    const validStudents = await db.query.students.findMany({
      where: and(eq(students.schoolId, data.schoolId), inArray(students.id, studentIds)),
    });
    if (validStudents.length !== studentIds.length)
      return { success: false, message: "One or more student IDs don't belong to this school." };
    const byStudentId = new Map(validStudents.map((s) => [s.id, s]));

    const result = await db.transaction(async (tx) => {
      const rows: TSelectExamResult[] = [];

      for (const entry of data.entries) {
        const outOf = entry.outOf ?? "100.00";
        const isAbsent = entry.isAbsent ?? false;
        const marks = isAbsent ? null : entry.marks ?? null;

        let grade: string | null = null;
        let points: number | null = null;
        if (!isAbsent && marks !== null && bands.length > 0) {
          const percentage = (Number(marks) / Number(outOf)) * 100;
          const band = resolveBand(bands, percentage);
          if (band) { grade = band.grade; points = band.points; }
        }

        const student = byStudentId.get(entry.studentId);

        const existing = await tx.query.examResults.findFirst({
          where: and(
            eq(examResults.examId, data.examId),
            eq(examResults.studentId, entry.studentId),
            eq(examResults.subjectId, data.subjectId)
          ),
        });

        if (existing) {
          const [row] = await tx
            .update(examResults)
            .set({
              marks, outOf, isAbsent, grade, points,
              remarks: entry.remarks ?? null,
              enteredBy: data.enteredBy,
              updatedAt: new Date(),
            })
            .where(eq(examResults.id, existing.id))
            .returning();
          rows.push(row);
        } else {
          const [row] = await tx
            .insert(examResults)
            .values({
              schoolId: data.schoolId,
              examId: data.examId,
              studentId: entry.studentId,
              subjectId: data.subjectId,
              classId: entry.classId ?? student?.classId ?? null,
              marks, outOf, isAbsent, grade, points,
              remarks: entry.remarks ?? null,
              enteredBy: data.enteredBy,
            })
            .returning();
          rows.push(row);
        }
      }

      return rows;
    });

    return { success: true, message: `Entered ${result.length} mark(s) for ${subject.name}.`, results: result, count: result.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-enter marks." };
  }
};

// ================================================================
// 21. UPDATE MARK
// ================================================================
export const updateMarkService = async (
  id: string,
  patch: { marks?: string | null; outOf?: string; isAbsent?: boolean; remarks?: string | null },
  updatedBy: string
): Promise<ExamResponse> => {
  try {
    const existing = await db.query.examResults.findFirst({ where: eq(examResults.id, id) });
    if (!existing) return { success: false, message: "Mark not found." };

    const exam = await db.query.termExams.findFirst({ where: eq(termExams.id, existing.examId) });
    if (exam?.isLocked) return { success: false, message: "Exam is locked." };

    const outOf = patch.outOf ?? existing.outOf;
    const isAbsent = patch.isAbsent ?? existing.isAbsent;
    const marks = isAbsent ? null : patch.marks !== undefined ? patch.marks : existing.marks;

    let grade = existing.grade;
    let points = existing.points;
    if (!isAbsent && marks !== null && exam) {
      const { bands } = await getEffectiveScale(existing.schoolId, exam.gradingScaleId);
      if (bands.length > 0) {
        const percentage = (Number(marks) / Number(outOf)) * 100;
        const band = resolveBand(bands, percentage);
        grade = band?.grade ?? null;
        points = band?.points ?? null;
      }
    } else if (isAbsent) {
      grade = null;
      points = null;
    }

    const [row] = await db
      .update(examResults)
      .set({ marks, outOf, isAbsent, grade, points, remarks: patch.remarks ?? existing.remarks, enteredBy: updatedBy, updatedAt: new Date() })
      .where(eq(examResults.id, id))
      .returning();
    return { success: true, message: "Mark updated.", result: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update mark." };
  }
};

// ================================================================
// 22. DELETE MARK
// ================================================================
export const deleteMarkService = async (id: string): Promise<ExamResponse> => {
  try {
    const existing = await db.query.examResults.findFirst({ where: eq(examResults.id, id) });
    if (!existing) return { success: false, message: "Mark not found." };

    const exam = await db.query.termExams.findFirst({ where: eq(termExams.id, existing.examId) });
    if (exam?.isLocked) return { success: false, message: "Exam is locked." };

    const [row] = await db.delete(examResults).where(eq(examResults.id, id)).returning();
    return { success: true, message: "Mark deleted.", result: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete mark." };
  }
};

// ================================================================
// 23. MARK ABSENT
// ================================================================
export const markAbsentService = async (data: {
  schoolId: string; examId: string; studentId: string; subjectId: string; enteredBy: string;
}): Promise<ExamResponse> => {
  return enterMarkService({
    schoolId: data.schoolId,
    examId: data.examId,
    studentId: data.studentId,
    subjectId: data.subjectId,
    marks: null,
    outOf: "100.00",
    isAbsent: true,
    enteredBy: data.enteredBy,
  });
};

// ================================================================
// 24. GET RESULT BY ID
// ================================================================
export const getResultByIdService = async (id: string): Promise<ExamResponse> => {
  try {
    const row = await db.query.examResults.findFirst({
      where: eq(examResults.id, id),
      with: { exam: true, student: true, subject: true },
    });
    if (!row) return { success: false, message: "Result not found." };
    return { success: true, message: "Result retrieved.", result: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch result." };
  }
};

// ================================================================
// 25. GET STUDENT'S MARKS FOR AN EXAM
// ================================================================
export const getStudentMarksForExamService = async (
  examId: string,
  studentId: string
): Promise<ExamResponse> => {
  try {
    const rows = await db.query.examResults.findMany({
      where: and(eq(examResults.examId, examId), eq(examResults.studentId, studentId)),
      with: { subject: true },
      orderBy: [asc(examResults.createdAt)],
    });

    const present = rows.filter((r) => !r.isAbsent && r.marks !== null);
    const totalMarks = present.reduce((s, r) => s + Number(r.marks ?? 0), 0);
    const totalOutOf = present.reduce((s, r) => s + Number(r.outOf), 0);
    const mean = present.length === 0 ? 0 : totalMarks / present.length;

    return {
      success: true,
      message: `Fetched ${rows.length} mark(s).`,
      results: rows as any,
      statistics: {
        totalSubjects: rows.length,
        present: present.length,
        absent: rows.length - present.length,
        totalMarks: fmt(totalMarks),
        totalOutOf: fmt(totalOutOf),
        mean: fmt(mean),
      },
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch marks." };
  }
};

// ================================================================
// 26. GET MARKSHEET
// ================================================================
export const getMarksheetService = async (
  schoolId: string,
  examId: string,
  classId: string,
  subjectId: string
): Promise<ExamResponse> => {
  try {
    const exam = await assertExamInSchool(schoolId, examId);
    if (!exam) return { success: false, message: "Exam not found in this school." };

    const roster = await db.query.students.findMany({
      where: and(
        eq(students.classId, classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });

    const results = await db.query.examResults.findMany({
      where: and(
        eq(examResults.examId, examId),
        eq(examResults.classId, classId),
        eq(examResults.subjectId, subjectId)
      ),
    });
    const byStudent = new Map(results.map((r) => [r.studentId, r]));

    const rows = roster.map((s) => {
      const r = byStudent.get(s.id);
      return {
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        marks: r?.marks ?? null,
        outOf: r?.outOf ?? "100.00",
        grade: r?.grade ?? null,
        points: r?.points ?? null,
        isAbsent: r?.isAbsent ?? false,
        remarks: r?.remarks ?? null,
      };
    });

    return {
      success: true,
      message: `Marksheet: ${rows.length} student(s), ${results.length} recorded.`,
      marksheet: { examId, subjectId, classId, scaleId: exam.gradingScaleId, rows },
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build marksheet." };
  }
};

// ================================================================
// 27. PUBLISH MARKS (compute positions + rankings + lock)
// ================================================================
export const publishMarksService = async (examId: string): Promise<ExamResponse> => {
  try {
    const exam = await db.query.termExams.findFirst({ where: eq(termExams.id, examId) });
    if (!exam) return { success: false, message: "Exam not found." };
    if (exam.isLocked) return { success: false, message: "Exam already locked." };

    const subjectRank = await computeSubjectPositionsService(examId);
    if (!subjectRank.success) return subjectRank;

    const classRank = await computeClassRankingService(examId);
    if (!classRank.success) return classRank;

    const lock = await lockExamService(examId);
    if (!lock.success) return lock;

    return {
      success: true,
      message: "Marks published. Exam locked. Subject positions and class rankings computed.",
      exam: lock.exam,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to publish marks." };
  }
};

// ================================================================
// 28. GET ALL SUBJECT MARKS
// ================================================================
export const getSubjectMarksService = async (
  schoolId: string,
  examId: string,
  subjectId: string
): Promise<ExamResponse> => {
  try {
    const rows = await db.query.examResults.findMany({
      where: and(
        eq(examResults.schoolId, schoolId),
        eq(examResults.examId, examId),
        eq(examResults.subjectId, subjectId)
      ),
      with: { student: true, class: true },
    });
    return { success: true, message: `Fetched ${rows.length} mark(s).`, results: rows as any, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch subject marks." };
  }
};

// ================================================================
// 29. COMPUTE GRADES FOR EXAM (batched — no await in loop)
// ================================================================
export const computeGradesForExamService = async (examId: string): Promise<ExamResponse> => {
  try {
    const exam = await db.query.termExams.findFirst({ where: eq(termExams.id, examId) });
    if (!exam) return { success: false, message: "Exam not found." };

    const { bands } = await getEffectiveScale(exam.schoolId, exam.gradingScaleId);
    if (bands.length === 0)
      return { success: false, message: "No grading scale available for this exam." };

    const results = await db.query.examResults.findMany({
      where: eq(examResults.examId, examId),
    });

    // Bucket IDs by (grade, points) target — key is ALWAYS a string
    const byBucket = new Map<string, string[]>();

    for (const r of results) {
      let newGrade: string | null = null;
      let newPoints: number | null = null;

      if (!r.isAbsent && r.marks !== null) {
        const percentage = (Number(r.marks) / Number(r.outOf)) * 100;
        const band = resolveBand(bands, percentage);
        newGrade = band?.grade ?? null;
        newPoints = band?.points ?? null;
      }

      // Skip if nothing changes
      if (newGrade === r.grade && newPoints === r.points) continue;

      // Key is a STRING: "null::null" or "A::12" or "B::9"
      const key = `${newGrade ?? "null"}::${newPoints ?? "null"}`;
      if (!byBucket.has(key)) byBucket.set(key, []);
      byBucket.get(key)!.push(r.id);
    }

    let updated = 0;
    for (const [key, ids] of byBucket.entries()) {
      if (ids.length === 0) continue;

      const [gradeStr, pointsStr] = key.split("::");
      const grade: string | null = gradeStr === "null" ? null : gradeStr;
      const points: number | null = pointsStr === "null" ? null : Number(pointsStr);

      await db
        .update(examResults)
        .set({ grade, points })
        .where(inArray(examResults.id, ids));

      updated += ids.length;
    }

    return {
      success: true,
      message: `Computed grades for ${results.length} result(s); ${updated} updated.`,
      count: updated,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute grades." };
  }
};

// ================================================================
// 30. COMPUTE SUBJECT POSITIONS (batched)
// ================================================================
export const computeSubjectPositionsService = async (examId: string): Promise<ExamResponse> => {
  try {
    const results = await db.query.examResults.findMany({
      where: eq(examResults.examId, examId),
    });

    // Group by (classId, subjectId)
    const groups = new Map<string, TSelectExamResult[]>();
    for (const r of results) {
      if (r.isAbsent || r.marks === null || !r.classId) continue;
      const key = `${r.classId}::${r.subjectId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    // Build a bucket of (position → [ids])
    const byPosition = new Map<number, string[]>();
    for (const [, group] of groups) {
      group.sort((a, b) => Number(b.marks ?? 0) - Number(a.marks ?? 0));
      for (let i = 0; i < group.length; i++) {
        const r = group[i];
        let position = i + 1;
        if (i > 0 && Number(group[i - 1].marks ?? 0) === Number(r.marks ?? 0)) {
          position = group[i - 1].subjectPosition ?? position;
        }
        if (r.subjectPosition !== position) {
          if (!byPosition.has(position)) byPosition.set(position, []);
          byPosition.get(position)!.push(r.id);
        }
      }
    }

    let updated = 0;
    for (const [position, ids] of byPosition.entries()) {
      if (ids.length === 0) continue;
      await db
        .update(examResults)
        .set({ subjectPosition: position })
        .where(inArray(examResults.id, ids));
      updated += ids.length;
    }

    return { success: true, message: `Computed subject positions; ${updated} result(s) updated.`, count: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute subject positions." };
  }
};

// ================================================================
// 31. COMPUTE CLASS RANKING (no shadowing, no broken inArray)
// ================================================================
export const computeClassRankingService = async (examId: string): Promise<ExamResponse> => {
  try {
    const results = await db.query.examResults.findMany({
      where: eq(examResults.examId, examId),
    });

    // Group by classId, then by studentId — do NOT shadow the `students` import
    const byClass = new Map<string, Map<string, TSelectExamResult[]>>();
    for (const r of results) {
      if (!r.classId) continue;
      if (!byClass.has(r.classId)) byClass.set(r.classId, new Map());
      const studentMap = byClass.get(r.classId)!;
      if (!studentMap.has(r.studentId)) studentMap.set(r.studentId, []);
      studentMap.get(r.studentId)!.push(r);
    }

    const ranking: NonNullable<ExamResponse["ranking"]> = [];

    for (const [, studentsInClass] of byClass.entries()) {
      const studentIdsInClass = Array.from(studentsInClass.keys());

      // Fetch students for this class in one query
      const studentRows = studentIdsInClass.length
        ? await db
            .select({
              id: students.id,
              admissionNumber: students.admissionNumber,
              firstName: students.firstName,
              lastName: students.lastName,
            })
            .from(students)
            .where(inArray(students.id, studentIdsInClass))
        : [];
      const byId = new Map(studentRows.map((s) => [s.id, s]));

      const totals: Array<{
        studentId: string;
        totalMarks: number;
        totalOutOf: number;
        subjectsCount: number;
        meanScore: number;
        meanGrade: string;
      }> = [];

      for (const [studentId, studentResults] of studentsInClass.entries()) {
        const present = studentResults.filter((r) => !r.isAbsent && r.marks !== null);
        const totalMarks = present.reduce((s, r) => s + Number(r.marks ?? 0), 0);
        const totalOutOf = present.reduce((s, r) => s + Number(r.outOf), 0);
        const meanScore = present.length === 0 ? 0 : totalMarks / present.length;

        // Mean grade: the grade of the mean percentage
        let meanGrade = "N/A";
        if (present.length > 0) {
          const gradesPresent = present.map((r) => r.grade).filter(Boolean) as string[];
          meanGrade = gradesPresent.length > 0 ? gradesPresent[0] : "N/A";
        }

        totals.push({
          studentId,
          totalMarks,
          totalOutOf,
          subjectsCount: present.length,
          meanScore,
          meanGrade,
        });
      }

      totals.sort((a, b) => b.meanScore - a.meanScore);

      for (let i = 0; i < totals.length; i++) {
        const t = totals[i];
        const s = byId.get(t.studentId);
        if (!s) continue;
        ranking.push({
          studentId: t.studentId,
          admissionNumber: s.admissionNumber,
          firstName: s.firstName,
          lastName: s.lastName,
          totalMarks: fmt(t.totalMarks),
          totalOutOf: fmt(t.totalOutOf),
          meanScore: fmt(t.meanScore),
          meanGrade: t.meanGrade,
          position: i + 1,
          subjectsCount: t.subjectsCount,
        });
      }
    }

    ranking.sort((a, b) => a.position - b.position);

    return {
      success: true,
      message: `Computed class ranking across ${ranking.length} student(s).`,
      ranking,
      count: ranking.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute class ranking." };
  }
};

// ================================================================
// 32. COMPUTE SUBJECT STATISTICS
// ================================================================
export const computeSubjectStatisticsService = async (examId: string): Promise<ExamResponse> => {
  try {
    const results = await db.query.examResults.findMany({
      where: eq(examResults.examId, examId),
      with: { subject: true },
    });

    const bySubject = new Map<string, TSelectExamResult[]>();
    for (const r of results) {
      if (!bySubject.has(r.subjectId)) bySubject.set(r.subjectId, []);
      bySubject.get(r.subjectId)!.push(r);
    }

    const stats: Record<string, any> = {};
    for (const [subjectId, rows] of bySubject.entries()) {
      const present = rows.filter((r) => !r.isAbsent && r.marks !== null);
      const totalMarks = present.reduce((s, r) => s + Number(r.marks ?? 0), 0);
      const totalOutOf = present.reduce((s, r) => s + Number(r.outOf), 0);
      const mean = present.length === 0 ? 0 : totalMarks / present.length;
      const meanPercentage = totalOutOf === 0 ? 0 : (totalMarks / totalOutOf) * 100;

      const distribution: Record<string, number> = {};
      for (const r of present) {
        const g = r.grade ?? "N/A";
        distribution[g] = (distribution[g] ?? 0) + 1;
      }

      const passCount = present.filter((r) => r.grade && !["E", "BE", "1", "2", "3"].includes(r.grade)).length;
      const passRate = present.length === 0 ? 0 : (passCount / present.length) * 100;

      stats[subjectId] = {
        subjectName: (rows[0] as any).subject?.name ?? "Unknown",
        totalStudents: rows.length,
        present: present.length,
        absent: rows.length - present.length,
        mean: fmt(mean),
        meanPercentage: fmt(meanPercentage),
        passRate: fmt(passRate),
        distribution,
      };
    }

    return {
      success: true,
      message: `Computed statistics across ${Object.keys(stats).length} subject(s).`,
      statistics: stats,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute subject statistics." };
  }
};

// ================================================================
// 33. COMPUTE CLASS PERFORMANCE
// ================================================================
export const computeClassPerformanceService = async (examId: string): Promise<ExamResponse> => {
  try {
    const results = await db.query.examResults.findMany({
      where: eq(examResults.examId, examId),
      with: { student: true, subject: true },
    });

    const byClass = new Map<string, TSelectExamResult[]>();
    for (const r of results) {
      if (!r.classId) continue;
      if (!byClass.has(r.classId)) byClass.set(r.classId, []);
      byClass.get(r.classId)!.push(r);
    }

    const performance: Record<string, any> = {};
    for (const [classId, rows] of byClass.entries()) {
      const present = rows.filter((r) => !r.isAbsent && r.marks !== null);
      const totalMarks = present.reduce((s, r) => s + Number(r.marks ?? 0), 0);
      const mean = present.length === 0 ? 0 : totalMarks / present.length;

      performance[classId] = {
        totalStudents: new Set(rows.map((r) => r.studentId)).size,
        totalSubjects: new Set(rows.map((r) => r.subjectId)).size,
        totalResults: rows.length,
        absent: rows.length - present.length,
        mean: fmt(mean),
      };
    }

    return {
      success: true,
      message: `Computed performance across ${Object.keys(performance).length} class(es).`,
      statistics: performance,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute class performance." };
  }
};

// ================================================================
// 34. GET STUDENT TRANSCRIPT
// ================================================================
export const getStudentTranscriptService = async (studentId: string): Promise<ExamResponse> => {
  try {
    const results = await db.query.examResults.findMany({
      where: eq(examResults.studentId, studentId),
      with: { exam: true, subject: true },
      orderBy: [asc(examResults.createdAt)],
    });

    const byExam = new Map<string, { exam: TSelectTermExam; results: TSelectExamResult[] }>();
    for (const r of results) {
      if (!byExam.has(r.examId)) {
        byExam.set(r.examId, { exam: (r as any).exam, results: [] });
      }
      byExam.get(r.examId)!.results.push(r);
    }

    const examIds = Array.from(byExam.keys());
    const exams = examIds.length
      ? await db.query.termExams.findMany({ where: inArray(termExams.id, examIds) })
      : [];
    const examById = new Map(exams.map((e) => [e.id, e]));

    const termIds = [...new Set(exams.map((e) => e.termId))];
    const terms = termIds.length
      ? await db.query.academicTerms.findMany({ where: inArray(academicTerms.id, termIds) })
      : [];
    const termById = new Map(terms.map((t) => [t.id, t]));

    const transcript: NonNullable<ExamResponse["transcript"]> = [];
    for (const [examId, data] of byExam.entries()) {
      const exam = examById.get(examId);
      if (!exam) continue;
      const term = termById.get(exam.termId);
      transcript.push({
        examId,
        examTitle: exam.examTitle,
        termName: term?.termName ?? "Unknown",
        academicYear: term?.academicYear ?? "Unknown",
        results: data.results,
      });
    }

    return {
      success: true,
      message: `Transcript across ${transcript.length} exam(s) and ${results.length} result(s).`,
      transcript,
      count: results.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build transcript." };
  }
};

// ================================================================
// 35. GET EXAM REPORT
// ================================================================
export const getExamReportService = async (examId: string): Promise<ExamResponse> => {
  try {
    const exam = await db.query.termExams.findFirst({ where: eq(termExams.id, examId) });
    if (!exam) return { success: false, message: "Exam not found." };

    const [stats, subjectStats, classPerf] = await Promise.all([
      getExamStatisticsService(examId),
      computeSubjectStatisticsService(examId),
      computeClassPerformanceService(examId),
    ]);

    return {
      success: true,
      message: `Full report for "${exam.examTitle}".`,
      exam,
      statistics: {
        summary: stats.statistics,
        bySubject: subjectStats.statistics,
        byClass: classPerf.statistics,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build exam report." };
  }
};