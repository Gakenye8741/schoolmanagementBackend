import { Request, Response } from "express";
import {
  createSchoolExpenseService,
  getSchoolExpenseByIdService,
  getSchoolExpensesBySchoolService,
  updateSchoolExpenseService,
  deleteSchoolExpenseService,
  getSchoolExpensesByCategoryService,
  getSchoolExpensesByDateRangeService,
  getSchoolExpenseCategorySummaryService
} from "./expenses.service";
import {
  createSchoolExpenseSchema,
  updateSchoolExpenseSchema
} from "../../validators/expenses.validator";

/**
 * Create a new school expense controller
 */
export const createSchoolExpenseController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createSchoolExpenseSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed for school expense creation.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createSchoolExpenseService(validationResult.data);
  const statusCode = result.success ? 201 : 400;
  res.status(statusCode).json(result);
};

/**
 * Get school expense by ID controller
 */
export const getSchoolExpenseByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const result = await getSchoolExpenseByIdService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Get all school expenses for a school controller
 */
export const getSchoolExpensesBySchoolController = async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.params.schoolId as string;
  const result = await getSchoolExpensesBySchoolService(schoolId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Update school expense controller
 */
export const updateSchoolExpenseController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const validationResult = updateSchoolExpenseSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed for school expense update.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await updateSchoolExpenseService(id, validationResult.data);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Delete school expense controller
 */
export const deleteSchoolExpenseController = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const result = await deleteSchoolExpenseService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Get school expenses filtered by category controller
 */
export const getSchoolExpensesByCategoryController = async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.params.schoolId as string;
  const { category } = req.query;

  if (!category || typeof category !== "string") {
    res.status(400).json({
      success: false,
      message: "The category query parameter is required as a string.",
    });
    return;
  }

  const result = await getSchoolExpensesByCategoryService(schoolId, category);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Get school expenses within a date range controller
 */
export const getSchoolExpensesByDateRangeController = async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.params.schoolId as string;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate || typeof startDate !== "string" || typeof endDate !== "string") {
    res.status(400).json({
      success: false,
      message: "Both startDate and endDate query parameters are required as strings (YYYY-MM-DD).",
    });
    return;
  }

  const result = await getSchoolExpensesByDateRangeService(schoolId, startDate, endDate);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Get school expense category summary controller
 */
export const getSchoolExpenseCategorySummaryController = async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.params.schoolId as string;
  const { startDate, endDate } = req.query;

  const result = await getSchoolExpenseCategorySummaryService(
    schoolId, 
    startDate as string | undefined, 
    endDate as string | undefined
  );
  
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};