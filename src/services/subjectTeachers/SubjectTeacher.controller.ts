import { Request, Response } from "express";
import {
  assignTeacherSubjectService,
  removeTeacherSubjectService,
  getSubjectsByTeacherService,
  getTeachersBySubjectService,
  bulkAssignSubjectsToTeacherService,
  syncTeacherSubjectsService,
} from "./subjectTeachers.service";
import {
  assignTeacherSubjectSchema,
  bulkAssignSubjectsSchema,
  syncTeacherSubjectsSchema,
} from "../../validators/subjectTeachers.validators";

/**
 * 1. Assign a single teacher to a subject
 */
export const assignTeacherSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = assignTeacherSubjectSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const result = await assignTeacherSubjectService(validationResult.data);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

/**
 * 2. Remove a teacher from a subject
 */
export const removeTeacherSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.params.teacherId as string;
    const subjectId = req.params.subjectId as string;

    const result = await removeTeacherSubjectService(teacherId, subjectId);
    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

/**
 * 3. Get all subjects assigned to a specific teacher
 */
export const getSubjectsByTeacherController = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.params.teacherId as string;
    const result = await getSubjectsByTeacherService(teacherId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

/**
 * 4. Get all teachers assigned to a specific subject
 */
export const getTeachersBySubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = req.params.subjectId as string;
    const result = await getTeachersBySubjectService(subjectId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

/**
 * 5. Bulk assign multiple subjects to a teacher
 */
export const bulkAssignSubjectsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = bulkAssignSubjectsSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const { teacherId, subjectIds } = validationResult.data;
    const result = await bulkAssignSubjectsToTeacherService(teacherId, subjectIds);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

/**
 * 6. Sync / Replace all subject assignments for a teacher
 */
export const syncTeacherSubjectsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = syncTeacherSubjectsSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const { teacherId, subjectIds } = validationResult.data;
    const result = await syncTeacherSubjectsService(teacherId, subjectIds);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};