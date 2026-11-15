// services/reportCards.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, inArray, gte, lte,
} from "drizzle-orm";

import {
  reportCards,
  students,
  classes,
  gradeLevels,
  academicTerms,
  termExams,
  examResults,
  subjects,
  attendance,
  schools,
  gradingScales,
  gradingBands,
  TSelectReportCard,
  TSelectStudent,
  TSelectAcademicTerm,
  TSelectClass,
  TSelectTermExam,
  TSelectExamResult,
  TSelectGradingBand,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Input types
// ================================================================
export interface GenerateReportCardInput {
  schoolId: string;
  studentId: string;
  termId: string;
  classTeacherRemarks?: string | null;
  principalRemarks?: string | null;
}

// ================================================================
// Response envelope
// ================================================================
export interface ReportCardResponse {
  success: boolean;
  message: string;
  reportCard?: TSelectReportCard;
  reportCards?: TSelectReportCard[];
  preview?: ReportCardPayload;
  data?: ReportCardPayload;
  summary?: {
    total: number;
    generated: number;
    skipped: number;
    failed: number;
  };
  count?: number;
  issues?: string[];
}

/** Full render-ready payload for a report card. */
export interface ReportCardPayload {
  reportCard: TSelectReportCard | null;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    gender: string | null;
    dateOfBirth: string | null;
  };
  school: {
    id: string;
    name: string;
    shortName: string | null;
    motto: string | null;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  term: {
    id: string;
    academicYear: string;
    termName: string;
    startDate: string;
    endDate: string;
  };
  class: {
    id: string;
    gradeLevel: string;
    stream: string;
    academicYear: string;
  };
  exams: Array<{
    examId: string;
    examTitle: string;
    examCategory: string;
    weighting: string | null;
    isLocked: boolean;
  }>;
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    marks: string | null;
    outOf: string | null;
    percentage: string | null;
    grade: string | null;
    points: number | null;
    isAbsent: boolean;
    teacherRemarks: string | null;
  }>;
  totals: {
    subjectsCount: number;
    totalMarks: string;
    totalOutOf: string;
    totalPoints: number;
    meanScore: string;
    meanGrade: string;
  };
  attendance: {
    daysPresent: number;
    daysAbsent: number;
    daysLate: number;
    daysTotal: number;
    attendanceRate: string;
  };
  classPosition: number | null;
  streamSize: number | null;
  classTeacherRemarks: string | null;
  principalRemarks: string | null;
  isPublished: boolean;
  publishedAt: string | null;
}

// ================================================================
// Helpers
// ================================================================
const fmt = (n: number) => n.toFixed(2);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Returns locked exams in a term + their weightings. */
const getLockedExamsInTerm = async (
  schoolId: string,
  termId: string
): Promise<TSelectTermExam[]> => {
  return await db.query.termExams.findMany({
    where: and(
      eq(termExams.schoolId, schoolId),
      eq(termExams.termId, termId),
      eq(termExams.isLocked, true)
    ),
    orderBy: [asc(termExams.startDate)],
  });
};

/** Resolves the effective grading scale (exam → school default). */
const getEffectiveBands = async (
  schoolId: string,
  examGradingScaleId: string | null
): Promise<TSelectGradingBand[]> => {
  let scaleId = examGradingScaleId;
  if (!scaleId) {
    const def = await db.query.gradingScales.findFirst({
      where: and(
        eq(gradingScales.schoolId, schoolId),
        eq(gradingScales.isDefault, true)
      ),
    });
    scaleId = def?.id ?? null;
  }
  if (!scaleId) return [];
  return await db.query.gradingBands.findMany({
    where: eq(gradingBands.scaleId, scaleId),
    orderBy: [desc(gradingBands.minScore)],
  });
};

const resolveBand = (bands: TSelectGradingBand[], pct: number): TSelectGradingBand | null => {
  for (const b of bands) {
    if (pct >= Number(b.minScore) && pct <= Number(b.maxScore)) return b;
  }
  return null;
};

