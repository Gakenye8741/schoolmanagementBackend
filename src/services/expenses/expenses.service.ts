// src/services/expenses/expenses.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, inArray, gte, lte,
} from "drizzle-orm";

import {
  schoolExpenses,
  schools,
  users,
  notifications,
  studentInvoices,
  feeTransactions,
  TSelectSchoolExpense,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Input types
// ================================================================
export type ExpenseCategory =
  | "Salary" | "Utilities" | "Maintenance" | "Supplies" | "Transport";
export type PaymentMethod = "M-Pesa" | "Bank" | "Cash" | "Cheque";

export interface CreateExpenseInput {
  schoolId: string;
  title: string;
  category: ExpenseCategory;
  amount: string;
  paymentMethod: PaymentMethod;
  referenceCode?: string | null;
  receiptUrl?: string | null;
  expenseDate: string;
  recordedBy: string;
  approvalThreshold?: string;
}

export interface BulkCreateExpensesInput {
  schoolId: string;
  recordedBy: string;
  approvalThreshold?: string;
  expenses: Array<{
    title: string;
    category: ExpenseCategory;
    amount: string;
    paymentMethod: PaymentMethod;
    referenceCode?: string | null;
    receiptUrl?: string | null;
    expenseDate: string;
  }>;
}

export interface UpdateExpenseInput {
  title?: string;
  category?: ExpenseCategory;
  amount?: string;
  paymentMethod?: PaymentMethod;
  referenceCode?: string | null;
  receiptUrl?: string | null;
  expenseDate?: string;
}

// ================================================================
// Response envelope
// ================================================================
export interface ExpenseResponse {
  success: boolean;
  message: string;
  expense?: TSelectSchoolExpense;
  expenses?: TSelectSchoolExpense[];
  summary?: {
    totalExpenses: string;
    byCategory: Record<string, string>;
    byMonth: Array<{ month: string; total: string }>;
    count: number;
    pendingApprovalCount: number;
  };
  comparison?: {
    billed: string;
    collected: string;
    totalExpenses: string;
    netPosition: string;
    collectionRate: string;
  };
  stats?: Record<string, any>;
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const fmt = (n: number) => n.toFixed(2);

/** Normalize any date input to YYYY-MM-DD string for Postgres `date` columns. */
const toDateOnly = (value: string | Date): string =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : new Date(value).toISOString().slice(0, 10);

const isValidCategory = (c: string): c is ExpenseCategory =>
  ["Salary", "Utilities", "Maintenance", "Supplies", "Transport"].includes(c);

const isValidPaymentMethod = (m: string): m is PaymentMethod =>
  ["M-Pesa", "Bank", "Cash", "Cheque"].includes(m);

const assertSchoolExists = async (schoolId: string) => {
  return await db.query.schools.findFirst({ where: eq(schools.id, schoolId) });
};

const assertUserInSchool = async (userId: string, schoolId: string) => {
  return await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.schoolId, schoolId)),
  });
};

const needsApproval = (amount: string, threshold?: string): boolean => {
  if (!threshold) return false;
  return Number(amount) >= Number(threshold);
};

