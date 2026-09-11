import { Request, Response } from "express";
import { 
  createFeeItemService,
  getFeeItemByIdService,
  getFeeItemsBySchoolService,
  updateFeeItemService,
  deleteFeeItemService,
  createClassFeeStructureService,
  getClassFeeStructuresService,
  updateClassFeeStructureService,
  deleteClassFeeStructureService,
  recordFeeTransactionService,
  updateFeeTransactionService,
  deleteFeeTransactionService,
  getStudentFeeTransactionsService,
  getSchoolFeeTransactionsService,
  getStudentFeeStatementService,
  getSchoolTermCollectionSummaryService
} from "./finance.service";
import { 
  createFeeItemSchema,
  updateFeeItemSchema,
  createClassFeeStructureSchema,
  updateClassFeeStructureSchema,
  createFeeTransactionSchema,
  updateFeeTransactionSchema
} from "../../validators/finance.validator";

/**
 * Fee Item Controllers
 */

export const createFeeItemController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createFeeItemSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed for fee item creation.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createFeeItemService(validationResult.data);
  const statusCode = result.success ? 201 : 400;
  res.status(statusCode).json(result);
};

export const getFeeItemByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const result = await getFeeItemByIdService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

export const getFeeItemsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.params.schoolId as string;
  const result = await getFeeItemsBySchoolService(schoolId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

export const updateFeeItemController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const validationResult = updateFeeItemSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed for fee item update.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await updateFeeItemService(id, validationResult.data);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

export const deleteFeeItemController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const result = await deleteFeeItemService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Class Fee Structure Controllers
 */

export const createClassFeeStructureController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createClassFeeStructureSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed for class fee structure creation.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createClassFeeStructureService(validationResult.data);
  const statusCode = result.success ? 201 : 400;
  res.status(statusCode).json(result);
};

export const getClassFeeStructuresController = async (req: Request, res: Response): Promise<void> => {
  const { termId, gradeLevel } = req.query;
  if (!termId || !gradeLevel || typeof termId !== "string" || typeof gradeLevel !== "string") {
    res.status(400).json({
      success: false,
      message: "Both termId and gradeLevel query parameters are required as strings.",
    });
    return;
  }

  const result = await getClassFeeStructuresService(termId, gradeLevel);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

export const updateClassFeeStructureController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const validationResult = updateClassFeeStructureSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed for class fee structure update.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await updateClassFeeStructureService(id, validationResult.data);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

export const deleteClassFeeStructureController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const result = await deleteClassFeeStructureService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Fee Transaction Controllers
 */

export const recordFeeTransactionController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createFeeTransactionSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed for fee transaction recording.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await recordFeeTransactionService(validationResult.data);
  const statusCode = result.success ? 201 : 400;
  res.status(statusCode).json(result);
};

export const updateFeeTransactionController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const validationResult = updateFeeTransactionSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed for fee transaction update.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await updateFeeTransactionService(id, validationResult.data);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

export const deleteFeeTransactionController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const result = await deleteFeeTransactionService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

export const getStudentFeeTransactionsController = async (req: Request, res: Response): Promise<void> => {
  const studentId = req.params.studentId as string;
  const result = await getStudentFeeTransactionsService(studentId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

export const getSchoolFeeTransactionsController = async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.params.schoolId as string;
  const result = await getSchoolFeeTransactionsService(schoolId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

export const getStudentFeeStatementController = async (req: Request, res: Response): Promise<void> => {
  const studentId = req.params.studentId as string;
  const { termId, gradeLevel } = req.query;

  if (!termId || !gradeLevel || typeof termId !== "string" || typeof gradeLevel !== "string") {
    res.status(400).json({
      success: false,
      message: "Both termId and gradeLevel query parameters are required as strings to generate a fee statement.",
    });
    return;
  }

  const result = await getStudentFeeStatementService(studentId, termId, gradeLevel);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

export const getSchoolTermCollectionSummaryController = async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.params.schoolId as string;
  const { termId } = req.query;

  if (!termId || typeof termId !== "string") {
    res.status(400).json({
      success: false,
      message: "The termId query parameter is required as a string to generate a collection summary.",
    });
    return;
  }

  const result = await getSchoolTermCollectionSummaryService(schoolId, termId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};