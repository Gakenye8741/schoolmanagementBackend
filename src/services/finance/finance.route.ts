// routes/fees.router.ts
import { Router } from "express";
import {
  // Fee items
  createFeeItemController,
  getFeeItemByIdController,
  listFeeItemsController,
  listMandatoryFeeItemsController,
  listOptionalFeeItemsController,
  searchFeeItemsController,
  updateFeeItemController,
  deleteFeeItemController,
  countFeeItemsController,
  bulkCreateFeeItemsController,
  // Fee structures
  createFeeStructureController,
  getFeeStructureByIdController,
  listFeeStructuresByTermController,
  listFeeStructuresByBoardingStatusController,
  listFeeStructuresByGradeController,
  resolveFeesForClassController,
  updateFeeStructureController,
  deleteFeeStructureController,
  bulkUpsertFeeStructureController,
  copyFeeStructureController,
  validateFeeStructureController,
  getClassTotalFeeController,
  // Invoices
  generateInvoiceForStudentController,
  generateInvoicesForClassController,
  generateInvoicesForGradeLevelController,
  generateInvoicesForSchoolController,
  getInvoiceByIdController,
  listInvoicesForStudentController,
  listInvoicesForTermController,
  listInvoicesByStatusController,
  updateInvoiceStatusController,
  waiveInvoiceController,
  cancelInvoiceController,
  applyDiscountToInvoiceController,
  deleteInvoiceController,
  markOverdueInvoicesController,
  // Payments
  recordPaymentController,
  getTransactionByIdController,
  listTransactionsForStudentController,
  listTransactionsForInvoiceController,
  listTransactionsForTermController,
  listTransactionsByMethodController,
  reversePaymentController,
  deleteTransactionController,
  getStudentBalanceController,
  getStudentStatementController,
  listDefaultersController,
  listClearedStudentsController,
  // Analytics
  getTermFinancialSummaryController,
  getCollectionsByMethodController,
  getCollectionsByBoardingStatusController,
  getCollectionsByGradeController,
  getAgingReportController,
  getDailyCollectionsController,
  getCollectionTrendController,
  getExpectedVsCollectedController,
  listMpesaPendingPaymentsController,
  findPaymentByMpesaCheckoutController,
  recomputeInvoiceStatusesController,
  getFeeDashboardController,
} from "./finance.controller";
import { adminAuth, adminOrTeacherAuth, anyAuthenticatedUser, superAdminAuth } from "../../middleware/bearAuth";

const feesRouter = Router();

// ================================================================
// FEE ITEMS
// ================================================================

// Static-prefix routes BEFORE "/:feeItemId"
feesRouter.post("/fee-items", adminAuth, createFeeItemController);
feesRouter.post("/fee-items/bulk", adminAuth, bulkCreateFeeItemsController);

feesRouter.get(
  "/fee-items/school/:schoolId",
  anyAuthenticatedUser,
  listFeeItemsController
);
feesRouter.get(
  "/fee-items/school/:schoolId/count",
  anyAuthenticatedUser,
  countFeeItemsController
);
feesRouter.get(
  "/fee-items/school/:schoolId/mandatory",
  anyAuthenticatedUser,
  listMandatoryFeeItemsController
);
feesRouter.get(
  "/fee-items/school/:schoolId/optional",
  anyAuthenticatedUser,
  listOptionalFeeItemsController
);
feesRouter.get(
  "/fee-items/school/:schoolId/search",
  anyAuthenticatedUser,
  searchFeeItemsController
);

feesRouter.put("/fee-items/:feeItemId", adminAuth, updateFeeItemController);
feesRouter.delete(
  "/fee-items/:feeItemId",
  superAdminAuth,
  deleteFeeItemController
);

// Generic lookup LAST
feesRouter.get(
  "/fee-items/:feeItemId",
  anyAuthenticatedUser,
  getFeeItemByIdController
);

// ================================================================
// FEE STRUCTURES
// ================================================================

feesRouter.post("/fee-structures", adminAuth, createFeeStructureController);
feesRouter.post(
  "/fee-structures/bulk-upsert",
  adminAuth,
  bulkUpsertFeeStructureController
);
feesRouter.post("/fee-structures/copy", adminAuth, copyFeeStructureController);

feesRouter.get(
  "/fee-structures/school/:schoolId/term/:termId",
  anyAuthenticatedUser,
  listFeeStructuresByTermController
);
feesRouter.get(
  "/fee-structures/school/:schoolId/term/:termId/by-boarding",
  anyAuthenticatedUser,
  listFeeStructuresByBoardingStatusController
);
feesRouter.get(
  "/fee-structures/school/:schoolId/term/:termId/by-grade",
  anyAuthenticatedUser,
  listFeeStructuresByGradeController
);
feesRouter.get(
  "/fee-structures/school/:schoolId/term/:termId/resolve-class",
  anyAuthenticatedUser,
  resolveFeesForClassController
);
feesRouter.get(
  "/fee-structures/school/:schoolId/term/:termId/class-total",
  anyAuthenticatedUser,
  getClassTotalFeeController
);
feesRouter.get(
  "/fee-structures/school/:schoolId/term/:termId/validate",
  anyAuthenticatedUser,
  validateFeeStructureController
);

feesRouter.put(
  "/fee-structures/:feeStructureId",
  adminAuth,
  updateFeeStructureController
);
feesRouter.delete(
  "/fee-structures/:feeStructureId",
  adminAuth,
  deleteFeeStructureController
);

// Generic lookup LAST
feesRouter.get(
  "/fee-structures/:feeStructureId",
  anyAuthenticatedUser,
  getFeeStructureByIdController
);

// ================================================================
// INVOICES
// ================================================================

