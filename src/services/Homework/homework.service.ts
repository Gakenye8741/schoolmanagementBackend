// src/services/homework/homework.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, inArray, gte, lte,
} from "drizzle-orm";

import {
  homeworkAssignments,
  homeworkSubmissions,
  classes,
  subjects,
  students,
  users,
  academicTerms,
  notifications,
  TSelectHomeworkAssignment,
  TSelectHomeworkSubmission,
  TSelectClass,
  TSelectSubject,
  TSelectStudent,
  studentGuardians,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Input types
// ================================================================
export type AssignmentStatus = "Pending" | "Submitted" | "Graded" | "Late";

export interface CreateAssignmentInput {
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string;
  attachmentUrl?: string | null;
  maxScore?: string | null;
  dueDate: string; // ISO datetime
  notify?: boolean;
}

export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  attachmentUrl?: string | null;
  maxScore?: string | null;
  dueDate?: string;
}

export interface SubmitHomeworkInput {
  schoolId: string;
  assignmentId: string;
  studentId: string;
  submissionText?: string | null;
  attachmentUrl?: string | null;
}

export interface GradeSubmissionInput {
  gradeScore?: string | null;
  teacherFeedback?: string | null;
  status?: AssignmentStatus;
}

// ================================================================
// Response envelope
// ================================================================
export interface HomeworkResponse {
  success: boolean;
  message: string;
  assignment?: TSelectHomeworkAssignment;
  assignments?: TSelectHomeworkAssignment[];
  submission?: TSelectHomeworkSubmission;
  submissions?: TSelectHomeworkSubmission[];
  summary?: {
    assignmentId: string;
    totalStudents: number;
    submitted: number;
    pending: number;
    late: number;
    graded: number;
    completionRate: string;
  };
  stats?: Record<string, any>;
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const now = () => new Date();

const isPastDue = (dueDate: Date): boolean => now() > dueDate;

/** Fetch all enrolled students in a class. */
const getClassRoster = async (classId: string): Promise<string[]> => {
  const rows = await db.query.students.findMany({
    where: and(
      eq(students.classId, classId),
      eq(students.isEnrolled, true),
      isNull(students.deletedAt)
    ),
    columns: { id: true },
  });
  return rows.map((s) => s.id);
};

/** Fan-out in-app notifications to all students + guardians in a class. */
const notifyClassRoster = async (
  schoolId: string,
  classId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<number> => {
  const rosterIds = await getClassRoster(classId);
  if (rosterIds.length === 0) return 0;

  // Students' user IDs
  const studentRows = await db.query.students.findMany({
    where: inArray(students.id, rosterIds),
    columns: { userId: true },
  });
  const studentUserIds = studentRows.map((s) => s.userId).filter(Boolean) as string[];

  // Guardians of those students
  const guardians = await db.query.studentGuardians.findMany({
    where: inArray(studentGuardians.studentId, rosterIds),
    columns: { guardianUserId: true },
  });
  const guardianUserIds = guardians.map((g) => g.guardianUserId);

  const allRecipients = [...new Set([...studentUserIds, ...guardianUserIds])];
  if (allRecipients.length === 0) return 0;

  const values = allRecipients.map((uid) => ({
    schoolId,
    userId: uid,
    type: "Homework" as const,
    title,
    body,
    data,
  }));

  let inserted = 0;
  for (let i = 0; i < values.length; i += 100) {
    const chunk = values.slice(i, i + 100);
    const res = await db.insert(notifications).values(chunk).returning({ id: notifications.id });
    inserted += res.length;
  }
  return inserted;
};

// ================================================================
// ASSIGNMENTS — 12 services
// ================================================================

/** 1. Create assignment (auto-notifies the class if notify=true). */
export const createAssignmentService = async (
  data: CreateAssignmentInput
): Promise<HomeworkResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.classId) return { success: false, message: "classId is required." };
    if (!data.subjectId) return { success: false, message: "subjectId is required." };
    if (!data.teacherId) return { success: false, message: "teacherId is required." };
    if (!data.title || data.title.trim().length < 2)
      return { success: false, message: "Title must be at least 2 characters." };
    if (!data.description || data.description.trim().length < 2)
      return { success: false, message: "Description must be at least 2 characters." };
    if (!data.dueDate)
      return { success: false, message: "dueDate is required." };

    const dueDate = new Date(data.dueDate);
    if (Number.isNaN(dueDate.getTime()))
      return { success: false, message: "dueDate is not a valid datetime." };

