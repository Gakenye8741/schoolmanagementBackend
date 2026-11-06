import { eq, and, ne, asc, desc, count, sql } from "drizzle-orm";

import { academicTerms, termWindows, TInsertAcademicTerm, TInsertTermWindow, TSelectAcademicTerm, TSelectTermWindow } from "../../drizzle/schema";
import db from "../../drizzle/db";

// ----------------------------------------------------------------
// Response envelope
// ----------------------------------------------------------------
export interface AcademicTermResponse {
  success: boolean;
  message: string;
  term?: TSelectAcademicTerm;
  terms?: TSelectAcademicTerm[];
  currentTerm?: TSelectAcademicTerm | null;
  termWithWindows?: TSelectAcademicTerm & { windows: TSelectTermWindow[] };
  window?: TSelectTermWindow;
  windows?: TSelectTermWindow[];
  count?: number;
  issues?: string[];
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
const TERM_STATUS_VALUES = ["upcoming", "active", "completed", "archived"] as const;
type TermStatus = (typeof TERM_STATUS_VALUES)[number];

const toDateOnly = (value: string | Date): string =>
  value instanceof Date
    ? value.toISOString().split("T")[0]
    : new Date(value).toISOString().split("T")[0];

const datesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean =>
  aStart <= bEnd && aEnd >= bStart;

/**
 * Overlap check scoped to one school + one academic year.
 * Uses the relational API so we get typed rows without a cast.
 */
const hasTermOverlap = async (
  schoolId: string,
  academicYear: string,
  startDate: string,
  endDate: string,
  excludeTermId?: string
): Promise<boolean> => {
  const rows = await db.query.academicTerms.findMany({
    where: and(
      eq(academicTerms.schoolId, schoolId),
      eq(academicTerms.academicYear, academicYear),
      excludeTermId ? ne(academicTerms.id, excludeTermId) : undefined
    ),
    columns: { startDate: true, endDate: true },
  });

  return rows.some((r) => datesOverlap(startDate, endDate, r.startDate, r.endDate));
};

/**
 * Demote any currently-active term for the school to "completed".
 * `tx` is the transaction's query-builder; relational definitions
 * apply unchanged inside transactions.
 */
const demoteCurrentTermsTx = async (
  tx: typeof db,
  schoolId: string,
  keepTermId?: string
): Promise<void> => {
  await tx
    .update(academicTerms)
    .set({ isCurrentTerm: false, status: "completed" })
    .where(
      and(
        eq(academicTerms.schoolId, schoolId),
        eq(academicTerms.isCurrentTerm, true),
        keepTermId ? ne(academicTerms.id, keepTermId) : undefined
      )
    );
};

// ================================================================
// 1. CREATE ACADEMIC TERM
// ================================================================
export const createAcademicTermService = async (
  data: TInsertAcademicTerm
): Promise<AcademicTermResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.academicYear) return { success: false, message: "academicYear is required." };
    if (!data.termName) return { success: false, message: "termName is required." };
    if (!data.startDate || !data.endDate)
      return { success: false, message: "startDate and endDate are required." };

    const startDate = toDateOnly(data.startDate);
    const endDate = toDateOnly(data.endDate);

    if (startDate > endDate)
      return { success: false, message: "Start date cannot be later than end date." };

    if (await hasTermOverlap(data.schoolId, data.academicYear, startDate, endDate))
      return {
        success: false,
        message: `A term already exists in academic year "${data.academicYear}" that overlaps these dates.`,
      };

    const shouldBeCurrent = data.isCurrentTerm === true || data.status === "active";

    const created = await db.transaction(async (tx) => {
      if (shouldBeCurrent) await demoteCurrentTermsTx(tx as unknown as typeof db, data.schoolId);

      const [row] = await tx
        .insert(academicTerms)
        .values({
          ...data,
          startDate,
          endDate,
          isCurrentTerm: shouldBeCurrent,
          status: shouldBeCurrent ? "active" : ((data.status as TermStatus) ?? "upcoming"),
        })
        .returning();

      return row;
    });

    return { success: true, message: "Academic term created successfully.", term: created };
  } catch (error: any) {
    if (String(error?.code) === "23505")
      return {
        success: false,
        message: "Duplicate term: same academic year + term name already exists for this school.",
      };
    if (String(error?.code) === "23514")
      return { success: false, message: "Term dates failed validation." };
    return { success: false, message: error?.message || "Failed to create academic term." };
  }
};

