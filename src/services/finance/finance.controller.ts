// controllers/fees.controller.ts
import { Request, Response } from "express";
import {
  createFeeItemService,
  getFeeItemByIdService,
  listFeeItemsService,
  listMandatoryFeeItemsService,
  listOptionalFeeItemsService,
  searchFeeItemsService,
  updateFeeItemService,
  deleteFeeItemService,
  countFeeItemsService,
  bulkCreateFeeItemsService,
  createFeeStructureService,
  getFeeStructureByIdService,
  listFeeStructuresByTermService,
  listFeeStructuresByBoardingStatusService,
  listFeeStructuresByGradeService,
  resolveFeesForClassService,
  updateFeeStructureService,
  deleteFeeStructureService,
  bulkUpsertFeeStructureService,
  copyFeeStructureService,
  validateFeeStructureService,
  getClassTotalFeeService,
  generateInvoiceForStudentService,
  generateInvoicesForClassService,
  generateInvoicesForGradeLevelService,
  generateInvoicesForSchoolService,
  getInvoiceByIdService,
  listInvoicesForStudentService,
  listInvoicesForTermService,
  listInvoicesByStatusService,
  updateInvoiceStatusService,
  waiveInvoiceService,
  cancelInvoiceService,
  applyDiscountToInvoiceService,
  deleteInvoiceService,
  markOverdueInvoicesService,
  recordPaymentService,
  getTransactionByIdService,
  listTransactionsForStudentService,
  listTransactionsForInvoiceService,
  listTransactionsForTermService,
  listTransactionsByMethodService,
  reversePaymentService,
  deleteTransactionService,
  getStudentBalanceService,
  getStudentStatementService,
  listDefaultersService,
  listClearedStudentsService,
  getTermFinancialSummaryService,
  getCollectionsByMethodService,
  getCollectionsByBoardingStatusService,
  getCollectionsByGradeService,
  getAgingReportService,
  getDailyCollectionsService,
  getCollectionTrendService,
  getExpectedVsCollectedService,
  listMpesaPendingPaymentsService,
  findPaymentByMpesaCheckoutService,
  recomputeInvoiceStatusesService,
  getFeeDashboardService,
} from "./finance.service";
import {
  createFeeItemSchema,
  updateFeeItemSchema,
  bulkCreateFeeItemsSchema,
  searchFeeItemsSchema,
  createFeeStructureSchema,
  updateFeeStructureSchema,
  bulkUpsertFeeStructureSchema,
  copyFeeStructureSchema,
  listFeeStructuresByBoardingStatusSchema,
  listFeeStructuresByGradeSchema,
  resolveFeesForClassSchema,
  getClassTotalFeeSchema,
  generateInvoiceForStudentSchema,
  generateInvoicesForClassSchema,
  generateInvoicesForGradeLevelSchema,
  generateInvoicesForSchoolSchema,
  updateInvoiceStatusSchema,
  waiveInvoiceSchema,
  cancelInvoiceSchema,
  applyDiscountToInvoiceSchema,
  listInvoicesByStatusSchema,
  recordPaymentSchema,
  reversePaymentSchema,
  listTransactionsForTermSchema,
  listTransactionsByMethodSchema,
  listDefaultersSchema,
  findPaymentByMpesaCheckoutSchema,
  getDailyCollectionsSchema,
  getCollectionTrendSchema,
  feeItemIdParamSchema,
  feeStructureIdParamSchema,
  invoiceIdParamSchema,
  transactionIdParamSchema,
  termIdParamSchema,
  schoolIdParamSchema,
  studentIdParamSchema,
  classIdParamSchema,
  gradeLevelIdParamSchema,
} from "../../validators/finance.validator";

// Get user ID from the authenticated request (populated by bearAuth)
const getUserId = (req: Request): string | undefined =>
  (req as any).user?.id as string | undefined;

// ================================================================
// FEE ITEMS (1–10)
// ================================================================

