// src/services/expenses/expenses.route.ts
import { Router } from "express";
import {
  createExpenseController,
  bulkCreateExpensesController,
  getExpenseByIdController,
  updateExpenseController,
  approveExpenseController,
  revokeApprovalController,
  deleteExpenseController,
  listExpensesForSchoolController,
  listExpensesByCategoryController,
  listExpensesByDateRangeController,
  listPendingApprovalExpensesController,
  getExpenseSummaryController,
  getMonthlyExpensesController,
  getExpenseBreakdownByCategoryController,
  getTopExpenseCategoriesController,
  getExpenseVsFeeComparisonController,
} from "./expenses.controller";
import {
  adminAuth,
  adminOrTeacherAuth,
  superAdminAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const expensesRouter = Router();

// ================================================================
// RECORDING
// ================================================================

expensesRouter.post("/", adminAuth, createExpenseController);
expensesRouter.post("/bulk", adminAuth, bulkCreateExpensesController);

// ================================================================
// SCHOOL-LEVEL READS — static prefixes first
// ================================================================

expensesRouter.get(
  "/school/:schoolId",
  anyAuthenticatedUser,
  listExpensesForSchoolController
);
expensesRouter.get(
  "/school/:schoolId/by-date-range",
  anyAuthenticatedUser,
  listExpensesByDateRangeController
);
expensesRouter.get(
  "/school/:schoolId/pending-approval",
  anyAuthenticatedUser,
  listPendingApprovalExpensesController
);

// Analytics — must come before "/school/:schoolId/category/:category"
expensesRouter.get(
  "/school/:schoolId/summary",
  anyAuthenticatedUser,
  getExpenseSummaryController
);
expensesRouter.get(
  "/school/:schoolId/monthly-trend",
  anyAuthenticatedUser,
  getMonthlyExpensesController
);
expensesRouter.get(
  "/school/:schoolId/category-breakdown",
  anyAuthenticatedUser,
  getExpenseBreakdownByCategoryController
);
expensesRouter.get(
  "/school/:schoolId/top-categories",
  anyAuthenticatedUser,
  getTopExpenseCategoriesController
);
expensesRouter.get(
  "/school/:schoolId/fee-comparison",
  anyAuthenticatedUser,
  getExpenseVsFeeComparisonController
);

// Category filter — LAST within the /school/:schoolId group
expensesRouter.get(
  "/school/:schoolId/category/:category",
  anyAuthenticatedUser,
  listExpensesByCategoryController
);

// ================================================================
// PER-EXPENSE MUTATIONS
// ================================================================

expensesRouter.patch(
  "/:expenseId/approve",
  adminAuth,
  approveExpenseController
);
expensesRouter.patch(
  "/:expenseId/revoke-approval",
  adminAuth,
  revokeApprovalController
);
expensesRouter.put("/:expenseId", adminAuth, updateExpenseController);
expensesRouter.delete(
  "/:expenseId",
  superAdminAuth,
  deleteExpenseController
);

// ================================================================
// GENERIC LOOKUP — LAST
// ================================================================

expensesRouter.get(
  "/:expenseId",
  anyAuthenticatedUser,
  getExpenseByIdController
);

export default expensesRouter;