// ================================================================
// 2. GET TERM BY ID  (relational API)
// ================================================================
export const getAcademicTermByIdService = async (
  id: string
): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, id),
    });
    if (!term) return { success: false, message: "Academic term not found." };
    return { success: true, message: "Academic term retrieved.", term };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch academic term." };
  }
};

// ================================================================
// 3. GET TERM WITH WINDOWS  (relational API + typed nesting)
// ================================================================
export const getAcademicTermWithWindowsService = async (
  id: string
): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, id),
      with: {
        windows: { orderBy: [asc(termWindows.startDate)] },
      },
    });
    if (!term) return { success: false, message: "Academic term not found." };

    return {
      success: true,
      message: "Academic term with windows retrieved.",
      termWithWindows: term, // already typed as TSelectAcademicTerm & { windows: [...] }
      term,
      windows: term.windows,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch term with windows." };
  }
};

// ================================================================
// 4. LIST ALL TERMS FOR A SCHOOL
// ================================================================
export const listAcademicTermsBySchoolService = async (
  schoolId: string
): Promise<AcademicTermResponse> => {
  try {
    const terms = await db.query.academicTerms.findMany({
      where: eq(academicTerms.schoolId, schoolId),
      orderBy: [desc(academicTerms.academicYear), asc(academicTerms.startDate)],
    });

    return { success: true, message: "Academic terms fetched.", terms, count: terms.length };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch academic terms." };
  }
};

// ================================================================
// 5. LIST TERMS FOR A SPECIFIC ACADEMIC YEAR
// ================================================================
export const listAcademicTermsByYearService = async (
  schoolId: string,
  academicYear: string
): Promise<AcademicTermResponse> => {
  try {
    const terms = await db.query.academicTerms.findMany({
      where: and(
        eq(academicTerms.schoolId, schoolId),
        eq(academicTerms.academicYear, academicYear)
      ),
      orderBy: [asc(academicTerms.startDate)],
    });

    return { success: true, message: "Academic terms fetched.", terms, count: terms.length };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch terms by year." };
  }
};

// ================================================================
// 6. LIST DISTINCT ACADEMIC YEARS FOR A SCHOOL
// ================================================================
export const listAcademicYearsService = async (
  schoolId: string
): Promise<AcademicTermResponse> => {
  try {
    const rows = await db
      .selectDistinct({ academicYear: academicTerms.academicYear })
      .from(academicTerms)
      .where(eq(academicTerms.schoolId, schoolId))
      .orderBy(desc(academicTerms.academicYear));

    // Keep the `terms[]` slot minimal — callers usually just need the strings.
    const terms = rows.map((r) => ({ academicYear: r.academicYear })) as unknown as TSelectAcademicTerm[];
    return { success: true, message: "Academic years fetched.", terms, count: rows.length };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch academic years." };
  }
};

// ================================================================
// 7. GET THE CURRENT ACTIVE TERM
// ================================================================
export const getCurrentAcademicTermService = async (
  schoolId: string
): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.isCurrentTerm, true)),
    });

    if (!term)
      return { success: false, message: "No current academic term set for this school." };

    return { success: true, message: "Current academic term retrieved.", term, currentTerm: term };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch current academic term." };
  }
};

