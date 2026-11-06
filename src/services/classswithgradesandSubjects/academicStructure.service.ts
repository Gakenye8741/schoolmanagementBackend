import { eq, and, ne, asc, desc, count, sql, inArray, ilike, isNull } from "drizzle-orm";

import {
  gradeLevels,
  subjects,
  classes,
  classSubjects,
  teacherSubjects,
  students,
  users,
  studentEnrollmentHistory,
  academicTerms,
  TSelectGradeLevel,
  TSelectSubject,
  TSelectClass,
  TSelectClassSubject,
  TSelectStudent,
  TSelectUser,
  TInsertGradeLevel,
  TInsertSubject,
  TInsertClass,
  TInsertClassSubject,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Response envelope
// ================================================================
export interface AcademicStructureResponse {
  success: boolean;
  message: string;
  gradeLevel?: TSelectGradeLevel;
  gradeLevels?: TSelectGradeLevel[];
  subject?: TSelectSubject;
  subjects?: TSelectSubject[];
  classRow?: TSelectClass;
  classes?: TSelectClass[];
  classSubject?: TSelectClassSubject;
  classSubjects?: TSelectClassSubject[];
  students?: TSelectStudent[];
  teacher?: Pick<TSelectUser, "id" | "name" | "email"> | null;
  count?: number;
  issues?: string[];
  promotionMap?: Array<{ from: string; to: string | null }>;
}

// ================================================================
// Helpers
// ================================================================
const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "-");

const isValidClassTeacher = async (teacherId: string, schoolId: string): Promise<boolean> => {
  const u = await db.query.users.findFirst({
    where: and(eq(users.id, teacherId), eq(users.schoolId, schoolId)),
  });
  if (!u) return false;
  const roles = u.roles ?? [];
  return roles.includes("teacher") || roles.includes("principal") || roles.includes("deputy_principal");
};

const classHasActiveStudents = async (classId: string): Promise<number> => {
  const [row] = await db
    .select({ count: count() })
    .from(students)
    .where(and(eq(students.classId, classId), eq(students.isEnrolled, true), isNull(students.deletedAt)));
  return Number(row?.count ?? 0);
};

const walkPromotionChain = async (
  startId: string,
  schoolId: string,
  maxHops = 30
): Promise<{ chain: TSelectGradeLevel[]; cycle: boolean }> => {
  const chain: TSelectGradeLevel[] = [];
  const seen = new Set<string>();
  let cursor: string | null = startId;

  for (let i = 0; i < maxHops && cursor; i++) {
    if (seen.has(cursor)) return { chain, cycle: true };
    seen.add(cursor);
    const g: any = await db.query.gradeLevels.findFirst({
      where: and(eq(gradeLevels.id, cursor), eq(gradeLevels.schoolId, schoolId)),
    });
    if (!g) break;
    chain.push(g);
    cursor = g.nextGradeLevelId;
  }
  return { chain, cycle: false };
};

// ================================================================
// =============== GRADE LEVELS (20 services) =====================
// ================================================================

// 1. Create grade level
export const createGradeLevelService = async (
  data: TInsertGradeLevel
): Promise<AcademicStructureResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.name) return { success: false, message: "Grade level name is required." };
    if (data.sortOrder === undefined || data.sortOrder === null)
      return { success: false, message: "sortOrder is required." };

    if (data.nextGradeLevelId) {
      const next = await db.query.gradeLevels.findFirst({
        where: and(
          eq(gradeLevels.id, data.nextGradeLevelId),
          eq(gradeLevels.schoolId, data.schoolId)
        ),
      });
      if (!next)
        return { success: false, message: "The next grade level must belong to the same school." };
      if (data.nextGradeLevelId === data.id)
        return { success: false, message: "A grade level cannot promote into itself." };
    }

    const [row] = await db.insert(gradeLevels).values(data).returning();
    return { success: true, message: "Grade level created successfully.", gradeLevel: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A grade level with that name already exists for this school." };
    return { success: false, message: e?.message || "Failed to create grade level." };
  }
};

// 2. Get grade level by ID
export const getGradeLevelByIdService = async (id: string): Promise<AcademicStructureResponse> => {
  try {
    const g = await db.query.gradeLevels.findFirst({ where: eq(gradeLevels.id, id) });
    if (!g) return { success: false, message: "Grade level not found." };
    return { success: true, message: "Grade level retrieved.", gradeLevel: g };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch grade level." };
  }
};

