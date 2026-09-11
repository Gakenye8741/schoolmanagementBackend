import { Request, Response } from "express";
import {
  createSubjectService,
  bulkCreateSubjectsService,
  getSubjectByIdService,
  listSubjectsBySchoolService,
  listSubjectsByTeacherService,
  updateSubjectService,
  assignTeacherToSubjectService,
  removeTeacherFromSubjectService,
  deleteSubjectService,
} from "./subjects.service";
import {
  createSubjectSchema,
  bulkCreateSubjectsSchema,
  updateSubjectSchema,
  assignTeacherToSubjectSchema,
} from "../../validators/subject.validator";

/**
 * 1. Create a single subject
 */
export const createSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createSubjectSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const result = await createSubjectService(validationResult.data);
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
 * 2. Bulk create subjects
 */
export const bulkCreateSubjectsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = bulkCreateSubjectsSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const result = await bulkCreateSubjectsService(validationResult.data.subjects);
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
 * 3. Get subject by ID
 */
export const getSubjectByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = req.params.subjectId as string;
    const result = await getSubjectByIdService(subjectId);

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
 * 4. List all subjects for a school (with optional category filter)
 */
export const listSubjectsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.schoolId as string;
    const category = req.query.category as string | undefined;

    const result = await listSubjectsBySchoolService(schoolId, category);
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
 * 5. List all subjects taught by a specific teacher
 */
export const listSubjectsByTeacherController = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.params.teacherId as string;
    const result = await listSubjectsByTeacherService(teacherId);

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
 * 6. Update subject details
 */
export const updateSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = req.params.subjectId as string;
    const validationResult = updateSubjectSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const result = await updateSubjectService(subjectId, validationResult.data);
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
 * 7. Assign a teacher to a subject
 */
export const assignTeacherToSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = req.params.subjectId as string;
    const validationResult = assignTeacherToSubjectSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const result = await assignTeacherToSubjectService(subjectId, validationResult.data.teacherId);
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
 * 8. Remove a teacher from a subject
 */
export const removeTeacherFromSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = req.params.subjectId as string;
    const teacherId = req.params.teacherId as string;
    const result = await removeTeacherFromSubjectService(subjectId, teacherId);

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
 * 9. Delete a subject
 */
export const deleteSubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = req.params.subjectId as string;
    const result = await deleteSubjectService(subjectId);

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