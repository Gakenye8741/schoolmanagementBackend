// services/fees.service.ts
import {
  eq, and, ne, asc, desc, count, sql, ilike, isNull, inArray, gte, lte,
} from "drizzle-orm";

import {
  feeItems,
  classFeeStructures,
  studentInvoices,
  invoiceItems,
  feeTransactions,
  academicTerms,
  gradeLevels,
  classes,
  students,
  users,
  TSelectFeeItem,
  TSelectClassFeeStructure,
  TSelectStudentInvoice,
  TSelectInvoiceItem,
  TSelectFeeTransaction,
  TSelectAcademicTerm,
  TSelectGradeLevel,
  TSelectClass,
  TSelectStudent,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Input types
// ================================================================
type BoardingStatus = "Day" | "Boarding";
type PaymentMethod = "M-Pesa" | "Bank" | "Cash" | "Cheque";
type PaymentStatus = "Pending" | "Completed" | "Failed" | "Reversed";
type InvoiceStatus = "Unpaid" | "Partial" | "Paid" | "Overdue" | "Waived" | "Cancelled";

export interface CreateFeeItemInput {
  schoolId: string;
  name: string;
  description?: string | null;
  isOptional?: boolean;
}

export interface CreateFeeStructureInput {
  schoolId: string;
  termId: string;
  feeItemId: string;
  boardingStatus: BoardingStatus;
  gradeLevelId?: string | null;
  classId?: string | null;
  amount: string;
}

export interface BulkUpsertFeeStructureInput {
  schoolId: string;
  termId: string;
  boardingStatus: BoardingStatus;
  gradeLevelId?: string | null;
  classId?: string | null;
  items: Array<{ feeItemId: string; amount: string }>;
}

export interface GenerateInvoiceForStudentInput {
  schoolId: string;
  studentId: string;
  termId: string;
  dueDate?: string | null;
  notes?: string | null;
  includeOptionalFeeItems?: boolean;
  optionalFeeItemIds?: string[];
}

export interface GenerateInvoicesForClassInput {
  schoolId: string;
  classId: string;
  termId: string;
  dueDate?: string | null;
  notes?: string | null;
  includeOptionalFeeItems?: boolean;
}

export interface GenerateInvoicesForGradeLevelInput {
  schoolId: string;
  gradeLevelId: string;
  termId: string;
  dueDate?: string | null;
  notes?: string | null;
  includeOptionalFeeItems?: boolean;
}

export interface GenerateInvoicesForSchoolInput {
  schoolId: string;
  termId: string;
  dueDate?: string | null;
  notes?: string | null;
  includeOptionalFeeItems?: boolean;
}

export interface RecordPaymentInput {
  schoolId: string;
  studentId: string;
  termId: string;
  invoiceId?: string | null;
  amountPaid: string;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  payerName?: string | null;
  payerPhone?: string | null;
  notes?: string | null;
  mpesaCheckoutRequestId?: string | null;
}

export interface ReversePaymentInput {
  reason: string;
}

// ================================================================
// Response envelope
// ================================================================
export interface FeeResponse {
  success: boolean;
  message: string;

  feeItem?: TSelectFeeItem;
  feeItems?: TSelectFeeItem[];

  feeStructure?: TSelectClassFeeStructure;
  feeStructures?: TSelectClassFeeStructure[];

  invoice?: TSelectStudentInvoice;
  invoices?: TSelectStudentInvoice[];
  invoiceItems?: TSelectInvoiceItem[];

  transaction?: TSelectFeeTransaction;
  transactions?: TSelectFeeTransaction[];

  // Resolution / summary
  resolvedFees?: Array<{
    feeItemId: string;
    feeItemName: string;
    amount: string;
    source: "class" | "grade" | "school" | "none";
  }>;
  summary?: {
    totalBilled: string;
    totalPaid: string;
    balance: string;
    invoiceCount: number;
    paidCount: number;
    partialCount: number;
    unpaidCount: number;
  };

  // Balance / statement
  balance?: {
    studentId: string;
    termId: string;
    billed: string;
    paid: string;
    balance: string;
    status: "Cleared" | "Partial" | "Owed";
  };

  stats?: Record<string, any>;
  issues?: string[];
  count?: number;
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

const assertStudentInSchool = async (schoolId: string, studentId: string) => {
  return await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
  });
};