// ================================================================
// 8. GET CURRENT TERM WITH WINDOWS
// ================================================================
export const getCurrentTermWithWindowsService = async (
  schoolId: string
): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.isCurrentTerm, true)),
      with: {
        windows: { orderBy: [asc(termWindows.startDate)] },
      },
    });
    if (!term)
      return { success: false, message: "No current academic term set for this school." };

    return {
      success: true,
      message: "Current term with windows retrieved.",
      termWithWindows: term,
      term,
      windows: term.windows,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch current term." };
  }
};

// ================================================================
// 9. LIST TERMS BY STATUS
// ================================================================
export const listTermsByStatusService = async (
  schoolId: string,
  status: TermStatus
): Promise<AcademicTermResponse> => {
  try {
    if (!TERM_STATUS_VALUES.includes(status))
      return { success: false, message: `Invalid status "${status}".` };

    const terms = await db.query.academicTerms.findMany({
      where: and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.status, status)),
      orderBy: [asc(academicTerms.startDate)],
    });

    return { success: true, message: "Terms fetched by status.", terms, count: terms.length };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch terms by status." };
  }
};

// ================================================================
// 10. UPDATE ACADEMIC TERM
// ================================================================
export const updateAcademicTermService = async (
  id: string,
  updates: Partial<TInsertAcademicTerm>
): Promise<AcademicTermResponse> => {
  try {
    const existing = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, id),
    });
    if (!existing) return { success: false, message: "Academic term not found." };

    const startDate = updates.startDate ? toDateOnly(updates.startDate) : existing.startDate;
    const endDate = updates.endDate ? toDateOnly(updates.endDate) : existing.endDate;
    const academicYear = updates.academicYear ?? existing.academicYear;

    if (startDate > endDate)
      return { success: false, message: "Start date cannot be later than end date." };

    if (updates.startDate || updates.endDate || updates.academicYear) {
      if (await hasTermOverlap(existing.schoolId, academicYear, startDate, endDate, id))
        return {
          success: false,
          message: "Updated dates overlap with an existing term in the same academic year.",
        };
    }

    const shouldBeCurrent = updates.isCurrentTerm === true || updates.status === "active";

    const updated = await db.transaction(async (tx) => {
      if (shouldBeCurrent) await demoteCurrentTermsTx(tx as unknown as typeof db, existing.schoolId, id);

      const patch: Partial<TInsertAcademicTerm> = { ...updates, startDate, endDate, academicYear };
      if (shouldBeCurrent) {
        patch.isCurrentTerm = true;
        patch.status = "active";
      } else if (updates.isCurrentTerm === false) {
        patch.isCurrentTerm = false;
        if (!updates.status) patch.status = "completed";
      }

      const [row] = await tx.update(academicTerms).set(patch).where(eq(academicTerms.id, id)).returning();
      return row;
    });

    return { success: true, message: "Academic term updated.", term: updated };
  } catch (error: any) {
    if (String(error?.code) === "23505")
      return { success: false, message: "Duplicate academic year + term name for this school." };
    return { success: false, message: error?.message || "Failed to update academic term." };
  }
};

// ================================================================
// 11. SET A TERM AS CURRENT
// ================================================================
export const setCurrentAcademicTermService = async (
  schoolId: string,
  termId: string
): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: and(eq(academicTerms.id, termId), eq(academicTerms.schoolId, schoolId)),
    });
    if (!term) return { success: false, message: "Term not found for this school." };
    if (term.isCurrentTerm)
      return { success: true, message: "Term is already current.", term };

    const updated = await db.transaction(async (tx) => {
      await demoteCurrentTermsTx(tx as unknown as typeof db, schoolId, termId);
      const [row] = await tx
        .update(academicTerms)
        .set({ isCurrentTerm: true, status: "active" })
        .where(eq(academicTerms.id, termId))
        .returning();
      return row;
    });

    return { success: true, message: "Term set as current.", term: updated };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to set current term." };
  }
};