// 3. Get grade level with its classes
export const getGradeLevelWithClassesService = async (
  id: string
): Promise<AcademicStructureResponse> => {
  try {
    const g = await db.query.gradeLevels.findFirst({
      where: eq(gradeLevels.id, id),
      with: { classes: true },
    });
    if (!g) return { success: false, message: "Grade level not found." };
    return {
      success: true,
      message: "Grade level with classes retrieved.",
      gradeLevel: g as TSelectGradeLevel,
      classes: (g as any).classes,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch grade level with classes." };
  }
};

// 4. List grade levels for a school (ordered)
export const listGradeLevelsService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.gradeLevels.findMany({
      where: eq(gradeLevels.schoolId, schoolId),
      orderBy: [asc(gradeLevels.sortOrder)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} grade level(s).`,
      gradeLevels: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list grade levels." };
  }
};

// 5. List grade levels by education stage
export const listGradeLevelsByStageService = async (
  schoolId: string,
  stage: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.gradeLevels.findMany({
      where: and(eq(gradeLevels.schoolId, schoolId), eq(gradeLevels.educationStage, stage)),
      orderBy: [asc(gradeLevels.sortOrder)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} grade level(s) for stage "${stage}".`,
      gradeLevels: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list grade levels by stage." };
  }
};

// 6. Update grade level
export const updateGradeLevelService = async (
  id: string,
  patch: Partial<TInsertGradeLevel>
): Promise<AcademicStructureResponse> => {
  try {
    const existing = await db.query.gradeLevels.findFirst({ where: eq(gradeLevels.id, id) });
    if (!existing) return { success: false, message: "Grade level not found." };

    if (patch.nextGradeLevelId) {
      if (patch.nextGradeLevelId === id)
        return { success: false, message: "A grade level cannot promote into itself." };
      const next = await db.query.gradeLevels.findFirst({
        where: and(
          eq(gradeLevels.id, patch.nextGradeLevelId),
          eq(gradeLevels.schoolId, existing.schoolId)
        ),
      });
      if (!next)
        return { success: false, message: "The next grade level must belong to the same school." };
      // Cycle check via chain walk
      const { chain, cycle } = await walkPromotionChain(patch.nextGradeLevelId, existing.schoolId);
      if (cycle || chain.some((c) => c.id === id))
        return { success: false, message: "This update would create a cycle in the promotion ladder." };
    }

    const [row] = await db
      .update(gradeLevels)
      .set(patch)
      .where(eq(gradeLevels.id, id))
      .returning();
    return { success: true, message: "Grade level updated.", gradeLevel: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A grade level with that name already exists." };
    return { success: false, message: e?.message || "Failed to update grade level." };
  }
};

// 7. Delete grade level
export const deleteGradeLevelService = async (id: string): Promise<AcademicStructureResponse> => {
  try {
    const [row] = await db.delete(gradeLevels).where(eq(gradeLevels.id, id)).returning();
    if (!row) return { success: false, message: "Grade level not found." };
    return { success: true, message: "Grade level deleted.", gradeLevel: row };
  } catch (e: any) {
    if (String(e?.code) === "23503")
      return {
        success: false,
        message: "Cannot delete: classes or curriculum strands reference this grade level.",
      };
    return { success: false, message: e?.message || "Failed to delete grade level." };
  }
};

// 8. Set the next grade level (single-purpose link)
export const setNextGradeLevelService = async (
  id: string,
  nextGradeLevelId: string | null
): Promise<AcademicStructureResponse> => {
  return updateGradeLevelService(id, { nextGradeLevelId });
};

// 9. Mark as final grade (graduates here)
export const markGradeLevelAsFinalService = async (
  id: string
): Promise<AcademicStructureResponse> => {
  try {
    const existing = await db.query.gradeLevels.findFirst({ where: eq(gradeLevels.id, id) });
    if (!existing) return { success: false, message: "Grade level not found." };
    const [row] = await db
      .update(gradeLevels)
      .set({ isFinalGrade: true, nextGradeLevelId: null })
      .where(eq(gradeLevels.id, id))
      .returning();
    return { success: true, message: "Grade level marked as final.", gradeLevel: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to mark grade as final." };
  }
};

// 10. Get the final grade level for a school
export const getFinalGradeLevelService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const g = await db.query.gradeLevels.findFirst({
      where: and(eq(gradeLevels.schoolId, schoolId), eq(gradeLevels.isFinalGrade, true)),
    });
    if (!g) return { success: false, message: "No final grade level is configured for this school." };
    return { success: true, message: "Final grade level retrieved.", gradeLevel: g };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch final grade level." };
  }
};

// 11. Get the promotion chain from a grade level
export const getPromotionChainService = async (
  id: string
): Promise<AcademicStructureResponse> => {
  try {
    const g = await db.query.gradeLevels.findFirst({ where: eq(gradeLevels.id, id) });
    if (!g) return { success: false, message: "Grade level not found." };
    const { chain, cycle } = await walkPromotionChain(id, g.schoolId);
    return {
      success: !cycle,
      message: cycle
        ? "The promotion chain contains a cycle — fix the ladder before promoting students."
        : `Promotion chain has ${chain.length} step(s).`,
      gradeLevels: chain,
      count: chain.length,
      promotionMap: chain.map((c) => ({
        from: c.name,
        to: chain.find((x) => x.id === c.nextGradeLevelId)?.name ?? null,
      })),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to walk promotion chain." };
  }
};

// 12. Get the previous grade level in the ladder
export const getPreviousGradeLevelService = async (
  id: string
): Promise<AcademicStructureResponse> => {
  try {
    const g = await db.query.gradeLevels.findFirst({ where: eq(gradeLevels.id, id) });
    if (!g) return { success: false, message: "Grade level not found." };
    const prev = await db.query.gradeLevels.findFirst({
      where: and(
        eq(gradeLevels.schoolId, g.schoolId),
        eq(gradeLevels.nextGradeLevelId, id)
      ),
    });
    if (!prev)
      return { success: true, message: "This is the entry grade level — no previous grade.", gradeLevel: undefined };
    return { success: true, message: "Previous grade level retrieved.", gradeLevel: prev };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch previous grade level." };
  }
};

// 13. Count grade levels for a school
export const countGradeLevelsService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(gradeLevels)
      .where(eq(gradeLevels.schoolId, schoolId));
    return {
      success: true,
      message: `This school has ${Number(row?.count ?? 0)} grade level(s).`,
      count: Number(row?.count ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count grade levels." };
  }
};

// 14. Bulk create grade levels
export const bulkCreateGradeLevelsService = async (
  schoolId: string,
  levels: Array<Omit<TInsertGradeLevel, "schoolId">>
): Promise<AcademicStructureResponse> => {
  try {
    if (!schoolId) return { success: false, message: "schoolId is required." };
    if (!levels.length) return { success: false, message: "At least one grade level is required." };
    const prepared = levels.map((l) => ({ ...l, schoolId }));
    const rows = await db.insert(gradeLevels).values(prepared).returning();
    return {
      success: true,
      message: `Created ${rows.length} grade level(s).`,
      gradeLevels: rows,
      count: rows.length,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "One or more grade levels duplicate an existing name." };
    return { success: false, message: e?.message || "Failed to bulk-create grade levels." };
  }
};

// 15. Reorder grade levels (bulk update sortOrder)
export const reorderGradeLevelsService = async (
  schoolId: string,
  orderedIds: string[]
): Promise<AcademicStructureResponse> => {
  try {
    if (!orderedIds.length)
      return { success: false, message: "Provide at least one grade level ID." };

    const rows = await db.transaction(async (tx) => {
      const out: TSelectGradeLevel[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const [r] = await tx
          .update(gradeLevels)
          .set({ sortOrder: i + 1 })
          .where(and(eq(gradeLevels.id, orderedIds[i]), eq(gradeLevels.schoolId, schoolId)))
          .returning();
        if (r) out.push(r);
      }
      return out;
    });

    return {
      success: true,
      message: `Reordered ${rows.length} grade level(s).`,
      gradeLevels: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reorder grade levels." };
  }
};

// 16. Validate promotion ladder (cycle + final grade + coverage)
export const validatePromotionLadderService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const all = await db.query.gradeLevels.findMany({
      where: eq(gradeLevels.schoolId, schoolId),
      orderBy: [asc(gradeLevels.sortOrder)],
    });
    if (!all.length)
      return { success: false, message: "No grade levels configured for this school.", issues: [] };

    const issues: string[] = [];
    const finals = all.filter((g) => g.isFinalGrade);
    if (finals.length === 0) issues.push("No grade level is marked as final — learners will never graduate.");
    if (finals.length > 1) issues.push(`Multiple grade levels marked final: ${finals.map((f) => f.name).join(", ")}.`);

    for (const g of all) {
      if (g.isFinalGrade && g.nextGradeLevelId)
        issues.push(`"${g.name}" is final but also promotes to another grade.`);
      if (!g.isFinalGrade && !g.nextGradeLevelId)
        issues.push(`"${g.name}" is not final and has no next grade — the ladder is broken here.`);
    }

    for (const g of all) {
      const { cycle } = await walkPromotionChain(g.id, schoolId);
      if (cycle) {
        issues.push(`Promotion chain starting at "${g.name}" contains a cycle.`);
        break;
      }
    }

    return {
      success: issues.length === 0,
      message:
        issues.length === 0
          ? "Promotion ladder is valid."
          : `${issues.length} issue(s) found in the promotion ladder.`,
      gradeLevels: all,
      count: all.length,
      issues,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to validate promotion ladder." };
  }
};

// 17. Get grade level by name (within a school)
export const getGradeLevelByNameService = async (
  schoolId: string,
  name: string
): Promise<AcademicStructureResponse> => {
  try {
    const g = await db.query.gradeLevels.findFirst({
      where: and(eq(gradeLevels.schoolId, schoolId), eq(gradeLevels.name, name)),
    });
    if (!g) return { success: false, message: `Grade level "${name}" not found.` };
    return { success: true, message: "Grade level retrieved.", gradeLevel: g };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch grade level by name." };
  }
};

// 18. Fuzzy search grade levels (ILIKE on name)
export const searchGradeLevelsService = async (
  schoolId: string,
  query: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.gradeLevels.findMany({
      where: and(eq(gradeLevels.schoolId, schoolId), ilike(gradeLevels.name, `%${query}%`)),
      orderBy: [asc(gradeLevels.sortOrder)],
    });
    return {
      success: true,
      message: `Found ${rows.length} grade level(s) matching "${query}".`,
      gradeLevels: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to search grade levels." };
  }
};

// 19. Get root grade level(s) — the entry point of the ladder
export const getRootGradeLevelService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const all = await db.query.gradeLevels.findMany({
      where: eq(gradeLevels.schoolId, schoolId),
    });
    const pointedIds = new Set(all.map((g) => g.nextGradeLevelId).filter(Boolean) as string[]);
    const roots = all.filter((g) => !pointedIds.has(g.id));
    return {
      success: true,
      message: `Found ${roots.length} entry grade level(s).`,
      gradeLevels: roots,
      count: roots.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to find root grade levels." };
  }
};

// 20. Get promotion summary (from → to table for admins)
export const getPromotionSummaryService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const all = await db.query.gradeLevels.findMany({
      where: eq(gradeLevels.schoolId, schoolId),
      orderBy: [asc(gradeLevels.sortOrder)],
    });
    const byId = new Map(all.map((g) => [g.id, g]));
    return {
      success: true,
      message: `Promotion summary across ${all.length} grade level(s).`,
      promotionMap: all.map((g) => ({
        from: g.name,
        to: g.nextGradeLevelId ? byId.get(g.nextGradeLevelId)?.name ?? null : null,
      })),
      gradeLevels: all,
      count: all.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build promotion summary." };
  }
};