// 1. Create fee item
export const createFeeItemController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createFeeItemSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the fee item — check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await createFeeItemService(validation.data);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Fee item created successfully."
        : `We couldn't create the fee item — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the fee item. Please try again.",
    });
  }
};

// 2. Get fee item by ID
export const getFeeItemByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = feeItemIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid fee item ID.", errors: p.error.format() });
      return;
    }
    const result = await getFeeItemByIdService(p.data.feeItemId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Fee item retrieved successfully." : "We couldn't find that fee item.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the fee item. Please try again.",
    });
  }
};

// 3. List fee items
export const listFeeItemsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await listFeeItemsService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} fee item(s).`
        : `We couldn't list fee items — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing fee items. Please try again.",
    });
  }
};

// 4. List mandatory fee items
export const listMandatoryFeeItemsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await listMandatoryFeeItemsService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} mandatory fee item(s).`
        : `We couldn't list mandatory fee items — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing mandatory fee items. Please try again.",
    });
  }
};

// 5. List optional fee items
export const listOptionalFeeItemsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await listOptionalFeeItemsService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} optional fee item(s).`
        : `We couldn't list optional fee items — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing optional fee items. Please try again.",
    });
  }
};

// 6. Search fee items
export const searchFeeItemsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = searchFeeItemsSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ success: false, message: "Provide a valid search query.", errors: q.error.format() });
      return;
    }
    const result = await searchFeeItemsService(p.data.schoolId, q.data.query);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Found ${result.count ?? 0} fee item(s) matching "${q.data.query}".`
        : `We couldn't search fee items — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while searching fee items. Please try again.",
    });
  }
};

// 7. Update fee item
export const updateFeeItemController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = feeItemIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid fee item ID.", errors: p.error.format() });
      return;
    }
    const validation = updateFeeItemSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't update the fee item — check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await updateFeeItemService(p.data.feeItemId, validation.data);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Fee item updated successfully."
        : `We couldn't update the fee item — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the fee item. Please try again.",
    });
  }
};

// 8. Delete fee item
export const deleteFeeItemController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = feeItemIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid fee item ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteFeeItemService(p.data.feeItemId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Fee item deleted."
        : result.message.startsWith("Cannot delete")
        ? "This fee item can't be deleted because it's used in fee structures or invoices."
        : "We couldn't find that fee item.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the fee item. Please try again.",
    });
  }
};

// 9. Count fee items
export const countFeeItemsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await countFeeItemsService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `This school has ${result.count ?? 0} fee item(s).`
        : `We couldn't count fee items — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while counting fee items. Please try again.",
    });
  }
};

// 10. Bulk create fee items
export const bulkCreateFeeItemsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = bulkCreateFeeItemsSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the fee items — check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await bulkCreateFeeItemsService(validation.data.schoolId, validation.data.items);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Created ${result.count ?? 0} fee item(s).`
        : `We couldn't create the fee items — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong during bulk fee item creation. Please try again.",
    });
  }
};

// ================================================================
// FEE STRUCTURES (11–22)
// ================================================================

// 11. Create fee structure
export const createFeeStructureController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createFeeStructureSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the fee structure — check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await createFeeStructureService(validation.data);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Fee structure created successfully."
        : `We couldn't create the fee structure — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the fee structure. Please try again.",
    });
  }
};

// 12. Get fee structure by ID
export const getFeeStructureByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = feeStructureIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid fee structure ID.", errors: p.error.format() });
      return;
    }
    const result = await getFeeStructureByIdService(p.data.feeStructureId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Fee structure retrieved." : "We couldn't find that fee structure.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the fee structure. Please try again.",
    });
  }
};

// 13. List fee structures by term
export const listFeeStructuresByTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await listFeeStructuresByTermService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} fee structure row(s).`
        : `We couldn't list fee structures — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing fee structures. Please try again.",
    });
  }
};