const notifyApprovers = async (
  schoolId: string,
  expenseId: string,
  title: string,
  amount: string
): Promise<number> => {
  try {
    const admins = await db.query.users.findMany({
      where: and(
        eq(users.schoolId, schoolId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
        inArray(users.role, ["school_admin", "principal", "bursar"])
      ),
      columns: { id: true },
    });
    if (admins.length === 0) return 0;

    const values = admins.map((a) => ({
      schoolId,
      userId: a.id,
      type: "System" as const,
      title: `Expense approval needed: ${title}`,
      body: `A KES ${amount} expense requires your approval.`,
      data: { expenseId, action: "approve_expense" },
    }));

    let inserted = 0;
    for (let i = 0; i < values.length; i += 100) {
      const chunk = values.slice(i, i + 100);
      const res = await db.insert(notifications).values(chunk).returning({ id: notifications.id });
      inserted += res.length;
    }
    return inserted;
  } catch (e: any) {
    console.error("Expense approval notification failed:", e?.message);
    return 0;
  }
};

// ================================================================
// 1. CREATE EXPENSE
// ================================================================
export const createExpenseService = async (
  data: CreateExpenseInput
): Promise<ExpenseResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.title || data.title.trim().length < 2)
      return { success: false, message: "Title must be at least 2 characters." };
    if (!data.category || !isValidCategory(data.category))
      return { success: false, message: "Invalid expense category." };
    if (!data.amount || !/^\d+(\.\d{1,2})?$/.test(data.amount))
      return { success: false, message: "Amount must be a valid number." };
    if (Number(data.amount) <= 0)
      return { success: false, message: "Amount must be greater than zero." };
    if (!data.paymentMethod || !isValidPaymentMethod(data.paymentMethod))
      return { success: false, message: "Invalid payment method." };
    if (!data.expenseDate)
      return { success: false, message: "expenseDate is required." };
    if (!data.recordedBy)
      return { success: false, message: "recordedBy is required." };

    const school = await assertSchoolExists(data.schoolId);
    if (!school) return { success: false, message: "School not found." };

    const user = await assertUserInSchool(data.recordedBy, data.schoolId);
    if (!user) return { success: false, message: "Recording user not found in this school." };

    const expenseDateStr = toDateOnly(data.expenseDate);

    const requiresApproval = needsApproval(data.amount, data.approvalThreshold);

    const [row] = await db
      .insert(schoolExpenses)
      .values({
        schoolId: data.schoolId,
        title: data.title.trim(),
        category: data.category,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        referenceCode: data.referenceCode ?? null,
        receiptUrl: data.receiptUrl ?? null,
        recordedBy: data.recordedBy,
        approvedBy: requiresApproval ? null : data.recordedBy,
        expenseDate: expenseDateStr,          // ← string, not Date
      })
      .returning();

    let notified = 0;
    if (requiresApproval) {
      notified = await notifyApprovers(data.schoolId, row.id, row.title, row.amount);
    }

    return {
      success: true,
      message:
        `Expense "${row.title}" recorded` +
        (requiresApproval
          ? ` — awaiting approval${notified > 0 ? ` (${notified} admin(s) notified)` : ""}.`
          : "."),
      expense: row,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A duplicate reference code already exists." };
    return { success: false, message: e?.message || "Failed to record expense." };
  }
};

// ================================================================
// 2. BULK CREATE EXPENSES
// ================================================================
export const bulkCreateExpensesService = async (
  data: BulkCreateExpensesInput
): Promise<ExpenseResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.recordedBy) return { success: false, message: "recordedBy is required." };
    if (!data.expenses || data.expenses.length === 0)
      return { success: false, message: "At least one expense is required." };

    const school = await assertSchoolExists(data.schoolId);
    if (!school) return { success: false, message: "School not found." };

    const user = await assertUserInSchool(data.recordedBy, data.schoolId);
    if (!user) return { success: false, message: "Recording user not found in this school." };

    const issues: string[] = [];
    const values: Array<{
      schoolId: string;
      title: string;
      category: ExpenseCategory;
      amount: string;
      paymentMethod: PaymentMethod;
      referenceCode: string | null;
      receiptUrl: string | null;
      recordedBy: string;
      approvedBy: string | null;
      expenseDate: string;                   // ← string, not Date
    }> = [];

    for (let i = 0; i < data.expenses.length; i++) {
      const e = data.expenses[i];
      if (!e.title || e.title.trim().length < 2) {
        issues.push(`Row ${i + 1}: title too short`); continue;
      }
      if (!isValidCategory(e.category)) {
        issues.push(`Row ${i + 1}: invalid category`); continue;
      }
      if (!/^\d+(\.\d{1,2})?$/.test(e.amount) || Number(e.amount) <= 0) {
        issues.push(`Row ${i + 1}: invalid amount`); continue;
      }
      if (!isValidPaymentMethod(e.paymentMethod)) {
        issues.push(`Row ${i + 1}: invalid payment method`); continue;
      }
      if (!e.expenseDate) {
        issues.push(`Row ${i + 1}: missing expense date`); continue;
      }
      const dateStr = toDateOnly(e.expenseDate);
      if (!dateStr) {
        issues.push(`Row ${i + 1}: invalid date`); continue;
      }
      const requiresApproval = needsApproval(e.amount, data.approvalThreshold);
      values.push({
        schoolId: data.schoolId,
        title: e.title.trim(),
        category: e.category,
        amount: e.amount,
        paymentMethod: e.paymentMethod,
        referenceCode: e.referenceCode ?? null,
        receiptUrl: e.receiptUrl ?? null,
        recordedBy: data.recordedBy,
        approvedBy: requiresApproval ? null : data.recordedBy,
        expenseDate: dateStr,
      });
    }

    if (values.length === 0) {
      return {
        success: false,
        message: `No valid expenses to record.${issues.length > 0 ? " " + issues.slice(0, 5).join("; ") : ""}`,
        issues,
      };
    }

    const inserted = await db.insert(schoolExpenses).values(values).returning();

    let totalNotified = 0;
    for (const row of inserted) {
      if (row.approvedBy === null) {
        const n = await notifyApprovers(data.schoolId, row.id, row.title, row.amount);
        totalNotified += n;
      }
    }

    return {
      success: true,
      message:
        `Recorded ${inserted.length} expense(s)${totalNotified > 0 ? ` — ${totalNotified} approval notification(s) sent` : ""}.` +
        (issues.length > 0 ? ` ${issues.length} row(s) skipped.` : ""),
      expenses: inserted,
      count: inserted.length,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A duplicate reference code already exists." };
    return { success: false, message: e?.message || "Failed to bulk-create expenses." };
  }
};