// ================================================================
// =============== SUBJECTS (18 services) =========================
// ================================================================

// 21. Create subject
export const createSubjectService = async (
  data: TInsertSubject
): Promise<AcademicStructureResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.name) return { success: false, message: "Subject name is required." };
    if (!data.code) return { success: false, message: "Subject code is required." };
    if (!/^[A-Z0-9]{2,20}$/.test(normalizeCode(data.code)))
      return {
        success: false,
        message: "Subject code must be 2–20 alphanumeric characters (letters/digits only after normalization).",
      };

    const [row] = await db
      .insert(subjects)
      .values({ ...data, code: normalizeCode(data.code) })
      .returning();
    return { success: true, message: "Subject created successfully.", subject: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A subject with that code already exists for this school." };
    return { success: false, message: e?.message || "Failed to create subject." };
  }
};

// 22. Get subject by ID
export const getSubjectByIdService = async (id: string): Promise<AcademicStructureResponse> => {
  try {
    const s = await db.query.subjects.findFirst({ where: eq(subjects.id, id) });
    if (!s) return { success: false, message: "Subject not found." };
    return { success: true, message: "Subject retrieved.", subject: s };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch subject." };
  }
};

// 23. Get subject by code (per school)
export const getSubjectByCodeService = async (
  schoolId: string,
  code: string
): Promise<AcademicStructureResponse> => {
  try {
    const s = await db.query.subjects.findFirst({
      where: and(eq(subjects.schoolId, schoolId), eq(subjects.code, normalizeCode(code))),
    });
    if (!s) return { success: false, message: `Subject with code "${code}" not found.` };
    return { success: true, message: "Subject retrieved.", subject: s };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch subject by code." };
  }
};