// 14. List fee structures by boarding status
export const listFeeStructuresByBoardingStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    const q = listFeeStructuresByBoardingStatusSchema.safeParse(req.query);
    if (!s.success || !t.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school, term, or boarding status." });
      return;
    }
    const result = await listFeeStructuresByBoardingStatusService(s.data.schoolId, t.data.termId, q.data.boardingStatus);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} ${q.data.boardingStatus} fee structure row(s).`
        : `We couldn't list fee structures — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing fee structures. Please try again.",
    });
  }
};

// 15. List fee structures by grade
export const listFeeStructuresByGradeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    const q = listFeeStructuresByGradeSchema.safeParse(req.query);
    if (!s.success || !t.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school, term, grade, or boarding status." });
      return;
    }
    const result = await listFeeStructuresByGradeService(
      s.data.schoolId, t.data.termId, q.data.gradeLevelId, q.data.boardingStatus
    );
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't resolve fees — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while resolving fees. Please try again.",
    });
  }
};

// 16. Resolve fees for a class
export const resolveFeesForClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    const q = resolveFeesForClassSchema.safeParse(req.query);
    if (!s.success || !t.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school, term, class, or boarding status." });
      return;
    }
    const result = await resolveFeesForClassService(
      s.data.schoolId, t.data.termId, q.data.classId, q.data.boardingStatus
    );
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't resolve fees — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while resolving fees. Please try again.",
    });
  }
};

// 17. Update fee structure
export const updateFeeStructureController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = feeStructureIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid fee structure ID.", errors: p.error.format() });
      return;
    }
    const validation = updateFeeStructureSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, message: "Provide a valid amount.", errors: validation.error.format() });
      return;
    }
    const result = await updateFeeStructureService(p.data.feeStructureId, validation.data.amount);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Fee structure updated."
        : `We couldn't update the fee structure — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the fee structure. Please try again.",
    });
  }
};

// 18. Delete fee structure
export const deleteFeeStructureController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = feeStructureIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid fee structure ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteFeeStructureService(p.data.feeStructureId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Fee structure deleted." : "We couldn't find that fee structure.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the fee structure. Please try again.",
    });
  }
};

// 19. Bulk upsert fee structure
export const bulkUpsertFeeStructureController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = bulkUpsertFeeStructureSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't upsert the fee structure — check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await bulkUpsertFeeStructureService(validation.data);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't upsert the fee structure — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while upserting the fee structure. Please try again.",
    });
  }
};

// 20. Copy fee structure
export const copyFeeStructureController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = copyFeeStructureSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Provide valid source and target terms (they must be different).",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await copyFeeStructureService(
      validation.data.schoolId, validation.data.fromTermId, validation.data.toTermId
    );
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't copy the fee structure — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while copying the fee structure. Please try again.",
    });
  }
};

// 21. Validate fee structure completeness
export const validateFeeStructureController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await validateFeeStructureService(s.data.schoolId, t.data.termId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : result.issues?.length
        ? `${result.issues.length} gap(s) found in fee structure.`
        : `We couldn't validate the fee structure — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while validating the fee structure. Please try again.",
    });
  }
};

// 22. Get class total fee
export const getClassTotalFeeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    const q = getClassTotalFeeSchema.safeParse(req.query);
    if (!s.success || !t.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school, term, class, or boarding status." });
      return;
    }
    const result = await getClassTotalFeeService(
      s.data.schoolId, t.data.termId, q.data.classId, q.data.boardingStatus
    );
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute class total — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing class total. Please try again.",
    });
  }
};

// ================================================================
// INVOICES (23–36)
// ================================================================

// 23. Generate invoice for a student
export const generateInvoiceForStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = generateInvoiceForStudentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't generate the invoice — check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await generateInvoiceForStudentService(validation.data);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't generate the invoice — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while generating the invoice. Please try again.",
    });
  }
};

// 24. Generate invoices for a class
export const generateInvoicesForClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = generateInvoicesForClassSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await generateInvoicesForClassService(validation.data);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success ? result.message : `We couldn't generate invoices — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while generating class invoices. Please try again.",
    });
  }
};

// 25. Generate invoices for a grade level
export const generateInvoicesForGradeLevelController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = generateInvoicesForGradeLevelSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await generateInvoicesForGradeLevelService(validation.data);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success ? result.message : `We couldn't generate invoices — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while generating grade-level invoices. Please try again.",
    });
  }
};