// ================================================================
// 12. CLEAR THE CURRENT TERM
// ================================================================
export const clearCurrentAcademicTermService = async (
  schoolId: string
): Promise<AcademicTermResponse> => {
  try {
    const [updated] = await db.transaction(async (tx) =>
      tx
        .update(academicTerms)
        .set({ isCurrentTerm: false, status: "completed" })
        .where(and(eq(academicTerms.schoolId, schoolId), eq(academicTerms.isCurrentTerm, true)))
        .returning()
    );

    if (!updated) return { success: false, message: "No current term to clear." };
    return { success: true, message: "Current term cleared.", term: updated };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to clear current term." };
  }
};

// ================================================================
// 13. CHANGE TERM STATUS
// ================================================================
export const changeTermStatusService = async (
  id: string,
  status: TermStatus
): Promise<AcademicTermResponse> => {
  try {
    if (!TERM_STATUS_VALUES.includes(status))
      return { success: false, message: `Invalid status "${status}".` };

    const existing = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, id),
    });
    if (!existing) return { success: false, message: "Academic term not found." };

    const updated = await db.transaction(async (tx) => {
      if (status === "active") await demoteCurrentTermsTx(tx as unknown as typeof db, existing.schoolId, id);

      const patch: Partial<TInsertAcademicTerm> = { status };
      if (status === "active") patch.isCurrentTerm = true;
      if (status === "completed" || status === "archived") patch.isCurrentTerm = false;

      const [row] = await tx.update(academicTerms).set(patch).where(eq(academicTerms.id, id)).returning();
      return row;
    });

    return { success: true, message: `Term status set to "${status}".`, term: updated };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to change term status." };
  }
};

// ================================================================
// 14. ARCHIVE A TERM
// ================================================================
export const archiveAcademicTermService = async (
  id: string
): Promise<AcademicTermResponse> => changeTermStatusService(id, "archived");

// ================================================================
// 15. DELETE ACADEMIC TERM
// ================================================================
export const deleteAcademicTermService = async (
  id: string
): Promise<AcademicTermResponse> => {
  try {
    const [deleted] = await db.delete(academicTerms).where(eq(academicTerms.id, id)).returning();
    if (!deleted) return { success: false, message: "Academic term not found." };
    return { success: true, message: "Academic term deleted.", term: deleted };
  } catch (error: any) {
    if (String(error?.code) === "23503")
      return {
        success: false,
        message:
          "Cannot delete: term is referenced by invoices, exams, report cards, or other records. Archive it instead.",
      };
    return { success: false, message: error?.message || "Failed to delete academic term." };
  }
};

// ================================================================
// 16. COUNT TERMS FOR A SCHOOL
// ================================================================
export const countTermsBySchoolService = async (
  schoolId: string
): Promise<AcademicTermResponse> => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(academicTerms)
      .where(eq(academicTerms.schoolId, schoolId));

    return { success: true, message: "Term count fetched.", count: Number(row?.count ?? 0) };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to count terms." };
  }
};

// ================================================================
// 17. GET TERM BY (school, year, name)
// ================================================================
export const getTermByYearAndNameService = async (
  schoolId: string,
  academicYear: string,
  termName: string
): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: and(
        eq(academicTerms.schoolId, schoolId),
        eq(academicTerms.academicYear, academicYear),
        eq(academicTerms.termName, termName)
      ),
    });
    if (!term) return { success: false, message: "Academic term not found." };
    return { success: true, message: "Academic term retrieved.", term };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch term." };
  }
};

// ================================================================
// =============== TERM WINDOWS ===============
// ================================================================

// ================================================================
// 18. CREATE TERM WINDOW  (relational lookup for parent term)
// ================================================================
export const createTermWindowService = async (
  data: TInsertTermWindow
): Promise<AcademicTermResponse> => {
  try {
    if (!data.termId) return { success: false, message: "termId is required." };
    if (!data.windowType) return { success: false, message: "windowType is required." };
    if (!data.title) return { success: false, message: "title is required." };
    if (!data.startDate || !data.endDate)
      return { success: false, message: "startDate and endDate are required." };

    const term = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, data.termId),
    });
    if (!term) return { success: false, message: "Parent academic term not found." };

    const startDate = toDateOnly(data.startDate);
    const endDate = toDateOnly(data.endDate);

    if (startDate > endDate)
      return { success: false, message: "Window start date cannot be later than end date." };

    if (startDate < term.startDate || endDate > term.endDate)
      return {
        success: false,
        message: `Window must fall within the parent term (${term.startDate} → ${term.endDate}).`,
      };

    const [row] = await db
      .insert(termWindows)
      .values({ ...data, startDate, endDate })
      .returning();

    return { success: true, message: "Term window created.", window: row };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to create term window." };
  }
};