// 24. List subjects for a school
export const listSubjectsService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.subjects.findMany({
      where: eq(subjects.schoolId, schoolId),
      orderBy: [asc(subjects.name)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} subject(s).`,
      subjects: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list subjects." };
  }
};

// 25. List subjects by category
export const listSubjectsByCategoryService = async (
  schoolId: string,
  category: TInsertSubject["category"]
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.subjects.findMany({
      where: and(eq(subjects.schoolId, schoolId), eq(subjects.category, category)),
      orderBy: [asc(subjects.name)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} subject(s) in category "${category}".`,
      subjects: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list subjects by category." };
  }
};

// 26. Update subject
export const updateSubjectService = async (
  id: string,
  patch: Partial<TInsertSubject>
): Promise<AcademicStructureResponse> => {
  try {
    const existing = await db.query.subjects.findFirst({ where: eq(subjects.id, id) });
    if (!existing) return { success: false, message: "Subject not found." };

    const prepared: Partial<TInsertSubject> = { ...patch };
    if (patch.code) prepared.code = normalizeCode(patch.code);

    const [row] = await db.update(subjects).set(prepared).where(eq(subjects.id, id)).returning();
    return { success: true, message: "Subject updated.", subject: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A subject with that code already exists." };
    return { success: false, message: e?.message || "Failed to update subject." };
  }
};

// 27. Delete subject
export const deleteSubjectService = async (id: string): Promise<AcademicStructureResponse> => {
  try {
    const [row] = await db.delete(subjects).where(eq(subjects.id, id)).returning();
    if (!row) return { success: false, message: "Subject not found." };
    return { success: true, message: "Subject deleted.", subject: row };
  } catch (e: any) {
    if (String(e?.code) === "23503")
      return {
        success: false,
        message: "Cannot delete: exams, timetables, or curriculum strands reference this subject.",
      };
    return { success: false, message: e?.message || "Failed to delete subject." };
  }
};

// 28. Count subjects for a school
export const countSubjectsService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(subjects)
      .where(eq(subjects.schoolId, schoolId));
    return {
      success: true,
      message: `This school has ${Number(row?.count ?? 0)} subject(s).`,
      count: Number(row?.count ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count subjects." };
  }
};

// 29. Bulk create subjects
export const bulkCreateSubjectsService = async (
  schoolId: string,
  items: Array<Omit<TInsertSubject, "schoolId">>
): Promise<AcademicStructureResponse> => {
  try {
    if (!items.length) return { success: false, message: "At least one subject is required." };
    const prepared = items.map((s) => ({ ...s, schoolId, code: normalizeCode(s.code) }));
    const rows = await db.insert(subjects).values(prepared).returning();
    return {
      success: true,
      message: `Created ${rows.length} subject(s).`,
      subjects: rows,
      count: rows.length,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "One or more subject codes already exist for this school." };
    return { success: false, message: e?.message || "Failed to bulk-create subjects." };
  }
};

// 30. Search subjects by name or code
export const searchSubjectsService = async (
  schoolId: string,
  query: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.subjects.findMany({
      where: and(
        eq(subjects.schoolId, schoolId),
        sql`(${subjects.name} ILIKE ${"%" + query + "%"} OR ${subjects.code} ILIKE ${"%" + query + "%"})`
      ),
      orderBy: [asc(subjects.name)],
    });
    return {
      success: true,
      message: `Found ${rows.length} subject(s) matching "${query}".`,
      subjects: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to search subjects." };
  }
};

// 31. List subjects for a specific class (via classSubjects)
export const listSubjectsForClassService = async (
  classId: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.classSubjects.findMany({
      where: eq(classSubjects.classId, classId),
      with: { subject: true },
    });
    const subs = rows.map((r) => (r as any).subject).filter(Boolean) as TSelectSubject[];
    return {
      success: true,
      message: `Fetched ${subs.length} subject(s) assigned to this class.`,
      subjects: subs,
      count: subs.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list class subjects." };
  }
};

// 32. List subjects a teacher is qualified for
export const listSubjectsForTeacherService = async (
  teacherId: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.teacherSubjects.findMany({
      where: eq(teacherSubjects.teacherId, teacherId),
      with: { subject: true },
    });
    const subs = rows.map((r) => (r as any).subject).filter(Boolean) as TSelectSubject[];
    return {
      success: true,
      message: `Fetched ${subs.length} subject(s) this teacher is qualified for.`,
      subjects: subs,
      count: subs.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list teacher subjects." };
  }
};

// 33. Duplicate a subject under a new code (e.g., roll a subject to a new year)
export const duplicateSubjectService = async (
  id: string,
  newCode: string
): Promise<AcademicStructureResponse> => {
  try {
    const existing = await db.query.subjects.findFirst({ where: eq(subjects.id, id) });
    if (!existing) return { success: false, message: "Subject not found." };
    const [row] = await db
      .insert(subjects)
      .values({
        schoolId: existing.schoolId,
        name: `${existing.name} (copy)`,
        code: normalizeCode(newCode),
        category: existing.category,
      })
      .returning();
    return { success: true, message: "Subject duplicated.", subject: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "That subject code already exists." };
    return { success: false, message: e?.message || "Failed to duplicate subject." };
  }
};

// 34. Count classes using a subject
export const countClassesUsingSubjectService = async (
  subjectId: string
): Promise<AcademicStructureResponse> => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(classSubjects)
      .where(eq(classSubjects.subjectId, subjectId));
    return {
      success: true,
      message: `This subject is assigned to ${Number(row?.count ?? 0)} class(es).`,
      count: Number(row?.count ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count classes using the subject." };
  }
};

// 35. Get subject usage summary
export const getSubjectUsageSummaryService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const subs = await db.query.subjects.findMany({ where: eq(subjects.schoolId, schoolId) });
    const [agg] = await db
      .select({ count: count() })
      .from(classSubjects)
      .where(eq(classSubjects.schoolId, schoolId));
    return {
      success: true,
      message: `${subs.length} subject(s), ${Number(agg?.count ?? 0)} class assignment(s).`,
      subjects: subs,
      count: subs.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build subject usage summary." };
  }
};