// 26. Generate invoices for the whole school
export const generateInvoicesForSchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = generateInvoicesForSchoolSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await generateInvoicesForSchoolService(validation.data);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success ? result.message : `We couldn't generate invoices — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while generating school invoices. Please try again.",
    });
  }
};

// 27. Get invoice by ID
export const getInvoiceByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = invoiceIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid invoice ID.", errors: p.error.format() });
      return;
    }
    const result = await getInvoiceByIdService(p.data.invoiceId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Invoice retrieved." : "We couldn't find that invoice.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the invoice. Please try again.",
    });
  }
};

// 28. List invoices for a student
export const listInvoicesForStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const st = studentIdParamSchema.safeParse(req.params);
    if (!s.success || !st.success) {
      res.status(400).json({ success: false, message: "Invalid school or student ID." });
      return;
    }
    const result = await listInvoicesForStudentService(s.data.schoolId, st.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} invoice(s).`
        : `We couldn't list invoices — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing invoices. Please try again.",
    });
  }
};

// 29. List invoices for a term
export const listInvoicesForTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await listInvoicesForTermService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} invoice(s).`
        : `We couldn't list invoices — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing invoices. Please try again.",
    });
  }
};

// 30. List invoices by status
export const listInvoicesByStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const q = listInvoicesByStatusSchema.safeParse(req.query);
    if (!s.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school ID or invoice status." });
      return;
    }
    const result = await listInvoicesByStatusService(s.data.schoolId, q.data.status, { termId: q.data.termId });
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} ${q.data.status} invoice(s).`
        : `We couldn't list invoices — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing invoices. Please try again.",
    });
  }
};

// 31. Update invoice status
export const updateInvoiceStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = invoiceIdParamSchema.safeParse(req.params);
    const validation = updateInvoiceStatusSchema.safeParse(req.body);
    if (!p.success || !validation.success) {
      res.status(400).json({ success: false, message: "Invalid invoice ID or status." });
      return;
    }
    const result = await updateInvoiceStatusService(p.data.invoiceId, validation.data.status);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? `Invoice status set to ${validation.data.status}.`
        : `We couldn't update the invoice status — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the invoice status. Please try again.",
    });
  }
};

// 32. Waive invoice
export const waiveInvoiceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = invoiceIdParamSchema.safeParse(req.params);
    const validation = waiveInvoiceSchema.safeParse(req.body);
    if (!p.success || !validation.success) {
      res.status(400).json({ success: false, message: "Provide a valid invoice ID and waiver reason." });
      return;
    }
    const result = await waiveInvoiceService(p.data.invoiceId, validation.data.reason);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Invoice waived." : `We couldn't waive the invoice — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while waiving the invoice. Please try again.",
    });
  }
};

// 33. Cancel invoice
export const cancelInvoiceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = invoiceIdParamSchema.safeParse(req.params);
    const validation = cancelInvoiceSchema.safeParse(req.body);
    if (!p.success || !validation.success) {
      res.status(400).json({ success: false, message: "Provide a valid invoice ID and cancellation reason." });
      return;
    }
    const result = await cancelInvoiceService(p.data.invoiceId, validation.data.reason);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Invoice cancelled." : `We couldn't cancel the invoice — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while cancelling the invoice. Please try again.",
    });
  }
};

// 34. Apply discount to invoice
export const applyDiscountToInvoiceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = invoiceIdParamSchema.safeParse(req.params);
    const validation = applyDiscountToInvoiceSchema.safeParse(req.body);
    if (!p.success || !validation.success) {
      res.status(400).json({ success: false, message: "Provide a valid invoice ID and discount amount." });
      return;
    }
    const result = await applyDiscountToInvoiceService(p.data.invoiceId, validation.data.discount);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Discount applied." : `We couldn't apply the discount — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while applying the discount. Please try again.",
    });
  }
};