// ================================================================
// 1. COMPUTE MEAN SCORE (weighted across locked exams)
// ================================================================
export const computeMeanScoreForStudentService = async (
  schoolId: string,
  studentId: string,
  termId: string
): Promise<{
  success: boolean;
  message: string;
  totalMarks: number;
  totalOutOf: number;
  meanScore: number;
  meanPercentage: number;
  subjectsCount: number;
  perSubject: Map<string, { marks: number; outOf: number; grades: string[]; points: number[]; absents: number }>;
}> => {
  try {
    const locked = await getLockedExamsInTerm(schoolId, termId);
    if (locked.length === 0) {
      return {
        success: false,
        message: "No locked exams in this term. Publish exams before generating report cards.",
        totalMarks: 0, totalOutOf: 0, meanScore: 0, meanPercentage: 0, subjectsCount: 0,
        perSubject: new Map(),
      };
    }

    const examIds = locked.map((e) => e.id);
    const results = await db.query.examResults.findMany({
      where: and(
        eq(examResults.schoolId, schoolId),
        eq(examResults.studentId, studentId),
        inArray(examResults.examId, examIds)
      ),
    });

    // Aggregate per subject across all exams
    const perSubject = new Map<
      string,
      { marks: number; outOf: number; grades: string[]; points: number[]; absents: number }
    >();
    for (const r of results) {
      if (!perSubject.has(r.subjectId)) {
        perSubject.set(r.subjectId, { marks: 0, outOf: 0, grades: [], points: [], absents: 0 });
      }
      const bucket = perSubject.get(r.subjectId)!;
      if (r.isAbsent) {
        bucket.absents++;
        continue;
      }
      if (r.marks !== null) {
        bucket.marks += Number(r.marks);
        bucket.outOf += Number(r.outOf);
      }
      if (r.grade) bucket.grades.push(r.grade);
      if (r.points !== null) bucket.points.push(r.points);
    }

    // Overall totals
    let totalMarks = 0;
    let totalOutOf = 0;
    for (const b of perSubject.values()) {
      totalMarks += b.marks;
      totalOutOf += b.outOf;
    }

    const meanPercentage = totalOutOf === 0 ? 0 : (totalMarks / totalOutOf) * 100;

    return {
      success: true,
      message: `Mean computed across ${perSubject.size} subject(s).`,
      totalMarks,
      totalOutOf,
      meanScore: perSubject.size === 0 ? 0 : round2(totalMarks / perSubject.size),
      meanPercentage: round2(meanPercentage),
      subjectsCount: perSubject.size,
      perSubject,
    };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || "Failed to compute mean.",
      totalMarks: 0, totalOutOf: 0, meanScore: 0, meanPercentage: 0, subjectsCount: 0,
      perSubject: new Map(),
    };
  }
};

// ================================================================
// 2. COMPUTE CLASS POSITION
// ================================================================
export const computeClassPositionService = async (
  schoolId: string,
  classId: string,
  termId: string,
  studentId: string
): Promise<{ success: boolean; message: string; position: number | null; streamSize: number; meanScore: number | null }> => {
  try {
    const roster = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.classId, classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
      columns: { id: true },
    });

    if (roster.length === 0) {
      return { success: false, message: "No enrolled students in this class.", position: null, streamSize: 0, meanScore: null };
    }

    const scores: Array<{ studentId: string; mean: number }> = [];
    for (const s of roster) {
      const result = await computeMeanScoreForStudentService(schoolId, s.id, termId);
      if (result.success) {
        scores.push({ studentId: s.id, mean: result.meanPercentage });
      }
    }

    scores.sort((a, b) => b.mean - a.mean);

    let position: number | null = null;
    let prevMean = -1;
    let prevPosition = 0;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i].mean !== prevMean) {
        position = i + 1;
        prevPosition = position;
        prevMean = scores[i].mean;
      } else {
        position = prevPosition;
      }
      if (scores[i].studentId === studentId) break;
    }

    const target = scores.find((s) => s.studentId === studentId);
    return {
      success: true,
      message: `Class position: ${position ?? "N/A"} of ${scores.length}.`,
      position,
      streamSize: scores.length,
      meanScore: target?.mean ?? null,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute class position.", position: null, streamSize: 0, meanScore: null };
  }
};