// 36. Rename a subject's code safely (fails if in use)
export const renameSubjectCodeService = async (
  id: string,
  newCode: string
): Promise<AcademicStructureResponse> => {
  try {
    const existing = await db.query.subjects.findFirst({ where: eq(subjects.id, id) });
    if (!existing) return { success: false, message: "Subject not found." };
    const code = normalizeCode(newCode);
    if (!/^[A-Z0-9]{2,20}$/.test(code))
      return { success: false, message: "Subject code must be 2–20 alphanumeric characters." };
    const [row] = await db
      .update(subjects)
      .set({ code })
      .where(eq(subjects.id, id))
      .returning();
    return { success: true, message: "Subject code updated.", subject: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "That subject code already exists for this school." };
    return { success: false, message: e?.message || "Failed to rename subject code." };
  }
};

// 37. Assert a subject exists in a school (helper for downstream services)
export const assertSubjectExistsService = async (
  schoolId: string,
  subjectId: string
): Promise<AcademicStructureResponse> => {
  try {
    const s = await db.query.subjects.findFirst({
      where: and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId)),
    });
    if (!s) return { success: false, message: "Subject does not belong to this school." };
    return { success: true, message: "Subject verified.", subject: s };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to verify subject." };
  }
};

// 38. List core subjects (category = Core)
export const listCoreSubjectsService = async (
  schoolId: string
): Promise<AcademicStructureResponse> =>
  listSubjectsByCategoryService(schoolId, "Core");

// ================================================================
// =============== CLASSES (22 services) ==========================
// ================================================================

// 39. Create class
export const createClassService = async (
  data: TInsertClass
): Promise<AcademicStructureResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.gradeLevelId)
      return { success: false, message: "gradeLevelId is required (string gradeLevel is deprecated)." };
    if (!data.stream) return { success: false, message: "Stream is required." };
    if (!data.academicYear) return { success: false, message: "academicYear is required." };

    const grade = await db.query.gradeLevels.findFirst({
      where: and(eq(gradeLevels.id, data.gradeLevelId), eq(gradeLevels.schoolId, data.schoolId)),
    });
    if (!grade) return { success: false, message: "Grade level must belong to the same school." };

    if (data.classTeacherId) {
      if (!(await isValidClassTeacher(data.classTeacherId, data.schoolId)))
        return { success: false, message: "classTeacherId must reference a teacher at this school." };
    }

    const [row] = await db.insert(classes).values(data).returning();
    return { success: true, message: "Class created successfully.", classRow: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return {
        success: false,
        message: "A class with that academic year + grade level + stream already exists.",
      };
    return { success: false, message: e?.message || "Failed to create class." };
  }
};

// 40. Get class by ID
export const getClassByIdService = async (id: string): Promise<AcademicStructureResponse> => {
  try {
    const c = await db.query.classes.findFirst({ where: eq(classes.id, id) });
    if (!c) return { success: false, message: "Class not found." };
    return { success: true, message: "Class retrieved.", classRow: c };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch class." };
  }
};

// 41. Get class with relations (grade, teacher, subjects, students)
export const getClassWithRelationsService = async (
  id: string
): Promise<AcademicStructureResponse> => {
  try {
    const c = await db.query.classes.findFirst({
      where: eq(classes.id, id),
      with: {
        gradeLevelRef: true,
        classTeacher: true,
        classSubjects: true,
        students: true,
      },
    });
    if (!c) return { success: false, message: "Class not found." };
    return {
      success: true,
      message: "Class with relations retrieved.",
      classRow: c as TSelectClass,
      classSubjects: (c as any).classSubjects,
      students: (c as any).students,
      teacher: (c as any).classTeacher,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch class with relations." };
  }
};

// 42. List classes for a school
export const listClassesService = async (
  schoolId: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
      orderBy: [asc(classes.academicYear), asc(classes.stream)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} class(es).`,
      classes: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list classes." };
  }
};

// 43. List classes for a specific academic year
export const listClassesByYearService = async (
  schoolId: string,
  academicYear: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.classes.findMany({
      where: and(eq(classes.schoolId, schoolId), eq(classes.academicYear, academicYear)),
      orderBy: [asc(classes.stream)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} class(es) for ${academicYear}.`,
      classes: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list classes by year." };
  }
};