    // Verify class belongs to school
    const cls = await db.query.classes.findFirst({
      where: and(eq(classes.id, data.classId), eq(classes.schoolId, data.schoolId)),
    });
    if (!cls) return { success: false, message: "Class not found in this school." };

    // Verify subject belongs to school
    const subj = await db.query.subjects.findFirst({
      where: and(eq(subjects.id, data.subjectId), eq(subjects.schoolId, data.schoolId)),
    });
    if (!subj) return { success: false, message: "Subject not found in this school." };

    // Verify teacher belongs to school
    const teacher = await db.query.users.findFirst({
      where: and(eq(users.id, data.teacherId), eq(users.schoolId, data.schoolId)),
    });
    if (!teacher) return { success: false, message: "Teacher not found in this school." };

    const [row] = await db
      .insert(homeworkAssignments)
      .values({
        schoolId: data.schoolId,
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        title: data.title.trim(),
        description: data.description.trim(),
        attachmentUrl: data.attachmentUrl ?? null,
        maxScore: data.maxScore ?? null,
        dueDate,
      })
      .returning();

    // Optional: notify the class
    let notified = 0;
    if (data.notify !== false) {
      notified = await notifyClassRoster(
        data.schoolId,
        data.classId,
        `New ${subj.name} homework: ${row.title}`,
        `Due ${dueDate.toISOString().split("T")[0]}. ${row.description.slice(0, 200)}`,
        { assignmentId: row.id, classId: data.classId, subjectId: data.subjectId }
      ).catch((e) => {
        console.error("Notification fan-out failed:", e?.message);
        return 0;
      });
    }

    return {
      success: true,
      message:
        `Homework "${row.title}" assigned` +
        (notified > 0 ? ` — ${notified} notification(s) sent.` : "."),
      assignment: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create assignment." };
  }
};