// ================================================================
// 19. GET WINDOW BY ID  (relational API, includes parent term)
// ================================================================
export const getTermWindowByIdService = async (
  id: string
): Promise<AcademicTermResponse> => {
  try {
    const win = await db.query.termWindows.findFirst({
      where: eq(termWindows.id, id),
      with: { term: true }, // relation is defined in termWindowsRelations
    });
    if (!win) return { success: false, message: "Term window not found." };
    return {
      success: true,
      message: "Term window retrieved.",
      window: win,
      term: win.term, // convenient for the caller
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch term window." };
  }
};

// ================================================================
// 20. LIST WINDOWS FOR A TERM
// ================================================================
export const listTermWindowsByTermService = async (
  termId: string
): Promise<AcademicTermResponse> => {
  try {
    const windows = await db.query.termWindows.findMany({
      where: eq(termWindows.termId, termId),
      orderBy: [asc(termWindows.startDate)],
    });

    return { success: true, message: "Term windows fetched.", windows, count: windows.length };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch term windows." };
  }
};

// ================================================================
// 21. LIST WINDOWS BY TYPE FOR A TERM
// ================================================================
export const listTermWindowsByTypeService = async (
  termId: string,
  windowType: TInsertTermWindow["windowType"]
): Promise<AcademicTermResponse> => {
  try {
    const windows = await db.query.termWindows.findMany({
      where: and(eq(termWindows.termId, termId), eq(termWindows.windowType, windowType)),
      orderBy: [asc(termWindows.startDate)],
    });

    return { success: true, message: "Term windows fetched.", windows, count: windows.length };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch term windows by type." };
  }
};

// ================================================================
// 22. GET WINDOWS ACTIVE ON A DATE  (relational filter)
// ================================================================
export const getActiveWindowsOnDateService = async (
  schoolId: string,
  onDate: string
): Promise<AcademicTermResponse> => {
  try {
    const day = toDateOnly(onDate);

    // Use relational API: fetch windows whose parent term belongs to this school,
    // then filter by date range in SQL via the `where` on the relation.
    const windows = await db.query.termWindows.findMany({
      where: and(
        sql`${termWindows.startDate} <= ${day}`,
        sql`${termWindows.endDate} >= ${day}`
      ),
      with: {
        term: {
          where: eq(academicTerms.schoolId, schoolId),
          columns: { id: true, schoolId: true, academicYear: true, termName: true },
        },
      },
      orderBy: [asc(termWindows.startDate)],
    });

    // Rows whose parent term doesn't belong to this school are dropped by the
    // relation `where` (term comes back undefined). Filter them out.
    const scoped = windows.filter((w) => w.term !== undefined);

    return {
      success: true,
      message: `Windows active on ${day}.`,
      windows: scoped,
      count: scoped.length,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch active windows." };
  }
};

// ================================================================
// 23. UPDATE TERM WINDOW
// ================================================================
export const updateTermWindowService = async (
  id: string,
  updates: Partial<TInsertTermWindow>
): Promise<AcademicTermResponse> => {
  try {
    const existing = await db.query.termWindows.findFirst({
      where: eq(termWindows.id, id),
    });
    if (!existing) return { success: false, message: "Term window not found." };

    const termId = updates.termId ?? existing.termId;
    const term = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, termId),
    });
    if (!term) return { success: false, message: "Parent academic term not found." };

    const startDate = updates.startDate ? toDateOnly(updates.startDate) : existing.startDate;
    const endDate = updates.endDate ? toDateOnly(updates.endDate) : existing.endDate;

    if (startDate > endDate)
      return { success: false, message: "Window start date cannot be later than end date." };

    if (startDate < term.startDate || endDate > term.endDate)
      return {
        success: false,
        message: `Window must fall within the parent term (${term.startDate} → ${term.endDate}).`,
      };

    const [row] = await db
      .update(termWindows)
      .set({ ...updates, startDate, endDate, termId })
      .where(eq(termWindows.id, id))
      .returning();

    return { success: true, message: "Term window updated.", window: row };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to update term window." };
  }
};