// ================================================================
// 3. COMPUTE STREAM SIZE
// ================================================================
export const computeStreamSizeService = async (
  schoolId: string,
  classId: string
): Promise<{ success: boolean; message: string; streamSize: number }> => {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(students)
      .where(
        and(
          eq(students.schoolId, schoolId),
          eq(students.classId, classId),
          eq(students.isEnrolled, true),
          isNull(students.deletedAt)
        )
      );
    return { success: true, message: `${Number(row?.c ?? 0)} student(s).`, streamSize: Number(row?.c ?? 0) };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute stream size.", streamSize: 0 };
  }
};

// ================================================================
// 4. COMPUTE ATTENDANCE DAYS
// ================================================================
export const computeAttendanceDaysService = async (
  schoolId: string,
  studentId: string,
  termId: string
): Promise<{ success: boolean; message: string; daysPresent: number; daysAbsent: number; daysLate: number; daysTotal: number; attendanceRate: string }> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, termId),
    });
    if (!term) {
      return { success: false, message: "Term not found.", daysPresent: 0, daysAbsent: 0, daysLate: 0, daysTotal: 0, attendanceRate: "0.00" };
    }

    const rows = await db.query.attendance.findMany({
      where: and(
        eq(attendance.schoolId, schoolId),
        eq(attendance.studentId, studentId),
        gte(attendance.date, term.startDate),
        lte(attendance.date, term.endDate)
      ),
    });

    const daysPresent = rows.filter((r) => r.status === "Present").length;
    const daysAbsent = rows.filter((r) => r.status === "Absent").length;
    const daysLate = rows.filter((r) => r.status === "Late").length;
    const daysTotal = rows.length;
    const attended = daysPresent + daysLate;
    const attendanceRate = daysTotal === 0 ? "0.00" : fmt((attended / daysTotal) * 100);

    return {
      success: true,
      message: `${attended}/${daysTotal} days present (${attendanceRate}%).`,
      daysPresent, daysAbsent, daysLate, daysTotal, attendanceRate,
    };
  } catch (e: any) {
    return {
      success: false, message: e?.message || "Failed to compute attendance.",
      daysPresent: 0, daysAbsent: 0, daysLate: 0, daysTotal: 0, attendanceRate: "0.00",
    };
  }
};

