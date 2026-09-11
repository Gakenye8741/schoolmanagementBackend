import { Request, Response } from "express";
import {
  createAcademicTermService,
  getAcademicTermByIdService,
  listAcademicTermsBySchoolService,
  getCurrentAcademicTermService,
  updateAcademicTermService,
  deleteAcademicTermService,
  createTermWindowService,
  listTermWindowsByTermService,
  deleteTermWindowService,
} from "./terms.service";
import {
  createAcademicTermSchema,
  updateAcademicTermSchema,
  createTermWindowSchema,
  updateTermWindowSchema,
} from "../../validators/academicTerms.validator";

/**
 * 1. Create Academic Term Controller
 */
export const createAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createAcademicTermSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await createAcademicTermService(validationResult.data as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during academic term creation.",
    });
  }
};

/**
 * 2. Get Academic Term by ID Controller
 */
export const getAcademicTermByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({ success: false, message: "Academic term ID parameter is required." });
      return;
    }

    const result = await getAcademicTermByIdService(termId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred fetching the academic term.",
    });
  }
};

/**
 * 3. List Academic Terms by School Controller
 */
export const listAcademicTermsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const result = await listAcademicTermsBySchoolService(schoolId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred listing academic terms.",
    });
  }
};

/**
 * 4. Get Current Active Academic Term Controller
 */
export const getCurrentAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const result = await getCurrentAcademicTermService(schoolId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred fetching the current academic term.",
    });
  }
};

/**
 * 5. Update Academic Term Controller
 */
export const updateAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateAcademicTermSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({ success: false, message: "Academic term ID parameter is required." });
      return;
    }

    const result = await updateAcademicTermService(termId, validationResult.data as any);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred updating the academic term.",
    });
  }
};

/**
 * 6. Delete Academic Term Controller
 */
export const deleteAcademicTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({ success: false, message: "Academic term ID parameter is required." });
      return;
    }

    const result = await deleteAcademicTermService(termId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred deleting the academic term.",
    });
  }
};

/**
 * 7. Create Term Window Controller
 */
export const createTermWindowController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createTermWindowSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await createTermWindowService(validationResult.data as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during term window creation.",
    });
  }
};

/**
 * 8. List Term Windows by Term Controller
 */
export const listTermWindowsByTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawTermId = req.params.termId;
    const termId = Array.isArray(rawTermId) ? rawTermId[0] : rawTermId;

    if (!termId) {
      res.status(400).json({ success: false, message: "Academic term ID parameter is required." });
      return;
    }

    const result = await listTermWindowsByTermService(termId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred listing term windows.",
    });
  }
};

/**
 * 9. Delete Term Window Controller
 */
export const deleteTermWindowController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawWindowId = req.params.windowId;
    const windowId = Array.isArray(rawWindowId) ? rawWindowId[0] : rawWindowId;

    if (!windowId) {
      res.status(400).json({ success: false, message: "Term window ID parameter is required." });
      return;
    }

    const result = await deleteTermWindowService(windowId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred deleting the term window.",
    });
  }
};