// ================================================================
// 24. DELETE TERM WINDOW
// ================================================================
export const deleteTermWindowService = async (
  id: string
): Promise<AcademicTermResponse> => {
  try {
    const [deleted] = await db.delete(termWindows).where(eq(termWindows.id, id)).returning();
    if (!deleted) return { success: false, message: "Term window not found." };
    return { success: true, message: "Term window deleted.", window: deleted };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to delete term window." };
  }
};

// ================================================================
// 25. DELETE ALL WINDOWS FOR A TERM
// ================================================================
export const deleteAllWindowsForTermService = async (
  termId: string
): Promise<AcademicTermResponse> => {
  try {
    const deleted = await db
      .delete(termWindows)
      .where(eq(termWindows.termId, termId))
      .returning();

    return {
      success: true,
      message: `${deleted.length} window(s) deleted.`,
      windows: deleted,
      count: deleted.length,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to delete term windows." };
  }
};

// ================================================================
// 26. COUNT WINDOWS FOR A TERM
// ================================================================
export const countWindowsForTermService = async (
  termId: string
): Promise<AcademicTermResponse> => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(termWindows)
      .where(eq(termWindows.termId, termId));

    return { success: true, message: "Window count fetched.", count: Number(row?.count ?? 0) };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to count windows." };
  }
};

// ================================================================
// 27. COPY TERM WINDOWS FROM ANOTHER TERM
// ================================================================
export const copyTermWindowsService = async (
  sourceTermId: string,
  targetTermId: string
): Promise<AcademicTermResponse> => {
  try {
    const [source, target] = await Promise.all([
      db.query.academicTerms.findFirst({ where: eq(academicTerms.id, sourceTermId) }),
      db.query.academicTerms.findFirst({ where: eq(academicTerms.id, targetTermId) }),
    ]);
    if (!source) return { success: false, message: "Source term not found." };
    if (!target) return { success: false, message: "Target term not found." };

    // Relational read: parent + windows in one round-trip.
    const sourceWithWindows = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, sourceTermId),
      with: { windows: true },
    });

    const sourceWindows = sourceWithWindows?.windows ?? [];
    if (sourceWindows.length === 0)
      return { success: false, message: "Source term has no windows to copy." };

    const targetStart = new Date(target.startDate).getTime();
    const sourceStart = new Date(source.startDate).getTime();
    const targetEnd = new Date(target.endDate).getTime();

    const toInsert: TInsertTermWindow[] = [];
    const skipped: string[] = [];

    for (const w of sourceWindows) {
      const offsetStart = new Date(w.startDate).getTime() - sourceStart;
      const offsetEnd = new Date(w.endDate).getTime() - sourceStart;

      const shiftedStart = new Date(targetStart + offsetStart);
      const shiftedEnd = new Date(targetStart + offsetEnd);

      if (shiftedEnd.getTime() > targetEnd) {
        skipped.push(w.title);
        continue;
      }

      toInsert.push({
        termId: targetTermId,
        windowType: w.windowType,
        title: w.title,
        startDate: shiftedStart.toISOString().split("T")[0],
        endDate: shiftedEnd.toISOString().split("T")[0],
      });
    }

    if (toInsert.length === 0)
      return {
        success: false,
        message: `No windows fit within the target term. Skipped: ${skipped.join(", ")}.`,
      };

    const inserted = await db.insert(termWindows).values(toInsert).returning();

    return {
      success: true,
      message: `${inserted.length} window(s) copied.${skipped.length ? ` Skipped: ${skipped.join(", ")}.` : ""}`,
      windows: inserted,
      count: inserted.length,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to copy term windows." };
  }
};