// ================================================================
// 5. RESOLVE DEFAULT REMARKS FROM GRADE
// ================================================================
export const resolveDefaultRemarksForGradeService = async (
  schoolId: string,
  termId: string,
  grade: string
): Promise<{ success: boolean; message: string; remark: string | null }> => {
  try {
    const locked = await getLockedExamsInTerm(schoolId, termId);
    const gradingScaleId = locked[0]?.gradingScaleId ?? null;
    const bands = await getEffectiveBands(schoolId, gradingScaleId);
    const band = bands.find((b) => b.grade === grade);
    return {
      success: true,
      message: `Remarks resolved for grade ${grade}.`,
      remark: band?.remark ?? null,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to resolve remarks.", remark: null };
  }
};

// ================================================================
// 6. COMPUTE SUBJECT BREAKDOWN (one row per subject)
// ================================================================
export const computeSubjectBreakdownService = async (
  schoolId: string,
  studentId: string,
  termId: string
): Promise<{
  success: boolean;
  message: string;
  subjects: ReportCardPayload["subjects"];
}> => {
  try {
    const locked = await getLockedExamsInTerm(schoolId, termId);
    if (locked.length === 0) {
      return { success: false, message: "No locked exams in this term.", subjects: [] };
    }

    const examIds = locked.map((e) => e.id);
    const gradingScaleId = locked[0]?.gradingScaleId ?? null;
    const bands = await getEffectiveBands(schoolId, gradingScaleId);

    const results = await db.query.examResults.findMany({
      where: and(
        eq(examResults.schoolId, schoolId),
        eq(examResults.studentId, studentId),
        inArray(examResults.examId, examIds)
      ),
      with: { subject: true },
    });

    const bySubject = new Map<string, {
      subjectName: string;
      subjectCode: string;
      marks: number;
      outOf: number;
      absents: number;
      remarks: string | null;
    }>();

    for (const r of results) {
      if (!bySubject.has(r.subjectId)) {
        bySubject.set(r.subjectId, {
          subjectName: (r as any).subject?.name ?? "Unknown",
          subjectCode: (r as any).subject?.code ?? "",
          marks: 0,
          outOf: 0,
          absents: 0,
          remarks: r.remarks,
        });
      }
      const b = bySubject.get(r.subjectId)!;
      if (r.isAbsent) {
        b.absents++;
        continue;
      }
      if (r.marks !== null) {
        b.marks += Number(r.marks);
        b.outOf += Number(r.outOf);
      }
      if (r.remarks) b.remarks = r.remarks;
    }

    const subjectsOut: ReportCardPayload["subjects"] = [];
    for (const [subjectId, b] of bySubject.entries()) {
      const percentage = b.outOf === 0 ? 0 : (b.marks / b.outOf) * 100;
      const band = resolveBand(bands, percentage);
      subjectsOut.push({
        subjectId,
        subjectName: b.subjectName,
        subjectCode: b.subjectCode,
        marks: b.absents > 0 && b.outOf === 0 ? null : fmt(b.marks),
        outOf: b.outOf === 0 ? null : fmt(b.outOf),
        percentage: b.outOf === 0 ? null : fmt(percentage),
        grade: band?.grade ?? null,
        points: band?.points ?? null,
        isAbsent: b.absents > 0 && b.outOf === 0,
        teacherRemarks: b.remarks,
      });
    }

    return { success: true, message: `${subjectsOut.length} subject(s) computed.`, subjects: subjectsOut };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute subject breakdown.", subjects: [] };
  }
};

// ================================================================
// 7. PREVIEW (dry-run, no save)
// ================================================================
export const previewReportCardService = async (
  data: GenerateReportCardInput
): Promise<ReportCardResponse> => {
  try {
    const student = await db.query.students.findFirst({
      where: and(eq(students.id, data.studentId), eq(students.schoolId, data.schoolId)),
    });
    if (!student) return { success: false, message: "Student not found in this school." };
    if (!student.classId) return { success: false, message: "Student is not assigned to a class." };

    const term = await db.query.academicTerms.findFirst({
      where: and(eq(academicTerms.id, data.termId), eq(academicTerms.schoolId, data.schoolId)),
    });
    if (!term) return { success: false, message: "Term not found in this school." };

    const cls = await db.query.classes.findFirst({ where: eq(classes.id, student.classId) });
    if (!cls) return { success: false, message: "Class not found." };

    const grade = await db.query.gradeLevels.findFirst({ where: eq(gradeLevels.id, cls.gradeLevelId) });
    const school = await db.query.schools.findFirst({ where: eq(schools.id, data.schoolId) });

    const locked = await getLockedExamsInTerm(data.schoolId, data.termId);
    if (locked.length === 0) {
      return {
        success: false,
        message: "No locked exams in this term. Publish exams before generating report cards.",
      };
    }

    const meanResult = await computeMeanScoreForStudentService(data.schoolId, data.studentId, data.termId);
    const positionResult = await computeClassPositionService(data.schoolId, student.classId, data.termId, data.studentId);
    const attendanceResult = await computeAttendanceDaysService(data.schoolId, data.studentId, data.termId);
    const subjectResult = await computeSubjectBreakdownService(data.schoolId, data.studentId, data.termId);

    const gradingScaleId = locked[0]?.gradingScaleId ?? null;
    const bands = await getEffectiveBands(data.schoolId, gradingScaleId);
    const meanBand = resolveBand(bands, meanResult.meanPercentage);

    const payload: ReportCardPayload = {
      reportCard: null,
      student: {
        id: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
      },
      school: {
        id: school?.id ?? "",
        name: school?.name ?? "",
        shortName: school?.shortName ?? null,
        motto: school?.motto ?? null,
        logoUrl: school?.logoUrl ?? null,
        address: school?.address ?? null,
        phone: school?.phone ?? null,
        email: school?.email ?? null,
      },
      term: {
        id: term.id,
        academicYear: term.academicYear,
        termName: term.termName,
        startDate: term.startDate,
        endDate: term.endDate,
      },
      class: {
        id: cls.id,
        gradeLevel: grade?.name ?? "Unknown",
        stream: cls.stream,
        academicYear: cls.academicYear,
      },
      exams: locked.map((e) => ({
        examId: e.id,
        examTitle: e.examTitle,
        examCategory: e.examCategory,
        weighting: e.weighting,
        isLocked: e.isLocked,
      })),
      subjects: subjectResult.subjects,
      totals: {
        subjectsCount: meanResult.subjectsCount,
        totalMarks: fmt(meanResult.totalMarks),
        totalOutOf: fmt(meanResult.totalOutOf),
        totalPoints: subjectResult.subjects.reduce((s, r) => s + (r.points ?? 0), 0),
        meanScore: fmt(meanResult.meanPercentage),
        meanGrade: meanBand?.grade ?? "N/A",
      },
      attendance: {
        daysPresent: attendanceResult.daysPresent,
        daysAbsent: attendanceResult.daysAbsent,
        daysLate: attendanceResult.daysLate,
        daysTotal: attendanceResult.daysTotal,
        attendanceRate: attendanceResult.attendanceRate,
      },
      classPosition: positionResult.position,
      streamSize: positionResult.streamSize,
      classTeacherRemarks: data.classTeacherRemarks ?? meanBand?.remark ?? null,
      principalRemarks: data.principalRemarks ?? null,
      isPublished: false,
      publishedAt: null,
    };

    return { success: true, message: "Preview ready.", preview: payload };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to preview report card." };
  }
};

// ================================================================
// 8. GENERATE (one student)
// ================================================================
export const generateReportCardService = async (
  data: GenerateReportCardInput
): Promise<ReportCardResponse> => {
  try {
    const preview = await previewReportCardService(data);
    if (!preview.success || !preview.preview) return preview;

    const payload = preview.preview;

    // Prevent duplicates: unique (studentId, termId)
    const existing = await db.query.reportCards.findFirst({
      where: and(
        eq(reportCards.studentId, data.studentId),
        eq(reportCards.termId, data.termId)
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(reportCards)
        .set({
          meanScore: payload.totals.meanScore,
          classPosition: payload.classPosition,
          streamSize: payload.streamSize,
          attendanceDays: payload.attendance.daysTotal,
          classTeacherRemarks: payload.classTeacherRemarks,
          principalRemarks: payload.principalRemarks,
          updatedAt: new Date(),
        })
        .where(eq(reportCards.id, existing.id))
        .returning();
      return { success: true, message: "Report card regenerated.", reportCard: updated, data: payload };
    }

    const [created] = await db
      .insert(reportCards)
      .values({
        schoolId: data.schoolId,
        studentId: data.studentId,
        termId: data.termId,
        classId: payload.class.id,
        meanScore: payload.totals.meanScore,
        classPosition: payload.classPosition,
        streamSize: payload.streamSize,
        attendanceDays: payload.attendance.daysTotal,
        classTeacherRemarks: payload.classTeacherRemarks,
        principalRemarks: payload.principalRemarks,
        isPublished: false,
      })
      .returning();

    return { success: true, message: "Report card generated.", reportCard: created, data: payload };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to generate report card." };
  }
};

// ================================================================
// 9. GENERATE FOR CLASS
// ================================================================
export const generateReportCardsForClassService = async (
  schoolId: string,
  classId: string,
  termId: string
): Promise<ReportCardResponse> => {
  try {
    const roster = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.classId, classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
    });

    if (roster.length === 0) return { success: false, message: "No enrolled students in this class." };

    const generated: TSelectReportCard[] = [];
    let failed = 0;
    const issues: string[] = [];

    for (const s of roster) {
      const r = await generateReportCardService({ schoolId, studentId: s.id, termId });
      if (r.success && r.reportCard) generated.push(r.reportCard);
      else {
        failed++;
        issues.push(`${s.firstName} ${s.lastName}: ${r.message}`);
      }
    }

    return {
      success: true,
      message: `Generated ${generated.length} report card(s); ${failed} failed.`,
      reportCards: generated,
      summary: { total: roster.length, generated: generated.length, skipped: 0, failed },
      issues: issues.length > 0 ? issues : undefined,
      count: generated.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to generate class report cards." };
  }
};

// ================================================================
// 10. GENERATE FOR SCHOOL
// ================================================================
export const generateReportCardsForSchoolService = async (
  schoolId: string,
  termId: string
): Promise<ReportCardResponse> => {
  try {
    const roster = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
    });

    if (roster.length === 0) return { success: false, message: "No enrolled students in this school." };

    const generated: TSelectReportCard[] = [];
    let failed = 0;
    const issues: string[] = [];

    for (const s of roster) {
      if (!s.classId) { failed++; continue; }
      const r = await generateReportCardService({ schoolId, studentId: s.id, termId });
      if (r.success && r.reportCard) generated.push(r.reportCard);
      else { failed++; issues.push(`${s.firstName} ${s.lastName}: ${r.message}`); }
    }

    return {
      success: true,
      message: `Generated ${generated.length} report card(s); ${failed} failed.`,
      reportCards: generated,
      summary: { total: roster.length, generated: generated.length, skipped: 0, failed },
      issues: issues.length > 0 ? issues.slice(0, 10) : undefined,
      count: generated.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to generate school report cards." };
  }
};

// ================================================================
// 11. REGENERATE (force recompute)
// ================================================================
export const regenerateReportCardService = async (
  reportCardId: string
): Promise<ReportCardResponse> => {
  try {
    const existing = await db.query.reportCards.findFirst({
      where: eq(reportCards.id, reportCardId),
    });
    if (!existing) return { success: false, message: "Report card not found." };

    return generateReportCardService({
      schoolId: existing.schoolId,
      studentId: existing.studentId,
      termId: existing.termId,
    });
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to regenerate report card." };
  }
};

// ================================================================
// 12. GET BY ID (with relations)
// ================================================================
export const getReportCardByIdService = async (id: string): Promise<ReportCardResponse> => {
  try {
    const row = await db.query.reportCards.findFirst({
      where: eq(reportCards.id, id),
      with: { student: true, term: true, class: true },
    });
    if (!row) return { success: false, message: "Report card not found." };
    return { success: true, message: "Report card retrieved.", reportCard: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch report card." };
  }
};

// ================================================================
// 13. GET BY STUDENT + TERM
// ================================================================
export const getReportCardByStudentTermService = async (
  studentId: string,
  termId: string
): Promise<ReportCardResponse> => {
  try {
    const row = await db.query.reportCards.findFirst({
      where: and(eq(reportCards.studentId, studentId), eq(reportCards.termId, termId)),
      with: { student: true, term: true, class: true },
    });
    if (!row) return { success: false, message: "No report card for this student and term." };
    return { success: true, message: "Report card retrieved.", reportCard: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch report card." };
  }
};

// ================================================================
// 14. LIST FOR STUDENT (all terms)
// ================================================================
export const listReportCardsForStudentService = async (
  schoolId: string,
  studentId: string
): Promise<ReportCardResponse> => {
  try {
    const rows = await db.query.reportCards.findMany({
      where: and(eq(reportCards.schoolId, schoolId), eq(reportCards.studentId, studentId)),
      orderBy: [desc(reportCards.createdAt)],
    });
    return { success: true, message: `Fetched ${rows.length} report card(s).`, reportCards: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list report cards." };
  }
};

// ================================================================
// 15. LIST FOR CLASS
// ================================================================
export const listReportCardsForClassService = async (
  schoolId: string,
  classId: string,
  termId: string
): Promise<ReportCardResponse> => {
  try {
    const rows = await db.query.reportCards.findMany({
      where: and(
        eq(reportCards.schoolId, schoolId),
        eq(reportCards.classId, classId),
        eq(reportCards.termId, termId)
      ),
      with: { student: true },
      orderBy: [desc(reportCards.classPosition)],
    });
    return { success: true, message: `Fetched ${rows.length} report card(s).`, reportCards: rows as any, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list report cards." };
  }
};

// ================================================================
// 16. LIST FOR TERM
// ================================================================
export const listReportCardsForTermService = async (
  schoolId: string,
  termId: string,
  classId?: string
): Promise<ReportCardResponse> => {
  try {
    const filters: any[] = [eq(reportCards.schoolId, schoolId), eq(reportCards.termId, termId)];
    if (classId) filters.push(eq(reportCards.classId, classId));

    const rows = await db.query.reportCards.findMany({
      where: and(...filters),
      with: { student: true, class: true },
      orderBy: [asc(reportCards.classId), desc(reportCards.classPosition)],
    });
    return { success: true, message: `Fetched ${rows.length} report card(s).`, reportCards: rows as any, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list report cards." };
  }
};

// ================================================================
// 17. UPDATE REMARKS (manual)
// ================================================================
export const updateRemarksService = async (
  reportCardId: string,
  patch: { classTeacherRemarks?: string | null; principalRemarks?: string | null }
): Promise<ReportCardResponse> => {
  try {
    const existing = await db.query.reportCards.findFirst({ where: eq(reportCards.id, reportCardId) });
    if (!existing) return { success: false, message: "Report card not found." };

    const [updated] = await db
      .update(reportCards)
      .set({
        ...(patch.classTeacherRemarks !== undefined && { classTeacherRemarks: patch.classTeacherRemarks }),
        ...(patch.principalRemarks !== undefined && { principalRemarks: patch.principalRemarks }),
        updatedAt: new Date(),
      })
      .where(eq(reportCards.id, reportCardId))
      .returning();
    return { success: true, message: "Remarks updated.", reportCard: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update remarks." };
  }
};

// ================================================================
// 18. OVERRIDE FIELDS (admin correction)
// ================================================================
export const overrideReportCardFieldsService = async (
  reportCardId: string,
  patch: {
    meanScore?: string | null;
    classPosition?: number | null;
    streamSize?: number | null;
    attendanceDays?: number | null;
    classTeacherRemarks?: string | null;
    principalRemarks?: string | null;
  }
): Promise<ReportCardResponse> => {
  try {
    const existing = await db.query.reportCards.findFirst({ where: eq(reportCards.id, reportCardId) });
    if (!existing) return { success: false, message: "Report card not found." };

    const [updated] = await db
      .update(reportCards)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(reportCards.id, reportCardId))
      .returning();
    return { success: true, message: "Report card fields overridden.", reportCard: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to override fields." };
  }
};

// ================================================================
// 19. PUBLISH (single)
// ================================================================
export const publishReportCardService = async (reportCardId: string): Promise<ReportCardResponse> => {
  try {
    const [updated] = await db
      .update(reportCards)
      .set({ isPublished: true, publishedAt: new Date() })
      .where(eq(reportCards.id, reportCardId))
      .returning();
    if (!updated) return { success: false, message: "Report card not found." };
    return { success: true, message: "Report card published. Parents can now view it.", reportCard: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to publish report card." };
  }
};

// ================================================================
// 20. PUBLISH FOR CLASS
// ================================================================
export const publishReportCardsForClassService = async (
  schoolId: string,
  classId: string,
  termId: string
): Promise<ReportCardResponse> => {
  try {
    const rows = await db
      .update(reportCards)
      .set({ isPublished: true, publishedAt: new Date() })
      .where(
        and(
          eq(reportCards.schoolId, schoolId),
          eq(reportCards.classId, classId),
          eq(reportCards.termId, termId),
          eq(reportCards.isPublished, false)
        )
      )
      .returning();
    return { success: true, message: `Published ${rows.length} report card(s).`, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to publish class report cards." };
  }
};

// ================================================================
// 21. UNPUBLISH
// ================================================================
export const unpublishReportCardService = async (reportCardId: string): Promise<ReportCardResponse> => {
  try {
    const [updated] = await db
      .update(reportCards)
      .set({ isPublished: false, publishedAt: null })
      .where(eq(reportCards.id, reportCardId))
      .returning();
    if (!updated) return { success: false, message: "Report card not found." };
    return { success: true, message: "Report card unpublished.", reportCard: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to unpublish." };
  }
};

// ================================================================
// 22. DELETE (single)
// ================================================================
export const deleteReportCardService = async (reportCardId: string): Promise<ReportCardResponse> => {
  try {
    const [deleted] = await db.delete(reportCards).where(eq(reportCards.id, reportCardId)).returning();
    if (!deleted) return { success: false, message: "Report card not found." };
    return { success: true, message: "Report card deleted.", reportCard: deleted };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete report card." };
  }
};

// ================================================================
// 23. DELETE ALL FOR TERM
// ================================================================
export const deleteReportCardsForTermService = async (
  schoolId: string,
  termId: string,
  classId?: string
): Promise<ReportCardResponse> => {
  try {
    const filters: any[] = [eq(reportCards.schoolId, schoolId), eq(reportCards.termId, termId)];
    if (classId) filters.push(eq(reportCards.classId, classId));
    const deleted = await db.delete(reportCards).where(and(...filters)).returning();
    return { success: true, message: `Deleted ${deleted.length} report card(s).`, count: deleted.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete report cards." };
  }
};

// ================================================================
// 24. GET FULL DATA (render-ready payload)
// ================================================================
export const getReportCardDataService = async (reportCardId: string): Promise<ReportCardResponse> => {
  try {
    const existing = await db.query.reportCards.findFirst({ where: eq(reportCards.id, reportCardId) });
    if (!existing) return { success: false, message: "Report card not found." };

    // Build the same payload that preview returns, but with the saved report card
    const student = await db.query.students.findFirst({ where: eq(students.id, existing.studentId) });
    const term = await db.query.academicTerms.findFirst({ where: eq(academicTerms.id, existing.termId) });
    const cls = await db.query.classes.findFirst({ where: eq(classes.id, existing.classId) });
    const school = await db.query.schools.findFirst({ where: eq(schools.id, existing.schoolId) });
    const grade = cls ? await db.query.gradeLevels.findFirst({ where: eq(gradeLevels.id, cls.gradeLevelId) }) : null;

    const locked = await getLockedExamsInTerm(existing.schoolId, existing.termId);
    const subjectResult = await computeSubjectBreakdownService(existing.schoolId, existing.studentId, existing.termId);
    const attendanceResult = await computeAttendanceDaysService(existing.schoolId, existing.studentId, existing.termId);

    const gradingScaleId = locked[0]?.gradingScaleId ?? null;
    const bands = await getEffectiveBands(existing.schoolId, gradingScaleId);
    const meanBand = resolveBand(bands, Number(existing.meanScore ?? 0));

    const payload: ReportCardPayload = {
      reportCard: existing,
      student: student ? {
        id: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
      } : { id: "", admissionNumber: "", firstName: "", middleName: null, lastName: "", gender: null, dateOfBirth: null },
      school: {
        id: school?.id ?? "",
        name: school?.name ?? "",
        shortName: school?.shortName ?? null,
        motto: school?.motto ?? null,
        logoUrl: school?.logoUrl ?? null,
        address: school?.address ?? null,
        phone: school?.phone ?? null,
        email: school?.email ?? null,
      },
      term: term ? {
        id: term.id,
        academicYear: term.academicYear,
        termName: term.termName,
        startDate: term.startDate,
        endDate: term.endDate,
      } : { id: "", academicYear: "", termName: "", startDate: "", endDate: "" },
      class: cls ? {
        id: cls.id,
        gradeLevel: grade?.name ?? "Unknown",
        stream: cls.stream,
        academicYear: cls.academicYear,
      } : { id: "", gradeLevel: "", stream: "", academicYear: "" },
      exams: locked.map((e) => ({
        examId: e.id,
        examTitle: e.examTitle,
        examCategory: e.examCategory,
        weighting: e.weighting,
        isLocked: e.isLocked,
      })),
      subjects: subjectResult.subjects,
      totals: {
        subjectsCount: subjectResult.subjects.length,
        totalMarks: fmt(subjectResult.subjects.reduce((s, r) => s + Number(r.marks ?? 0), 0)),
        totalOutOf: fmt(subjectResult.subjects.reduce((s, r) => s + Number(r.outOf ?? 0), 0)),
        totalPoints: subjectResult.subjects.reduce((s, r) => s + (r.points ?? 0), 0),
        meanScore: existing.meanScore ?? "0.00",
        meanGrade: meanBand?.grade ?? "N/A",
      },
      attendance: {
        daysPresent: attendanceResult.daysPresent,
        daysAbsent: attendanceResult.daysAbsent,
        daysLate: attendanceResult.daysLate,
        daysTotal: attendanceResult.daysTotal,
        attendanceRate: attendanceResult.attendanceRate,
      },
      classPosition: existing.classPosition,
      streamSize: existing.streamSize,
      classTeacherRemarks: existing.classTeacherRemarks,
      principalRemarks: existing.principalRemarks,
      isPublished: existing.isPublished,
      publishedAt: existing.publishedAt ? existing.publishedAt.toISOString() : null,
    };

    return { success: true, message: "Report card data ready.", data: payload, reportCard: existing };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build report card data." };
  }
};