// 35. Delete invoice
export const deleteInvoiceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = invoiceIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid invoice ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteInvoiceService(p.data.invoiceId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Invoice deleted."
        : result.message.startsWith("Cannot delete")
        ? "This invoice can't be deleted because it has payments. Cancel it instead."
        : "We couldn't find that invoice.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the invoice. Please try again.",
    });
  }
};

// 36. Mark overdue invoices
export const markOverdueInvoicesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await markOverdueInvoicesService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Marked ${result.count ?? 0} invoice(s) as overdue.`
        : `We couldn't mark overdue invoices — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while marking overdue invoices. Please try again.",
    });
  }
};

// ================================================================
// PAYMENTS (37–48)
// ================================================================

// 37. Record payment
export const recordPaymentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to record a payment." });
      return;
    }
    const validation = recordPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't record the payment — check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await recordPaymentService(validation.data, userId);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success ? result.message : `We couldn't record the payment — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while recording the payment. Please try again.",
    });
  }
};

// 38. Get transaction by ID
export const getTransactionByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = transactionIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid transaction ID.", errors: p.error.format() });
      return;
    }
    const result = await getTransactionByIdService(p.data.transactionId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Transaction retrieved." : "We couldn't find that transaction.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the transaction. Please try again.",
    });
  }
};

// 39. List transactions for a student
export const listTransactionsForStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const st = studentIdParamSchema.safeParse(req.params);
    if (!s.success || !st.success) {
      res.status(400).json({ success: false, message: "Invalid school or student ID." });
      return;
    }
    const result = await listTransactionsForStudentService(s.data.schoolId, st.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} transaction(s).`
        : `We couldn't list transactions — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing transactions. Please try again.",
    });
  }
};

// 40. List transactions for an invoice
export const listTransactionsForInvoiceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = invoiceIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid invoice ID.", errors: p.error.format() });
      return;
    }
    const result = await listTransactionsForInvoiceService(p.data.invoiceId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} transaction(s).`
        : `We couldn't list transactions — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing transactions. Please try again.",
    });
  }
};

// 41. List transactions for a term
export const listTransactionsForTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    const q = listTransactionsForTermSchema.safeParse(req.query);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await listTransactionsForTermService(s.data.schoolId, t.data.termId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} transaction(s).`
        : `We couldn't list transactions — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing transactions. Please try again.",
    });
  }
};

// 42. List transactions by payment method
export const listTransactionsByMethodController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const q = listTransactionsByMethodSchema.safeParse(req.query);
    if (!s.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school ID or payment method." });
      return;
    }
    const result = await listTransactionsByMethodService(s.data.schoolId, q.data.method);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} ${q.data.method} transaction(s).`
        : `We couldn't list transactions — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing transactions. Please try again.",
    });
  }
};

// 43. Reverse payment
export const reversePaymentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to reverse a payment." });
      return;
    }
    const p = transactionIdParamSchema.safeParse(req.params);
    const validation = reversePaymentSchema.safeParse(req.body);
    if (!p.success || !validation.success) {
      res.status(400).json({ success: false, message: "Provide a valid transaction ID and reversal reason." });
      return;
    }
    const result = await reversePaymentService(p.data.transactionId, validation.data, userId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Payment reversed." : `We couldn't reverse the payment — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while reversing the payment. Please try again.",
    });
  }
};

// 44. Delete transaction
export const deleteTransactionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = transactionIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid transaction ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteTransactionService(p.data.transactionId);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json({
      ...result,
      message: result.success
        ? "Transaction deleted."
        : result.message.startsWith("Cannot delete")
        ? "Completed transactions can't be deleted — reverse it instead."
        : "We couldn't find that transaction.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the transaction. Please try again.",
    });
  }
};

// 45. Get student balance
export const getStudentBalanceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const st = studentIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !st.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school, student, or term ID." });
      return;
    }
    const result = await getStudentBalanceService(s.data.schoolId, st.data.studentId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute balance — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing balance. Please try again.",
    });
  }
};