// ================================================================
// 28. GET UPCOMING WINDOWS ACROSS THE SCHOOL
// ================================================================
export const getUpcomingWindowsService = async (
  schoolId: string,
  daysAhead = 30
): Promise<AcademicTermResponse> => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const limit = new Date(Date.now() + daysAhead * 86_400_000).toISOString().split("T")[0];

    const windows = await db.query.termWindows.findMany({
      where: and(
        sql`${termWindows.endDate} >= ${today}`,
        sql`${termWindows.startDate} <= ${limit}`
      ),
      with: {
        term: {
          where: eq(academicTerms.schoolId, schoolId),
          columns: { id: true, schoolId: true, academicYear: true, termName: true },
        },
      },
      orderBy: [asc(termWindows.startDate)],
    });

    const scoped = windows.filter((w) => w.term !== undefined);

    return {
      success: true,
      message: `Upcoming windows in the next ${daysAhead} days.`,
      windows: scoped,
      count: scoped.length,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to fetch upcoming windows." };
  }
};

// ================================================================
// 29. BULK CREATE TERM WINDOWS
// ================================================================
export const bulkCreateTermWindowsService = async (
  termId: string,
  windows: Omit<TInsertTermWindow, "termId">[]
): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, termId),
    });
    if (!term) return { success: false, message: "Parent academic term not found." };

    const prepared: TInsertTermWindow[] = [];
    const errors: string[] = [];

    for (const w of windows) {
      const startDate = toDateOnly(w.startDate);
      const endDate = toDateOnly(w.endDate);
      if (startDate > endDate) { errors.push(`${w.title}: start > end`); continue; }
      if (startDate < term.startDate || endDate > term.endDate) {
        errors.push(`${w.title}: outside parent term`); continue;
      }
      prepared.push({ ...w, termId, startDate, endDate });
    }

    if (prepared.length === 0)
      return {
        success: false,
        message: `All ${windows.length} window(s) failed validation: ${errors.join("; ")}`,
      };

    const inserted = await db.insert(termWindows).values(prepared).returning();

    return {
      success: true,
      message: `${inserted.length} of ${windows.length} window(s) created.${errors.length ? ` Errors: ${errors.join("; ")}` : ""}`,
      windows: inserted,
      count: inserted.length,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to bulk-create term windows." };
  }
};

// ================================================================
// 30. VALIDATE TERM SETUP (pre-flight)
// ================================================================
export const validateTermReadinessService = async (
  termId: string
): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, termId),
      with: { windows: true },
    });
    if (!term) return { success: false, message: "Academic term not found." };

    const issues: string[] = [];
    const now = new Date().toISOString().split("T")[0];

    if (term.endDate < now) issues.push("Term end date is already in the past.");
    if (term.startDate > term.endDate) issues.push("Start date is after end date.");
    if (term.windows.length === 0)
      issues.push("No term windows configured (exam weeks, CAT weeks, breaks...).");

    const siblings = await db.query.academicTerms.findMany({
      where: and(
        eq(academicTerms.schoolId, term.schoolId),
        eq(academicTerms.academicYear, term.academicYear),
        ne(academicTerms.id, termId)
      ),
    });

    for (const s of siblings) {
      if (datesOverlap(term.startDate, term.endDate, s.startDate, s.endDate))
        issues.push(`Overlaps with "${s.termName}" (${s.startDate} → ${s.endDate}).`);
    }

    return {
      success: issues.length === 0,
      message:
        issues.length === 0
          ? "Term is ready to activate."
          : `${issues.length} issue(s) found before activation.`,
      term,
      issues,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to validate term readiness." };
  }
};