const generateInvoiceNumber = async (schoolId: string): Promise<string> => {
  const [row] = await db
    .select({ c: count() })
    .from(studentInvoices)
    .where(eq(studentInvoices.schoolId, schoolId));
  const n = Number(row?.c ?? 0) + 1;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(n).padStart(5, "0")}`;
};

// ================================================================
// Fee resolver — the 3-level cascade
// ================================================================
const resolveFeeForStudent = async (
  schoolId: string,
  termId: string,
  feeItemId: string,
  boardingStatus: BoardingStatus,
  classId: string | null,
  gradeLevelId: string | null
): Promise<{ row: TSelectClassFeeStructure | null; source: "class" | "grade" | "school" | "none" }> => {
  // 1. class-specific override
  if (classId) {
    const hit = await db.query.classFeeStructures.findFirst({
      where: and(
        eq(classFeeStructures.schoolId, schoolId),
        eq(classFeeStructures.termId, termId),
        eq(classFeeStructures.feeItemId, feeItemId),
        eq(classFeeStructures.boardingStatus, boardingStatus),
        eq(classFeeStructures.classId, classId)
      ),
    });
    if (hit) return { row: hit, source: "class" };
  }

  // 2. grade-level default
  if (gradeLevelId) {
    const hit = await db.query.classFeeStructures.findFirst({
      where: and(
        eq(classFeeStructures.schoolId, schoolId),
        eq(classFeeStructures.termId, termId),
        eq(classFeeStructures.feeItemId, feeItemId),
        eq(classFeeStructures.boardingStatus, boardingStatus),
        eq(classFeeStructures.gradeLevelId, gradeLevelId),
        isNull(classFeeStructures.classId)
      ),
    });
    if (hit) return { row: hit, source: "grade" };
  }

  // 3. school-wide
  const hit = await db.query.classFeeStructures.findFirst({
    where: and(
      eq(classFeeStructures.schoolId, schoolId),
      eq(classFeeStructures.termId, termId),
      eq(classFeeStructures.feeItemId, feeItemId),
      eq(classFeeStructures.boardingStatus, boardingStatus),
      isNull(classFeeStructures.gradeLevelId),
      isNull(classFeeStructures.classId)
    ),
  });
  if (hit) return { row: hit, source: "school" };

  return { row: null, source: "none" };
};

// ================================================================
// 1–10. FEE ITEMS
// ================================================================

// 1. Create fee item
export const createFeeItemService = async (data: CreateFeeItemInput): Promise<FeeResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.name) return { success: false, message: "Fee item name is required." };

    const [row] = await db
      .insert(feeItems)
      .values({
        schoolId: data.schoolId,
        name: data.name.trim(),
        description: data.description ?? null,
        isOptional: data.isOptional ?? false,
      })
      .returning();

    return { success: true, message: "Fee item created.", feeItem: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A fee item with that name already exists in this school." };
    return { success: false, message: e?.message || "Failed to create fee item." };
  }
};

// 2. Get fee item by ID
export const getFeeItemByIdService = async (id: string): Promise<FeeResponse> => {
  try {
    const row = await db.query.feeItems.findFirst({ where: eq(feeItems.id, id) });
    if (!row) return { success: false, message: "Fee item not found." };
    return { success: true, message: "Fee item retrieved.", feeItem: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch fee item." };
  }
};

// 3. List fee items
export const listFeeItemsService = async (schoolId: string): Promise<FeeResponse> => {
  try {
    const rows = await db.query.feeItems.findMany({
      where: eq(feeItems.schoolId, schoolId),
      orderBy: [asc(feeItems.name)],
    });
    return { success: true, message: `Fetched ${rows.length} fee item(s).`, feeItems: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list fee items." };
  }
};

// 4. List mandatory fee items
export const listMandatoryFeeItemsService = async (schoolId: string): Promise<FeeResponse> => {
  try {
    const rows = await db.query.feeItems.findMany({
      where: and(eq(feeItems.schoolId, schoolId), eq(feeItems.isOptional, false)),
      orderBy: [asc(feeItems.name)],
    });
    return { success: true, message: `Fetched ${rows.length} mandatory fee item(s).`, feeItems: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list mandatory fee items." };
  }
};

// 5. List optional fee items
export const listOptionalFeeItemsService = async (schoolId: string): Promise<FeeResponse> => {
  try {
    const rows = await db.query.feeItems.findMany({
      where: and(eq(feeItems.schoolId, schoolId), eq(feeItems.isOptional, true)),
      orderBy: [asc(feeItems.name)],
    });
    return { success: true, message: `Fetched ${rows.length} optional fee item(s).`, feeItems: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list optional fee items." };
  }
};

// 6. Search fee items
export const searchFeeItemsService = async (schoolId: string, query: string): Promise<FeeResponse> => {
  try {
    const rows = await db.query.feeItems.findMany({
      where: and(eq(feeItems.schoolId, schoolId), ilike(feeItems.name, `%${query}%`)),
      orderBy: [asc(feeItems.name)],
    });
    return { success: true, message: `Found ${rows.length} fee item(s).`, feeItems: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to search fee items." };
  }
};

// 7. Update fee item
export const updateFeeItemService = async (
  id: string,
  patch: Partial<CreateFeeItemInput>
): Promise<FeeResponse> => {
  try {
    const existing = await db.query.feeItems.findFirst({ where: eq(feeItems.id, id) });
    if (!existing) return { success: false, message: "Fee item not found." };
    const [row] = await db.update(feeItems).set(patch).where(eq(feeItems.id, id)).returning();
    return { success: true, message: "Fee item updated.", feeItem: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A fee item with that name already exists." };
    return { success: false, message: e?.message || "Failed to update fee item." };
  }
};

// 8. Delete fee item
export const deleteFeeItemService = async (id: string): Promise<FeeResponse> => {
  try {
    const [row] = await db.delete(feeItems).where(eq(feeItems.id, id)).returning();
    if (!row) return { success: false, message: "Fee item not found." };
    return { success: true, message: "Fee item deleted.", feeItem: row };
  } catch (e: any) {
    if (String(e?.code) === "23503")
      return { success: false, message: "Cannot delete: fee item is referenced by fee structures or invoices." };
    return { success: false, message: e?.message || "Failed to delete fee item." };
  }
};

// 9. Count fee items
export const countFeeItemsService = async (schoolId: string): Promise<FeeResponse> => {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(feeItems)
      .where(eq(feeItems.schoolId, schoolId));
    return { success: true, message: `This school has ${Number(row?.c ?? 0)} fee item(s).`, count: Number(row?.c ?? 0) };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count fee items." };
  }
};

// 10. Bulk create fee items
export const bulkCreateFeeItemsService = async (
  schoolId: string,
  items: Array<{ name: string; description?: string | null; isOptional?: boolean }>
): Promise<FeeResponse> => {
  try {
    if (!items.length) return { success: false, message: "At least one fee item is required." };
    const prepared = items.map((i) => ({
      schoolId,
      name: i.name.trim(),
      description: i.description ?? null,
      isOptional: i.isOptional ?? false,
    }));
    const rows = await db.insert(feeItems).values(prepared).returning();
    return { success: true, message: `Created ${rows.length} fee item(s).`, feeItems: rows, count: rows.length };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "One or more fee item names already exist." };
    return { success: false, message: e?.message || "Failed to bulk-create fee items." };
  }
};

// ================================================================
// 11–22. FEE STRUCTURES
// ================================================================

// 11. Create fee structure
export const createFeeStructureService = async (data: CreateFeeStructureInput): Promise<FeeResponse> => {
  try {
    const term = await assertTermInSchool(data.schoolId, data.termId);
    if (!term) return { success: false, message: "Term does not belong to this school." };

    const item = await db.query.feeItems.findFirst({
      where: and(eq(feeItems.id, data.feeItemId), eq(feeItems.schoolId, data.schoolId)),
    });
    if (!item) return { success: false, message: "Fee item does not belong to this school." };

    if (data.gradeLevelId) {
      const g = await db.query.gradeLevels.findFirst({
        where: and(eq(gradeLevels.id, data.gradeLevelId), eq(gradeLevels.schoolId, data.schoolId)),
      });
      if (!g) return { success: false, message: "Grade level does not belong to this school." };
    }

    if (data.classId) {
      const c = await db.query.classes.findFirst({
        where: and(eq(classes.id, data.classId), eq(classes.schoolId, data.schoolId)),
      });
      if (!c) return { success: false, message: "Class does not belong to this school." };
    }

    const [row] = await db
      .insert(classFeeStructures)
      .values({
        schoolId: data.schoolId,
        termId: data.termId,
        feeItemId: data.feeItemId,
        boardingStatus: data.boardingStatus,
        gradeLevelId: data.gradeLevelId ?? null,
        classId: data.classId ?? null,
        amount: data.amount,
      })
      .returning();

    return { success: true, message: "Fee structure created.", feeStructure: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "This fee is already defined for that scope." };
    return { success: false, message: e?.message || "Failed to create fee structure." };
  }
};

// 12. Get fee structure by ID
export const getFeeStructureByIdService = async (id: string): Promise<FeeResponse> => {
  try {
    const row = await db.query.classFeeStructures.findFirst({
      where: eq(classFeeStructures.id, id),
      with: { term: true, feeItem: true, gradeLevel: true, class: true },
    });
    if (!row) return { success: false, message: "Fee structure not found." };
    return { success: true, message: "Fee structure retrieved.", feeStructure: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch fee structure." };
  }
};

// 13. List fee structures for a term
export const listFeeStructuresByTermService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const rows = await db.query.classFeeStructures.findMany({
      where: and(
        eq(classFeeStructures.schoolId, schoolId),
        eq(classFeeStructures.termId, termId)
      ),
      with: { feeItem: true, gradeLevel: true, class: true },
      orderBy: [asc(classFeeStructures.boardingStatus), asc(classFeeStructures.gradeLevelId)],
    });
    return { success: true, message: `Fetched ${rows.length} fee structure row(s).`, feeStructures: rows as any, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list fee structures." };
  }
};

// 14. List fee structures by boarding status
export const listFeeStructuresByBoardingStatusService = async (
  schoolId: string,
  termId: string,
  boardingStatus: BoardingStatus
): Promise<FeeResponse> => {
  try {
    const rows = await db.query.classFeeStructures.findMany({
      where: and(
        eq(classFeeStructures.schoolId, schoolId),
        eq(classFeeStructures.termId, termId),
        eq(classFeeStructures.boardingStatus, boardingStatus)
      ),
      with: { feeItem: true, gradeLevel: true, class: true },
    });
    return { success: true, message: `Fetched ${rows.length} ${boardingStatus} fee structure row(s).`, feeStructures: rows as any, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list fee structures." };
  }
};

// 15. List fee structures for a grade level (resolve base + grade + class)
export const listFeeStructuresByGradeService = async (
  schoolId: string,
  termId: string,
  gradeLevelId: string,
  boardingStatus: BoardingStatus
): Promise<FeeResponse> => {
  try {
    const allItems = await db.query.feeItems.findMany({
      where: eq(feeItems.schoolId, schoolId),
      orderBy: [asc(feeItems.name)],
    });

    const resolved: FeeResponse["resolvedFees"] = [];
    for (const item of allItems) {
      const { row, source } = await resolveFeeForStudent(
        schoolId, termId, item.id, boardingStatus, null, gradeLevelId
      );
      resolved.push({
        feeItemId: item.id,
        feeItemName: item.name,
        amount: row?.amount ?? "0.00",
        source,
      });
    }

    const total = resolved.reduce((s, r) => s + Number(r.amount), 0);
    return {
      success: true,
      message: `Resolved ${resolved.length} fee item(s) — total ${fmt(total)}.`,
      resolvedFees: resolved,
      count: resolved.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to resolve fees." };
  }
};

// 16. Resolve the effective fees for a specific class
export const resolveFeesForClassService = async (
  schoolId: string,
  termId: string,
  classId: string,
  boardingStatus: BoardingStatus
): Promise<FeeResponse> => {
  try {
    const cls = await db.query.classes.findFirst({
      where: and(eq(classes.id, classId), eq(classes.schoolId, schoolId)),
    });
    if (!cls) return { success: false, message: "Class not found in this school." };

    const allItems = await db.query.feeItems.findMany({
      where: eq(feeItems.schoolId, schoolId),
      orderBy: [asc(feeItems.name)],
    });

    const resolved: FeeResponse["resolvedFees"] = [];
    for (const item of allItems) {
      const { row, source } = await resolveFeeForStudent(
        schoolId, termId, item.id, boardingStatus, classId, cls.gradeLevelId
      );
      resolved.push({
        feeItemId: item.id,
        feeItemName: item.name,
        amount: row?.amount ?? "0.00",
        source,
      });
    }

    const total = resolved.reduce((s, r) => s + Number(r.amount), 0);
    return {
      success: true,
      message: `Resolved ${resolved.length} fee item(s) for this class — total ${fmt(total)}.`,
      resolvedFees: resolved,
      count: resolved.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to resolve fees." };
  }
};

// 17. Update fee structure amount
export const updateFeeStructureService = async (
  id: string,
  amount: string
): Promise<FeeResponse> => {
  try {
    const existing = await db.query.classFeeStructures.findFirst({
      where: eq(classFeeStructures.id, id),
    });
    if (!existing) return { success: false, message: "Fee structure not found." };
    const [row] = await db
      .update(classFeeStructures)
      .set({ amount })
      .where(eq(classFeeStructures.id, id))
      .returning();
    return { success: true, message: "Fee structure updated.", feeStructure: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update fee structure." };
  }
};

// 18. Delete fee structure
export const deleteFeeStructureService = async (id: string): Promise<FeeResponse> => {
  try {
    const [row] = await db.delete(classFeeStructures).where(eq(classFeeStructures.id, id)).returning();
    if (!row) return { success: false, message: "Fee structure not found." };
    return { success: true, message: "Fee structure deleted.", feeStructure: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete fee structure." };
  }
};

// 19. Bulk upsert fee structure (upsert by unique shape)
export const bulkUpsertFeeStructureService = async (
  data: BulkUpsertFeeStructureInput
): Promise<FeeResponse> => {
  try {
    const term = await assertTermInSchool(data.schoolId, data.termId);
    if (!term) return { success: false, message: "Term does not belong to this school." };

    if (data.gradeLevelId) {
      const g = await db.query.gradeLevels.findFirst({
        where: and(eq(gradeLevels.id, data.gradeLevelId), eq(gradeLevels.schoolId, data.schoolId)),
      });
      if (!g) return { success: false, message: "Grade level does not belong to this school." };
    }

    if (data.classId) {
      const c = await db.query.classes.findFirst({
        where: and(eq(classes.id, data.classId), eq(classes.schoolId, data.schoolId)),
      });
      if (!c) return { success: false, message: "Class does not belong to this school." };
    }

    const itemIds = data.items.map((i) => i.feeItemId);
    const validItems = await db.query.feeItems.findMany({
      where: and(eq(feeItems.schoolId, data.schoolId), inArray(feeItems.id, itemIds)),
    });
    if (validItems.length !== itemIds.length)
      return { success: false, message: "Some fee items don't belong to this school." };

    const result = await db.transaction(async (tx) => {
      const rows: TSelectClassFeeStructure[] = [];
      for (const item of data.items) {
        // Delete any existing row that matches the scope shape, then insert fresh
        await tx
          .delete(classFeeStructures)
          .where(
            and(
              eq(classFeeStructures.schoolId, data.schoolId),
              eq(classFeeStructures.termId, data.termId),
              eq(classFeeStructures.feeItemId, item.feeItemId),
              eq(classFeeStructures.boardingStatus, data.boardingStatus),
              data.gradeLevelId
                ? eq(classFeeStructures.gradeLevelId, data.gradeLevelId)
                : isNull(classFeeStructures.gradeLevelId),
              data.classId
                ? eq(classFeeStructures.classId, data.classId)
                : isNull(classFeeStructures.classId)
            )
          );

        const [row] = await tx
          .insert(classFeeStructures)
          .values({
            schoolId: data.schoolId,
            termId: data.termId,
            feeItemId: item.feeItemId,
            boardingStatus: data.boardingStatus,
            gradeLevelId: data.gradeLevelId ?? null,
            classId: data.classId ?? null,
            amount: item.amount,
          })
          .returning();
        rows.push(row);
      }
      return rows;
    });

    const scope = data.classId ? "class" : data.gradeLevelId ? "grade level" : "school";
    return {
      success: true,
      message: `Upserted ${result.length} ${data.boardingStatus} fee item(s) for ${scope}.`,
      feeStructures: result,
      count: result.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-upsert fee structure." };
  }
};

// 20. Copy fee structure from one term to another
export const copyFeeStructureService = async (
  schoolId: string,
  fromTermId: string,
  toTermId: string
): Promise<FeeResponse> => {
  try {
    if (fromTermId === toTermId)
      return { success: false, message: "Source and target terms must be different." };

    const from = await assertTermInSchool(schoolId, fromTermId);
    if (!from) return { success: false, message: "Source term not found." };
    const to = await assertTermInSchool(schoolId, toTermId);
    if (!to) return { success: false, message: "Target term not found." };

    const source = await db.query.classFeeStructures.findMany({
      where: and(eq(classFeeStructures.schoolId, schoolId), eq(classFeeStructures.termId, fromTermId)),
    });
    if (source.length === 0)
      return { success: false, message: "Source term has no fee structures to copy." };

    const result = await db.transaction(async (tx) => {
      const rows: TSelectClassFeeStructure[] = [];
      for (const s of source) {
        await tx
          .delete(classFeeStructures)
          .where(
            and(
              eq(classFeeStructures.schoolId, schoolId),
              eq(classFeeStructures.termId, toTermId),
              eq(classFeeStructures.feeItemId, s.feeItemId),
              eq(classFeeStructures.boardingStatus, s.boardingStatus),
              s.gradeLevelId
                ? eq(classFeeStructures.gradeLevelId, s.gradeLevelId)
                : isNull(classFeeStructures.gradeLevelId),
              s.classId
                ? eq(classFeeStructures.classId, s.classId)
                : isNull(classFeeStructures.classId)
            )
          );

        const [row] = await tx
          .insert(classFeeStructures)
          .values({
            schoolId,
            termId: toTermId,
            feeItemId: s.feeItemId,
            boardingStatus: s.boardingStatus,
            gradeLevelId: s.gradeLevelId,
            classId: s.classId,
            amount: s.amount,
          })
          .returning();
        rows.push(row);
      }
      return rows;
    });

    return {
      success: true,
      message: `Copied ${result.length} fee structure row(s) from ${from.termName} to ${to.termName}.`,
      feeStructures: result,
      count: result.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to copy fee structures." };
  }
};

// 21. Validate fee structure completeness
export const validateFeeStructureService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const term = await assertTermInSchool(schoolId, termId);
    if (!term) return { success: false, message: "Term not found." };

    const grades = await db.query.gradeLevels.findMany({
      where: eq(gradeLevels.schoolId, schoolId),
    });
    const mandatory = await db.query.feeItems.findMany({
      where: and(eq(feeItems.schoolId, schoolId), eq(feeItems.isOptional, false)),
    });

    const issues: string[] = [];
    const boardings: BoardingStatus[] = ["Day", "Boarding"];

    for (const g of grades) {
      for (const b of boardings) {
        for (const item of mandatory) {
          const { row } = await resolveFeeForStudent(schoolId, termId, item.id, b, null, g.id);
          if (!row) issues.push(`Missing "${item.name}" for ${g.name} (${b})`);
        }
      }
    }

    return {
      success: issues.length === 0,
      message: issues.length === 0
        ? "Fee structure is complete for all grades and boarding types."
        : `${issues.length} gap(s) found.`,
      issues,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to validate fee structure." };
  }
};

// 22. Get total fee for a class in a term (uses resolver)
export const getClassTotalFeeService = async (
  schoolId: string,
  termId: string,
  classId: string,
  boardingStatus: BoardingStatus
): Promise<FeeResponse> => {
  const r = await resolveFeesForClassService(schoolId, termId, classId, boardingStatus);
  if (!r.success) return r;
  const total = (r.resolvedFees ?? []).reduce((s, x) => s + Number(x.amount), 0);
  return {
    ...r,
    message: `Total fees for this class (${boardingStatus}): ${fmt(total)}.`,
    summary: {
      totalBilled: fmt(total),
      totalPaid: "0.00",
      balance: fmt(total),
      invoiceCount: 0,
      paidCount: 0,
      partialCount: 0,
      unpaidCount: 0,
    },
  };
};

// ================================================================
// 23–36. INVOICES
// ================================================================

// 23. Generate invoice for one student
export const generateInvoiceForStudentService = async (
  data: GenerateInvoiceForStudentInput
): Promise<FeeResponse> => {
  try {
    const student = await assertStudentInSchool(data.schoolId, data.studentId);
    if (!student) return { success: false, message: "Student not found in this school." };
    const term = await assertTermInSchool(data.schoolId, data.termId);
    if (!term) return { success: false, message: "Term not found." };

    // Prevent duplicate invoice for the same student/term
    const existing = await db.query.studentInvoices.findFirst({
      where: and(
        eq(studentInvoices.schoolId, data.schoolId),
        eq(studentInvoices.studentId, data.studentId),
        eq(studentInvoices.termId, data.termId),
        ne(studentInvoices.status, "Cancelled")
      ),
    });
    if (existing)
      return { success: false, message: "An active invoice already exists for this student and term." };

    // Resolve fees
    const grade = student.classId
      ? (await db.query.classes.findFirst({ where: eq(classes.id, student.classId) }))?.gradeLevelId ?? null
      : null;

    const allItems = await db.query.feeItems.findMany({
      where: eq(feeItems.schoolId, data.schoolId),
    });

    const optionalSet = new Set(data.optionalFeeItemIds ?? []);
    const lineItems: Array<{ feeItemId: string; description: string; amount: string }> = [];

    for (const item of allItems) {
      if (item.isOptional) {
        if (!data.includeOptionalFeeItems && !optionalSet.has(item.id)) continue;
      }
      const { row } = await resolveFeeForStudent(
        data.schoolId, data.termId, item.id, student.boardingStatus, student.classId, grade
      );
      if (!row) continue;
      if (Number(row.amount) <= 0) continue;
      lineItems.push({ feeItemId: item.id, description: item.name, amount: row.amount });
    }

    if (lineItems.length === 0)
      return { success: false, message: "No applicable fee items resolved for this student." };

    const total = lineItems.reduce((s, i) => s + Number(i.amount), 0);
    const invoiceNumber = await generateInvoiceNumber(data.schoolId);

    const result = await db.transaction(async (tx) => {
      const [inv] = await tx
        .insert(studentInvoices)
        .values({
          schoolId: data.schoolId,
          studentId: data.studentId,
          termId: data.termId,
          invoiceNumber,
          totalAmount: fmt(total),
          discountAmount: "0.00",
          status: "Unpaid",
          dueDate: data.dueDate ?? null,
          notes: data.notes ?? null,
        })
        .returning();

      const items = await tx
        .insert(invoiceItems)
        .values(
          lineItems.map((li) => ({
            invoiceId: inv.id,
            feeItemId: li.feeItemId,
            description: li.description,
            amount: li.amount,
          }))
        )
        .returning();

      return { invoice: inv, items };
    });

    return {
      success: true,
      message: `Invoice ${invoiceNumber} created — total ${fmt(total)}.`,
      invoice: result.invoice,
      invoiceItems: result.items,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to generate invoice." };
  }
};

// 24. Generate invoices for a whole class
export const generateInvoicesForClassService = async (
  data: GenerateInvoicesForClassInput
): Promise<FeeResponse> => {
  try {
    const cls = await db.query.classes.findFirst({
      where: and(eq(classes.id, data.classId), eq(classes.schoolId, data.schoolId)),
    });
    if (!cls) return { success: false, message: "Class not found in this school." };

    const roster = await db.query.students.findMany({
      where: and(
        eq(students.classId, data.classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
    });

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const s of roster) {
      const r = await generateInvoiceForStudentService({
        schoolId: data.schoolId,
        studentId: s.id,
        termId: data.termId,
        dueDate: data.dueDate,
        notes: data.notes,
        includeOptionalFeeItems: data.includeOptionalFeeItems,
      });
      if (r.success) created++;
      else if (r.message.includes("already exists")) skipped++;
      else failed++;
    }

    return {
      success: true,
      message: `Generated ${created} invoice(s); ${skipped} skipped (existing); ${failed} failed.`,
      count: created,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to generate class invoices." };
  }
};

// 25. Generate invoices for a grade level
export const generateInvoicesForGradeLevelService = async (
  data: GenerateInvoicesForGradeLevelInput
): Promise<FeeResponse> => {
  try {
    const classIds = (
      await db.query.classes.findMany({
        where: and(
          eq(classes.schoolId, data.schoolId),
          eq(classes.gradeLevelId, data.gradeLevelId)
        ),
        columns: { id: true },
      })
    ).map((c) => c.id);

    if (classIds.length === 0)
      return { success: false, message: "No classes for this grade level." };

    const roster = await db.query.students.findMany({
      where: and(
        inArray(students.classId, classIds),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
    });

    let created = 0, skipped = 0, failed = 0;
    for (const s of roster) {
      const r = await generateInvoiceForStudentService({
        schoolId: data.schoolId,
        studentId: s.id,
        termId: data.termId,
        dueDate: data.dueDate,
        notes: data.notes,
        includeOptionalFeeItems: data.includeOptionalFeeItems,
      });
      if (r.success) created++;
      else if (r.message.includes("already exists")) skipped++;
      else failed++;
    }

    return {
      success: true,
      message: `Generated ${created} invoice(s) for this grade level; ${skipped} skipped; ${failed} failed.`,
      count: created,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to generate grade-level invoices." };
  }
};

// 26. Generate invoices for the whole school
export const generateInvoicesForSchoolService = async (
  data: GenerateInvoicesForSchoolInput
): Promise<FeeResponse> => {
  try {
    const roster = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, data.schoolId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
    });

    let created = 0, skipped = 0, failed = 0;
    for (const s of roster) {
      const r = await generateInvoiceForStudentService({
        schoolId: data.schoolId,
        studentId: s.id,
        termId: data.termId,
        dueDate: data.dueDate,
        notes: data.notes,
        includeOptionalFeeItems: data.includeOptionalFeeItems,
      });
      if (r.success) created++;
      else if (r.message.includes("already exists")) skipped++;
      else failed++;
    }

    return {
      success: true,
      message: `Generated ${created} invoice(s) school-wide; ${skipped} skipped; ${failed} failed.`,
      count: created,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to generate school invoices." };
  }
};

// 27. Get invoice by ID
export const getInvoiceByIdService = async (id: string): Promise<FeeResponse> => {
  try {
    const inv = await db.query.studentInvoices.findFirst({
      where: eq(studentInvoices.id, id),
      with: { items: true, payments: true },
    });
    if (!inv) return { success: false, message: "Invoice not found." };
    return {
      success: true,
      message: "Invoice retrieved.",
      invoice: inv as any,
      invoiceItems: (inv as any).items,
      transactions: (inv as any).payments,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch invoice." };
  }
};

// 28. List invoices for a student
export const listInvoicesForStudentService = async (
  schoolId: string,
  studentId: string
): Promise<FeeResponse> => {
  try {
    const rows = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.studentId, studentId)
      ),
      orderBy: [desc(studentInvoices.createdAt)],
    });
    return { success: true, message: `Fetched ${rows.length} invoice(s).`, invoices: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list invoices." };
  }
};

// 29. List invoices for a term
export const listInvoicesForTermService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const rows = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.termId, termId)
      ),
      orderBy: [desc(studentInvoices.createdAt)],
    });
    return { success: true, message: `Fetched ${rows.length} invoice(s).`, invoices: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list invoices." };
  }
};

// 30. List invoices by status
export const listInvoicesByStatusService = async (
  schoolId: string,
  status: InvoiceStatus,
  opts?: { termId?: string }
): Promise<FeeResponse> => {
  try {
    const conds: any[] = [
      eq(studentInvoices.schoolId, schoolId),
      eq(studentInvoices.status, status),
    ];
    if (opts?.termId) conds.push(eq(studentInvoices.termId, opts.termId));

    const rows = await db.query.studentInvoices.findMany({
      where: and(...conds),
      orderBy: [desc(studentInvoices.createdAt)],
    });
    return { success: true, message: `Fetched ${rows.length} ${status} invoice(s).`, invoices: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list invoices." };
  }
};

// 31. Update invoice status (manual override)
export const updateInvoiceStatusService = async (
  invoiceId: string,
  status: InvoiceStatus
): Promise<FeeResponse> => {
  try {
    const existing = await db.query.studentInvoices.findFirst({
      where: eq(studentInvoices.id, invoiceId),
    });
    if (!existing) return { success: false, message: "Invoice not found." };
    const [row] = await db
      .update(studentInvoices)
      .set({ status, updatedAt: new Date() })
      .where(eq(studentInvoices.id, invoiceId))
      .returning();
    return { success: true, message: `Invoice status set to ${status}.`, invoice: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update invoice status." };
  }
};

// 32. Waive invoice
export const waiveInvoiceService = async (
  invoiceId: string,
  reason: string
): Promise<FeeResponse> => {
  try {
    const existing = await db.query.studentInvoices.findFirst({
      where: eq(studentInvoices.id, invoiceId),
    });
    if (!existing) return { success: false, message: "Invoice not found." };
    const [row] = await db
      .update(studentInvoices)
      .set({ status: "Waived", notes: existing.notes ? `${existing.notes}\nWaived: ${reason}` : `Waived: ${reason}`, updatedAt: new Date() })
      .where(eq(studentInvoices.id, invoiceId))
      .returning();
    return { success: true, message: "Invoice waived.", invoice: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to waive invoice." };
  }
};

// 33. Cancel invoice
export const cancelInvoiceService = async (
  invoiceId: string,
  reason: string
): Promise<FeeResponse> => {
  try {
    const existing = await db.query.studentInvoices.findFirst({
      where: eq(studentInvoices.id, invoiceId),
    });
    if (!existing) return { success: false, message: "Invoice not found." };
    const [row] = await db
      .update(studentInvoices)
      .set({ status: "Cancelled", notes: existing.notes ? `${existing.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`, updatedAt: new Date() })
      .where(eq(studentInvoices.id, invoiceId))
      .returning();
    return { success: true, message: "Invoice cancelled.", invoice: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to cancel invoice." };
  }
};

// 34. Apply a discount to an invoice
export const applyDiscountToInvoiceService = async (
  invoiceId: string,
  discount: string
): Promise<FeeResponse> => {
  try {
    const existing = await db.query.studentInvoices.findFirst({
      where: eq(studentInvoices.id, invoiceId),
    });
    if (!existing) return { success: false, message: "Invoice not found." };
    if (Number(discount) > Number(existing.totalAmount))
      return { success: false, message: "Discount cannot exceed total amount." };

    const [row] = await db
      .update(studentInvoices)
      .set({ discountAmount: fmt(Number(discount)), updatedAt: new Date() })
      .where(eq(studentInvoices.id, invoiceId))
      .returning();
    return { success: true, message: `Discount of ${discount} applied.`, invoice: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to apply discount." };
  }
};

// 35. Delete invoice (only if no payments)
export const deleteInvoiceService = async (invoiceId: string): Promise<FeeResponse> => {
  try {
    const payments = await db.query.feeTransactions.findMany({
      where: eq(feeTransactions.invoiceId, invoiceId),
    });
    if (payments.length > 0)
      return { success: false, message: "Cannot delete invoice with existing payments. Cancel it instead." };

    const [row] = await db.delete(studentInvoices).where(eq(studentInvoices.id, invoiceId)).returning();
    if (!row) return { success: false, message: "Invoice not found." };
    return { success: true, message: "Invoice deleted.", invoice: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete invoice." };
  }
};

// 36. Mark overdue invoices (cron job candidate)
export const markOverdueInvoicesService = async (schoolId: string): Promise<FeeResponse> => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db
      .update(studentInvoices)
      .set({ status: "Overdue", updatedAt: new Date() })
      .where(
        and(
          eq(studentInvoices.schoolId, schoolId),
          inArray(studentInvoices.status, ["Unpaid", "Partial"]),
          sql`${studentInvoices.dueDate} IS NOT NULL AND ${studentInvoices.dueDate} < ${today}`
        )
      )
      .returning();
    return { success: true, message: `Marked ${rows.length} invoice(s) as overdue.`, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to mark overdue invoices." };
  }
};

// ================================================================
// 37–48. PAYMENTS
// ================================================================

// 37. Record payment
export const recordPaymentService = async (
  data: RecordPaymentInput,
  recordedBy: string
): Promise<FeeResponse> => {
  try {
    const student = await assertStudentInSchool(data.schoolId, data.studentId);
    if (!student) return { success: false, message: "Student not found in this school." };
    const term = await assertTermInSchool(data.schoolId, data.termId);
    if (!term) return { success: false, message: "Term not found." };

    if (Number(data.amountPaid) <= 0)
      return { success: false, message: "Payment amount must be greater than zero." };

    // Validate invoice if provided
    let invoice: TSelectStudentInvoice | null = null;
    if (data.invoiceId) {
      const inv = await db.query.studentInvoices.findFirst({
        where: and(
          eq(studentInvoices.id, data.invoiceId),
          eq(studentInvoices.schoolId, data.schoolId),
          eq(studentInvoices.studentId, data.studentId)
        ),
      });
      if (!inv) return { success: false, message: "Invoice not found for this student." };
      if (inv.status === "Cancelled" || inv.status === "Waived")
        return { success: false, message: "Cannot pay a cancelled or waived invoice." };
      invoice = inv;
    }

    // Compute total paid and balance for this student/term
    const priorPaidRows = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, data.schoolId),
        eq(feeTransactions.studentId, data.studentId),
        eq(feeTransactions.termId, data.termId),
        eq(feeTransactions.status, "Completed")
      ),
    });
    const priorPaid = priorPaidRows.reduce((s, r) => s + Number(r.amountPaid), 0);
    const newTotalPaid = priorPaid + Number(data.amountPaid);

    // Compute billed (sum of non-cancelled invoices for the term)
    const billedRows = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, data.schoolId),
        eq(studentInvoices.studentId, data.studentId),
        eq(studentInvoices.termId, data.termId),
        ne(studentInvoices.status, "Cancelled")
      ),
    });
    const billed = billedRows.reduce(
      (s, r) => s + Number(r.totalAmount) - Number(r.discountAmount),
      0
    );
    const balance = billed - newTotalPaid;

    const result = await db.transaction(async (tx) => {
      const [txn] = await tx
        .insert(feeTransactions)
        .values({
          schoolId: data.schoolId,
          studentId: data.studentId,
          invoiceId: data.invoiceId ?? null,
          amountPaid: data.amountPaid,
          balanceRemaining: fmt(Math.max(0, balance)),
          paymentMethod: data.paymentMethod,
          status: "Completed",
          referenceCode: data.referenceCode,
          mpesaCheckoutRequestId: data.mpesaCheckoutRequestId ?? null,
          payerName: data.payerName ?? null,
          payerPhone: data.payerPhone ?? null,
          notes: data.notes ?? null,
          termId: data.termId,
          recordedBy,
        })
        .returning();

      // Update invoice status if applicable
      if (invoice) {
        const invPaidRows = await tx.query.feeTransactions.findMany({
          where: and(
            eq(feeTransactions.invoiceId, invoice.id),
            eq(feeTransactions.status, "Completed")
          ),
        });
        const invPaid = invPaidRows.reduce((s, r) => s + Number(r.amountPaid), 0);
        const invBilled = Number(invoice.totalAmount) - Number(invoice.discountAmount);
        let newStatus: InvoiceStatus = invoice.status;
        if (invPaid >= invBilled) newStatus = "Paid";
        else if (invPaid > 0) newStatus = "Partial";
        if (newStatus !== invoice.status) {
          await tx
            .update(studentInvoices)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(studentInvoices.id, invoice.id));
        }
      }

      // Also update any unpaid invoices for the term, in FIFO order
      else {
        const openInvoices = await tx.query.studentInvoices.findMany({
          where: and(
            eq(studentInvoices.schoolId, data.schoolId),
            eq(studentInvoices.studentId, data.studentId),
            eq(studentInvoices.termId, data.termId),
            inArray(studentInvoices.status, ["Unpaid", "Partial", "Overdue"])
          ),
          orderBy: [asc(studentInvoices.createdAt)],
        });
        let remaining = Number(data.amountPaid);
        for (const inv of openInvoices) {
          if (remaining <= 0) break;
          const invPaidRows = await tx.query.feeTransactions.findMany({
            where: and(
              eq(feeTransactions.invoiceId, inv.id),
              eq(feeTransactions.status, "Completed")
            ),
          });
          const invPaid = invPaidRows.reduce((s, r) => s + Number(r.amountPaid), 0);
          const invBilled = Number(inv.totalAmount) - Number(inv.discountAmount);
          const invOutstanding = invBilled - invPaid;
          if (invOutstanding <= 0) continue;
          const applied = Math.min(remaining, invOutstanding);
          remaining -= applied;
          const newInvPaid = invPaid + applied;
          const newStatus: InvoiceStatus =
            newInvPaid >= invBilled ? "Paid" : newInvPaid > 0 ? "Partial" : inv.status;
          await tx
            .update(studentInvoices)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(studentInvoices.id, inv.id));
        }
      }

      return txn;
    });

    return {
      success: true,
      message: `Payment of ${data.amountPaid} recorded. Balance: ${fmt(Math.max(0, balance))}.`,
      transaction: result,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "Duplicate reference code — a payment with this code already exists." };
    return { success: false, message: e?.message || "Failed to record payment." };
  }
};

// 38. Get transaction by ID
export const getTransactionByIdService = async (id: string): Promise<FeeResponse> => {
  try {
    const row = await db.query.feeTransactions.findFirst({ where: eq(feeTransactions.id, id) });
    if (!row) return { success: false, message: "Transaction not found." };
    return { success: true, message: "Transaction retrieved.", transaction: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch transaction." };
  }
};

// 39. List transactions for a student
export const listTransactionsForStudentService = async (
  schoolId: string,
  studentId: string
): Promise<FeeResponse> => {
  try {
    const rows = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.studentId, studentId)
      ),
      orderBy: [desc(feeTransactions.transactionDate)],
    });
    return { success: true, message: `Fetched ${rows.length} transaction(s).`, transactions: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list transactions." };
  }
};

// 40. List transactions for an invoice
export const listTransactionsForInvoiceService = async (
  invoiceId: string
): Promise<FeeResponse> => {
  try {
    const rows = await db.query.feeTransactions.findMany({
      where: eq(feeTransactions.invoiceId, invoiceId),
      orderBy: [desc(feeTransactions.transactionDate)],
    });
    return { success: true, message: `Fetched ${rows.length} transaction(s).`, transactions: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list transactions." };
  }
};

// 41. List transactions for a term
export const listTransactionsForTermService = async (
  schoolId: string,
  termId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<FeeResponse> => {
  try {
    const conds: any[] = [
      eq(feeTransactions.schoolId, schoolId),
      eq(feeTransactions.termId, termId),
    ];
    if (opts?.fromDate) conds.push(gte(feeTransactions.transactionDate, new Date(opts.fromDate)));
    if (opts?.toDate) conds.push(lte(feeTransactions.transactionDate, new Date(opts.toDate)));

    const rows = await db.query.feeTransactions.findMany({
      where: and(...conds),
      orderBy: [desc(feeTransactions.transactionDate)],
    });
    return { success: true, message: `Fetched ${rows.length} transaction(s).`, transactions: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list transactions." };
  }
};

// 42. List transactions by payment method
export const listTransactionsByMethodService = async (
  schoolId: string,
  method: PaymentMethod
): Promise<FeeResponse> => {
  try {
    const rows = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.paymentMethod, method)
      ),
      orderBy: [desc(feeTransactions.transactionDate)],
    });
    return { success: true, message: `Fetched ${rows.length} ${method} transaction(s).`, transactions: rows, count: rows.length };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list transactions." };
  }
};

// 43. Reverse a payment
export const reversePaymentService = async (
  id: string,
  data: ReversePaymentInput,
  reversedBy: string
): Promise<FeeResponse> => {
  try {
    const existing = await db.query.feeTransactions.findFirst({ where: eq(feeTransactions.id, id) });
    if (!existing) return { success: false, message: "Transaction not found." };
    if (existing.status !== "Completed")
      return { success: false, message: "Only completed transactions can be reversed." };

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(feeTransactions)
        .set({
          status: "Reversed",
          notes: existing.notes ? `${existing.notes}\nReversed: ${data.reason}` : `Reversed: ${data.reason}`,
        })
        .where(eq(feeTransactions.id, id))
        .returning();

      // Recompute invoice status if it was linked
      if (existing.invoiceId) {
        const inv = await tx.query.studentInvoices.findFirst({
          where: eq(studentInvoices.id, existing.invoiceId),
        });
        if (inv) {
          const paidRows = await tx.query.feeTransactions.findMany({
            where: and(
              eq(feeTransactions.invoiceId, existing.invoiceId),
              eq(feeTransactions.status, "Completed")
            ),
          });
          const paid = paidRows.reduce((s, r) => s + Number(r.amountPaid), 0);
          const billed = Number(inv.totalAmount) - Number(inv.discountAmount);
          const newStatus: InvoiceStatus =
            paid >= billed ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
          await tx
            .update(studentInvoices)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(studentInvoices.id, inv.id));
        }
      }

      return row;
    });

    return { success: true, message: "Payment reversed.", transaction: result };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reverse payment." };
  }
};

// 44. Delete transaction (only if Pending/Failed)
export const deleteTransactionService = async (id: string): Promise<FeeResponse> => {
  try {
    const existing = await db.query.feeTransactions.findFirst({ where: eq(feeTransactions.id, id) });
    if (!existing) return { success: false, message: "Transaction not found." };
    if (existing.status === "Completed")
      return { success: false, message: "Cannot delete a completed transaction — reverse it instead." };
    const [row] = await db.delete(feeTransactions).where(eq(feeTransactions.id, id)).returning();
    return { success: true, message: "Transaction deleted.", transaction: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete transaction." };
  }
};

// 45. Get student balance for a term
export const getStudentBalanceService = async (
  schoolId: string,
  studentId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const billedRows = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.studentId, studentId),
        eq(studentInvoices.termId, termId),
        ne(studentInvoices.status, "Cancelled")
      ),
    });
    const billed = billedRows.reduce(
      (s, r) => s + Number(r.totalAmount) - Number(r.discountAmount),
      0
    );

    const paidRows = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.studentId, studentId),
        eq(feeTransactions.termId, termId),
        eq(feeTransactions.status, "Completed")
      ),
    });
    const paid = paidRows.reduce((s, r) => s + Number(r.amountPaid), 0);
    const balance = billed - paid;

    return {
      success: true,
      message:
        balance > 0
          ? `Balance owing: ${fmt(balance)}.`
          : balance < 0
          ? `Overpaid by ${fmt(-balance)}.`
          : "Fees fully cleared.",
      balance: {
        studentId,
        termId,
        billed: fmt(billed),
        paid: fmt(paid),
        balance: fmt(balance),
        status: balance <= 0 ? "Cleared" : paid > 0 ? "Partial" : "Owed",
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute balance." };
  }
};

// 46. Get student statement (all transactions + invoices across terms)
export const getStudentStatementService = async (
  schoolId: string,
  studentId: string
): Promise<FeeResponse> => {
  try {
    const invoices = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.studentId, studentId)
      ),
      with: { items: true },
      orderBy: [asc(studentInvoices.createdAt)],
    });
    const transactions = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.studentId, studentId)
      ),
      orderBy: [asc(feeTransactions.transactionDate)],
    });

    const totalBilled = invoices
      .filter((i) => i.status !== "Cancelled")
      .reduce((s, i) => s + Number(i.totalAmount) - Number(i.discountAmount), 0);
    const totalPaid = transactions
      .filter((t) => t.status === "Completed")
      .reduce((s, t) => s + Number(t.amountPaid), 0);

    return {
      success: true,
      message: `Statement: billed ${fmt(totalBilled)}, paid ${fmt(totalPaid)}, balance ${fmt(totalBilled - totalPaid)}.`,
      invoices,
      transactions,
      balance: {
        studentId,
        termId: "ALL",
        billed: fmt(totalBilled),
        paid: fmt(totalPaid),
        balance: fmt(totalBilled - totalPaid),
        status:
          totalBilled - totalPaid <= 0
            ? "Cleared"
            : totalPaid > 0
            ? "Partial"
            : "Owed",
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build statement." };
  }
};

// 47. Get defaulters (students with outstanding balance)
export const listDefaultersService = async (
  schoolId: string,
  termId: string,
  opts?: { minBalance?: number }
): Promise<FeeResponse> => {
  try {
    const minBalance = opts?.minBalance ?? 1;

    const invoiced = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.termId, termId),
        ne(studentInvoices.status, "Cancelled"),
        ne(studentInvoices.status, "Waived")
      ),
    });

    const paid = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.termId, termId),
        eq(feeTransactions.status, "Completed")
      ),
    });

    const billedByStudent = new Map<string, number>();
    for (const inv of invoiced) {
      const amount = Number(inv.totalAmount) - Number(inv.discountAmount);
      billedByStudent.set(inv.studentId, (billedByStudent.get(inv.studentId) ?? 0) + amount);
    }

    const paidByStudent = new Map<string, number>();
    for (const t of paid) {
      paidByStudent.set(t.studentId, (paidByStudent.get(t.studentId) ?? 0) + Number(t.amountPaid));
    }

    const defaulters: Array<{ studentId: string; billed: string; paid: string; balance: string }> = [];
    for (const [studentId, billed] of billedByStudent.entries()) {
      const paid = paidByStudent.get(studentId) ?? 0;
      const balance = billed - paid;
      if (balance >= minBalance) {
        defaulters.push({
          studentId,
          billed: fmt(billed),
          paid: fmt(paid),
          balance: fmt(balance),
        });
      }
    }

    defaulters.sort((a, b) => Number(b.balance) - Number(a.balance));

    return {
      success: true,
      message: `${defaulters.length} student(s) with outstanding balance ≥ ${minBalance}.`,
      stats: { defaulters },
      count: defaulters.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute defaulters." };
  }
};

// 48. Get paid-in-full students for a term
export const listClearedStudentsService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const invoiced = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.termId, termId),
        ne(studentInvoices.status, "Cancelled"),
        ne(studentInvoices.status, "Waived")
      ),
    });
    const paid = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.termId, termId),
        eq(feeTransactions.status, "Completed")
      ),
    });

    const billedByStudent = new Map<string, number>();
    for (const inv of invoiced) {
      const amount = Number(inv.totalAmount) - Number(inv.discountAmount);
      billedByStudent.set(inv.studentId, (billedByStudent.get(inv.studentId) ?? 0) + amount);
    }
    const paidByStudent = new Map<string, number>();
    for (const t of paid) {
      paidByStudent.set(t.studentId, (paidByStudent.get(t.studentId) ?? 0) + Number(t.amountPaid));
    }

    const cleared: Array<{ studentId: string; billed: string; paid: string }> = [];
    for (const [studentId, billed] of billedByStudent.entries()) {
      const paid = paidByStudent.get(studentId) ?? 0;
      if (paid >= billed && billed > 0) cleared.push({ studentId, billed: fmt(billed), paid: fmt(paid) });
    }

    return {
      success: true,
      message: `${cleared.length} student(s) have fully paid.`,
      stats: { cleared },
      count: cleared.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute cleared students." };
  }
};

// ================================================================
// 49–60. ANALYTICS & REPORTS
// ================================================================

// 49. Term financial summary
export const getTermFinancialSummaryService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const invoices = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.termId, termId),
        ne(studentInvoices.status, "Cancelled")
      ),
    });
    const transactions = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.termId, termId),
        eq(feeTransactions.status, "Completed")
      ),
    });

    const totalBilled = invoices.reduce(
      (s, i) => s + Number(i.totalAmount) - Number(i.discountAmount),
      0
    );
    const totalPaid = transactions.reduce((s, t) => s + Number(t.amountPaid), 0);

    return {
      success: true,
      message: `Billed ${fmt(totalBilled)}, collected ${fmt(totalPaid)}, outstanding ${fmt(totalBilled - totalPaid)}.`,
      summary: {
        totalBilled: fmt(totalBilled),
        totalPaid: fmt(totalPaid),
        balance: fmt(totalBilled - totalPaid),
        invoiceCount: invoices.length,
        paidCount: invoices.filter((i) => i.status === "Paid").length,
        partialCount: invoices.filter((i) => i.status === "Partial").length,
        unpaidCount: invoices.filter((i) => ["Unpaid", "Overdue"].includes(i.status)).length,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute financial summary." };
  }
};

// 50. Collections by payment method
export const getCollectionsByMethodService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const rows = await db
      .select({
        method: feeTransactions.paymentMethod,
        total: sql<string>`SUM(${feeTransactions.amountPaid})`,
        txnCount: count(),
      })
      .from(feeTransactions)
      .where(
        and(
          eq(feeTransactions.schoolId, schoolId),
          eq(feeTransactions.termId, termId),
          eq(feeTransactions.status, "Completed")
        )
      )
      .groupBy(feeTransactions.paymentMethod);

    const breakdown: Record<string, { total: string; count: number }> = {};
    for (const r of rows) {
      breakdown[r.method] = { total: fmt(Number(r.total)), count: Number(r.txnCount) };
    }

    return {
      success: true,
      message: `Collections across ${rows.length} payment method(s).`,
      stats: { breakdown },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute collections by method." };
  }
};

// 51. Collections by boarding status
export const getCollectionsByBoardingStatusService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const transactions = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.termId, termId),
        eq(feeTransactions.status, "Completed")
      ),
    });
    const studentIds = [...new Set(transactions.map((t) => t.studentId))];
    const studentRows = studentIds.length
      ? await db.query.students.findMany({ where: inArray(students.id, studentIds) })
      : [];
    const byId = new Map(studentRows.map((s) => [s.id, s]));

    const breakdown: Record<string, number> = { Day: 0, Boarding: 0 };
    for (const t of transactions) {
      const b = byId.get(t.studentId)?.boardingStatus ?? "Day";
      breakdown[b] += Number(t.amountPaid);
    }

    return {
      success: true,
      message: `Day: ${fmt(breakdown.Day)}, Boarding: ${fmt(breakdown.Boarding)}.`,
      stats: {
        day: fmt(breakdown.Day),
        boarding: fmt(breakdown.Boarding),
        total: fmt(breakdown.Day + breakdown.Boarding),
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute collections by boarding." };
  }
};

// 52. Collections by grade level
export const getCollectionsByGradeService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const invoices = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.termId, termId),
        ne(studentInvoices.status, "Cancelled")
      ),
    });
    const studentIds = [...new Set(invoices.map((i) => i.studentId))];
    const studentRows = studentIds.length
      ? await db.query.students.findMany({
          where: inArray(students.id, studentIds),
          with: { class: true },
        })
      : [];
    const byId = new Map(studentRows.map((s) => [s.id, s]));
    const paidRows = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.termId, termId),
        eq(feeTransactions.status, "Completed")
      ),
    });
    const paidById = new Map<string, number>();
    for (const t of paidRows) {
      paidById.set(t.studentId, (paidById.get(t.studentId) ?? 0) + Number(t.amountPaid));
    }

    const breakdown: Record<string, { billed: number; paid: number; balance: number }> = {};
    for (const inv of invoices) {
      const student = byId.get(inv.studentId);
      const gradeId = (student as any)?.class?.gradeLevelId ?? "unassigned";
      if (!breakdown[gradeId]) breakdown[gradeId] = { billed: 0, paid: 0, balance: 0 };
      breakdown[gradeId].billed += Number(inv.totalAmount) - Number(inv.discountAmount);
    }
    for (const [studentId, paid] of paidById.entries()) {
      const student = byId.get(studentId);
      const gradeId = (student as any)?.class?.gradeLevelId ?? "unassigned";
      if (!breakdown[gradeId]) breakdown[gradeId] = { billed: 0, paid: 0, balance: 0 };
      breakdown[gradeId].paid += paid;
    }
    for (const k of Object.keys(breakdown)) {
      breakdown[k].balance = breakdown[k].billed - breakdown[k].paid;
    }

    return {
      success: true,
      message: `Collections broken down by grade level.`,
      stats: { breakdown },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute collections by grade." };
  }
};

// 53. Aging report (invoices by age bucket)
export const getAgingReportService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const invoices = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.termId, termId),
        inArray(studentInvoices.status, ["Unpaid", "Partial", "Overdue"])
      ),
    });
    const today = new Date();
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    for (const inv of invoices) {
      const outstanding = Number(inv.totalAmount) - Number(inv.discountAmount);
      const days = inv.dueDate
        ? Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000)
        : 0;
      if (days <= 30) buckets["0-30"] += outstanding;
      else if (days <= 60) buckets["31-60"] += outstanding;
      else if (days <= 90) buckets["61-90"] += outstanding;
      else buckets["90+"] += outstanding;
    }
    return {
      success: true,
      message: `Aging report computed across ${invoices.length} outstanding invoice(s).`,
      stats: {
        "0-30 days": fmt(buckets["0-30"]),
        "31-60 days": fmt(buckets["31-60"]),
        "61-90 days": fmt(buckets["61-90"]),
        "90+ days": fmt(buckets["90+"]),
        total: fmt(Object.values(buckets).reduce((a, b) => a + b, 0)),
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute aging report." };
  }
};

// 54. Daily collections
export const getDailyCollectionsService = async (
  schoolId: string,
  date: string
): Promise<FeeResponse> => {
  try {
    const transactions = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.status, "Completed"),
        sql`DATE(${feeTransactions.transactionDate}) = ${date}`
      ),
    });
    const total = transactions.reduce((s, t) => s + Number(t.amountPaid), 0);
    return {
      success: true,
      message: `Collections on ${date}: ${fmt(total)} across ${transactions.length} payment(s).`,
      transactions,
      stats: { date, total: fmt(total), count: transactions.length },
      count: transactions.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute daily collections." };
  }
};

// 55. Collection trend over N days
export const getCollectionTrendService = async (
  schoolId: string,
  days: number = 30
): Promise<FeeResponse> => {
  try {
    const startDate = new Date(Date.now() - days * 86_400_000);
    const rows = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.status, "Completed"),
        gte(feeTransactions.transactionDate, startDate)
      ),
    });
    const byDate: Record<string, number> = {};
    for (const t of rows) {
      const d = t.transactionDate.toISOString().split("T")[0];
      byDate[d] = (byDate[d] ?? 0) + Number(t.amountPaid);
    }
    const trend = Object.entries(byDate)
      .map(([date, total]) => ({ date, total: fmt(total) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      success: true,
      message: `Collection trend across ${trend.length} day(s).`,
      stats: { trend },
      count: trend.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build collection trend." };
  }
};

// 56. Expected vs collected
export const getExpectedVsCollectedService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const summary = await getTermFinancialSummaryService(schoolId, termId);
    if (!summary.success || !summary.summary) return summary;

    const { totalBilled, totalPaid, balance } = summary.summary;
    const collected = Number(totalPaid);
    const billed = Number(totalBilled);
    const collectionRate = billed === 0 ? 0 : Math.round((collected / billed) * 10000) / 100;

    return {
      success: true,
      message: `Collected ${totalPaid} of ${totalBilled} (${collectionRate}%). Outstanding: ${balance}.`,
      stats: {
        billed,
        collected,
        outstanding: Number(balance),
        collectionRate,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute expected vs collected." };
  }
};

// 57. M-Pesa pending payments
export const listMpesaPendingPaymentsService = async (
  schoolId: string
): Promise<FeeResponse> => {
  try {
    const rows = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.paymentMethod, "M-Pesa"),
        eq(feeTransactions.status, "Pending")
      ),
      orderBy: [desc(feeTransactions.transactionDate)],
    });
    return {
      success: true,
      message: `${rows.length} pending M-Pesa payment(s).`,
      transactions: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list pending M-Pesa payments." };
  }
};

// 58. Lookup a payment by M-Pesa checkout ID (webhook handler helper)
export const findPaymentByMpesaCheckoutService = async (
  checkoutRequestId: string
): Promise<FeeResponse> => {
  try {
    const row = await db.query.feeTransactions.findFirst({
      where: eq(feeTransactions.mpesaCheckoutRequestId, checkoutRequestId),
    });
    if (!row) return { success: false, message: "No payment found for that M-Pesa checkout ID." };
    return { success: true, message: "Payment found.", transaction: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to look up payment." };
  }
};

// 59. Recompute invoice statuses for a term (fix-up job)
export const recomputeInvoiceStatusesService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const invoices = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.termId, termId),
        ne(studentInvoices.status, "Cancelled")
      ),
    });

    let changed = 0;
    for (const inv of invoices) {
      const paidRows = await db.query.feeTransactions.findMany({
        where: and(
          eq(feeTransactions.invoiceId, inv.id),
          eq(feeTransactions.status, "Completed")
        ),
      });
      const paid = paidRows.reduce((s, r) => s + Number(r.amountPaid), 0);
      const billed = Number(inv.totalAmount) - Number(inv.discountAmount);
      let newStatus: InvoiceStatus = inv.status;
      if (paid >= billed) newStatus = "Paid";
      else if (paid > 0) newStatus = "Partial";
      else if (inv.status === "Overdue" || inv.status === "Partial") newStatus = "Unpaid";
      if (newStatus !== inv.status) {
        await db
          .update(studentInvoices)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(studentInvoices.id, inv.id));
        changed++;
      }
    }

    return { success: true, message: `Recomputed ${invoices.length} invoice(s); ${changed} updated.`, count: changed };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to recompute invoice statuses." };
  }
};

// 60. Fee dashboard — one-shot summary
export const getFeeDashboardService = async (
  schoolId: string,
  termId: string
): Promise<FeeResponse> => {
  try {
    const summary = await getTermFinancialSummaryService(schoolId, termId);
    const byMethod = await getCollectionsByMethodService(schoolId, termId);
    const byBoarding = await getCollectionsByBoardingStatusService(schoolId, termId);
    const aging = await getAgingReportService(schoolId, termId);
    const defaulters = await listDefaultersService(schoolId, termId);

    return {
      success: true,
      message: `Fee dashboard for the term.`,
      stats: {
        summary: summary.summary,
        byMethod: byMethod.stats,
        byBoarding: byBoarding.stats,
        aging: aging.stats,
        defaultersCount: defaulters.count,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to build fee dashboard." };
  }
};