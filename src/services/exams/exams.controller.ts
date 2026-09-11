import { Request, Response } from "express";
import {
  createTermExamService,
  getTermExamByIdService,
  getTermExamsByTermService,
  updateTermExamService,
  deleteTermExamService,
  createCbcAssessmentService,
  bulkCreateCbcAssessmentsService,
  getCbcAssessmentByIdService,
  getStudentCbcAssessmentsService,
  getExamSubjectPerformanceService,
  getStudentTermReportCardService,
  getExamSummaryAnalyticsService,
  deleteCbcAssessmentService
} from "./exams.service";
import {
  createTermExamSchema,
  updateTermExamSchema,
  createCbcAssessmentSchema,
  bulkCbcAssessmentsSchema,
  updateCbcAssessmentSchema
} from "../../validators/exams.validators";

/**
 * Helper utility to translate cryptic database/foreign key and conflict error messages 
 * into clear, user-friendly feedback.
 */
const formatDatabaseErrorMessage = (errorMessage: string): string => {
  if (errorMessage.includes("term_exams_term_id_academic_terms_id_fk") || errorMessage.includes("academic_terms")) {
    return "The specified academic term ID does not exist in the system. Please provide a valid term ID.";
  }
  if (errorMessage.includes("cbc_assessments_student_id") || errorMessage.includes("students")) {
    return "The specified student ID does not exist in the system.";
  }
  if (errorMessage.includes("cbc_assessments_subject_id") || errorMessage.includes("subjects")) {
    return "The specified subject ID does not exist in the system.";
  }
  if (errorMessage.includes("cbc_assessments_exam_id") || errorMessage.includes("term_exams")) {
    return "The specified examination ID does not exist in the system.";
  }
  if (errorMessage.includes("unique or exclusion constraint matching the ON CONFLICT")) {
    return "Database conflict error: The service is attempting an upsert (ON CONFLICT) operation, but the table is missing a unique constraint on the target columns (typically studentId, examId, subjectId, and strand). Please add a unique index to your database table schema.";
  }
  if (errorMessage.includes("violates foreign key constraint")) {
    return "Operation failed: A referenced resource (Term, Student, Subject, or Exam) could not be found.";
  }
  return errorMessage;
};

// ==========================================
// TERM EXAMS CONTROLLERS
// ==========================================

/**
 * Create a new term exam controller
 */
export const createTermExamController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createTermExamSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Please ensure all term exam fields are correctly formatted.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createTermExamService(validationResult.data);
  if (!result.success && result.message) {
    result.message = formatDatabaseErrorMessage(result.message);
  }
  
  const statusCode = result.success ? 201 : 400;
  res.status(statusCode).json(result);
};

/**
 * Get term exam by ID controller
 */
export const getTermExamByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await getTermExamByIdService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Get all term exams for a specific academic term controller
 */
export const getTermExamsByTermController = async (req: Request, res: Response): Promise<void> => {
  const termId = String(req.params.termId);
  const result = await getTermExamsByTermService(termId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Update term exam controller
 */
export const updateTermExamController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const validationResult = updateTermExamSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Unable to update term exam with the provided payload.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await updateTermExamService(id, validationResult.data);
  if (!result.success && result.message) {
    result.message = formatDatabaseErrorMessage(result.message);
  }

  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Delete term exam controller
 */
export const deleteTermExamController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await deleteTermExamService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};


// ==========================================
// CBC ASSESSMENTS CONTROLLERS
// ==========================================

/**
 * Create or record a single CBC assessment controller
 */
export const createCbcAssessmentController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createCbcAssessmentSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: CBC assessment data contains invalid attributes or missing required fields.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createCbcAssessmentService(validationResult.data);
  if (!result.success && result.message) {
    result.message = formatDatabaseErrorMessage(result.message);
  }

  const statusCode = result.success ? 201 : 400;
  res.status(statusCode).json(result);
};

/**
 * Bulk create or update CBC assessments controller (for marksheets)
 */
export const bulkCreateCbcAssessmentsController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = bulkCbcAssessmentsSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Bulk assessment payload contains malformed items or is empty.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await bulkCreateCbcAssessmentsService(validationResult.data);
  if (!result.success && result.message) {
    result.message = formatDatabaseErrorMessage(result.message);
  }

  const statusCode = result.success ? 201 : 400;
  res.status(statusCode).json(result);
};

/**
 * Get CBC assessment by ID controller
 */
export const getCbcAssessmentByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await getCbcAssessmentByIdService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Get student CBC assessments controller
 */
export const getStudentCbcAssessmentsController = async (req: Request, res: Response): Promise<void> => {
  const studentId = String(req.params.studentId);
  const { termId, examId } = req.query;

  const result = await getStudentCbcAssessmentsService(
    studentId, 
    termId as string | undefined, 
    examId as string | undefined
  );
  
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Get exam subject performance analytics controller
 */
export const getExamSubjectPerformanceController = async (req: Request, res: Response): Promise<void> => {
  const examId = String(req.params.examId);
  const subjectId = String(req.params.subjectId);

  if (!examId || !subjectId) {
    res.status(400).json({
      success: false,
      message: "Both examId and subjectId parameters are required to fetch performance analytics.",
    });
    return;
  }

  const result = await getExamSubjectPerformanceService(examId, subjectId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Get student term report card controller
 */
export const getStudentTermReportCardController = async (req: Request, res: Response): Promise<void> => {
  const studentId = String(req.params.studentId);
  const termId = String(req.params.termId);
  const examId = String(req.params.examId);

  if (!studentId || !termId || !examId) {
    res.status(400).json({
      success: false,
      message: "Parameters studentId, termId, and examId are all mandatory to generate a term report card.",
    });
    return;
  }

  const result = await getStudentTermReportCardService(studentId, termId, examId);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Get exam summary analytics controller
 */
export const getExamSummaryAnalyticsController = async (req: Request, res: Response): Promise<void> => {
  const examId = String(req.params.examId);

  if (!examId) {
    res.status(400).json({
      success: false,
      message: "The examId parameter is required to compile exam summary analytics.",
    });
    return;
  }

  const result = await getExamSummaryAnalyticsService(examId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Delete CBC assessment controller
 */
export const deleteCbcAssessmentController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await deleteCbcAssessmentService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};