/** 2. Get assignment by ID. */
export const getAssignmentByIdService = async (
  id: string
): Promise<HomeworkResponse> => {
  try {
    const row = await db.query.homeworkAssignments.findFirst({
      where: eq(homeworkAssignments.id, id),
      with: { class: true, subject: true, teacher: true },
    });
    if (!row) return { success: false, message: "Assignment not found." };
    return { success: true, message: "Assignment retrieved.", assignment: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch assignment." };
  }
};

/** 3. List assignments for a class. */
export const listAssignmentsByClassService = async (
  classId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<HomeworkResponse> => {
  try {
    const filters: any[] = [eq(homeworkAssignments.classId, classId)];
    if (opts?.fromDate) filters.push(gte(homeworkAssignments.dueDate, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(homeworkAssignments.dueDate, new Date(opts.toDate)));

    const rows = await db.query.homeworkAssignments.findMany({
      where: and(...filters),
      with: { subject: true, teacher: { columns: { id: true, name: true } } },
      orderBy: [desc(homeworkAssignments.createdAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} assignment(s).`,
      assignments: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list class assignments." };
  }
};

/** 4. List assignments for a subject. */
export const listAssignmentsBySubjectService = async (
  subjectId: string
): Promise<HomeworkResponse> => {
  try {
    const rows = await db.query.homeworkAssignments.findMany({
      where: eq(homeworkAssignments.subjectId, subjectId),
      orderBy: [desc(homeworkAssignments.dueDate)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} assignment(s).`,
      assignments: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list subject assignments." };
  }
};

/** 5. List assignments for a teacher. */
export const listAssignmentsByTeacherService = async (
  teacherId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<HomeworkResponse> => {
  try {
    const filters: any[] = [eq(homeworkAssignments.teacherId, teacherId)];
    if (opts?.fromDate) filters.push(gte(homeworkAssignments.dueDate, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(homeworkAssignments.dueDate, new Date(opts.toDate)));

    const rows = await db.query.homeworkAssignments.findMany({
      where: and(...filters),
      with: { class: true, subject: true },
      orderBy: [desc(homeworkAssignments.dueDate)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} assignment(s).`,
      assignments: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list teacher assignments." };
  }
};

/** 6. List assignments for a school (recent). */
export const listAssignmentsBySchoolService = async (
  schoolId: string,
  opts?: { limit?: number }
): Promise<HomeworkResponse> => {
  try {
    const rows = await db.query.homeworkAssignments.findMany({
      where: eq(homeworkAssignments.schoolId, schoolId),
      with: { class: true, subject: true, teacher: { columns: { id: true, name: true } } },
      orderBy: [desc(homeworkAssignments.createdAt)],
      ...(opts?.limit ? { limit: opts.limit } : { limit: 100 }),
    });
    return {
      success: true,
      message: `Fetched ${rows.length} assignment(s).`,
      assignments: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list school assignments." };
  }
};

/** 7. Update assignment. */
export const updateAssignmentService = async (
  id: string,
  patch: UpdateAssignmentInput
): Promise<HomeworkResponse> => {
  try {
    const existing = await db.query.homeworkAssignments.findFirst({
      where: eq(homeworkAssignments.id, id),
    });
    if (!existing) return { success: false, message: "Assignment not found." };

    const [row] = await db
      .update(homeworkAssignments)
      .set({
        ...(patch.title !== undefined && { title: patch.title.trim() }),
        ...(patch.description !== undefined && { description: patch.description.trim() }),
        ...(patch.attachmentUrl !== undefined && { attachmentUrl: patch.attachmentUrl }),
        ...(patch.maxScore !== undefined && { maxScore: patch.maxScore }),
        ...(patch.dueDate !== undefined && { dueDate: new Date(patch.dueDate) }),
      })
      .where(eq(homeworkAssignments.id, id))
      .returning();
    return { success: true, message: "Assignment updated.", assignment: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update assignment." };
  }
};

/** 8. Delete assignment (cascades submissions). */
export const deleteAssignmentService = async (id: string): Promise<HomeworkResponse> => {
  try {
    const [row] = await db
      .delete(homeworkAssignments)
      .where(eq(homeworkAssignments.id, id))
      .returning();
    if (!row) return { success: false, message: "Assignment not found." };
    return { success: true, message: "Assignment deleted (submissions removed).", assignment: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete assignment." };
  }
};

/** 9. Get assignment summary — how many submitted, graded, pending. */
export const getAssignmentSummaryService = async (
  assignmentId: string
): Promise<HomeworkResponse> => {
  try {
    const assignment = await db.query.homeworkAssignments.findFirst({
      where: eq(homeworkAssignments.id, assignmentId),
    });
    if (!assignment) return { success: false, message: "Assignment not found." };

    const rosterIds = await getClassRoster(assignment.classId);
    const submissions = await db.query.homeworkSubmissions.findMany({
      where: eq(homeworkSubmissions.assignmentId, assignmentId),
    });

    const submittedStudentIds = new Set(submissions.map((s) => s.studentId));
    const graded = submissions.filter((s) => s.status === "Graded").length;
    const submitted = submissions.filter((s) => s.status === "Submitted" || s.status === "Graded").length;
    const late = submissions.filter((s) => s.status === "Late").length;
    const pending = rosterIds.length - submissions.length;

    const completionRate =
      rosterIds.length === 0
        ? "0.00"
        : ((submissions.length / rosterIds.length) * 100).toFixed(2);

    return {
      success: true,
      message: `${submissions.length}/${rosterIds.length} submitted (${completionRate}%); ${graded} graded.`,
      summary: {
        assignmentId,
        totalStudents: rosterIds.length,
        submitted,
        pending,
        late,
        graded,
        completionRate,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build assignment summary." };
  }
};

/** 10. List pending submissions (students who haven't submitted yet). */
export const listPendingSubmissionsService = async (
  assignmentId: string
): Promise<HomeworkResponse> => {
  try {
    const assignment = await db.query.homeworkAssignments.findFirst({
      where: eq(homeworkAssignments.id, assignmentId),
    });
    if (!assignment) return { success: false, message: "Assignment not found." };

    const rosterIds = await getClassRoster(assignment.classId);
    const submissions = await db.query.homeworkSubmissions.findMany({
      where: eq(homeworkSubmissions.assignmentId, assignmentId),
      columns: { studentId: true },
    });
    const submittedIds = new Set(submissions.map((s) => s.studentId));
    const pendingIds = rosterIds.filter((id) => !submittedIds.has(id));

    if (pendingIds.length === 0)
      return { success: true, message: "All students have submitted.", count: 0 };

    const pendingStudents = await db.query.students.findMany({
      where: inArray(students.id, pendingIds),
      columns: { id: true, admissionNumber: true, firstName: true, lastName: true },
    });

    return {
      success: true,
      message: `${pendingStudents.length} student(s) have not submitted yet.`,
      stats: { pendingStudents },
      count: pendingStudents.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list pending submissions." };
  }
};

/** 11. Count assignments for a class in a date range. */
export const countAssignmentsForClassService = async (
  classId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<HomeworkResponse> => {
  try {
    const filters: any[] = [eq(homeworkAssignments.classId, classId)];
    if (opts?.fromDate) filters.push(gte(homeworkAssignments.dueDate, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(homeworkAssignments.dueDate, new Date(opts.toDate)));

    const [row] = await db
      .select({ c: count() })
      .from(homeworkAssignments)
      .where(and(...filters));
    return {
      success: true,
      message: `This class has ${Number(row?.c ?? 0)} assignment(s).`,
      count: Number(row?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count assignments." };
  }
};

/** 12. List upcoming assignments (due in the future) for a class. */
export const listUpcomingAssignmentsService = async (
  classId: string
): Promise<HomeworkResponse> => {
  try {
    const rows = await db.query.homeworkAssignments.findMany({
      where: and(
        eq(homeworkAssignments.classId, classId),
        gte(homeworkAssignments.dueDate, now())
      ),
      with: { subject: true },
      orderBy: [asc(homeworkAssignments.dueDate)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} upcoming assignment(s).`,
      assignments: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list upcoming assignments." };
  }
};

// ================================================================
// SUBMISSIONS — 15 services
// ================================================================

/** 13. Submit homework. Auto-marks as Late if past due. */
export const submitHomeworkService = async (
  data: SubmitHomeworkInput
): Promise<HomeworkResponse> => {
  try {
    if (!data.assignmentId) return { success: false, message: "assignmentId is required." };
    if (!data.studentId) return { success: false, message: "studentId is required." };
    if (!data.submissionText && !data.attachmentUrl)
      return { success: false, message: "Provide submission text or an attachment." };

    const assignment = await db.query.homeworkAssignments.findFirst({
      where: eq(homeworkAssignments.id, data.assignmentId),
    });
    if (!assignment) return { success: false, message: "Assignment not found." };

    const student = await db.query.students.findFirst({
      where: and(eq(students.id, data.studentId), eq(students.schoolId, data.schoolId)),
    });
    if (!student) return { success: false, message: "Student not found in this school." };
    if (student.classId !== assignment.classId)
      return { success: false, message: "Student is not in this assignment's class." };

    const isLate = isPastDue(assignment.dueDate);
    const status: AssignmentStatus = isLate ? "Late" : "Submitted";

    // Upsert — one submission per (assignment, student)
    const existing = await db.query.homeworkSubmissions.findFirst({
      where: and(
        eq(homeworkSubmissions.assignmentId, data.assignmentId),
        eq(homeworkSubmissions.studentId, data.studentId)
      ),
    });

    if (existing) {
      const [row] = await db
        .update(homeworkSubmissions)
        .set({
          submissionText: data.submissionText ?? null,
          attachmentUrl: data.attachmentUrl ?? null,
          status,
          submittedAt: now(),
        })
        .where(eq(homeworkSubmissions.id, existing.id))
        .returning();
      return {
        success: true,
        message: `Submission updated${isLate ? " (marked late)" : ""}.`,
        submission: row,
      };
    }

    const [row] = await db
      .insert(homeworkSubmissions)
      .values({
        schoolId: data.schoolId,
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        submissionText: data.submissionText ?? null,
        attachmentUrl: data.attachmentUrl ?? null,
        status,
        submittedAt: now(),
      })
      .returning();

    return {
      success: true,
      message: `Homework submitted${isLate ? " (marked late)" : ""}.`,
      submission: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to submit homework." };
  }
};

/** 14. Get submission by ID. */
export const getSubmissionByIdService = async (
  id: string
): Promise<HomeworkResponse> => {
  try {
    const row = await db.query.homeworkSubmissions.findFirst({
      where: eq(homeworkSubmissions.id, id),
      with: { assignment: true, student: true },
    });
    if (!row) return { success: false, message: "Submission not found." };
    return { success: true, message: "Submission retrieved.", submission: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch submission." };
  }
};

/** 15. List submissions for an assignment (teacher's view). */
export const listSubmissionsForAssignmentService = async (
  assignmentId: string,
  opts?: { status?: AssignmentStatus }
): Promise<HomeworkResponse> => {
  try {
    const filters: any[] = [eq(homeworkSubmissions.assignmentId, assignmentId)];
    if (opts?.status) filters.push(eq(homeworkSubmissions.status, opts.status));

    const rows = await db.query.homeworkSubmissions.findMany({
      where: and(...filters),
      with: {
        student: {
          columns: { id: true, admissionNumber: true, firstName: true, lastName: true },
        },
      },
      orderBy: [desc(homeworkSubmissions.submittedAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} submission(s).`,
      submissions: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list submissions." };
  }
};

/** 16. List submissions for a student (student's view). */
export const listSubmissionsForStudentService = async (
  studentId: string
): Promise<HomeworkResponse> => {
  try {
    const rows = await db.query.homeworkSubmissions.findMany({
      where: eq(homeworkSubmissions.studentId, studentId),
      with: {
        assignment: {
          with: { subject: true, class: true },
        },
      },
      orderBy: [desc(homeworkSubmissions.submittedAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} submission(s).`,
      submissions: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list student submissions." };
  }
};

/** 17. Get a student's submission for a specific assignment. */
export const getStudentSubmissionForAssignmentService = async (
  assignmentId: string,
  studentId: string
): Promise<HomeworkResponse> => {
  try {
    const row = await db.query.homeworkSubmissions.findFirst({
      where: and(
        eq(homeworkSubmissions.assignmentId, assignmentId),
        eq(homeworkSubmissions.studentId, studentId)
      ),
    });
    if (!row)
      return { success: false, message: "Student has not submitted this assignment." };
    return { success: true, message: "Submission retrieved.", submission: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch submission." };
  }
};

/** 18. Grade a submission. */
export const gradeSubmissionService = async (
  id: string,
  data: GradeSubmissionInput
): Promise<HomeworkResponse> => {
  try {
    const existing = await db.query.homeworkSubmissions.findFirst({
      where: eq(homeworkSubmissions.id, id),
    });
    if (!existing) return { success: false, message: "Submission not found." };

    const [row] = await db
      .update(homeworkSubmissions)
      .set({
        ...(data.gradeScore !== undefined && { gradeScore: data.gradeScore }),
        ...(data.teacherFeedback !== undefined && { teacherFeedback: data.teacherFeedback }),
        status: "Graded",
        gradedAt: now(),
      })
      .where(eq(homeworkSubmissions.id, id))
      .returning();

    return {
      success: true,
      message: `Submission graded${data.gradeScore ? `: ${data.gradeScore}` : ""}.`,
      submission: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to grade submission." };
  }
};

/** 19. Ungrade a submission (return for re-grading). */
export const ungradeSubmissionService = async (
  id: string
): Promise<HomeworkResponse> => {
  try {
    const existing = await db.query.homeworkSubmissions.findFirst({
      where: eq(homeworkSubmissions.id, id),
    });
    if (!existing) return { success: false, message: "Submission not found." };

    // Reset to Submitted or Late based on whether the original was late
    const status: AssignmentStatus = existing.status === "Late" ? "Late" : "Submitted";

    const [row] = await db
      .update(homeworkSubmissions)
      .set({
        status,
        gradeScore: null,
        teacherFeedback: null,
        gradedAt: null,
      })
      .where(eq(homeworkSubmissions.id, id))
      .returning();
    return { success: true, message: "Grade removed — submission is ungraded again.", submission: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to ungrade submission." };
  }
};

/** 20. Return for resubmission — reset to Pending so student can submit again. */
export const returnForResubmissionService = async (
  id: string,
  feedback?: string
): Promise<HomeworkResponse> => {
  try {
    const existing = await db.query.homeworkSubmissions.findFirst({
      where: eq(homeworkSubmissions.id, id),
    });
    if (!existing) return { success: false, message: "Submission not found." };

    const [row] = await db
      .update(homeworkSubmissions)
      .set({
        status: "Pending",
        teacherFeedback: feedback ?? existing.teacherFeedback,
        gradeScore: null,
        gradedAt: null,
        submittedAt: null,
      })
      .where(eq(homeworkSubmissions.id, id))
      .returning();
    return { success: true, message: "Submission returned for resubmission.", submission: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to return submission." };
  }
};

/** 21. Delete a submission. */
export const deleteSubmissionService = async (
  id: string
): Promise<HomeworkResponse> => {
  try {
    const [row] = await db
      .delete(homeworkSubmissions)
      .where(eq(homeworkSubmissions.id, id))
      .returning();
    if (!row) return { success: false, message: "Submission not found." };
    return { success: true, message: "Submission deleted.", submission: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete submission." };
  }
};

/** 22. Count ungraded submissions for an assignment (teacher's marking queue). */
export const countUngradedForAssignmentService = async (
  assignmentId: string
): Promise<HomeworkResponse> => {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(homeworkSubmissions)
      .where(
        and(
          eq(homeworkSubmissions.assignmentId, assignmentId),
          inArray(homeworkSubmissions.status, ["Submitted", "Late"])
        )
      );
    return {
      success: true,
      message: `${Number(row?.c ?? 0)} submission(s) need grading.`,
      count: Number(row?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count ungraded." };
  }
};

/** 23. Count ungraded submissions for a teacher (across all their assignments). */
export const countUngradedForTeacherService = async (
  teacherId: string
): Promise<HomeworkResponse> => {
  try {
    const assignments = await db.query.homeworkAssignments.findMany({
      where: eq(homeworkAssignments.teacherId, teacherId),
      columns: { id: true },
    });
    if (assignments.length === 0)
      return { success: true, message: "No assignments.", count: 0 };

    const ids = assignments.map((a) => a.id);
    const [row] = await db
      .select({ c: count() })
      .from(homeworkSubmissions)
      .where(
        and(
          inArray(homeworkSubmissions.assignmentId, ids),
          inArray(homeworkSubmissions.status, ["Submitted", "Late"])
        )
      );
    return {
      success: true,
      message: `${Number(row?.c ?? 0)} submission(s) need grading across ${ids.length} assignment(s).`,
      count: Number(row?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count teacher's ungraded." };
  }
};

/** 24. Auto-mark overdue submissions as Late (cron job candidate). */
export const markOverdueSubmissionsService = async (
  schoolId: string
): Promise<HomeworkResponse> => {
  try {
    // Find assignments whose dueDate has passed
    const pastAssignments = await db.query.homeworkAssignments.findMany({
      where: and(
        eq(homeworkAssignments.schoolId, schoolId),
        lte(homeworkAssignments.dueDate, now())
      ),
      columns: { id: true },
    });
    if (pastAssignments.length === 0)
      return { success: true, message: "No past-due assignments.", count: 0 };

    const ids = pastAssignments.map((a) => a.id);

    // Update Pending → Late for these assignments
    const rows = await db
      .update(homeworkSubmissions)
      .set({ status: "Late" })
      .where(
        and(
          inArray(homeworkSubmissions.assignmentId, ids),
          eq(homeworkSubmissions.status, "Pending")
        )
      )
      .returning();
    return {
      success: true,
      message: `Marked ${rows.length} submission(s) as late.`,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to mark overdue submissions." };
  }
};

/** 25. Bulk grade multiple submissions. */
export const bulkGradeSubmissionsService = async (
  items: Array<{ submissionId: string; gradeScore?: string | null; teacherFeedback?: string | null }>
): Promise<HomeworkResponse> => {
  try {
    if (items.length === 0) return { success: false, message: "No submissions provided." };

    let graded = 0;
    for (const item of items) {
      const r = await gradeSubmissionService(item.submissionId, {
        gradeScore: item.gradeScore,
        teacherFeedback: item.teacherFeedback,
      });
      if (r.success) graded++;
    }
    return {
      success: true,
      message: `Graded ${graded} of ${items.length} submission(s).`,
      count: graded,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk grade submissions." };
  }
};

/** 26. Get grading queue for a teacher — submissions awaiting grading. */
export const getTeacherGradingQueueService = async (
  teacherId: string
): Promise<HomeworkResponse> => {
  try {
    const assignments = await db.query.homeworkAssignments.findMany({
      where: eq(homeworkAssignments.teacherId, teacherId),
      columns: { id: true, title: true },
    });
    if (assignments.length === 0)
      return { success: true, message: "No assignments.", count: 0 };

    const ids = assignments.map((a) => a.id);
    const rows = await db.query.homeworkSubmissions.findMany({
      where: and(
        inArray(homeworkSubmissions.assignmentId, ids),
        inArray(homeworkSubmissions.status, ["Submitted", "Late"])
      ),
      with: {
        student: {
          columns: { id: true, admissionNumber: true, firstName: true, lastName: true },
        },
        assignment: { columns: { id: true, title: true } },
      },
      orderBy: [asc(homeworkSubmissions.submittedAt)],
    });

    return {
      success: true,
      message: `${rows.length} submission(s) awaiting grading.`,
      submissions: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build grading queue." };
  }
};

/** 27. Get a student's homework summary across all subjects. */
export const getStudentHomeworkSummaryService = async (
  studentId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<HomeworkResponse> => {
  try {
    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
      columns: { id: true, classId: true },
    });
    if (!student) return { success: false, message: "Student not found." };
    if (!student.classId) return { success: false, message: "Student is not in a class." };

    const filters: any[] = [eq(homeworkAssignments.classId, student.classId)];
    if (opts?.fromDate) filters.push(gte(homeworkAssignments.createdAt, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(homeworkAssignments.createdAt, new Date(opts.toDate)));

    const allAssignments = await db.query.homeworkAssignments.findMany({
      where: and(...filters),
      with: { subject: true },
    });

    const submissions = await db.query.homeworkSubmissions.findMany({
      where: and(
        eq(homeworkSubmissions.studentId, studentId),
        inArray(homeworkSubmissions.assignmentId, allAssignments.map((a) => a.id))
      ),
    });
    const submissionByAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));

    const rows = allAssignments.map((a) => {
      const s = submissionByAssignment.get(a.id);
      return {
        assignmentId: a.id,
        title: a.title,
        subjectName: (a as any).subject?.name ?? "Unknown",
        dueDate: a.dueDate,
        status: s?.status ?? (isPastDue(a.dueDate) ? "Late" : "Pending"),
        gradeScore: s?.gradeScore ?? null,
        teacherFeedback: s?.teacherFeedback ?? null,
        submittedAt: s?.submittedAt ?? null,
        gradedAt: s?.gradedAt ?? null,
      };
    });

    const completed = rows.filter((r) => r.status === "Submitted" || r.status === "Graded").length;
    const graded = rows.filter((r) => r.status === "Graded").length;
    const late = rows.filter((r) => r.status === "Late").length;
    const pending = rows.filter((r) => r.status === "Pending").length;

    return {
      success: true,
      message: `${completed}/${rows.length} completed (${graded} graded, ${late} late, ${pending} pending).`,
      stats: {
        totalAssignments: rows.length,
        completed,
        graded,
        late,
        pending,
        rows,
      },
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build student homework summary." };
  }
};

// ================================================================
// REPORTS — 5 services
// ================================================================

/** 28. Class homework completion rate. */
export const getClassCompletionRateService = async (
  classId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<HomeworkResponse> => {
  try {
    const filters: any[] = [eq(homeworkAssignments.classId, classId)];
    if (opts?.fromDate) filters.push(gte(homeworkAssignments.createdAt, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(homeworkAssignments.createdAt, new Date(opts.toDate)));

    const assignments = await db.query.homeworkAssignments.findMany({
      where: and(...filters),
      columns: { id: true },
    });
    if (assignments.length === 0)
      return { success: true, message: "No assignments for this class.", count: 0 };

    const rosterIds = await getClassRoster(classId);
    const assignmentIds = assignments.map((a) => a.id);
    const submissions = await db.query.homeworkSubmissions.findMany({
      where: inArray(homeworkSubmissions.assignmentId, assignmentIds),
    });

    const totalPossible = assignments.length * rosterIds.length;
    const completed = submissions.filter((s) => ["Submitted", "Graded", "Late"].includes(s.status)).length;
    const completionRate = totalPossible === 0 ? "0.00" : ((completed / totalPossible) * 100).toFixed(2);

    const byStudent = new Map<string, { total: number; completed: number }>();
    for (const sid of rosterIds) byStudent.set(sid, { total: assignments.length, completed: 0 });
    for (const s of submissions) {
      if (["Submitted", "Graded", "Late"].includes(s.status)) {
        const b = byStudent.get(s.studentId);
        if (b) b.completed++;
      }
    }

    return {
      success: true,
      message: `Class completion rate: ${completionRate}%.`,
      stats: {
        assignmentCount: assignments.length,
        studentCount: rosterIds.length,
        totalPossible,
        completed,
        completionRate,
        byStudent: [...byStudent.entries()].map(([studentId, v]) => ({
          studentId,
          completed: v.completed,
          total: v.total,
          rate: v.total === 0 ? "0.00" : ((v.completed / v.total) * 100).toFixed(2),
        })),
      },
      count: completed,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute class completion rate." };
  }
};

/** 29. Subject homework summary. */
export const getSubjectHomeworkSummaryService = async (
  subjectId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<HomeworkResponse> => {
  try {
    const filters: any[] = [eq(homeworkAssignments.subjectId, subjectId)];
    if (opts?.fromDate) filters.push(gte(homeworkAssignments.createdAt, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(homeworkAssignments.createdAt, new Date(opts.toDate)));

    const assignments = await db.query.homeworkAssignments.findMany({
      where: and(...filters),
      columns: { id: true },
    });
    if (assignments.length === 0)
      return { success: true, message: "No assignments for this subject.", count: 0 };

    const assignmentIds = assignments.map((a) => a.id);
    const submissions = await db.query.homeworkSubmissions.findMany({
      where: inArray(homeworkSubmissions.assignmentId, assignmentIds),
    });

    const total = submissions.length;
    const graded = submissions.filter((s) => s.status === "Graded").length;
    const late = submissions.filter((s) => s.status === "Late").length;

    const grades = submissions
      .filter((s) => s.gradeScore !== null)
      .map((s) => Number(s.gradeScore));
    const meanGrade = grades.length === 0 ? "0.00" : (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(2);

    return {
      success: true,
      message: `Subject homework: ${assignments.length} assignment(s), ${total} submission(s), mean ${meanGrade}.`,
      stats: {
        assignmentCount: assignments.length,
        submissionCount: total,
        gradedCount: graded,
        lateCount: late,
        meanGrade,
      },
      count: total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute subject summary." };
  }
};

/** 30. Teacher workload summary. */
export const getTeacherWorkloadService = async (
  teacherId: string
): Promise<HomeworkResponse> => {
  try {
    const assignments = await db.query.homeworkAssignments.findMany({
      where: eq(homeworkAssignments.teacherId, teacherId),
    });
    if (assignments.length === 0)
      return { success: true, message: "No assignments.", count: 0 };

    const ids = assignments.map((a) => a.id);
    const submissions = await db.query.homeworkSubmissions.findMany({
      where: inArray(homeworkSubmissions.assignmentId, ids),
    });

    const ungraded = submissions.filter((s) => s.status === "Submitted" || s.status === "Late").length;
    const graded = submissions.filter((s) => s.status === "Graded").length;

    return {
      success: true,
      message: `${assignments.length} assignment(s); ${ungraded} to grade, ${graded} done.`,
      stats: {
        assignmentCount: assignments.length,
        submissionCount: submissions.length,
        ungradedCount: ungraded,
        gradedCount: graded,
      },
      count: submissions.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute teacher workload." };
  }
};

/** 31. School homework overview. */
export const getSchoolHomeworkOverviewService = async (
  schoolId: string
): Promise<HomeworkResponse> => {
  try {
    const assignments = await db.query.homeworkAssignments.findMany({
      where: eq(homeworkAssignments.schoolId, schoolId),
      columns: { id: true, classId: true, teacherId: true },
    });
    if (assignments.length === 0)
      return { success: true, message: "No assignments in this school.", count: 0 };

    const ids = assignments.map((a) => a.id);
    const submissions = await db.query.homeworkSubmissions.findMany({
      where: inArray(homeworkSubmissions.assignmentId, ids),
    });

    const byStatus = submissions.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const uniqueClasses = new Set(assignments.map((a) => a.classId)).size;
    const uniqueTeachers = new Set(assignments.map((a) => a.teacherId)).size;

    return {
      success: true,
      message: `${assignments.length} assignment(s) across ${uniqueClasses} class(es) by ${uniqueTeachers} teacher(s).`,
      stats: {
        assignmentCount: assignments.length,
        submissionCount: submissions.length,
        byStatus,
        classCount: uniqueClasses,
        teacherCount: uniqueTeachers,
      },
      count: assignments.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build school overview." };
  }
};

/** 32. Student rank by homework completion (within a class). */
export const rankClassByCompletionService = async (
  classId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<HomeworkResponse> => {
  try {
    const result = await getClassCompletionRateService(classId, opts);
    if (!result.success || !result.stats) return result;

    const { byStudent } = result.stats as any;
    const ranked = (byStudent as Array<{ studentId: string; rate: string; completed: number; total: number }>)
      .sort((a, b) => Number(b.rate) - Number(a.rate))
      .map((s, i) => ({ ...s, position: i + 1 }));

    // Hydrate student names
    const ids = ranked.map((r) => r.studentId);
    const studentRows = ids.length
      ? await db.query.students.findMany({
          where: inArray(students.id, ids),
          columns: { id: true, admissionNumber: true, firstName: true, lastName: true },
        })
      : [];
    const byId = new Map(studentRows.map((s) => [s.id, s]));

    return {
      success: true,
      message: `Ranked ${ranked.length} student(s) by completion rate.`,
      stats: {
        ranking: ranked.map((r) => ({ ...r, student: byId.get(r.studentId) })),
      },
      count: ranked.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to rank class." };
  }
};