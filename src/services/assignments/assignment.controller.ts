import { Request, Response } from "express";
import {
  createHomeworkAssignmentService,
  getHomeworkAssignmentByIdService,
  getHomeworkAssignmentsByClassService,
  getHomeworkAssignmentsByTeacherService,
  updateHomeworkAssignmentService,
  deleteHomeworkAssignmentService,
  upsertHomeworkSubmissionService,
  getHomeworkSubmissionByIdService,
  getStudentHomeworkSubmissionsService,
  gradeHomeworkSubmissionService,
  deleteHomeworkSubmissionService
} from "./assignment.service";
import {
  createHomeworkAssignmentSchema,
  updateHomeworkAssignmentSchema,
  upsertHomeworkSubmissionSchema,
  gradeHomeworkSubmissionSchema
} from "../../validators/assignments.validator";

/**
 * Helper function to translate raw database error messages into human-friendly explanations.
 */
const formatDatabaseError = (errorMessage: string = ""): string => {
  if (errorMessage.includes("homework_assignments_class_id_classes_id_fk") || (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("class_id"))) {
    return "The class you selected does not exist in the school system. Please check the class details and try again.";
  }
  if (errorMessage.includes("homework_assignments_subject_id_subjects_id_fk") || (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("subject_id"))) {
    return "The subject selected for this assignment does not exist in the system.";
  }
  if (errorMessage.includes("homework_assignments_teacher_id_users_id_fk") || (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("teacher_id"))) {
    return "The teacher account specified could not be found in the system.";
  }
  if (errorMessage.includes("homework_submissions_assignment_id_homework_assignments_id_fk") || (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("assignment_id"))) {
    return "The homework assignment you are trying to submit work for does not exist.";
  }
  if (errorMessage.includes("homework_submissions_student_id_students_id_fk") || (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("student_id"))) {
    return "The student ID provided does not exist in the school register.";
  }
  if (errorMessage.includes("unique constraint") || errorMessage.includes("duplicate key")) {
    return "A homework submission already exists for this student on this specific assignment.";
  }
  return errorMessage || "An unexpected system error occurred while processing your request.";
};

// ==========================================
// HOMEWORK ASSIGNMENTS CONTROLLERS
// ==========================================

/**
 * Create a new homework assignment controller
 */
export const createHomeworkAssignmentController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createHomeworkAssignmentSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Please check that all assignment details are filled out correctly.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createHomeworkAssignmentService(validationResult.data);

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
 * Get homework assignment by ID controller
 */
export const getHomeworkAssignmentByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await getHomeworkAssignmentByIdService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Get all homework assignments for a specific class controller
 */
export const getHomeworkAssignmentsByClassController = async (req: Request, res: Response): Promise<void> => {
  const classId = String(req.params.classId);
  const result = await getHomeworkAssignmentsByClassService(classId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Get all homework assignments for a specific teacher controller
 */
export const getHomeworkAssignmentsByTeacherController = async (req: Request, res: Response): Promise<void> => {
  const teacherId = String(req.params.teacherId);
  const result = await getHomeworkAssignmentsByTeacherService(teacherId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Update a homework assignment controller
 */
export const updateHomeworkAssignmentController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const validationResult = updateHomeworkAssignmentSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: The update details provided for this assignment are invalid.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await updateHomeworkAssignmentService(id, validationResult.data);

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
 * Delete a homework assignment controller
 */
export const deleteHomeworkAssignmentController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await deleteHomeworkAssignmentService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};


// ==========================================
// HOMEWORK SUBMISSIONS CONTROLLERS
// ==========================================

/**
 * Upsert (create or update) student homework submission controller
 */
export const upsertHomeworkSubmissionController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = upsertHomeworkSubmissionSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Please ensure the student submission details are complete and correct.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await upsertHomeworkSubmissionService(validationResult.data);

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
 * Get homework submission by ID controller
 */
export const getHomeworkSubmissionByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await getHomeworkSubmissionByIdService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};

/**
 * Get all homework submissions for a specific student controller
 */
export const getStudentHomeworkSubmissionsController = async (req: Request, res: Response): Promise<void> => {
  const studentId = String(req.params.studentId);
  const result = await getStudentHomeworkSubmissionsService(studentId);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
};

/**
 * Grade a student homework submission controller
 */
export const gradeHomeworkSubmissionController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const validationResult = gradeHomeworkSubmissionSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: The score or grade entered is not valid.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await gradeHomeworkSubmissionService(id, validationResult.data.gradeScore);

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
 * Delete a homework submission record controller
 */
export const deleteHomeworkSubmissionController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await deleteHomeworkSubmissionService(id);
  const statusCode = result.success ? 200 : 404;
  res.status(statusCode).json(result);
};