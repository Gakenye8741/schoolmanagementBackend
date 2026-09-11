import { Request, Response } from "express";
import {
  generateGlobalSchoolTimetableService,
  upsertTimetableSlotService,
  getClassTimetableService,
  getTeacherTimetableService,
  clearClassTimetableService,
  auditSchoolTimetableClashesService,
} from "./timetables.service";
import {
  upsertTimetableSchema,
  generateGlobalTimetableSchema,
} from "../../validators/timetable.validator";

export const generateGlobalTimetableController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = generateGlobalTimetableSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const { schoolId, classes, subjectQuotas, daysOfWeek, periodsPerDay } = validationResult.data;
    const result = await generateGlobalSchoolTimetableService(schoolId, classes, subjectQuotas, daysOfWeek, periodsPerDay);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const upsertTimetableSlotController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = upsertTimetableSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.errors.map((e: any) => e.message),
      });
      return;
    }

    const result = await upsertTimetableSlotService(validationResult.data);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const getClassTimetableController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.schoolId as string;
    const gradeLevel = req.params.gradeLevel as string;
    const stream = req.params.stream as string;

    const result = await getClassTimetableService(schoolId, gradeLevel, stream);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const getTeacherTimetableController = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.params.teacherId as string;
    const result = await getTeacherTimetableService(teacherId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const clearClassTimetableController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.schoolId as string;
    const gradeLevel = req.params.gradeLevel as string;
    const stream = req.params.stream as string;

    const result = await clearClassTimetableService(schoolId, gradeLevel, stream);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};

export const auditSchoolTimetableClashesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.schoolId as string;
    const result = await auditSchoolTimetableClashesService(schoolId);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Internal server error." });
  }
};