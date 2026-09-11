import { Request, Response } from "express";
import {
  createStudentService,
  getStudentByIdService,
  getStudentsBySchoolService,
  updateStudentService,
  deleteStudentService,
  createEnrollmentHistoryService,
  getStudentEnrollmentHistoryService,
} from "./student.service";
import {
  createStudentSchema,
  updateStudentSchema,
  createEnrollmentHistorySchema,
} from "../../validators/students.validators";

export const createStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createStudentSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const result = await createStudentService(validationResult.data);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const getStudentByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.studentId as string;
    const result = await getStudentByIdService(studentId);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const getStudentsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.schoolId as string;
    const result = await getStudentsBySchoolService(schoolId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const updateStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.studentId as string;
    const validationResult = updateStudentSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const result = await updateStudentService(studentId, validationResult.data);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const deleteStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.studentId as string;
    const result = await deleteStudentService(studentId);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const createEnrollmentHistoryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = createEnrollmentHistorySchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const result = await createEnrollmentHistoryService(validationResult.data);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const getStudentEnrollmentHistoryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.studentId as string;
    const result = await getStudentEnrollmentHistoryService(studentId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};