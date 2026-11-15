// src/services/curriculum/curriculum.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, inArray, gte, lte, or, ilike,
} from "drizzle-orm";

import {
  curriculumStrands,
  curriculumSubStrands,
  schemeOfWorkEntries,
  schemesOfWork,
  subjects,
  gradeLevels,
  schools,
  TSelectCurriculumStrand,
  TSelectCurriculumSubStrand,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Types
// ================================================================
export interface CurriculumResponse {
  success: boolean;
  message: string;
  strand?: TSelectCurriculumStrand;
  strands?: TSelectCurriculumStrand[];
  subStrand?: TSelectCurriculumSubStrand;
  subStrands?: TSelectCurriculumSubStrand[];
  tree?: Array<{
    strand: TSelectCurriculumStrand;
    subStrands: TSelectCurriculumSubStrand[];
  }>;
  stats?: Record<string, any>;
  coverage?: {
    totalSubStrands: number;
    covered: number;
    uncovered: number;
    percent: number;
    uncoveredList: Array<{ id: string; name: string; strandName: string }>;
  };
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const assertSchoolExists = async (schoolId: string) =>
  await db.query.schools.findFirst({ where: eq(schools.id, schoolId) });

const assertSubjectInSchool = async (subjectId: string, schoolId: string) =>
  await db.query.subjects.findFirst({
    where: and(eq(subjects.id, subjectId), eq(subjects.schoolId, schoolId)),
  });

const assertGradeInSchool = async (gradeLevelId: string, schoolId: string) =>
  await db.query.gradeLevels.findFirst({
    where: and(eq(gradeLevels.id, gradeLevelId), eq(gradeLevels.schoolId, schoolId)),
  });

// ================================================================
// STRANDS — 11 services
// ================================================================

// 1. Create
export const createStrandService = async (data: {
  schoolId: string;
  subjectId: string;
  gradeLevelId: string;
  name: string;
  sortOrder?: number;
}): Promise<CurriculumResponse> => {
  try {
    const [school, subject, grade] = await Promise.all([
      assertSchoolExists(data.schoolId),
      assertSubjectInSchool(data.subjectId, data.schoolId),
      assertGradeInSchool(data.gradeLevelId, data.schoolId),
    ]);
    if (!school) return { success: false, message: "School not found." };
    if (!subject) return { success: false, message: "Subject not found in this school." };
    if (!grade) return { success: false, message: "Grade level not found in this school." };

    // Auto-assign sortOrder if not provided → after the current max
    let order = data.sortOrder;
    if (order === undefined) {
      const [max] = await db
        .select({ m: sql<number>`COALESCE(MAX(${curriculumStrands.sortOrder}), -1)` })
        .from(curriculumStrands)
        .where(
          and(
            eq(curriculumStrands.subjectId, data.subjectId),
            eq(curriculumStrands.gradeLevelId, data.gradeLevelId)
          )
        );
      order = Number(max?.m ?? -1) + 1;
    }

    const [row] = await db
      .insert(curriculumStrands)
      .values({
        schoolId: data.schoolId,
        subjectId: data.subjectId,
        gradeLevelId: data.gradeLevelId,
        name: data.name.trim(),
        sortOrder: order,
      })
      .returning();

    return {
      success: true,
      message: `Strand "${row.name}" created.`,
      strand: row,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return {
        success: false,
        message: "A strand with this name already exists for this subject and grade.",
      };
    }
    return { success: false, message: e?.message || "Failed to create strand." };
  }
};

// 2. Bulk create
export const bulkCreateStrandsService = async (data: {
  schoolId: string;
  subjectId: string;
  gradeLevelId: string;
  strands: Array<{ name: string; sortOrder?: number }>;
}): Promise<CurriculumResponse> => {
  try {
    const [school, subject, grade] = await Promise.all([
      assertSchoolExists(data.schoolId),
      assertSubjectInSchool(data.subjectId, data.schoolId),
      assertGradeInSchool(data.gradeLevelId, data.schoolId),
    ]);
    if (!school) return { success: false, message: "School not found." };
    if (!subject) return { success: false, message: "Subject not found in this school." };
    if (!grade) return { success: false, message: "Grade level not found in this school." };

    // Current max order for auto-numbering
    const [max] = await db
      .select({ m: sql<number>`COALESCE(MAX(${curriculumStrands.sortOrder}), -1)` })
      .from(curriculumStrands)
      .where(
        and(
          eq(curriculumStrands.subjectId, data.subjectId),
          eq(curriculumStrands.gradeLevelId, data.gradeLevelId)
        )
      );
    let next = Number(max?.m ?? -1) + 1;

    const issues: string[] = [];
    const rows: TSelectCurriculumStrand[] = [];

    await db.transaction(async (tx) => {
      for (const s of data.strands) {
        try {
          const [row] = await tx
            .insert(curriculumStrands)
            .values({
              schoolId: data.schoolId,
              subjectId: data.subjectId,
              gradeLevelId: data.gradeLevelId,
              name: s.name.trim(),
              sortOrder: s.sortOrder ?? next++,
            })
            .returning();
          rows.push(row);
        } catch (e: any) {
          if (String(e?.code) === "23505") {
            issues.push(`"${s.name}": already exists`);
          } else {
            issues.push(`"${s.name}": ${e?.message ?? "insert failed"}`);
          }
        }
      }
    });

    return {
      success: rows.length > 0,
      message: `Created ${rows.length} of ${data.strands.length} strand(s).`,
      strands: rows,
      count: rows.length,
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create strands." };
  }
};

// 3. Get by ID
export const getStrandByIdService = async (
  id: string
): Promise<CurriculumResponse> => {
  try {
    const row = await db.query.curriculumStrands.findFirst({
      where: eq(curriculumStrands.id, id),
      with: {
        subject: { columns: { id: true, name: true, code: true } },
        gradeLevel: { columns: { id: true, name: true } },
      },
    });
    if (!row) return { success: false, message: "Strand not found." };
    return { success: true, message: "Strand retrieved.", strand: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch strand." };
  }
};

// 4. Get strand WITH its sub-strands
export const getStrandWithSubStrandsService = async (
  id: string
): Promise<CurriculumResponse> => {
  try {
    const strand = await db.query.curriculumStrands.findFirst({
      where: eq(curriculumStrands.id, id),
      with: {
        subject: { columns: { id: true, name: true, code: true } },
        gradeLevel: { columns: { id: true, name: true } },
      },
    });
    if (!strand) return { success: false, message: "Strand not found." };

    const subs = await db.query.curriculumSubStrands.findMany({
      where: eq(curriculumSubStrands.strandId, id),
      orderBy: [asc(curriculumSubStrands.sortOrder), asc(curriculumSubStrands.name)],
    });

    return {
      success: true,
      message: `Strand with ${subs.length} sub-strand(s).`,
      tree: [{ strand: strand as any, subStrands: subs }],
      count: subs.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch strand." };
  }
};

// 5. List strands for a subject + grade
export const listStrandsForSubjectAndGradeService = async (
  schoolId: string,
  subjectId: string,
  gradeLevelId: string
): Promise<CurriculumResponse> => {
  try {
    const rows = await db.query.curriculumStrands.findMany({
      where: and(
        eq(curriculumStrands.schoolId, schoolId),
        eq(curriculumStrands.subjectId, subjectId),
        eq(curriculumStrands.gradeLevelId, gradeLevelId)
      ),
      orderBy: [asc(curriculumStrands.sortOrder), asc(curriculumStrands.name)],
    });
    return {
      success: true,
      message: `${rows.length} strand(s) found.`,
      strands: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list strands." };
  }
};

// 6. List strands for a school (optionally filtered)
export const listStrandsForSchoolService = async (
  schoolId: string,
  opts: { subjectId?: string; gradeLevelId?: string; page: number; limit: number }
): Promise<CurriculumResponse> => {
  try {
    const filters: any[] = [eq(curriculumStrands.schoolId, schoolId)];
    if (opts.subjectId) filters.push(eq(curriculumStrands.subjectId, opts.subjectId));
    if (opts.gradeLevelId) filters.push(eq(curriculumStrands.gradeLevelId, opts.gradeLevelId));

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.curriculumStrands.findMany({
        where: and(...filters),
        with: {
          subject: { columns: { id: true, name: true, code: true } },
          gradeLevel: { columns: { id: true, name: true } },
        },
        orderBy: [
          asc(curriculumStrands.gradeLevelId),
          asc(curriculumStrands.subjectId),
          asc(curriculumStrands.sortOrder),
          asc(curriculumStrands.name),
        ],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(curriculumStrands).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} strand(s) on this page.`,
      strands: rows as any,
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list strands." };
  }
};

// 7. Update
export const updateStrandService = async (
  id: string,
  patch: { name?: string; sortOrder?: number }
): Promise<CurriculumResponse> => {
  try {
    const existing = await db.query.curriculumStrands.findFirst({
      where: eq(curriculumStrands.id, id),
    });
    if (!existing) return { success: false, message: "Strand not found." };

    const [row] = await db
      .update(curriculumStrands)
      .set({
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
      })
      .where(eq(curriculumStrands.id, id))
      .returning();

    return { success: true, message: "Strand updated.", strand: row };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return { success: false, message: "Another strand with this name already exists." };
    }
    return { success: false, message: e?.message || "Failed to update strand." };
  }
};

// 8. Delete (blocked if scheme entries reference it)
export const deleteStrandService = async (
  id: string
): Promise<CurriculumResponse> => {
  try {
    const existing = await db.query.curriculumStrands.findFirst({
      where: eq(curriculumStrands.id, id),
    });
    if (!existing) return { success: false, message: "Strand not found." };

    // Guard: is this strand referenced by any scheme entry?
    const [usedBySchemes] = await db
      .select({ c: count() })
      .from(schemeOfWorkEntries)
      .where(eq(schemeOfWorkEntries.strandId, id));
    if (Number(usedBySchemes?.c ?? 0) > 0) {
      return {
        success: false,
        message: `This strand is used in ${usedBySchemes?.c} scheme of work entr${Number(usedBySchemes?.c) === 1 ? "y" : "ies"}. Remove those first or archive the strand.`,
      };
    }

    const [row] = await db
      .delete(curriculumStrands)
      .where(eq(curriculumStrands.id, id))
      .returning();
    return {
      success: true,
      message: "Strand deleted (along with its sub-strands).",
      strand: row,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete strand." };
  }
};

// 9. Reorder
export const reorderStrandsService = async (
  schoolId: string,
  orderedIds: string[]
): Promise<CurriculumResponse> => {
  try {
    const rows = await db.transaction(async (tx) => {
      const out: TSelectCurriculumStrand[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const [r] = await tx
          .update(curriculumStrands)
          .set({ sortOrder: i })
          .where(
            and(
              eq(curriculumStrands.id, orderedIds[i]),
              eq(curriculumStrands.schoolId, schoolId)
            )
          )
          .returning();
        if (r) out.push(r);
      }
      return out;
    });
    return {
      success: true,
      message: `Reordered ${rows.length} strand(s).`,
      strands: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reorder strands." };
  }
};

// 10. Count
export const countStrandsService = async (
  schoolId: string
): Promise<CurriculumResponse> => {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(curriculumStrands)
      .where(eq(curriculumStrands.schoolId, schoolId));
    return {
      success: true,
      message: `${Number(row?.c ?? 0)} strand(s).`,
      count: Number(row?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count strands." };
  }
};

// 11. Get full curriculum TREE (strands + their sub-strands) for subject + grade
export const getCurriculumTreeService = async (
  schoolId: string,
  subjectId: string,
  gradeLevelId: string
): Promise<CurriculumResponse> => {
  try {
    const strands = await db.query.curriculumStrands.findMany({
      where: and(
        eq(curriculumStrands.schoolId, schoolId),
        eq(curriculumStrands.subjectId, subjectId),
        eq(curriculumStrands.gradeLevelId, gradeLevelId)
      ),
      orderBy: [asc(curriculumStrands.sortOrder), asc(curriculumStrands.name)],
    });

    if (strands.length === 0) {
      return {
        success: true,
        message: "No strands defined yet for this subject and grade.",
        tree: [],
        count: 0,
      };
    }

    const strandIds = strands.map((s) => s.id);
    const allSubs = await db.query.curriculumSubStrands.findMany({
      where: inArray(curriculumSubStrands.strandId, strandIds),
      orderBy: [asc(curriculumSubStrands.sortOrder), asc(curriculumSubStrands.name)],
    });

    const byStrand = new Map<string, TSelectCurriculumSubStrand[]>();
    for (const s of allSubs) {
      const arr = byStrand.get(s.strandId) ?? [];
      arr.push(s);
      byStrand.set(s.strandId, arr);
    }

    const tree = strands.map((strand) => ({
      strand,
      subStrands: byStrand.get(strand.id) ?? [],
    }));

    return {
      success: true,
      message: `${strands.length} strand(s), ${allSubs.length} sub-strand(s).`,
      tree,
      count: allSubs.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build curriculum tree." };
  }
};

// ================================================================
// SUB-STRANDS — 11 services
// ================================================================

// 12. Create
export const createSubStrandService = async (data: {
  schoolId: string;
  strandId: string;
  name: string;
  learningOutcomes?: string | null;
  sortOrder?: number;
}): Promise<CurriculumResponse> => {
  try {
    const strand = await db.query.curriculumStrands.findFirst({
      where: and(
        eq(curriculumStrands.id, data.strandId),
        eq(curriculumStrands.schoolId, data.schoolId)
      ),
    });
    if (!strand) return { success: false, message: "Strand not found in this school." };

    let order = data.sortOrder;
    if (order === undefined) {
      const [max] = await db
        .select({ m: sql<number>`COALESCE(MAX(${curriculumSubStrands.sortOrder}), -1)` })
        .from(curriculumSubStrands)
        .where(eq(curriculumSubStrands.strandId, data.strandId));
      order = Number(max?.m ?? -1) + 1;
    }

    const [row] = await db
      .insert(curriculumSubStrands)
      .values({
        schoolId: data.schoolId,
        strandId: data.strandId,
        name: data.name.trim(),
        learningOutcomes: data.learningOutcomes?.trim() ?? null,
        sortOrder: order,
      })
      .returning();

    return {
      success: true,
      message: `Sub-strand "${row.name}" created.`,
      subStrand: row,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return {
        success: false,
        message: "A sub-strand with this name already exists in this strand.",
      };
    }
    return { success: false, message: e?.message || "Failed to create sub-strand." };
  }
};

// 13. Bulk create
export const bulkCreateSubStrandsService = async (data: {
  schoolId: string;
  strandId: string;
  subStrands: Array<{
    name: string;
    learningOutcomes?: string | null;
    sortOrder?: number;
  }>;
}): Promise<CurriculumResponse> => {
  try {
    const strand = await db.query.curriculumStrands.findFirst({
      where: and(
        eq(curriculumStrands.id, data.strandId),
        eq(curriculumStrands.schoolId, data.schoolId)
      ),
    });
    if (!strand) return { success: false, message: "Strand not found in this school." };

    const [max] = await db
      .select({ m: sql<number>`COALESCE(MAX(${curriculumSubStrands.sortOrder}), -1)` })
      .from(curriculumSubStrands)
      .where(eq(curriculumSubStrands.strandId, data.strandId));
    let next = Number(max?.m ?? -1) + 1;

    const issues: string[] = [];
    const rows: TSelectCurriculumSubStrand[] = [];

    await db.transaction(async (tx) => {
      for (const s of data.subStrands) {
        try {
          const [row] = await tx
            .insert(curriculumSubStrands)
            .values({
              schoolId: data.schoolId,
              strandId: data.strandId,
              name: s.name.trim(),
              learningOutcomes: s.learningOutcomes?.trim() ?? null,
              sortOrder: s.sortOrder ?? next++,
            })
            .returning();
          rows.push(row);
        } catch (e: any) {
          if (String(e?.code) === "23505") {
            issues.push(`"${s.name}": already exists`);
          } else {
            issues.push(`"${s.name}": ${e?.message ?? "insert failed"}`);
          }
        }
      }
    });

    return {
      success: rows.length > 0,
      message: `Created ${rows.length} of ${data.subStrands.length} sub-strand(s).`,
      subStrands: rows,
      count: rows.length,
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create sub-strands." };
  }
};

// 14. Get by ID
export const getSubStrandByIdService = async (
  id: string
): Promise<CurriculumResponse> => {
  try {
    const row = await db.query.curriculumSubStrands.findFirst({
      where: eq(curriculumSubStrands.id, id),
      with: {
        strand: {
          with: {
            subject: { columns: { id: true, name: true, code: true } },
            gradeLevel: { columns: { id: true, name: true } },
          },
        },
      },
    });
    if (!row) return { success: false, message: "Sub-strand not found." };
    return { success: true, message: "Sub-strand retrieved.", subStrand: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch sub-strand." };
  }
};

// 15. List sub-strands for a strand
export const listSubStrandsForStrandService = async (
  strandId: string,
  opts: { withOutcomesOnly: boolean; page: number; limit: number }
): Promise<CurriculumResponse> => {
  try {
    const filters: any[] = [eq(curriculumSubStrands.strandId, strandId)];
    if (opts.withOutcomesOnly) {
      filters.push(sql`${curriculumSubStrands.learningOutcomes} IS NOT NULL`);
      filters.push(sql`LENGTH(TRIM(${curriculumSubStrands.learningOutcomes})) > 0`);
    }

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.curriculumSubStrands.findMany({
        where: and(...filters),
        orderBy: [
          asc(curriculumSubStrands.sortOrder),
          asc(curriculumSubStrands.name),
        ],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(curriculumSubStrands).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} sub-strand(s) on this page.`,
      subStrands: rows,
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list sub-strands." };
  }
};

// 16. List all sub-strands for a school
export const listSubStrandsForSchoolService = async (
  schoolId: string,
  opts: { page: number; limit: number }
): Promise<CurriculumResponse> => {
  try {
    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.curriculumSubStrands.findMany({
        where: eq(curriculumSubStrands.schoolId, schoolId),
        with: {
          strand: {
            with: {
              subject: { columns: { id: true, name: true, code: true } },
              gradeLevel: { columns: { id: true, name: true } },
            },
          },
        },
        orderBy: [
          asc(curriculumSubStrands.strandId),
          asc(curriculumSubStrands.sortOrder),
        ],
        limit: opts.limit,
        offset,
      }),
      db
        .select({ c: count() })
        .from(curriculumSubStrands)
        .where(eq(curriculumSubStrands.schoolId, schoolId)),
    ]);

    return {
      success: true,
      message: `${rows.length} sub-strand(s) on this page.`,
      subStrands: rows as any,
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list sub-strands." };
  }
};

// 17. Update
export const updateSubStrandService = async (
  id: string,
  patch: {
    name?: string;
    learningOutcomes?: string | null;
    sortOrder?: number;
  }
): Promise<CurriculumResponse> => {
  try {
    const existing = await db.query.curriculumSubStrands.findFirst({
      where: eq(curriculumSubStrands.id, id),
    });
    if (!existing) return { success: false, message: "Sub-strand not found." };

    const [row] = await db
      .update(curriculumSubStrands)
      .set({
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.learningOutcomes !== undefined && {
          learningOutcomes: patch.learningOutcomes?.trim() ?? null,
        }),
        ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
      })
      .where(eq(curriculumSubStrands.id, id))
      .returning();

    return { success: true, message: "Sub-strand updated.", subStrand: row };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return {
        success: false,
        message: "Another sub-strand with this name already exists in this strand.",
      };
    }
    return { success: false, message: e?.message || "Failed to update sub-strand." };
  }
};

// 18. Delete
export const deleteSubStrandService = async (
  id: string
): Promise<CurriculumResponse> => {
  try {
    const existing = await db.query.curriculumSubStrands.findFirst({
      where: eq(curriculumSubStrands.id, id),
    });
    if (!existing) return { success: false, message: "Sub-strand not found." };

    // Guard against references in schemes of work
    const [used] = await db
      .select({ c: count() })
      .from(schemeOfWorkEntries)
      .where(eq(schemeOfWorkEntries.subStrandId, id));
    if (Number(used?.c ?? 0) > 0) {
      return {
        success: false,
        message: `This sub-strand is used in ${used?.c} scheme of work entr${Number(used?.c) === 1 ? "y" : "ies"}. Remove those first.`,
      };
    }

    const [row] = await db
      .delete(curriculumSubStrands)
      .where(eq(curriculumSubStrands.id, id))
      .returning();
    return { success: true, message: "Sub-strand deleted.", subStrand: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete sub-strand." };
  }
};

// 19. Reorder
export const reorderSubStrandsService = async (
  schoolId: string,
  orderedIds: string[]
): Promise<CurriculumResponse> => {
  try {
    const rows = await db.transaction(async (tx) => {
      const out: TSelectCurriculumSubStrand[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const [r] = await tx
          .update(curriculumSubStrands)
          .set({ sortOrder: i })
          .where(
            and(
              eq(curriculumSubStrands.id, orderedIds[i]),
              eq(curriculumSubStrands.schoolId, schoolId)
            )
          )
          .returning();
        if (r) out.push(r);
      }
      return out;
    });
    return {
      success: true,
      message: `Reordered ${rows.length} sub-strand(s).`,
      subStrands: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reorder sub-strands." };
  }
};

// 20. Count
export const countSubStrandsService = async (
  schoolId: string
): Promise<CurriculumResponse> => {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(curriculumSubStrands)
      .where(eq(curriculumSubStrands.schoolId, schoolId));
    return {
      success: true,
      message: `${Number(row?.c ?? 0)} sub-strand(s).`,
      count: Number(row?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count sub-strands." };
  }
};

// 21. Search sub-strands by name
export const searchSubStrandsService = async (
  schoolId: string,
  q: string,
  opts: { subjectId?: string; gradeLevelId?: string; limit: number }
): Promise<CurriculumResponse> => {
  try {
    const filters: any[] = [
      eq(curriculumSubStrands.schoolId, schoolId),
      ilike(curriculumSubStrands.name, `%${q}%`),
    ];

    // Filter by subject/grade via the parent strand if needed
    if (opts.subjectId || opts.gradeLevelId) {
      const strandFilters: any[] = [eq(curriculumStrands.schoolId, schoolId)];
      if (opts.subjectId) strandFilters.push(eq(curriculumStrands.subjectId, opts.subjectId));
      if (opts.gradeLevelId) strandFilters.push(eq(curriculumStrands.gradeLevelId, opts.gradeLevelId));

      const matchingStrands = await db.query.curriculumStrands.findMany({
        where: and(...strandFilters),
        columns: { id: true },
      });
      const strandIds = matchingStrands.map((s) => s.id);
      if (strandIds.length === 0) {
        return { success: true, message: "No matching sub-strands.", subStrands: [], count: 0 };
      }
      filters.push(inArray(curriculumSubStrands.strandId, strandIds));
    }

    const rows = await db.query.curriculumSubStrands.findMany({
      where: and(...filters),
      with: {
        strand: {
          with: {
            subject: { columns: { id: true, name: true, code: true } },
            gradeLevel: { columns: { id: true, name: true } },
          },
        },
      },
      orderBy: [asc(curriculumSubStrands.name)],
      limit: opts.limit,
    });

    return {
      success: true,
      message: `${rows.length} match(es) for "${q}".`,
      subStrands: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to search sub-strands." };
  }
};

// 22. Get sub-strands with learning outcomes
export const getSubStrandsWithOutcomesService = async (
  schoolId: string
): Promise<CurriculumResponse> => {
  try {
    const rows = await db.query.curriculumSubStrands.findMany({
      where: and(
        eq(curriculumSubStrands.schoolId, schoolId),
        sql`${curriculumSubStrands.learningOutcomes} IS NOT NULL`,
        sql`LENGTH(TRIM(${curriculumSubStrands.learningOutcomes})) > 0`
      ),
      with: {
        strand: {
          with: {
            subject: { columns: { id: true, name: true, code: true } },
            gradeLevel: { columns: { id: true, name: true } },
          },
        },
      },
      orderBy: [asc(curriculumSubStrands.name)],
    });

    return {
      success: true,
      message: `${rows.length} sub-strand(s) with learning outcomes.`,
      subStrands: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch sub-strands." };
  }
};

// ================================================================
// CROSS-CUTTING — 3 services
// ================================================================

// 23. Copy curriculum from another school (template seeding)
export const copyCurriculumFromSchoolService = async (data: {
  schoolId: string;
  sourceSchoolId: string;
  subjectId: string;
  gradeLevelId: string;
  overwriteExisting?: boolean;
}): Promise<CurriculumResponse> => {
  try {
    if (data.schoolId === data.sourceSchoolId) {
      return { success: false, message: "Source and target school must differ." };
    }

    const [src, tgt] = await Promise.all([
      assertSchoolExists(data.sourceSchoolId),
      assertSchoolExists(data.schoolId),
    ]);
    if (!src) return { success: false, message: "Source school not found." };
    if (!tgt) return { success: false, message: "Target school not found." };

    // Source strands: need to find matching subject+grade in SOURCE school
    // The caller passes IDs from THEIR school. We need to find the equivalent in the source.
    // Simplest approach: caller passes the TARGET subjectId+gradeLevelId (school-scoped)
    // and we match by NAME (subjects and gradeLevels both have name).

    const [targetSubject, targetGrade] = await Promise.all([
      db.query.subjects.findFirst({
        where: and(eq(subjects.id, data.subjectId), eq(subjects.schoolId, data.schoolId)),
      }),
      db.query.gradeLevels.findFirst({
        where: and(
          eq(gradeLevels.id, data.gradeLevelId),
          eq(gradeLevels.schoolId, data.schoolId)
        ),
      }),
    ]);
    if (!targetSubject) return { success: false, message: "Subject not found in target school." };
    if (!targetGrade) return { success: false, message: "Grade not found in target school." };

    // Find same-named subject + grade in source school
    const [sourceSubject, sourceGrade] = await Promise.all([
      db.query.subjects.findFirst({
        where: and(
          eq(subjects.schoolId, data.sourceSchoolId),
          eq(subjects.name, targetSubject.name)
        ),
      }),
      db.query.gradeLevels.findFirst({
        where: and(
          eq(gradeLevels.schoolId, data.sourceSchoolId),
          eq(gradeLevels.name, targetGrade.name)
        ),
      }),
    ]);
    if (!sourceSubject) {
      return {
        success: false,
        message: `Source school has no subject named "${targetSubject.name}".`,
      };
    }
    if (!sourceGrade) {
      return {
        success: false,
        message: `Source school has no grade named "${targetGrade.name}".`,
      };
    }

    // Fetch source strands + sub-strands
    const sourceStrands = await db.query.curriculumStrands.findMany({
      where: and(
        eq(curriculumStrands.schoolId, data.sourceSchoolId),
        eq(curriculumStrands.subjectId, sourceSubject.id),
        eq(curriculumStrands.gradeLevelId, sourceGrade.id)
      ),
      orderBy: [asc(curriculumStrands.sortOrder)],
    });

    if (sourceStrands.length === 0) {
      return { success: false, message: "Source school has no curriculum for this subject and grade." };
    }

    // Check what target already has
    const existingTarget = await db.query.curriculumStrands.findMany({
      where: and(
        eq(curriculumStrands.schoolId, data.schoolId),
        eq(curriculumStrands.subjectId, data.subjectId),
        eq(curriculumStrands.gradeLevelId, data.gradeLevelId)
      ),
      columns: { id: true, name: true },
    });

    if (existingTarget.length > 0 && !data.overwriteExisting) {
      return {
        success: false,
        message: `Target school already has ${existingTarget.length} strand(s) for this subject and grade. Pass overwriteExisting=true to replace.`,
      };
    }

    const issues: string[] = [];
    let strandCount = 0;
    let subCount = 0;

    await db.transaction(async (tx) => {
      // If overwrite, delete existing strands (cascade removes subs)
      if (data.overwriteExisting && existingTarget.length > 0) {
        await tx.delete(curriculumStrands).where(
          inArray(
            curriculumStrands.id,
            existingTarget.map((s) => s.id)
          )
        );
      }

      for (const srcStrand of sourceStrands) {
        try {
          const [newStrand] = await tx
            .insert(curriculumStrands)
            .values({
              schoolId: data.schoolId,
              subjectId: data.subjectId,
              gradeLevelId: data.gradeLevelId,
              name: srcStrand.name,
              sortOrder: srcStrand.sortOrder,
            })
            .returning();
          strandCount++;

          const srcSubs = await db.query.curriculumSubStrands.findMany({
            where: eq(curriculumSubStrands.strandId, srcStrand.id),
            orderBy: [asc(curriculumSubStrands.sortOrder)],
          });

          for (const srcSub of srcSubs) {
            try {
              await tx.insert(curriculumSubStrands).values({
                schoolId: data.schoolId,
                strandId: newStrand.id,
                name: srcSub.name,
                learningOutcomes: srcSub.learningOutcomes,
                sortOrder: srcSub.sortOrder,
              });
              subCount++;
            } catch (e: any) {
              issues.push(`Sub-strand "${srcSub.name}": ${e?.message ?? "insert failed"}`);
            }
          }
        } catch (e: any) {
          issues.push(`Strand "${srcStrand.name}": ${e?.message ?? "insert failed"}`);
        }
      }
    });

    return {
      success: strandCount > 0,
      message: `Copied ${strandCount} strand(s) and ${subCount} sub-strand(s) from "${src.name}".`,
      stats: { strands: strandCount, subStrands: subCount },
      count: subCount,
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to copy curriculum." };
  }
};

// 24. Curriculum coverage (how many sub-strands have been taught this term)
//
// IMPORTANT: this depends on Scheme of Work entries. If schemes haven't been
// created yet, coverage will return 0 / total.
export const getCurriculumCoverageService = async (
  schoolId: string,
  subjectId: string,
  gradeLevelId: string,
  termId: string
): Promise<CurriculumResponse> => {
  try {
    // 1. Get all sub-strands for this subject+grade
    const strands = await db.query.curriculumStrands.findMany({
      where: and(
        eq(curriculumStrands.schoolId, schoolId),
        eq(curriculumStrands.subjectId, subjectId),
        eq(curriculumStrands.gradeLevelId, gradeLevelId)
      ),
      columns: { id: true, name: true },
    });

    if (strands.length === 0) {
      return {
        success: true,
        message: "No curriculum defined for this subject and grade.",
        coverage: { totalSubStrands: 0, covered: 0, uncovered: 0, percent: 0, uncoveredList: [] },
      };
    }

    const strandIds = strands.map((s) => s.id);
    const strandNameById = new Map(strands.map((s) => [s.id, s.name]));

    const allSubs = await db.query.curriculumSubStrands.findMany({
      where: inArray(curriculumSubStrands.strandId, strandIds),
      columns: { id: true, name: true, strandId: true },
    });

    if (allSubs.length === 0) {
      return {
        success: true,
        message: "No sub-strands defined for this subject and grade.",
        coverage: { totalSubStrands: 0, covered: 0, uncovered: 0, percent: 0, uncoveredList: [] },
      };
    }

    // 2. Get all covered scheme entries for this subject+grade+term
    const schemes = await db.query.schemesOfWork.findMany({
      where: and(
        eq(schemesOfWork.schoolId, schoolId),
        eq(schemesOfWork.termId, termId),
        eq(schemesOfWork.subjectId, subjectId)
      ),
      columns: { id: true },
    });

    let coveredSubStrandIds = new Set<string>();

    if (schemes.length > 0) {
      const schemeIds = schemes.map((s) => s.id);
      const entries = await db.query.schemeOfWorkEntries.findMany({
        where: and(
          inArray(schemeOfWorkEntries.schemeId, schemeIds),
          eq(schemeOfWorkEntries.isCovered, true),
          sql`${schemeOfWorkEntries.subStrandId} IS NOT NULL`
        ),
        columns: { subStrandId: true },
      });
      for (const e of entries) {
        if (e.subStrandId) coveredSubStrandIds.add(e.subStrandId);
      }
    }

    // 3. Compute coverage
    const covered = allSubs.filter((s) => coveredSubStrandIds.has(s.id)).length;
    const uncovered = allSubs.length - covered;
    const percent = allSubs.length === 0 ? 0 : Math.round((covered / allSubs.length) * 100 * 100) / 100;

    const uncoveredList = allSubs
      .filter((s) => !coveredSubStrandIds.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        strandName: strandNameById.get(s.strandId) ?? "",
      }));

    return {
      success: true,
      message: `${covered}/${allSubs.length} sub-strand(s) covered (${percent}%).`,
      coverage: {
        totalSubStrands: allSubs.length,
        covered,
        uncovered,
        percent,
        uncoveredList,
      },
      count: allSubs.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute coverage." };
  }
};

// 25. Stats
export const getCurriculumStatsService = async (
  schoolId: string
): Promise<CurriculumResponse> => {
  try {
    const [strandCount] = await db
      .select({ c: count() })
      .from(curriculumStrands)
      .where(eq(curriculumStrands.schoolId, schoolId));

    const [subCount] = await db
      .select({ c: count() })
      .from(curriculumSubStrands)
      .where(eq(curriculumSubStrands.schoolId, schoolId));

    // Group by subject
    const bySubject = await db
      .select({
        subjectId: curriculumStrands.subjectId,
        strands: count(),
      })
      .from(curriculumStrands)
      .where(eq(curriculumStrands.schoolId, schoolId))
      .groupBy(curriculumStrands.subjectId);

    // Group by grade
    const byGrade = await db
      .select({
        gradeLevelId: curriculumStrands.gradeLevelId,
        strands: count(),
      })
      .from(curriculumStrands)
      .where(eq(curriculumStrands.schoolId, schoolId))
      .groupBy(curriculumStrands.gradeLevelId);

    // Sub-strands with no learning outcomes
    const [missingOutcomes] = await db
      .select({ c: count() })
      .from(curriculumSubStrands)
      .where(
        and(
          eq(curriculumSubStrands.schoolId, schoolId),
          or(
            isNull(curriculumSubStrands.learningOutcomes),
            sql`LENGTH(TRIM(${curriculumSubStrands.learningOutcomes})) = 0`
          )
        )
      );

    return {
      success: true,
      message: `${strandCount?.c ?? 0} strand(s), ${subCount?.c ?? 0} sub-strand(s).`,
      stats: {
        totalStrands: Number(strandCount?.c ?? 0),
        totalSubStrands: Number(subCount?.c ?? 0),
        subStrandsMissingOutcomes: Number(missingOutcomes?.c ?? 0),
        bySubject: bySubject.reduce<Record<string, number>>((acc, r) => {
          acc[r.subjectId] = Number(r.strands);
          return acc;
        }, {}),
        byGrade: byGrade.reduce<Record<string, number>>((acc, r) => {
          acc[r.gradeLevelId] = Number(r.strands);
          return acc;
        }, {}),
      },
      count: Number(strandCount?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute stats." };
  }
};