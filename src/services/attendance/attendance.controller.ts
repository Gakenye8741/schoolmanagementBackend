import { Request, Response } from "express";
import {
  createAttendanceService,
  bulkCreateAttendanceService,
  getAttendanceByIdService,
  getStudentAttendanceService,
  deleteAttendanceService,
  createDisciplinaryRecordService,
  getDisciplinaryRecordByIdService,
  getStudentDisciplinaryRecordsService,
  updateDisciplinaryRecordService,
  deleteDisciplinaryRecordService
} from "./attendance.service";
import {
  createAttendanceSchema,
  bulkAttendanceSchema,
  updateAttendanceSchema,
  createDisciplinaryRecordSchema,
  updateDisciplinaryRecordSchema
} from "../../validators/attendance.validator";

/**
 * Helper function to translate raw database error messages into human-friendly explanations.
 */
const formatDatabaseError = (errorMessage: string = ""): string => {
  if (errorMessage.includes("attendance_student_id_students_id_fk") || errorMessage.includes("violates foreign key constraint") && errorMessage.includes("student_id")) {
    return "The student ID provided does not exist in the system. Please check the student record and try again.";
  }
  if (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("marked_by") || errorMessage.includes("recorded_by")) {
    return "The staff member ID (teacher or admin) provided does not exist in the system.";
  }
  if (errorMessage.includes("unique constraint") || errorMessage.includes("duplicate key")) {
    return "A record with these details already exists for this date.";
  }
  return errorMessage || "An unexpected database error occurred.";
};

// ==========================================
// ATTENDANCE CONTROLLERS
// ==========================================

/**
 * Create or record single student attendance controller
 */
export const createAttendanceController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createAttendanceSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Please ensure all attendance fields are correctly formatted.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createAttendanceService(validationResult.data);
  
  if (!result.success) {
    res.status(400).json({
      success: false,
      message: formatDatabaseError(result.message),
    });
    return;
  }

  res.status(201).json(result);
};

/**
 * Bulk create or update attendance records controller
 */
export const bulkCreateAttendanceController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = bulkAttendanceSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Bulk attendance payload contains malformed items or is empty.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await bulkCreateAttendanceService(validationResult.data);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: formatDatabaseError(result.message),
    });
    return;
  }

  res.status(201).json(result);
};

/**
 * Get attendance record by ID controller
 */
export const getAttendanceByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await getAttendanceByIdService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Get attendance history for a specific student controller
 */
export const getStudentAttendanceController = async (req: Request, res: Response): Promise<void> => {
  const studentId = String(req.params.studentId);
  const { startDate, endDate } = req.query;

  const result = await getStudentAttendanceService(
    studentId, 
    startDate as string | undefined, 
    endDate as string | undefined
  );

  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Delete an attendance record controller
 */
export const deleteAttendanceController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await deleteAttendanceService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};


// ==========================================
// DISCIPLINARY RECORDS CONTROLLERS
// ==========================================

/**
 * Create a new disciplinary record controller
 */
export const createDisciplinaryRecordController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createDisciplinaryRecordSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Disciplinary record data contains invalid or missing attributes.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createDisciplinaryRecordService(validationResult.data);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: formatDatabaseError(result.message),
    });
    return;
  }

  res.status(201).json(result);
};

/**
 * Get disciplinary record by ID controller
 */
export const getDisciplinaryRecordByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await getDisciplinaryRecordByIdService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Get all disciplinary records for a specific student controller
 */
export const getStudentDisciplinaryRecordsController = async (req: Request, res: Response): Promise<void> => {
  const studentId = String(req.params.studentId);
  const result = await getStudentDisciplinaryRecordsService(studentId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Update an existing disciplinary record controller
 */
export const updateDisciplinaryRecordController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const validationResult = updateDisciplinaryRecordSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Unable to update disciplinary record with the provided payload.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await updateDisciplinaryRecordService(id, validationResult.data);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: formatDatabaseError(result.message),
    });
    return;
  }

  res.status(200).json(result);
};

/**
 * Delete a disciplinary record controller
 */
export const deleteDisciplinaryRecordController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await deleteDisciplinaryRecordService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};