// 44. List classes for a grade level
export const listClassesByGradeLevelService = async (
  gradeLevelId: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.classes.findMany({
      where: eq(classes.gradeLevelId, gradeLevelId),
      orderBy: [asc(classes.academicYear), asc(classes.stream)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} class(es) for this grade level.`,
      classes: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list classes by grade level." };
  }
};

// 45. List classes taught by a teacher
export const listClassesForTeacherService = async (
  teacherId: string
): Promise<AcademicStructureResponse> => {
  try {
    const asTeacher = await db.query.classes.findMany({
      where: eq(classes.classTeacherId, teacherId),
      orderBy: [asc(classes.academicYear)],
    });
    const viaSubjects = await db.query.classSubjects.findMany({
      where: eq(classSubjects.teacherId, teacherId),
      with: { class: true },
    });
    const fromSubjects = viaSubjects
      .map((r) => (r as any).class)
      .filter(Boolean) as TSelectClass[];
    const unique = new Map<string, TSelectClass>();
    [...asTeacher, ...fromSubjects].forEach((c) => unique.set(c.id, c));
    const rows = [...unique.values()];
    return {
      success: true,
      message: `Fetched ${rows.length} class(es) for this teacher.`,
      classes: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list teacher classes." };
  }
};

// 46. Update class
export const updateClassService = async (
  id: string,
  patch: Partial<TInsertClass>
): Promise<AcademicStructureResponse> => {
  try {
    const existing = await db.query.classes.findFirst({ where: eq(classes.id, id) });
    if (!existing) return { success: false, message: "Class not found." };

    if (patch.gradeLevelId) {
      const g = await db.query.gradeLevels.findFirst({
        where: and(
          eq(gradeLevels.id, patch.gradeLevelId),
          eq(gradeLevels.schoolId, existing.schoolId)
        ),
      });
      if (!g) return { success: false, message: "Grade level must belong to the same school." };
    }
    if (patch.classTeacherId) {
      if (!(await isValidClassTeacher(patch.classTeacherId, existing.schoolId)))
        return { success: false, message: "classTeacherId must reference a teacher at this school." };
    }

    const [row] = await db.update(classes).set(patch).where(eq(classes.id, id)).returning();
    return { success: true, message: "Class updated.", classRow: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return {
        success: false,
        message: "Another class already exists with that academic year + grade level + stream.",
      };
    return { success: false, message: e?.message || "Failed to update class." };
  }
};

// 47. Delete class
export const deleteClassService = async (id: string): Promise<AcademicStructureResponse> => {
  try {
    const enrolled = await classHasActiveStudents(id);
    if (enrolled > 0)
      return {
        success: false,
        message: `Cannot delete: ${enrolled} enrolled student(s) still belong to this class.`,
      };
    const [row] = await db.delete(classes).where(eq(classes.id, id)).returning();
    if (!row) return { success: false, message: "Class not found." };
    return { success: true, message: "Class deleted.", classRow: row };
  } catch (e: any) {
    if (String(e?.code) === "23503")
      return {
        success: false,
        message: "Cannot delete: timetables, exams, or report cards reference this class.",
      };
    return { success: false, message: e?.message || "Failed to delete class." };
  }
};

// 48. Assign a class teacher
export const assignClassTeacherService = async (
  classId: string,
  teacherId: string | null
): Promise<AcademicStructureResponse> => {
  try {
    if (teacherId) {
      const c = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
      if (!c) return { success: false, message: "Class not found." };
      if (!(await isValidClassTeacher(teacherId, c.schoolId)))
        return { success: false, message: "Teacher must belong to this school and hold a teaching role." };
    }
    const [row] = await db
      .update(classes)
      .set({ classTeacherId: teacherId })
      .where(eq(classes.id, classId))
      .returning();
    if (!row) return { success: false, message: "Class not found." };
    return {
      success: true,
      message: teacherId ? "Class teacher assigned." : "Class teacher cleared.",
      classRow: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to assign class teacher." };
  }
};

// 49. Add a subject to a class
export const addSubjectToClassService = async (
  data: TInsertClassSubject
): Promise<AcademicStructureResponse> => {
  try {
    const [row] = await db.insert(classSubjects).values(data).returning();
    return { success: true, message: "Subject added to class.", classSubject: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "That subject is already assigned to this class." };
    return { success: false, message: e?.message || "Failed to add subject to class." };
  }
};

// 50. Remove a subject from a class
export const removeSubjectFromClassService = async (
  classId: string,
  subjectId: string
): Promise<AcademicStructureResponse> => {
  try {
    const [row] = await db
      .delete(classSubjects)
      .where(and(eq(classSubjects.classId, classId), eq(classSubjects.subjectId, subjectId)))
      .returning();
    if (!row) return { success: false, message: "Class-subject link not found." };
    return { success: true, message: "Subject removed from class.", classSubject: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to remove subject from class." };
  }
};

// 51. Assign a teacher to a class subject
export const assignTeacherToClassSubjectService = async (
  classSubjectId: string,
  teacherId: string | null
): Promise<AcademicStructureResponse> => {
  try {
    const [row] = await db
      .update(classSubjects)
      .set({ teacherId })
      .where(eq(classSubjects.id, classSubjectId))
      .returning();
    if (!row) return { success: false, message: "Class-subject link not found." };
    return {
      success: true,
      message: teacherId ? "Teacher assigned to class subject." : "Teacher cleared from class subject.",
      classSubject: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to assign teacher." };
  }
};

// 52. List students in a class
export const listClassStudentsService = async (
  classId: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.students.findMany({
      where: and(eq(students.classId, classId), eq(students.isEnrolled, true), isNull(students.deletedAt)),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} student(s) in this class.`,
      students: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list class students." };
  }
};

// 53. Count students in a class
export const countClassStudentsService = async (
  classId: string
): Promise<AcademicStructureResponse> => {
  try {
    const n = await classHasActiveStudents(classId);
    return { success: true, message: `This class has ${n} enrolled student(s).`, count: n };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count class students." };
  }
};

// 54. Check class capacity
export const checkClassCapacityService = async (
  classId: string
): Promise<AcademicStructureResponse> => {
  try {
    const c = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!c) return { success: false, message: "Class not found." };
    const enrolled = await classHasActiveStudents(classId);
    const capacity = c.capacity ?? null;
    if (capacity === null)
      return {
        success: true,
        message: `No capacity limit set. Currently ${enrolled} student(s) enrolled.`,
        count: enrolled,
      };
    const remaining = capacity - enrolled;
    return {
      success: remaining >= 0,
      message:
        remaining < 0
          ? `Class is over capacity by ${-remaining} student(s).`
          : `Class has ${remaining} space(s) remaining (${enrolled}/${capacity}).`,
      count: enrolled,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to check class capacity." };
  }
};

// 55. Bulk create classes
export const bulkCreateClassesService = async (
  schoolId: string,
  items: Array<Omit<TInsertClass, "schoolId">>
): Promise<AcademicStructureResponse> => {
  try {
    if (!items.length) return { success: false, message: "At least one class is required." };
    const prepared = items.map((c) => ({ ...c, schoolId }));
    const rows = await db.insert(classes).values(prepared).returning();
    return {
      success: true,
      message: `Created ${rows.length} class(es).`,
      classes: rows,
      count: rows.length,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return {
        success: false,
        message: "One or more classes duplicate an existing year + grade level + stream.",
      };
    return { success: false, message: e?.message || "Failed to bulk-create classes." };
  }
};

// 56. Promote classes from one year to the next (structural, not student-level)
export const rollClassesToYearService = async (
  schoolId: string,
  fromYear: string,
  toYear: string
): Promise<AcademicStructureResponse> => {
  try {
    const existing = await db.query.classes.findMany({
      where: and(eq(classes.schoolId, schoolId), eq(classes.academicYear, fromYear)),
    });
    if (!existing.length)
      return { success: false, message: `No classes found for ${fromYear}.` };

    const toInsert: TInsertClass[] = existing.map((c) => ({
      schoolId,
      gradeLevelId: c.gradeLevelId,
      stream: c.stream,
      academicYear: toYear,
      capacity: c.capacity,
      classTeacherId: null,
    }));

    const rows = await db.insert(classes).values(toInsert).returning();
    return {
      success: true,
      message: `Rolled ${rows.length} class shell(s) from ${fromYear} to ${toYear}.`,
      classes: rows,
      count: rows.length,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: `Some ${toYear} classes already exist.` };
    return { success: false, message: e?.message || "Failed to roll classes to new year." };
  }
};

// 57. Move a student from one class to another
export const transferStudentBetweenClassesService = async (
  studentId: string,
  toClassId: string
): Promise<AcademicStructureResponse> => {
  try {
    const target = await db.query.classes.findFirst({ where: eq(classes.id, toClassId) });
    if (!target) return { success: false, message: "Target class not found." };

    const s = await db.query.students.findFirst({ where: eq(students.id, studentId) });
    if (!s) return { success: false, message: "Student not found." };
    if (s.schoolId !== target.schoolId)
      return { success: false, message: "Student and class must belong to the same school." };

    const [row] = await db
      .update(students)
      .set({ classId: toClassId })
      .where(eq(students.id, studentId))
      .returning();
    return { success: true, message: "Student transferred.", students: row ? [row] : [] };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to transfer student." };
  }
};

// 58. Get class statistics (student count, subject count, capacity)
export const getClassStatisticsService = async (
  classId: string
): Promise<AcademicStructureResponse> => {
  try {
    const c = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!c) return { success: false, message: "Class not found." };

    const [sc] = await db
      .select({ count: count() })
      .from(students)
      .where(and(eq(students.classId, classId), eq(students.isEnrolled, true), isNull(students.deletedAt)));

    const [cc] = await db
      .select({ count: count() })
      .from(classSubjects)
      .where(eq(classSubjects.classId, classId));

    return {
      success: true,
      message: `Class has ${Number(sc?.count ?? 0)} student(s) and ${Number(cc?.count ?? 0)} subject(s).`,
      count: Number(sc?.count ?? 0),
      classRow: c,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build class statistics." };
  }
};

// 59. Search classes (by stream + year)
export const searchClassesService = async (
  schoolId: string,
  query: string
): Promise<AcademicStructureResponse> => {
  try {
    const rows = await db.query.classes.findMany({
      where: and(
        eq(classes.schoolId, schoolId),
        sql`(${classes.stream} ILIKE ${"%" + query + "%"} OR ${classes.academicYear} ILIKE ${"%" + query + "%"})`
      ),
      orderBy: [asc(classes.academicYear), asc(classes.stream)],
    });
    return {
      success: true,
      message: `Found ${rows.length} class(es) matching "${query}".`,
      classes: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to search classes." };
  }
};

// 60. Validate class readiness (grade level, year, stream, teacher) before the term starts
export const validateClassReadinessService = async (
  classId: string
): Promise<AcademicStructureResponse> => {
  try {
    const c = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
    if (!c) return { success: false, message: "Class not found." };

    const issues: string[] = [];
    if (!c.gradeLevelId) issues.push("Class has no grade level assigned.");
    if (!c.stream) issues.push("Class has no stream.");
    if (!c.academicYear) issues.push("Class has no academic year.");
    if (!c.classTeacherId) issues.push("No class teacher assigned.");
    if (c.capacity && c.capacity <= 0) issues.push("Capacity is zero or negative.");

    return {
      success: issues.length === 0,
      message:
        issues.length === 0
          ? "Class is ready for the term."
          : `${issues.length} issue(s) found before the term.`,
      classRow: c,
      issues,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to validate class readiness." };
  }
};

// ================================================================
// 61. LINK STUDENT TO CLASS (atomic admission / transfer)
// ================================================================
export const linkStudentToClassService = async (
  studentId: string,
  classId: string,
  opts?: {
    /** The term this enrollment belongs to. Defaults to the school's current term. */
    termId?: string;
    /** If true, fails when the student is already in *any* class. Defaults to false. */
    requireUnplaced?: boolean;
  }
): Promise<AcademicStructureResponse> => {
  try {
    if (!studentId) return { success: false, message: "studentId is required." };
    if (!classId) return { success: false, message: "classId is required." };

    const [targetClass, student] = await Promise.all([
      db.query.classes.findFirst({ where: eq(classes.id, classId) }),
      db.query.students.findFirst({ where: eq(students.id, studentId) }),
    ]);

    if (!targetClass) return { success: false, message: "Target class not found." };
    if (!student) return { success: false, message: "Student not found." };
    if (student.deletedAt)
      return { success: false, message: "Cannot link a deleted student to a class." };

    if (student.schoolId !== targetClass.schoolId)
      return {
        success: false,
        message: "Student and class belong to different schools.",
      };

    if (opts?.requireUnplaced && student.classId)
      return {
        success: false,
        message:
          "Student is already assigned to a class — use transferStudentBetweenClassesService to move them.",
      };

    let termId = opts?.termId;
    if (!termId) {
      const current = await db.query.academicTerms.findFirst({
        where: and(
          eq(academicTerms.schoolId, targetClass.schoolId),
          eq(academicTerms.isCurrentTerm, true)
        ),
      });
      if (!current)
        return {
          success: false,
          message:
            "No current academic term is set for this school — activate a term first or pass termId explicitly.",
        };
      termId = current.id;
    } else {
      const term = await db.query.academicTerms.findFirst({
        where: and(
          eq(academicTerms.id, termId),
          eq(academicTerms.schoolId, targetClass.schoolId)
        ),
      });
      if (!term)
        return { success: false, message: "The provided termId does not belong to this school." };
    }

    if (targetClass.capacity && targetClass.capacity > 0) {
      const alreadyInTarget = student.classId === targetClass.id;
      if (!alreadyInTarget) {
        const enrolled = await classHasActiveStudents(targetClass.id);
        if (enrolled >= targetClass.capacity)
          return {
            success: false,
            message: `Class is at capacity (${enrolled}/${targetClass.capacity}) — cannot link another student.`,
          };
      }
    }

    const linked = await db.transaction(async (tx) => {
      if (student.classId && student.classId !== targetClass.id) {
        await tx
          .update(studentEnrollmentHistory)
          .set({ status: "Transferred" })
          .where(
            and(
              eq(studentEnrollmentHistory.studentId, student.id),
              eq(studentEnrollmentHistory.classId, student.classId)
            )
          );
      }

      const enrollmentDate =
        student.enrollmentDate ?? new Date().toISOString().split("T")[0];

      const [updated] = await tx
        .update(students)
        .set({
          classId: targetClass.id,
          isEnrolled: true,
          enrollmentDate,
          exitDate: null,
          exitReason: null,
        })
        .where(eq(students.id, student.id))
        .returning();

      const existing = await tx.query.studentEnrollmentHistory.findFirst({
        where: and(
          eq(studentEnrollmentHistory.studentId, student.id),
          eq(studentEnrollmentHistory.termId, termId)
        ),
      });

      if (existing) {
        await tx
          .update(studentEnrollmentHistory)
          .set({ classId: targetClass.id, status: "Active" })
          .where(eq(studentEnrollmentHistory.id, existing.id));
      } else {
        await tx.insert(studentEnrollmentHistory).values({
          schoolId: targetClass.schoolId,
          studentId: student.id,
          termId,
          classId: targetClass.id,
          status: "Active",
        });
      }

      return updated;
    });

    return {
      success: true,
      message: student.classId
        ? `Student moved to class "${targetClass.stream}" (${targetClass.academicYear}).`
        : `Student enrolled in class "${targetClass.stream}" (${targetClass.academicYear}).`,
      classRow: targetClass,
      students: linked ? [linked] : [],
    };
  } catch (e: any) {
    if (String(e?.code) === "23503")
      return {
        success: false,
        message: "Cannot link — the student or class no longer exists.",
      };
    return { success: false, message: e?.message || "Failed to link student to class." };
  }
};