// ================================================================
// 3. GET EXPENSE BY ID
// ================================================================
export const getExpenseByIdService = async (id: string): Promise<ExpenseResponse> => {
  try {
    const row = await db.query.schoolExpenses.findFirst({
      where: eq(schoolExpenses.id, id),
      with: { recordedByUser: true, school: true },
    });
    if (!row) return { success: false, message: "Expense not found." };
    return { success: true, message: "Expense retrieved.", expense: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch expense." };
  }
};

// ================================================================
// 4. UPDATE EXPENSE
// ================================================================
export const updateExpenseService = async (
  id: string,
  patch: UpdateExpenseInput
): Promise<ExpenseResponse> => {
  try {
    const existing = await db.query.schoolExpenses.findFirst({
      where: eq(schoolExpenses.id, id),
    });
    if (!existing) return { success: false, message: "Expense not found." };

    if (patch.category && !isValidCategory(patch.category))
      return { success: false, message: "Invalid expense category." };
    if (patch.paymentMethod && !isValidPaymentMethod(patch.paymentMethod))
      return { success: false, message: "Invalid payment method." };
    if (patch.amount && (!/^\d+(\.\d{1,2})?$/.test(patch.amount) || Number(patch.amount) <= 0))
      return { success: false, message: "Amount must be a valid number greater than zero." };

    const [row] = await db
      .update(schoolExpenses)
      .set({
        ...(patch.title !== undefined && { title: patch.title.trim() }),
        ...(patch.category !== undefined && { category: patch.category }),
        ...(patch.amount !== undefined && { amount: patch.amount }),
        ...(patch.paymentMethod !== undefined && { paymentMethod: patch.paymentMethod }),
        ...(patch.referenceCode !== undefined && { referenceCode: patch.referenceCode }),
        ...(patch.receiptUrl !== undefined && { receiptUrl: patch.receiptUrl }),
        ...(patch.expenseDate !== undefined && { expenseDate: toDateOnly(patch.expenseDate) }),  // ← string
      })
      .where(eq(schoolExpenses.id, id))
      .returning();
    return { success: true, message: "Expense updated.", expense: row };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "A duplicate reference code already exists." };
    return { success: false, message: e?.message || "Failed to update expense." };
  }
};

