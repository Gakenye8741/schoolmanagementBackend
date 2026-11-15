// src/services/lessonPlans/lessonPlans.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, inArray, gte, lte, or, isNotNull,
} from "drizzle-orm";

import {
  schemesOfWork,
  schemeOfWorkEntries,
  lessonPlans,
  curriculumStrands,
  curriculumSubStrands,
  schools,
  users,
  classes,
  subjects,
  academicTerms,
  TSelectSchemeOfWork,
  TSelectSchemeOfWorkEntry,
  TSelectLessonPlan,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Types
// ================================================================
export type ApprovalStatus = "Draft" | "Submitted" | "Approved" | "Rejected";

export interface PlanningResponse {
  success: boolean;
  message: string;
  scheme?: TSelectSchemeOfWork;
  schemes?: TSelectSchemeOfWork[];
  entry?: TSelectSchemeOfWorkEntry;
  entries?: TSelectSchemeOfWorkEntry[];
  plan?: TSelectLessonPlan;
  plans?: TSelectLessonPlan[];
  schemeWithEntries?: {
    scheme: TSelectSchemeOfWork;
    entries: TSelectSchemeOfWorkEntry[];
  };
  stats?: Record<string, any>;
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const now = () => new Date();
const todayIso = () => new Date().toISOString().slice(0, 10);

const assertSchoolExists = async (schoolId: string) =>
  await db.query.schools.findFirst({ where: eq(schools.id, schoolId) });

const assertTermInSchool = async (termId: string, schoolId: string) =>
  await db.query.academicTerms.findFirst({
    where: and(eq(academicTerms.id, termId), eq(academicTerms.schoolId, schoolId)),
  });

const assertClassInSchool = async (classId: string, schoolId: string) =>
  await db.query.classes.findFirst({
    where: and(eq(classes.id, classId), eq(classes.schoolId, schoolId)),
  });

const assertSubjectInSchool = async (subjectId: string, schoolId: string) =>
  await db.query.subjects.findFirst({
    where: and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId)),
  });

// ================================================================
// SCHEMES OF WORK — 11 services
// ================================================================

// 1. Create
export const createSchemeService = async (
  data: {
    schoolId: string;
    termId: string;
    classId: string;
    subjectId: string;
    teacherId?: string;
    title: string;
  },
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const [school, term, cls, subject] = await Promise.all([
      assertSchoolExists(data.schoolId),
      assertTermInSchool(data.termId, data.schoolId),
      assertClassInSchool(data.classId, data.schoolId),
      assertSubjectInSchool(data.subjectId, data.schoolId),
    ]);
    if (!school) return { success: false, message: "School not found." };
    if (!term) return { success: false, message: "Term not found in this school." };
    if (!cls) return { success: false, message: "Class not found in this school." };
    if (!subject) return { success: false, message: "Subject not found in this school." };

    const teacherId = data.teacherId ?? actorId;

    const [row] = await db
      .insert(schemesOfWork)
      .values({
        schoolId: data.schoolId,
        termId: data.termId,
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId,
        title: data.title.trim(),
        status: "Draft",
      })
      .returning();

    return {
      success: true,
      message: `Scheme "${row.title}" created (Draft).`,
      scheme: row,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return {
        success: false,
        message: "A scheme already exists for this term / class / subject. Use the existing one or delete it first.",
      };
    }
    return { success: false, message: e?.message || "Failed to create scheme." };
  }
};

// 2. Bulk create (whole-class teacher's workload in one call)
export const bulkCreateSchemesService = async (
  data: {
    schoolId: string;
    termId: string;
    teacherId?: string;
    schemes: Array<{ classId: string; subjectId: string; title: string }>;
  },
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const term = await assertTermInSchool(data.termId, data.schoolId);
    if (!term) return { success: false, message: "Term not found in this school." };

    const teacherId = data.teacherId ?? actorId;
    const issues: string[] = [];
    const rows: TSelectSchemeOfWork[] = [];

    await db.transaction(async (tx) => {
      for (const s of data.schemes) {
        try {
          const [row] = await tx
            .insert(schemesOfWork)
            .values({
              schoolId: data.schoolId,
              termId: data.termId,
              classId: s.classId,
              subjectId: s.subjectId,
              teacherId,
              title: s.title.trim(),
              status: "Draft",
            })
            .returning();
          rows.push(row);
        } catch (e: any) {
          if (String(e?.code) === "23505") {
            issues.push(`Class ${s.classId} / Subject ${s.subjectId}: already exists`);
          } else {
            issues.push(`${s.title}: ${e?.message ?? "insert failed"}`);
          }
        }
      }
    });

    return {
      success: rows.length > 0,
      message: `Created ${rows.length} of ${data.schemes.length} scheme(s).${
        issues.length ? ` ${issues.length} skipped.` : ""
      }`,
      schemes: rows,
      count: rows.length,
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create schemes." };
  }
};

