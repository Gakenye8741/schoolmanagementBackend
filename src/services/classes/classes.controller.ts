import { Request, Response } from "express";
import {
  createClassService,
  getClassByIdService,
  listClassesBySchoolService,
  updateClassService,
  assignClassTeacherService,
  deleteClassService,

} from "./classes.service";
import {
  createClassSchema,
  updateClassSchema,
  assignClassTeacherSchema,
  createEnrollmentSchema,
  updateEnrollmentSchema,
  bulkEnrollmentSchema,
} from "../../validators/class.validator";

/**
 * 1. Create Class Controller
 */
export const createClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createClassSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const result = await createClassService(validationResult.data as any);
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during class creation.",
    });
  }
};

/**
 * 2. Get Class by ID Controller
 */
export const getClassByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawClassId = req.params.classId;
    const classId = Array.isArray(rawClassId) ? rawClassId[0] : rawClassId;

    if (!classId) {
      res.status(400).json({ success: false, message: "Class ID parameter is required." });
      return;
    }

    const result = await getClassByIdService(classId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred fetching the class.",
    });
  }
};

/**
 * 3. List Classes by School Controller
 */
export const listClassesBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;
    const academicYear = req.query.academicYear as string | undefined;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const result = await listClassesBySchoolService(schoolId, academicYear);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred listing classes.",
    });
  }
};

/**
 * 4. Update Class Controller
 */
export const updateClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateClassSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawClassId = req.params.classId;
    const classId = Array.isArray(rawClassId) ? rawClassId[0] : rawClassId;

    if (!classId) {
      res.status(400).json({ success: false, message: "Class ID parameter is required." });
      return;
    }

    const result = await updateClassService(classId, validationResult.data as any);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred updating the class.",
    });
  }
};

/**
 * 5. Assign Class Teacher Controller
 */
export const assignClassTeacherController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = assignClassTeacherSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawClassId = req.params.classId;
    const classId = Array.isArray(rawClassId) ? rawClassId[0] : rawClassId;

    if (!classId) {
      res.status(400).json({ success: false, message: "Class ID parameter is required." });
      return;
    }

    const { classTeacherId } = validationResult.data;
    const result = await assignClassTeacherService(classId, classTeacherId ?? null);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred assigning the class teacher.",
    });
  }
};

/**
 * 6. Delete Class Controller
 */
export const deleteClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawClassId = req.params.classId;
    const classId = Array.isArray(rawClassId) ? rawClassId[0] : rawClassId;

    if (!classId) {
      res.status(400).json({ success: false, message: "Class ID parameter is required." });
      return;
    }

    const result = await deleteClassService(classId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred deleting the class.",
    });
  }
};

