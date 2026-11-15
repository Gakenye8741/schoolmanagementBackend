// src/services/expenses/expenses.controller.ts
import { Request, Response } from "express";
import {
  createExpenseService,
  bulkCreateExpensesService,
  getExpenseByIdService,
  updateExpenseService,
  approveExpenseService,
  revokeApprovalService,
  deleteExpenseService,
  listExpensesForSchoolService,
  listExpensesByCategoryService,
  listExpensesByDateRangeService,
  listPendingApprovalExpensesService,
  getExpenseSummaryService,
  getMonthlyExpensesService,
  getExpenseBreakdownByCategoryService,
  getTopExpenseCategoriesService,
  getExpenseVsFeeComparisonService,
} from "./expenses.service";
import {
  createExpenseSchema,
  bulkCreateExpensesSchema,
  updateExpenseSchema,
  listExpensesForSchoolSchema,
  listExpensesByDateRangeSchema,
  expenseSummaryQuerySchema,
  monthlyExpensesQuerySchema,
  topCategoriesQuerySchema,
  expenseIdParamSchema,
  schoolIdParamSchema,
  categoryParamSchema,
} from "../../validators/expenses.validator";

const getUserId = (req: Request): string | undefined =>
  (req as any).user?.id as string | undefined;

// ================================================================
// RECORDING
// ================================================================

/** 1. Create expense. */
export const createExpenseController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to record an expense." });
      return;
    }
    const v = createExpenseSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't record the expense — check the highlighted fields.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await createExpenseService({ ...v.data, recordedBy: userId } as any);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't record the expense — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while recording the expense.",
    });
  }
};

/** 2. Bulk create expenses. */
export const bulkCreateExpensesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to record expenses." });
      return;
    }
    const v = bulkCreateExpensesSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't record the expenses — check the highlighted fields.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await bulkCreateExpensesService({ ...v.data, recordedBy: userId } as any);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't record the expenses — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while recording expenses.",
    });
  }
};

// ================================================================
// READS
// ================================================================

/** 3. Get expense by ID. */
export const getExpenseByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = expenseIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid expense ID.", errors: p.error.format() });
      return;
    }
    const result = await getExpenseByIdService(p.data.expenseId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Expense retrieved." : "We couldn't find that expense.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the expense.",
    });
  }
};

/** 4. List expenses for a school (with filters). */
export const listExpensesForSchoolController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = listExpensesForSchoolSchema.safeParse(req.query);
    const opts = q.success ? q.data : undefined;
    const result = await listExpensesForSchoolService(p.data.schoolId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} expense(s).`
        : `We couldn't list expenses — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing expenses.",
    });
  }
};

/** 5. List expenses by category. */
export const listExpensesByCategoryController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    const c = categoryParamSchema.safeParse(req.params);
    if (!p.success || !c.success) {
      res.status(400).json({ success: false, message: "Invalid school ID or category." });
      return;
    }
    const result = await listExpensesByCategoryService(p.data.schoolId, c.data.category);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} ${c.data.category} expense(s).`
        : `We couldn't list expenses — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing expenses.",
    });
  }
};

/** 6. List expenses by date range. */
export const listExpensesByDateRangeController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = listExpensesByDateRangeSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({
        success: false,
        message: "Provide a valid fromDate and toDate.",
        errors: q.error.format(),
      });
      return;
    }
    const result = await listExpensesByDateRangeService(
      p.data.schoolId,
      q.data.fromDate,
      q.data.toDate
    );
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} expense(s) in the date range.`
        : `We couldn't list expenses — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing expenses.",
    });
  }
};

/** 7. List pending approval expenses. */
export const listPendingApprovalExpensesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await listPendingApprovalExpensesService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.count === 0
          ? "No expenses are awaiting approval."
          : `${result.count} expense(s) awaiting approval.`
        : `We couldn't list pending expenses — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing pending expenses.",
    });
  }
};

// ================================================================
// UPDATES & APPROVAL
// ================================================================

/** 8. Update expense. */
export const updateExpenseController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = expenseIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid expense ID.", errors: p.error.format() });
      return;
    }
    const v = updateExpenseSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields and try again.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await updateExpenseService(p.data.expenseId, v.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Expense updated."
        : `We couldn't update the expense — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the expense.",
    });
  }
};

/** 9. Approve expense. */
export const approveExpenseController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to approve expenses." });
      return;
    }
    const p = expenseIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid expense ID.", errors: p.error.format() });
      return;
    }
    const result = await approveExpenseService(p.data.expenseId, userId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Expense approved."
        : `We couldn't approve the expense — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while approving the expense.",
    });
  }
};

/** 10. Revoke approval. */
export const revokeApprovalController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = expenseIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid expense ID.", errors: p.error.format() });
      return;
    }
    const result = await revokeApprovalService(p.data.expenseId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Approval revoked — expense is pending again."
        : `We couldn't revoke approval — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while revoking approval.",
    });
  }
};

/** 11. Delete expense. */
export const deleteExpenseController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = expenseIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid expense ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteExpenseService(p.data.expenseId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Expense deleted." : "We couldn't find that expense.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the expense.",
    });
  }
};

// ================================================================
// ANALYTICS
// ================================================================

/** 12. Expense summary. */
export const getExpenseSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = expenseSummaryQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await getExpenseSummaryService(p.data.schoolId, opts);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute the summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the summary.",
    });
  }
};

/** 13. Monthly expenses trend. */
export const getMonthlyExpensesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = monthlyExpensesQuerySchema.safeParse(req.query);
    const months = q.success ? q.data.months : 6;
    const result = await getMonthlyExpensesService(p.data.schoolId, months);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute the monthly trend — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the monthly trend.",
    });
  }
};

/** 14. Expense breakdown by category. */
export const getExpenseBreakdownByCategoryController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = expenseSummaryQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await getExpenseBreakdownByCategoryService(p.data.schoolId, opts);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute the breakdown — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the breakdown.",
    });
  }
};

/** 15. Top expense categories. */
export const getTopExpenseCategoriesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = topCategoriesQuerySchema.safeParse(req.query);
    const limit = q.success ? q.data.limit : 5;
    const result = await getTopExpenseCategoriesService(p.data.schoolId, limit);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute the top categories — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the top categories.",
    });
  }
};

/** 16. Expense vs fee comparison (money in vs money out). */
export const getExpenseVsFeeComparisonController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = expenseSummaryQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await getExpenseVsFeeComparisonService(p.data.schoolId, opts);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute the comparison — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the comparison.",
    });
  }
};