// 3. Get by ID (with entries)
export const getSchemeByIdService = async (
  schemeId: string
): Promise<PlanningResponse> => {
  try {
    const scheme = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, schemeId),
      with: {
        term: { columns: { id: true, termName: true, academicYear: true } },
        class: { columns: { id: true, stream: true, gradeLevelId: true } },
        subject: { columns: { id: true, name: true, code: true } },
        teacher: { columns: { id: true, name: true } },
        approver: { columns: { id: true, name: true } },
      },
    });
    if (!scheme) return { success: false, message: "Scheme not found." };

    const entries = await db.query.schemeOfWorkEntries.findMany({
      where: eq(schemeOfWorkEntries.schemeId, schemeId),
      with: {
        strand: { columns: { id: true, name: true } },
        subStrand: { columns: { id: true, name: true } },
      },
      orderBy: [
        asc(schemeOfWorkEntries.weekNumber),
        asc(schemeOfWorkEntries.lessonNumber),
      ],
    });

    return {
      success: true,
      message: `Scheme with ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`,
      schemeWithEntries: {
        scheme: scheme as any,
        entries: entries as any,
      },
      count: entries.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load scheme." };
  }
};

// 4. List for school (filterable)
export const listSchemesForSchoolService = async (
  schoolId: string,
  opts: {
    termId?: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
    status?: ApprovalStatus;
    page: number;
    limit: number;
  }
): Promise<PlanningResponse> => {
  try {
    const filters: any[] = [eq(schemesOfWork.schoolId, schoolId)];
    if (opts.termId) filters.push(eq(schemesOfWork.termId, opts.termId));
    if (opts.classId) filters.push(eq(schemesOfWork.classId, opts.classId));
    if (opts.subjectId) filters.push(eq(schemesOfWork.subjectId, opts.subjectId));
    if (opts.teacherId) filters.push(eq(schemesOfWork.teacherId, opts.teacherId));
    if (opts.status) filters.push(eq(schemesOfWork.status, opts.status));

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.schemesOfWork.findMany({
        where: and(...filters),
        with: {
          term: { columns: { id: true, termName: true, academicYear: true } },
          class: { columns: { id: true, stream: true } },
          subject: { columns: { id: true, name: true, code: true } },
          teacher: { columns: { id: true, name: true } },
        },
        orderBy: [desc(schemesOfWork.createdAt)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(schemesOfWork).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} scheme(s) on this page.`,
      schemes: rows as any,
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list schemes." };
  }
};

// 5. List for a teacher
export const listSchemesForTeacherService = async (
  teacherId: string,
  termId?: string
): Promise<PlanningResponse> => {
  try {
    const filters: any[] = [eq(schemesOfWork.teacherId, teacherId)];
    if (termId) filters.push(eq(schemesOfWork.termId, termId));

    const rows = await db.query.schemesOfWork.findMany({
      where: and(...filters),
      with: {
        term: { columns: { id: true, termName: true, academicYear: true } },
        class: { columns: { id: true, stream: true } },
        subject: { columns: { id: true, name: true, code: true } },
      },
      orderBy: [desc(schemesOfWork.createdAt)],
    });

    return {
      success: true,
      message: `${rows.length} scheme(s) for this teacher.`,
      schemes: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list schemes." };
  }
};

// 6. HOD approval queue (Submitted only)
export const listPendingSchemesService = async (
  schoolId: string
): Promise<PlanningResponse> => {
  try {
    const rows = await db.query.schemesOfWork.findMany({
      where: and(
        eq(schemesOfWork.schoolId, schoolId),
        eq(schemesOfWork.status, "Submitted")
      ),
      with: {
        term: { columns: { id: true, termName: true, academicYear: true } },
        class: { columns: { id: true, stream: true } },
        subject: { columns: { id: true, name: true } },
        teacher: { columns: { id: true, name: true } },
      },
      orderBy: [asc(schemesOfWork.submittedAt)],
    });

    return {
      success: true,
      message: `${rows.length} scheme(s) awaiting approval.`,
      schemes: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load approval queue." };
  }
};

// 7. Update (only Draft or Rejected)
export const updateSchemeService = async (
  schemeId: string,
  patch: { title?: string },
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, schemeId),
    });
    if (!existing) return { success: false, message: "Scheme not found." };

    if (existing.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can edit this scheme." };
    }
    if (existing.status === "Approved") {
      return { success: false, message: "Approved schemes cannot be edited." };
    }
    if (existing.status === "Submitted") {
      return { success: false, message: "Schemes under review cannot be edited. Wait for approval or rejection." };
    }

    const [row] = await db
      .update(schemesOfWork)
      .set({
        ...(patch.title !== undefined && { title: patch.title.trim() }),
        updatedAt: now(),
      })
      .where(eq(schemesOfWork.id, schemeId))
      .returning();

    return { success: true, message: "Scheme updated.", scheme: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update scheme." };
  }
};

// 8. Submit for approval
export const submitSchemeService = async (
  schemeId: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, schemeId),
    });
    if (!existing) return { success: false, message: "Scheme not found." };
    if (existing.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can submit this scheme." };
    }
    if (existing.status === "Submitted") {
      return { success: true, message: "Scheme is already submitted.", scheme: existing };
    }
    if (existing.status === "Approved") {
      return { success: false, message: "Scheme is already approved." };
    }

    // Must have at least one entry
    const [entryCount] = await db
      .select({ c: count() })
      .from(schemeOfWorkEntries)
      .where(eq(schemeOfWorkEntries.schemeId, schemeId));
    if (Number(entryCount?.c ?? 0) === 0) {
      return {
        success: false,
        message: "Cannot submit a scheme with no entries. Add at least one week/lesson first.",
      };
    }

    const [row] = await db
      .update(schemesOfWork)
      .set({ status: "Submitted", submittedAt: now(), updatedAt: now() })
      .where(eq(schemesOfWork.id, schemeId))
      .returning();

    return { success: true, message: "Scheme submitted for review.", scheme: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to submit scheme." };
  }
};

// 9. Approve (HOD / admin only — enforced in controller)
export const approveSchemeService = async (
  schemeId: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, schemeId),
    });
    if (!existing) return { success: false, message: "Scheme not found." };
    if (existing.status !== "Submitted") {
      return { success: false, message: `Cannot approve a scheme in "${existing.status}" status.` };
    }

    const [row] = await db
      .update(schemesOfWork)
      .set({
        status: "Approved",
        approvedBy: actorId,
        approvedAt: now(),
        reviewComments: null,
        updatedAt: now(),
      })
      .where(eq(schemesOfWork.id, schemeId))
      .returning();

    return { success: true, message: "Scheme approved.", scheme: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to approve scheme." };
  }
};

// 10. Reject (with comments)
export const rejectSchemeService = async (
  schemeId: string,
  reviewComments: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, schemeId),
    });
    if (!existing) return { success: false, message: "Scheme not found." };
    if (existing.status !== "Submitted") {
      return { success: false, message: `Cannot reject a scheme in "${existing.status}" status.` };
    }

    const [row] = await db
      .update(schemesOfWork)
      .set({
        status: "Rejected",
        approvedBy: actorId,
        approvedAt: now(),
        reviewComments: reviewComments.trim(),
        updatedAt: now(),
      })
      .where(eq(schemesOfWork.id, schemeId))
      .returning();

    return { success: true, message: "Scheme rejected with comments.", scheme: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reject scheme." };
  }
};

// 11. Delete (only Draft / Rejected)
export const deleteSchemeService = async (
  schemeId: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, schemeId),
    });
    if (!existing) return { success: false, message: "Scheme not found." };
    if (existing.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can delete this scheme." };
    }
    if (!["Draft", "Rejected"].includes(existing.status)) {
      return {
        success: false,
        message: `Cannot delete a scheme in "${existing.status}" status. Only Draft or Rejected can be deleted.`,
      };
    }

    const [row] = await db
      .delete(schemesOfWork)
      .where(eq(schemesOfWork.id, schemeId))
      .returning();

    return { success: true, message: "Scheme deleted (entries cascaded).", scheme: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete scheme." };
  }
};

// ================================================================
// SCHEME ENTRIES — 8 services
// ================================================================

// 12. Create entry
export const createEntryService = async (
  data: {
    schemeId: string;
    weekNumber: number;
    lessonNumber: number;
    topic: string;
    strandId?: string | null;
    subStrandId?: string | null;
    objectives?: string | null;
    learningActivities?: string | null;
    resources?: string | null;
    assessmentMethods?: string | null;
    remarks?: string | null;
  },
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const scheme = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, data.schemeId),
    });
    if (!scheme) return { success: false, message: "Scheme not found." };
    if (scheme.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can add entries." };
    }
    if (scheme.status === "Approved") {
      return { success: false, message: "Approved schemes are locked. Cannot add entries." };
    }

    const [row] = await db
      .insert(schemeOfWorkEntries)
      .values({
        schemeId: data.schemeId,
        weekNumber: data.weekNumber,
        lessonNumber: data.lessonNumber,
        topic: data.topic.trim(),
        strandId: data.strandId ?? null,
        subStrandId: data.subStrandId ?? null,
        objectives: data.objectives?.trim() ?? null,
        learningActivities: data.learningActivities?.trim() ?? null,
        resources: data.resources?.trim() ?? null,
        assessmentMethods: data.assessmentMethods?.trim() ?? null,
        remarks: data.remarks?.trim() ?? null,
        isCovered: false,
      })
      .returning();

    return { success: true, message: "Entry created.", entry: row };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return {
        success: false,
        message: "An entry with this week + lesson number already exists in this scheme.",
      };
    }
    return { success: false, message: e?.message || "Failed to create entry." };
  }
};

// 13. Bulk create entries
export const bulkCreateEntriesService = async (
  data: {
    schemeId: string;
    entries: Array<{
      weekNumber: number;
      lessonNumber: number;
      topic: string;
      strandId?: string | null;
      subStrandId?: string | null;
      objectives?: string | null;
      learningActivities?: string | null;
      resources?: string | null;
      assessmentMethods?: string | null;
      remarks?: string | null;
    }>;
  },
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const scheme = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, data.schemeId),
    });
    if (!scheme) return { success: false, message: "Scheme not found." };
    if (scheme.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can add entries." };
    }
    if (scheme.status === "Approved") {
      return { success: false, message: "Approved schemes are locked." };
    }

    const issues: string[] = [];
    const rows: TSelectSchemeOfWorkEntry[] = [];

    await db.transaction(async (tx) => {
      for (const e of data.entries) {
        try {
          const [row] = await tx
            .insert(schemeOfWorkEntries)
            .values({
              schemeId: data.schemeId,
              weekNumber: e.weekNumber,
              lessonNumber: e.lessonNumber,
              topic: e.topic.trim(),
              strandId: e.strandId ?? null,
              subStrandId: e.subStrandId ?? null,
              objectives: e.objectives?.trim() ?? null,
              learningActivities: e.learningActivities?.trim() ?? null,
              resources: e.resources?.trim() ?? null,
              assessmentMethods: e.assessmentMethods?.trim() ?? null,
              remarks: e.remarks?.trim() ?? null,
              isCovered: false,
            })
            .returning();
          rows.push(row);
        } catch (err: any) {
          if (String(err?.code) === "23505") {
            issues.push(`W${e.weekNumber} L${e.lessonNumber}: duplicate`);
          } else {
            issues.push(`W${e.weekNumber} L${e.lessonNumber}: ${err?.message ?? "insert failed"}`);
          }
        }
      }
    });

    return {
      success: rows.length > 0,
      message: `Created ${rows.length} of ${data.entries.length} entr${data.entries.length === 1 ? "y" : "ies"}.${
        issues.length ? ` ${issues.length} skipped.` : ""
      }`,
      entries: rows,
      count: rows.length,
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create entries." };
  }
};

// 14. Get entry by ID
export const getEntryByIdService = async (
  entryId: string
): Promise<PlanningResponse> => {
  try {
    const row = await db.query.schemeOfWorkEntries.findFirst({
      where: eq(schemeOfWorkEntries.id, entryId),
      with: {
        scheme: {
          with: {
            class: { columns: { id: true, stream: true } },
            subject: { columns: { id: true, name: true } },
            teacher: { columns: { id: true, name: true } },
          },
        },
        strand: { columns: { id: true, name: true } },
        subStrand: { columns: { id: true, name: true } },
      },
    });
    if (!row) return { success: false, message: "Entry not found." };
    return { success: true, message: "Entry retrieved.", entry: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load entry." };
  }
};

// 15. List entries for a scheme
export const listEntriesForSchemeService = async (
  schemeId: string
): Promise<PlanningResponse> => {
  try {
    const rows = await db.query.schemeOfWorkEntries.findMany({
      where: eq(schemeOfWorkEntries.schemeId, schemeId),
      with: {
        strand: { columns: { id: true, name: true } },
        subStrand: { columns: { id: true, name: true } },
      },
      orderBy: [
        asc(schemeOfWorkEntries.weekNumber),
        asc(schemeOfWorkEntries.lessonNumber),
      ],
    });
    return {
      success: true,
      message: `${rows.length} entr${rows.length === 1 ? "y" : "ies"}.`,
      entries: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list entries." };
  }
};

// 16. Update entry
export const updateEntryService = async (
  entryId: string,
  patch: {
    weekNumber?: number;
    lessonNumber?: number;
    topic?: string;
    strandId?: string | null;
    subStrandId?: string | null;
    objectives?: string | null;
    learningActivities?: string | null;
    resources?: string | null;
    assessmentMethods?: string | null;
    remarks?: string | null;
  },
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const entry = await db.query.schemeOfWorkEntries.findFirst({
      where: eq(schemeOfWorkEntries.id, entryId),
      with: { scheme: true },
    });
    if (!entry) return { success: false, message: "Entry not found." };
    if ((entry.scheme as any).teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can edit this entry." };
    }
    if ((entry.scheme as any).status === "Approved") {
      return { success: false, message: "Approved schemes are locked." };
    }

    const [row] = await db
      .update(schemeOfWorkEntries)
      .set({
        ...(patch.weekNumber !== undefined && { weekNumber: patch.weekNumber }),
        ...(patch.lessonNumber !== undefined && { lessonNumber: patch.lessonNumber }),
        ...(patch.topic !== undefined && { topic: patch.topic.trim() }),
        ...(patch.strandId !== undefined && { strandId: patch.strandId }),
        ...(patch.subStrandId !== undefined && { subStrandId: patch.subStrandId }),
        ...(patch.objectives !== undefined && {
          objectives: patch.objectives?.trim() ?? null,
        }),
        ...(patch.learningActivities !== undefined && {
          learningActivities: patch.learningActivities?.trim() ?? null,
        }),
        ...(patch.resources !== undefined && {
          resources: patch.resources?.trim() ?? null,
        }),
        ...(patch.assessmentMethods !== undefined && {
          assessmentMethods: patch.assessmentMethods?.trim() ?? null,
        }),
        ...(patch.remarks !== undefined && { remarks: patch.remarks?.trim() ?? null }),
      })
      .where(eq(schemeOfWorkEntries.id, entryId))
      .returning();

    return { success: true, message: "Entry updated.", entry: row };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return {
        success: false,
        message: "Another entry already uses this week + lesson number in this scheme.",
      };
    }
    return { success: false, message: e?.message || "Failed to update entry." };
  }
};

// 17. Mark covered
export const markEntryCoveredService = async (
  entryId: string,
  coveredOn: string | undefined,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const entry = await db.query.schemeOfWorkEntries.findFirst({
      where: eq(schemeOfWorkEntries.id, entryId),
      with: { scheme: true },
    });
    if (!entry) return { success: false, message: "Entry not found." };
    if ((entry.scheme as any).teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can mark coverage." };
    }
    if ((entry.scheme as any).status !== "Approved") {
      return {
        success: false,
        message: "Only approved schemes can have coverage marked. Submit for approval first.",
      };
    }

    const [row] = await db
      .update(schemeOfWorkEntries)
      .set({
        isCovered: true,
        coveredOn: (coveredOn ?? todayIso()) as any,
      })
      .where(eq(schemeOfWorkEntries.id, entryId))
      .returning();

    return { success: true, message: "Entry marked as covered.", entry: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to mark coverage." };
  }
};

// 18. Unmark covered
export const unmarkEntryCoveredService = async (
  entryId: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const entry = await db.query.schemeOfWorkEntries.findFirst({
      where: eq(schemeOfWorkEntries.id, entryId),
      with: { scheme: true },
    });
    if (!entry) return { success: false, message: "Entry not found." };
    if ((entry.scheme as any).teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can unmark coverage." };
    }

    const [row] = await db
      .update(schemeOfWorkEntries)
      .set({ isCovered: false, coveredOn: null })
      .where(eq(schemeOfWorkEntries.id, entryId))
      .returning();

    return { success: true, message: "Coverage cleared.", entry: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to unmark coverage." };
  }
};

// 19. Reorder entries
export const reorderEntriesService = async (
  schemeId: string,
  orderedIds: string[],
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const scheme = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, schemeId),
    });
    if (!scheme) return { success: false, message: "Scheme not found." };
    if (scheme.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can reorder entries." };
    }
    if (scheme.status === "Approved") {
      return { success: false, message: "Approved schemes are locked." };
    }

    const rows = await db.transaction(async (tx) => {
      const out: TSelectSchemeOfWorkEntry[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const weekNumber = Math.floor(i / 10) + 1;
        const lessonNumber = (i % 10) + 1;
        const [r] = await tx
          .update(schemeOfWorkEntries)
          .set({ weekNumber, lessonNumber })
          .where(
            and(
              eq(schemeOfWorkEntries.id, orderedIds[i]),
              eq(schemeOfWorkEntries.schemeId, schemeId)
            )
          )
          .returning();
        if (r) out.push(r);
      }
      return out;
    });

    return {
      success: true,
      message: `Reordered ${rows.length} entries.`,
      entries: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reorder entries." };
  }
};

// 20. Delete entry
export const deleteEntryService = async (
  entryId: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const entry = await db.query.schemeOfWorkEntries.findFirst({
      where: eq(schemeOfWorkEntries.id, entryId),
      with: { scheme: true },
    });
    if (!entry) return { success: false, message: "Entry not found." };
    if ((entry.scheme as any).teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can delete this entry." };
    }
    if ((entry.scheme as any).status === "Approved") {
      return { success: false, message: "Approved schemes are locked." };
    }

    const [row] = await db
      .delete(schemeOfWorkEntries)
      .where(eq(schemeOfWorkEntries.id, entryId))
      .returning();

    return { success: true, message: "Entry deleted.", entry: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete entry." };
  }
};

// ================================================================
// LESSON PLANS — 10 services
// ================================================================

// 21. Create lesson plan
export const createLessonPlanService = async (
  data: {
    schoolId: string;
    classId: string;
    subjectId: string;
    teacherId?: string;
    schemeEntryId?: string | null;
    lessonDate: string;
    topic: string;
    objectives?: string | null;
    introduction?: string | null;
    development?: string | null;
    conclusion?: string | null;
    resources?: string | null;
    assessment?: string | null;
  },
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const [school, cls, subject] = await Promise.all([
      assertSchoolExists(data.schoolId),
      assertClassInSchool(data.classId, data.schoolId),
      assertSubjectInSchool(data.subjectId, data.schoolId),
    ]);
    if (!school) return { success: false, message: "School not found." };
    if (!cls) return { success: false, message: "Class not found in this school." };
    if (!subject) return { success: false, message: "Subject not found in this school." };

    const teacherId = data.teacherId ?? actorId;

    const [row] = await db
      .insert(lessonPlans)
      .values({
        schoolId: data.schoolId,
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId,
        schemeEntryId: data.schemeEntryId ?? null,
        lessonDate: data.lessonDate as any,
        topic: data.topic.trim(),
        objectives: data.objectives?.trim() ?? null,
        introduction: data.introduction?.trim() ?? null,
        development: data.development?.trim() ?? null,
        conclusion: data.conclusion?.trim() ?? null,
        resources: data.resources?.trim() ?? null,
        assessment: data.assessment?.trim() ?? null,
        status: "Draft",
      })
      .returning();

    return {
      success: true,
      message: `Lesson plan for "${row.topic}" created (Draft).`,
      plan: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create lesson plan." };
  }
};

// 22. Bulk create
export const bulkCreateLessonPlansService = async (
  data: {
    schoolId: string;
    plans: Array<{
      classId: string;
      subjectId: string;
      teacherId?: string;
      schemeEntryId?: string | null;
      lessonDate: string;
      topic: string;
      objectives?: string | null;
      introduction?: string | null;
      development?: string | null;
      conclusion?: string | null;
      resources?: string | null;
      assessment?: string | null;
    }>;
  },
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const school = await assertSchoolExists(data.schoolId);
    if (!school) return { success: false, message: "School not found." };

    const issues: string[] = [];
    const rows: TSelectLessonPlan[] = [];

    await db.transaction(async (tx) => {
      for (const p of data.plans) {
        try {
          const [row] = await tx
            .insert(lessonPlans)
            .values({
              schoolId: data.schoolId,
              classId: p.classId,
              subjectId: p.subjectId,
              teacherId: p.teacherId ?? actorId,
              schemeEntryId: p.schemeEntryId ?? null,
              lessonDate: p.lessonDate as any,
              topic: p.topic.trim(),
              objectives: p.objectives?.trim() ?? null,
              introduction: p.introduction?.trim() ?? null,
              development: p.development?.trim() ?? null,
              conclusion: p.conclusion?.trim() ?? null,
              resources: p.resources?.trim() ?? null,
              assessment: p.assessment?.trim() ?? null,
              status: "Draft",
            })
            .returning();
          rows.push(row);
        } catch (e: any) {
          issues.push(`${p.lessonDate} ${p.topic}: ${e?.message ?? "insert failed"}`);
        }
      }
    });

    return {
      success: rows.length > 0,
      message: `Created ${rows.length} of ${data.plans.length} lesson plan(s).${
        issues.length ? ` ${issues.length} skipped.` : ""
      }`,
      plans: rows,
      count: rows.length,
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create lesson plans." };
  }
};

// 23. Get by ID
export const getLessonPlanByIdService = async (
  planId: string
): Promise<PlanningResponse> => {
  try {
    const row = await db.query.lessonPlans.findFirst({
      where: eq(lessonPlans.id, planId),
      with: {
        class: { columns: { id: true, stream: true } },
        subject: { columns: { id: true, name: true, code: true } },
        teacher: { columns: { id: true, name: true } },
        schemeEntry: {
          with: {
            strand: { columns: { id: true, name: true } },
            subStrand: { columns: { id: true, name: true } },
          },
        },
      },
    });
    if (!row) return { success: false, message: "Lesson plan not found." };
    return { success: true, message: "Lesson plan retrieved.", plan: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load lesson plan." };
  }
};

// 24. List for teacher
export const listLessonPlansForTeacherService = async (
  teacherId: string,
  opts: { from?: string; to?: string; status?: ApprovalStatus }
): Promise<PlanningResponse> => {
  try {
    const filters: any[] = [eq(lessonPlans.teacherId, teacherId)];
    if (opts.from) filters.push(gte(lessonPlans.lessonDate, opts.from as any));
    if (opts.to) filters.push(lte(lessonPlans.lessonDate, opts.to as any));
    if (opts.status) filters.push(eq(lessonPlans.status, opts.status));

    const rows = await db.query.lessonPlans.findMany({
      where: and(...filters),
      with: {
        class: { columns: { id: true, stream: true } },
        subject: { columns: { id: true, name: true, code: true } },
      },
      orderBy: [desc(lessonPlans.lessonDate)],
    });

    return {
      success: true,
      message: `${rows.length} lesson plan(s).`,
      plans: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list lesson plans." };
  }
};

// 25. List for class
export const listLessonPlansForClassService = async (
  classId: string,
  opts: { from?: string; to?: string; subjectId?: string }
): Promise<PlanningResponse> => {
  try {
    const filters: any[] = [eq(lessonPlans.classId, classId)];
    if (opts.subjectId) filters.push(eq(lessonPlans.subjectId, opts.subjectId));
    if (opts.from) filters.push(gte(lessonPlans.lessonDate, opts.from as any));
    if (opts.to) filters.push(lte(lessonPlans.lessonDate, opts.to as any));

    const rows = await db.query.lessonPlans.findMany({
      where: and(...filters),
      with: {
        subject: { columns: { id: true, name: true, code: true } },
        teacher: { columns: { id: true, name: true } },
      },
      orderBy: [desc(lessonPlans.lessonDate)],
    });

    return {
      success: true,
      message: `${rows.length} lesson plan(s) for this class.`,
      plans: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list lesson plans." };
  }
};

// 26. List by date range (school-wide)
export const listLessonPlansForDateRangeService = async (
  schoolId: string,
  from: string,
  to: string,
  opts: { page: number; limit: number }
): Promise<PlanningResponse> => {
  try {
    const offset = (opts.page - 1) * opts.limit;
    const filters = and(
      eq(lessonPlans.schoolId, schoolId),
      gte(lessonPlans.lessonDate, from as any),
      lte(lessonPlans.lessonDate, to as any)
    );

    const [rows, [totals]] = await Promise.all([
      db.query.lessonPlans.findMany({
        where: filters,
        with: {
          class: { columns: { id: true, stream: true } },
          subject: { columns: { id: true, name: true, code: true } },
          teacher: { columns: { id: true, name: true } },
        },
        orderBy: [desc(lessonPlans.lessonDate)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(lessonPlans).where(filters),
    ]);

    return {
      success: true,
      message: `${rows.length} lesson plan(s) on this page.`,
      plans: rows as any,
      count: Number(totals?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list lesson plans." };
  }
};

// 27. Update
export const updateLessonPlanService = async (
  planId: string,
  patch: {
    schemeEntryId?: string | null;
    lessonDate?: string;
    topic?: string;
    objectives?: string | null;
    introduction?: string | null;
    development?: string | null;
    conclusion?: string | null;
    resources?: string | null;
    assessment?: string | null;
  },
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.lessonPlans.findFirst({
      where: eq(lessonPlans.id, planId),
    });
    if (!existing) return { success: false, message: "Lesson plan not found." };
    if (existing.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can edit this plan." };
    }
    if (existing.status === "Approved") {
      return { success: false, message: "Approved lesson plans cannot be edited." };
    }

    const [row] = await db
      .update(lessonPlans)
      .set({
        ...(patch.schemeEntryId !== undefined && { schemeEntryId: patch.schemeEntryId }),
        ...(patch.lessonDate !== undefined && { lessonDate: patch.lessonDate as any }),
        ...(patch.topic !== undefined && { topic: patch.topic.trim() }),
        ...(patch.objectives !== undefined && {
          objectives: patch.objectives?.trim() ?? null,
        }),
        ...(patch.introduction !== undefined && {
          introduction: patch.introduction?.trim() ?? null,
        }),
        ...(patch.development !== undefined && {
          development: patch.development?.trim() ?? null,
        }),
        ...(patch.conclusion !== undefined && {
          conclusion: patch.conclusion?.trim() ?? null,
        }),
        ...(patch.resources !== undefined && {
          resources: patch.resources?.trim() ?? null,
        }),
        ...(patch.assessment !== undefined && {
          assessment: patch.assessment?.trim() ?? null,
        }),
        updatedAt: now(),
      })
      .where(eq(lessonPlans.id, planId))
      .returning();

    return { success: true, message: "Lesson plan updated.", plan: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update lesson plan." };
  }
};

// 28. Submit
export const submitLessonPlanService = async (
  planId: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.lessonPlans.findFirst({
      where: eq(lessonPlans.id, planId),
    });
    if (!existing) return { success: false, message: "Lesson plan not found." };
    if (existing.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can submit this plan." };
    }
    if (existing.status === "Submitted") {
      return { success: true, message: "Already submitted.", plan: existing };
    }
    if (existing.status === "Approved") {
      return { success: false, message: "Already approved." };
    }

    const [row] = await db
      .update(lessonPlans)
      .set({ status: "Submitted", updatedAt: now() })
      .where(eq(lessonPlans.id, planId))
      .returning();

    return { success: true, message: "Lesson plan submitted.", plan: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to submit lesson plan." };
  }
};

// 29. Approve
export const approveLessonPlanService = async (
  planId: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.lessonPlans.findFirst({
      where: eq(lessonPlans.id, planId),
    });
    if (!existing) return { success: false, message: "Lesson plan not found." };
    if (existing.status !== "Submitted") {
      return { success: false, message: `Cannot approve a plan in "${existing.status}" status.` };
    }

    const [row] = await db
      .update(lessonPlans)
      .set({ status: "Approved", updatedAt: now() })
      .where(eq(lessonPlans.id, planId))
      .returning();

    return { success: true, message: "Lesson plan approved.", plan: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to approve." };
  }
};

// 30. Reject
export const rejectLessonPlanService = async (
  planId: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.lessonPlans.findFirst({
      where: eq(lessonPlans.id, planId),
    });
    if (!existing) return { success: false, message: "Lesson plan not found." };
    if (existing.status !== "Submitted") {
      return { success: false, message: `Cannot reject a plan in "${existing.status}" status.` };
    }

    const [row] = await db
      .update(lessonPlans)
      .set({ status: "Rejected", updatedAt: now() })
      .where(eq(lessonPlans.id, planId))
      .returning();

    return { success: true, message: "Lesson plan rejected.", plan: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reject." };
  }
};

// 31. Add post-lesson reflection
export const addReflectionService = async (
  planId: string,
  reflection: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.lessonPlans.findFirst({
      where: eq(lessonPlans.id, planId),
    });
    if (!existing) return { success: false, message: "Lesson plan not found." };
    if (existing.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can add a reflection." };
    }

    const [row] = await db
      .update(lessonPlans)
      .set({ reflection: reflection.trim(), updatedAt: now() })
      .where(eq(lessonPlans.id, planId))
      .returning();

    return { success: true, message: "Reflection saved.", plan: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to save reflection." };
  }
};

// 32. Delete
export const deleteLessonPlanService = async (
  planId: string,
  actorId: string
): Promise<PlanningResponse> => {
  try {
    const existing = await db.query.lessonPlans.findFirst({
      where: eq(lessonPlans.id, planId),
    });
    if (!existing) return { success: false, message: "Lesson plan not found." };
    if (existing.teacherId !== actorId) {
      return { success: false, message: "Only the owning teacher can delete this plan." };
    }

    const [row] = await db
      .delete(lessonPlans)
      .where(eq(lessonPlans.id, planId))
      .returning();

    return { success: true, message: "Lesson plan deleted.", plan: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete." };
  }
};

// ================================================================
// ANALYTICS — 1 service (coverage roll-up)
// ================================================================

// 33. Scheme coverage summary (% of entries covered)
export const getSchemeCoverageService = async (
  schemeId: string
): Promise<PlanningResponse> => {
  try {
    const scheme = await db.query.schemesOfWork.findFirst({
      where: eq(schemesOfWork.id, schemeId),
      with: {
        class: { columns: { id: true, stream: true } },
        subject: { columns: { id: true, name: true } },
        teacher: { columns: { id: true, name: true } },
      },
    });
    if (!scheme) return { success: false, message: "Scheme not found." };

    const [total] = await db
      .select({ c: count() })
      .from(schemeOfWorkEntries)
      .where(eq(schemeOfWorkEntries.schemeId, schemeId));

    const [covered] = await db
      .select({ c: count() })
      .from(schemeOfWorkEntries)
      .where(
        and(
          eq(schemeOfWorkEntries.schemeId, schemeId),
          eq(schemeOfWorkEntries.isCovered, true)
        )
      );

    const totalN = Number(total?.c ?? 0);
    const coveredN = Number(covered?.c ?? 0);
    const percent = totalN === 0 ? 0 : Math.round((coveredN / totalN) * 10000) / 100;

    return {
      success: true,
      message: `${coveredN}/${totalN} entr${totalN === 1 ? "y" : "ies"} covered (${percent}%).`,
      stats: {
        scheme: {
          id: scheme.id,
          title: scheme.title,
          class: (scheme as any).class?.stream,
          subject: (scheme as any).subject?.name,
          teacher: (scheme as any).teacher?.name,
          status: scheme.status,
        },
        totalEntries: totalN,
        coveredEntries: coveredN,
        uncoveredEntries: totalN - coveredN,
        coveragePercent: percent,
      },
      count: totalN,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute coverage." };
  }
};