// ================================================================
// 5. APPROVE EXPENSE
// ================================================================
export const approveExpenseService = async (
  id: string,
  approvedBy: string
): Promise<ExpenseResponse> => {
  try {
    const existing = await db.query.schoolExpenses.findFirst({
      where: eq(schoolExpenses.id, id),
    });
    if (!existing) return { success: false, message: "Expense not found." };
    if (existing.approvedBy !== null)
      return { success: true, message: "Expense is already approved.", expense: existing };

    const user = await assertUserInSchool(approvedBy, existing.schoolId);
    if (!user) return { success: false, message: "Approving user not found in this school." };

    const [row] = await db
      .update(schoolExpenses)
      .set({ approvedBy })
      .where(eq(schoolExpenses.id, id))
      .returning();
    return { success: true, message: "Expense approved.", expense: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to approve expense." };
  }
};

// ================================================================
// 6. REJECT / REVOKE APPROVAL
// ================================================================
export const revokeApprovalService = async (id: string): Promise<ExpenseResponse> => {
  try {
    const [row] = await db
      .update(schoolExpenses)
      .set({ approvedBy: null })
      .where(eq(schoolExpenses.id, id))
      .returning();
    if (!row) return { success: false, message: "Expense not found." };
    return { success: true, message: "Approval revoked — expense is pending again.", expense: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to revoke approval." };
  }
};

// ================================================================
// 7. DELETE EXPENSE
// ================================================================
export const deleteExpenseService = async (id: string): Promise<ExpenseResponse> => {
  try {
    const [row] = await db.delete(schoolExpenses).where(eq(schoolExpenses.id, id)).returning();
    if (!row) return { success: false, message: "Expense not found." };
    return { success: true, message: "Expense deleted.", expense: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete expense." };
  }
};

// ================================================================
// 8. LIST FOR SCHOOL (with filters)
// ================================================================
export const listExpensesForSchoolService = async (
  schoolId: string,
  opts?: {
    category?: ExpenseCategory;
    fromDate?: string;
    toDate?: string;
    approved?: boolean;
    pendingApprovalOnly?: boolean;
  }
): Promise<ExpenseResponse> => {
  try {
    const filters: any[] = [eq(schoolExpenses.schoolId, schoolId)];
    if (opts?.category) filters.push(eq(schoolExpenses.category, opts.category));
    if (opts?.fromDate) filters.push(gte(schoolExpenses.expenseDate, toDateOnly(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(schoolExpenses.expenseDate, toDateOnly(opts.toDate)));
    if (opts?.pendingApprovalOnly) filters.push(isNull(schoolExpenses.approvedBy));
    else if (opts?.approved === true) filters.push(sql`${schoolExpenses.approvedBy} IS NOT NULL`);
    else if (opts?.approved === false) filters.push(isNull(schoolExpenses.approvedBy));

    const rows = await db.query.schoolExpenses.findMany({
      where: and(...filters),
      with: { recordedByUser: { columns: { id: true, name: true } } },
      orderBy: [desc(schoolExpenses.expenseDate)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} expense(s).`,
      expenses: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list expenses." };
  }
};

// ================================================================
// 9. LIST BY CATEGORY
// ================================================================
export const listExpensesByCategoryService = async (
  schoolId: string,
  category: ExpenseCategory
): Promise<ExpenseResponse> => {
  return listExpensesForSchoolService(schoolId, { category });
};

// ================================================================
// 10. LIST BY DATE RANGE
// ================================================================
export const listExpensesByDateRangeService = async (
  schoolId: string,
  fromDate: string,
  toDate: string
): Promise<ExpenseResponse> => {
  return listExpensesForSchoolService(schoolId, { fromDate, toDate });
};

// ================================================================
// 11. LIST PENDING APPROVAL
// ================================================================
export const listPendingApprovalExpensesService = async (
  schoolId: string
): Promise<ExpenseResponse> => {
  return listExpensesForSchoolService(schoolId, { pendingApprovalOnly: true });
};

// ================================================================
// 12. EXPENSE SUMMARY
// ================================================================
export const getExpenseSummaryService = async (
  schoolId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<ExpenseResponse> => {
  try {
    const filters: any[] = [eq(schoolExpenses.schoolId, schoolId)];
    if (opts?.fromDate) filters.push(gte(schoolExpenses.expenseDate, toDateOnly(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(schoolExpenses.expenseDate, toDateOnly(opts.toDate)));

    const rows = await db.query.schoolExpenses.findMany({ where: and(...filters) });

    let total = 0;
    const byCategory: Record<string, number> = {};
    const byMonthMap: Record<string, number> = {};
    let pendingCount = 0;

    for (const r of rows) {
      total += Number(r.amount);
      byCategory[r.category] = (byCategory[r.category] ?? 0) + Number(r.amount);

      // `r.expenseDate` is already a string (YYYY-MM-DD) — slice first 7 chars
      const month = r.expenseDate.slice(0, 7);
      byMonthMap[month] = (byMonthMap[month] ?? 0) + Number(r.amount);

      if (r.approvedBy === null) pendingCount++;
    }

    const byCategoryFmt: Record<string, string> = {};
    for (const [k, v] of Object.entries(byCategory)) byCategoryFmt[k] = fmt(v);

    const byMonth = Object.entries(byMonthMap)
      .map(([month, amt]) => ({ month, total: fmt(amt) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      success: true,
      message: `${rows.length} expense(s) totalling ${fmt(total)}.`,
      summary: {
        totalExpenses: fmt(total),
        byCategory: byCategoryFmt,
        byMonth,
        count: rows.length,
        pendingApprovalCount: pendingCount,
      },
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute summary." };
  }
};

// ================================================================
// 13. MONTHLY EXPENSES (trend over N months)
// ================================================================
export const getMonthlyExpensesService = async (
  schoolId: string,
  months: number = 6
): Promise<ExpenseResponse> => {
  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = toDateOnly(startDate);

    const rows = await db.query.schoolExpenses.findMany({
      where: and(
        eq(schoolExpenses.schoolId, schoolId),
        gte(schoolExpenses.expenseDate, startDateStr)
      ),
      orderBy: [asc(schoolExpenses.expenseDate)],
    });

    const byMonth: Record<string, number> = {};
    for (const r of rows) {
      const month = r.expenseDate.slice(0, 7);
      byMonth[month] = (byMonth[month] ?? 0) + Number(r.amount);
    }

    const trend = Object.entries(byMonth)
      .map(([month, amt]) => ({ month, total: fmt(amt) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      success: true,
      message: `Monthly trend across ${trend.length} month(s).`,
      stats: { trend, months },
      count: trend.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute monthly trend." };
  }
};

// ================================================================
// 14. EXPENSE BREAKDOWN BY CATEGORY (pie chart)
// ================================================================
export const getExpenseBreakdownByCategoryService = async (
  schoolId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<ExpenseResponse> => {
  try {
    const summaryResult = await getExpenseSummaryService(schoolId, opts);
    if (!summaryResult.success || !summaryResult.summary) return summaryResult;

    const { byCategory, totalExpenses } = summaryResult.summary;
    const total = Number(totalExpenses);

    const breakdown = Object.entries(byCategory)
      .map(([category, amount]) => {
        const amt = Number(amount);
        const percentage = total === 0 ? "0.00" : fmt((amt / total) * 100);
        return { category, amount, percentage };
      })
      .sort((a, b) => Number(b.amount) - Number(a.amount));

    return {
      success: true,
      message: `Breakdown across ${breakdown.length} categor${breakdown.length === 1 ? "y" : "ies"}.`,
      stats: { total: totalExpenses, breakdown },
      count: breakdown.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute breakdown." };
  }
};

// ================================================================
// 15. TOP EXPENSE CATEGORIES
// ================================================================
export const getTopExpenseCategoriesService = async (
  schoolId: string,
  limit: number = 5
): Promise<ExpenseResponse> => {
  try {
    const breakdownResult = await getExpenseBreakdownByCategoryService(schoolId);
    if (!breakdownResult.success || !breakdownResult.stats) return breakdownResult;

    const top = (breakdownResult.stats.breakdown as any[]).slice(0, limit);

    return {
      success: true,
      message: `Top ${top.length} expense categor${top.length === 1 ? "y" : "ies"}.`,
      stats: { top },
      count: top.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute top categories." };
  }
};

// ================================================================
// 16. EXPENSE VS FEE COMPARISON
// ================================================================
export const getExpenseVsFeeComparisonService = async (
  schoolId: string,
  opts?: { fromDate?: string; toDate?: string }
): Promise<ExpenseResponse> => {
  try {
    const expenseSummary = await getExpenseSummaryService(schoolId, opts);
    if (!expenseSummary.success || !expenseSummary.summary)
      return { success: false, message: "Failed to fetch expense summary." };
    const totalExpenses = Number(expenseSummary.summary.totalExpenses);

    const invoices = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        ne(studentInvoices.status, "Cancelled")
      ),
    });
    const payments = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.status, "Completed")
      ),
    });

    const totalBilled = invoices.reduce(
      (s, i) => s + Number(i.totalAmount) - Number(i.discountAmount),
      0
    );
    const totalCollected = payments.reduce((s, p) => s + Number(p.amountPaid), 0);
    const netPosition = totalCollected - totalExpenses;
    const collectionRate = totalBilled === 0 ? "0.00" : fmt((totalCollected / totalBilled) * 100);

    return {
      success: true,
      message: `Collected ${fmt(totalCollected)}, spent ${fmt(totalExpenses)}, net ${fmt(netPosition)}.`,
      comparison: {
        billed: fmt(totalBilled),
        collected: fmt(totalCollected),
        totalExpenses: fmt(totalExpenses),
        netPosition: fmt(netPosition),
        collectionRate,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute comparison." };
  }
};