// 46. Get student statement
export const getStudentStatementController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const st = studentIdParamSchema.safeParse(req.params);
    if (!s.success || !st.success) {
      res.status(400).json({ success: false, message: "Invalid school or student ID." });
      return;
    }
    const result = await getStudentStatementService(s.data.schoolId, st.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't build the statement — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the statement. Please try again.",
    });
  }
};

// 47. List defaulters
export const listDefaultersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    const q = listDefaultersSchema.safeParse(req.query);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const opts = q.success ? { minBalance: q.data.minBalance } : undefined;
    const result = await listDefaultersService(s.data.schoolId, t.data.termId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute defaulters — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing defaulters. Please try again.",
    });
  }
};

// 48. List cleared students
export const listClearedStudentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await listClearedStudentsService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't compute cleared students — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing cleared students. Please try again.",
    });
  }
};

// ================================================================
// ANALYTICS (49–60)
// ================================================================

// 49. Term financial summary
export const getTermFinancialSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await getTermFinancialSummaryService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the summary. Please try again.",
    });
  }
};

// 50. Collections by method
export const getCollectionsByMethodController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await getCollectionsByMethodService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute collections — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing collections. Please try again.",
    });
  }
};

// 51. Collections by boarding status
export const getCollectionsByBoardingStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await getCollectionsByBoardingStatusService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute collections — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing collections. Please try again.",
    });
  }
};

// 52. Collections by grade
export const getCollectionsByGradeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await getCollectionsByGradeService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute collections — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing collections. Please try again.",
    });
  }
};

// 53. Aging report
export const getAgingReportController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await getAgingReportService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute aging report — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing the aging report. Please try again.",
    });
  }
};

// 54. Daily collections
export const getDailyCollectionsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const q = getDailyCollectionsSchema.safeParse(req.query);
    if (!s.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school ID or date." });
      return;
    }
    const result = await getDailyCollectionsService(s.data.schoolId, q.data.date);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute daily collections — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing daily collections. Please try again.",
    });
  }
};

// 55. Collection trend
export const getCollectionTrendController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const q = getCollectionTrendSchema.safeParse(req.query);
    if (!s.success) {
      res.status(400).json({ success: false, message: "Invalid school ID." });
      return;
    }
    const days = q.success ? q.data.days : 30;
    const result = await getCollectionTrendService(s.data.schoolId, days);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't build the trend — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the trend. Please try again.",
    });
  }
};

// 56. Expected vs collected
export const getExpectedVsCollectedController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await getExpectedVsCollectedService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute expected vs collected — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing expected vs collected. Please try again.",
    });
  }
};

// 57. List M-Pesa pending payments
export const listMpesaPendingPaymentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    if (!s.success) {
      res.status(400).json({ success: false, message: "Invalid school ID." });
      return;
    }
    const result = await listMpesaPendingPaymentsService(s.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't list pending M-Pesa payments — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing pending payments. Please try again.",
    });
  }
};

// 58. Find payment by M-Pesa checkout
export const findPaymentByMpesaCheckoutController = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = findPaymentByMpesaCheckoutSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ success: false, message: "checkoutRequestId is required." });
      return;
    }
    const result = await findPaymentByMpesaCheckoutService(q.data.checkoutRequestId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json({
      ...result,
      message: result.success ? "Payment found." : "No payment found for that M-Pesa checkout ID.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while looking up the payment. Please try again.",
    });
  }
};

// 59. Recompute invoice statuses
export const recomputeInvoiceStatusesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await recomputeInvoiceStatusesService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't recompute invoice statuses — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while recomputing invoice statuses. Please try again.",
    });
  }
};

// 60. Fee dashboard
export const getFeeDashboardController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await getFeeDashboardService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success ? "Fee dashboard computed." : `We couldn't build the dashboard — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the dashboard. Please try again.",
    });
  }
};