// Static-prefix mutations first
feesRouter.post(
  "/invoices/generate/student",
  adminAuth,
  generateInvoiceForStudentController
);
feesRouter.post(
  "/invoices/generate/class",
  adminAuth,
  generateInvoicesForClassController
);
feesRouter.post(
  "/invoices/generate/grade-level",
  adminAuth,
  generateInvoicesForGradeLevelController
);
feesRouter.post(
  "/invoices/generate/school",
  adminAuth,
  generateInvoicesForSchoolController
);
feesRouter.post(
  "/invoices/mark-overdue/:schoolId",
  adminAuth,
  markOverdueInvoicesController
);

// Static-prefix reads
feesRouter.get(
  "/invoices/school/:schoolId/term/:termId",
  anyAuthenticatedUser,
  listInvoicesForTermController
);
feesRouter.get(
  "/invoices/school/:schoolId/status",
  anyAuthenticatedUser,
  listInvoicesByStatusController
);
feesRouter.get(
  "/invoices/school/:schoolId/student/:studentId",
  anyAuthenticatedUser,
  listInvoicesForStudentController
);

// Per-invoice mutations
feesRouter.patch(
  "/invoices/:invoiceId/status",
  adminAuth,
  updateInvoiceStatusController
);
feesRouter.post(
  "/invoices/:invoiceId/waive",
  adminAuth,
  waiveInvoiceController
);
feesRouter.post(
  "/invoices/:invoiceId/cancel",
  adminAuth,
  cancelInvoiceController
);
feesRouter.patch(
  "/invoices/:invoiceId/discount",
  adminAuth,
  applyDiscountToInvoiceController
);
feesRouter.delete(
  "/invoices/:invoiceId",
  superAdminAuth,
  deleteInvoiceController
);

// Generic lookup LAST
feesRouter.get(
  "/invoices/:invoiceId",
  anyAuthenticatedUser,
  getInvoiceByIdController
);

// ================================================================
// PAYMENTS
// ================================================================

// Static-prefix mutations first
feesRouter.post(
  "/payments/record",
  adminOrTeacherAuth,
  recordPaymentController
);
feesRouter.post(
  "/payments/:transactionId/reverse",
  adminAuth,
  reversePaymentController
);

// Static-prefix reads
feesRouter.get(
  "/payments/school/:schoolId/term/:termId",
  anyAuthenticatedUser,
  listTransactionsForTermController
);
feesRouter.get(
  "/payments/school/:schoolId/by-method",
  anyAuthenticatedUser,
  listTransactionsByMethodController
);
feesRouter.get(
  "/payments/school/:schoolId/student/:studentId",
  anyAuthenticatedUser,
  listTransactionsForStudentController
);
feesRouter.get(
  "/payments/school/:schoolId/mpesa-pending",
  anyAuthenticatedUser,
  listMpesaPendingPaymentsController
);
feesRouter.get(
  "/payments/school/:schoolId/mpesa-lookup",
  anyAuthenticatedUser,
  findPaymentByMpesaCheckoutController
);
feesRouter.get(
  "/payments/invoice/:invoiceId",
  anyAuthenticatedUser,
  listTransactionsForInvoiceController
);

// Per-transaction delete (only pending/failed — service guards)
feesRouter.delete(
  "/payments/:transactionId",
  superAdminAuth,
  deleteTransactionController
);

// Generic lookup LAST
feesRouter.get(
  "/payments/:transactionId",
  anyAuthenticatedUser,
  getTransactionByIdController
);

// ================================================================
// STUDENT BALANCE / STATEMENT
// ================================================================

feesRouter.get(
  "/students/:studentId/statement",
  anyAuthenticatedUser,
  getStudentStatementController
);
feesRouter.get(
  "/students/:studentId/balance",
  anyAuthenticatedUser,
  getStudentBalanceController
);

// ================================================================
// REPORTS & ANALYTICS
// ================================================================

// Static-prefix routes BEFORE generic ones
feesRouter.get(
  "/reports/school/:schoolId/term/:termId/summary",
  anyAuthenticatedUser,
  getTermFinancialSummaryController
);
feesRouter.get(
  "/reports/school/:schoolId/term/:termId/by-method",
  anyAuthenticatedUser,
  getCollectionsByMethodController
);
feesRouter.get(
  "/reports/school/:schoolId/term/:termId/by-boarding",
  anyAuthenticatedUser,
  getCollectionsByBoardingStatusController
);
feesRouter.get(
  "/reports/school/:schoolId/term/:termId/by-grade",
  anyAuthenticatedUser,
  getCollectionsByGradeController
);
feesRouter.get(
  "/reports/school/:schoolId/term/:termId/aging",
  anyAuthenticatedUser,
  getAgingReportController
);
feesRouter.get(
  "/reports/school/:schoolId/term/:termId/defaulters",
  anyAuthenticatedUser,
  listDefaultersController
);
feesRouter.get(
  "/reports/school/:schoolId/term/:termId/cleared",
  anyAuthenticatedUser,
  listClearedStudentsController
);
feesRouter.get(
  "/reports/school/:schoolId/term/:termId/expected-vs-collected",
  anyAuthenticatedUser,
  getExpectedVsCollectedController
);
feesRouter.get(
  "/reports/school/:schoolId/term/:termId/dashboard",
  anyAuthenticatedUser,
  getFeeDashboardController
);
feesRouter.get(
  "/reports/school/:schoolId/daily",
  anyAuthenticatedUser,
  getDailyCollectionsController
);
feesRouter.get(
  "/reports/school/:schoolId/trend",
  anyAuthenticatedUser,
  getCollectionTrendController
);
feesRouter.post(
  "/reports/school/:schoolId/term/:termId/recompute-invoices",
  adminAuth,
  recomputeInvoiceStatusesController
);

export default feesRouter;