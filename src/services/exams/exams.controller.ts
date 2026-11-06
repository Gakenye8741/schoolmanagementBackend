// controllers/exams.controller.ts
import { Request, Response } from "express";
import {
  createExamService,
  getExamByIdService,
  listExamsByTermService,
  listExamsBySchoolService,
  listExamsByCategoryService,
  updateExamService,
  lockExamService,
  unlockExamService,
  deleteExamService,
  getExamStatisticsService,
  createScheduleService,
  bulkCreateSchedulesService,
  getScheduleByIdService,
  listSchedulesByExamService,
  listSchedulesByClassService,
  listSchedulesByDateService,
  updateScheduleService,
  deleteScheduleService,
  enterMarkService,
  bulkEnterMarksService,
  updateMarkService,
  deleteMarkService,
  markAbsentService,
  getResultByIdService,
  getStudentMarksForExamService,
  getMarksheetService,
  publishMarksService,
  getSubjectMarksService,
  computeGradesForExamService,
  computeSubjectPositionsService,
  computeClassRankingService,
  computeSubjectStatisticsService,
  computeClassPerformanceService,
  getStudentTranscriptService,
  getExamReportService,
} from "./exams.service";
import {
  createExamSchema,
  updateExamSchema,
  listExamsByCategorySchema,
  createScheduleSchema,
  bulkCreateSchedulesSchema,
  updateScheduleSchema,
  listSchedulesByDateSchema,
  enterMarkSchema,
  bulkEnterMarksSchema,
  updateMarkSchema,
  markAbsentSchema,
  examIdParamSchema,
  scheduleIdParamSchema,
  markIdParamSchema,
  schoolIdParamSchema,
  termIdParamSchema,
  subjectIdParamSchema,
  classIdParamSchema,
  studentIdParamSchema,
} from "../../validators/exams.validators";

const getUserId = (req: Request): string | undefined =>
  (req as any).user?.id as string | undefined;

// ================================================================
// EXAMS
// ================================================================

export const createExamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createExamSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the exam — check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await createExamService(validation.data);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't create the exam — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the exam. Please try again.",
    });
  }
};

export const getExamByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await getExamByIdService(p.data.examId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Exam retrieved." : "We couldn't find that exam.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the exam.",
    });
  }
};

export const listExamsByTermController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const t = termIdParamSchema.safeParse(req.params);
    if (!s.success || !t.success) {
      res.status(400).json({ success: false, message: "Invalid school or term ID." });
      return;
    }
    const result = await listExamsByTermService(s.data.schoolId, t.data.termId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} exam(s).`
        : `We couldn't list exams — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing exams.",
    });
  }
};

export const listExamsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    if (!s.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: s.error.format() });
      return;
    }
    const result = await listExamsBySchoolService(s.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} exam(s).`
        : `We couldn't list exams — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing exams.",
    });
  }
};

export const listExamsByCategoryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const q = listExamsByCategorySchema.safeParse(req.query);
    if (!s.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school ID or exam category." });
      return;
    }
    const result = await listExamsByCategoryService(s.data.schoolId, q.data.category);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} ${q.data.category} exam(s).`
        : `We couldn't list exams — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing exams by category.",
    });
  }
};

export const updateExamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    const body = updateExamSchema.safeParse(req.body);
    if (!p.success || !body.success) {
      res.status(400).json({ success: false, message: "Check the exam ID and highlighted fields." });
      return;
    }
    const result = await updateExamService(p.data.examId, body.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Exam updated."
        : `We couldn't update the exam — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the exam.",
    });
  }
};

export const lockExamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await lockExamService(p.data.examId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Exam locked." : `We couldn't lock the exam — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while locking the exam.",
    });
  }
};

export const unlockExamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await unlockExamService(p.data.examId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Exam unlocked." : `We couldn't unlock the exam — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while unlocking the exam.",
    });
  }
};

export const deleteExamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteExamService(p.data.examId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Exam deleted."
        : result.message.startsWith("Cannot delete")
        ? "Cannot delete a locked exam. Unlock it first."
        : "We couldn't find that exam.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the exam.",
    });
  }
};

export const getExamStatisticsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await getExamStatisticsService(p.data.examId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? result.message : "We couldn't compute statistics.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing exam statistics.",
    });
  }
};

// ================================================================
// SCHEDULES
// ================================================================

export const createScheduleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = createScheduleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the schedule — check the highlighted fields.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await createScheduleService(validation.data);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success
        ? "Exam schedule created."
        : `We couldn't create the schedule — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while creating the schedule.",
    });
  }
};

export const bulkCreateSchedulesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = bulkCreateSchedulesSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the schedules — check the highlighted fields.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await bulkCreateSchedulesService(validation.data);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success
        ? result.message
        : `We couldn't bulk-create schedules — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while bulk-creating schedules.",
    });
  }
};

export const getScheduleByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scheduleIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid schedule ID.", errors: p.error.format() });
      return;
    }
    const result = await getScheduleByIdService(p.data.scheduleId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Schedule retrieved." : "We couldn't find that schedule.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the schedule.",
    });
  }
};

export const listSchedulesByExamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await listSchedulesByExamService(p.data.examId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} schedule(s).`
        : `We couldn't list schedules — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing schedules.",
    });
  }
};

export const listSchedulesByClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const c = classIdParamSchema.safeParse(req.params);
    if (!s.success || !c.success) {
      res.status(400).json({ success: false, message: "Invalid school or class ID." });
      return;
    }
    const result = await listSchedulesByClassService(s.data.schoolId, c.data.classId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} schedule(s).`
        : `We couldn't list schedules — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing schedules.",
    });
  }
};

export const listSchedulesByDateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const q = listSchedulesByDateSchema.safeParse(req.query);
    if (!s.success || !q.success) {
      res.status(400).json({ success: false, message: "Invalid school ID or date." });
      return;
    }
    const result = await listSchedulesByDateService(s.data.schoolId, q.data.examDate);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} schedule(s) for ${q.data.examDate}.`
        : `We couldn't list schedules — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while listing schedules.",
    });
  }
};

export const updateScheduleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scheduleIdParamSchema.safeParse(req.params);
    const body = updateScheduleSchema.safeParse(req.body);
    if (!p.success || !body.success) {
      res.status(400).json({ success: false, message: "Check the schedule ID and highlighted fields." });
      return;
    }
    const result = await updateScheduleService(p.data.scheduleId, body.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Schedule updated."
        : `We couldn't update the schedule — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the schedule.",
    });
  }
};

export const deleteScheduleController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = scheduleIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid schedule ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteScheduleService(p.data.scheduleId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Schedule deleted." : "We couldn't find that schedule.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the schedule.",
    });
  }
};

// ================================================================
// MARKS
// ================================================================

export const enterMarkController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to enter marks." });
      return;
    }
    const validation = enterMarkSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't enter the mark — check the highlighted fields.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await enterMarkService({ ...validation.data, enteredBy: userId });
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't enter the mark — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while entering the mark.",
    });
  }
};

export const bulkEnterMarksController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to enter marks." });
      return;
    }
    const validation = bulkEnterMarksSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't enter the marks — check the highlighted fields.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await bulkEnterMarksService({ ...validation.data, enteredBy: userId });
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't enter the marks — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while bulk-entering marks.",
    });
  }
};

export const updateMarkController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to update marks." });
      return;
    }
    const p = markIdParamSchema.safeParse(req.params);
    const body = updateMarkSchema.safeParse(req.body);
    if (!p.success || !body.success) {
      res.status(400).json({ success: false, message: "Check the mark ID and highlighted fields." });
      return;
    }
    const result = await updateMarkService(p.data.markId, body.data, userId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Mark updated." : `We couldn't update the mark — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while updating the mark.",
    });
  }
};

export const deleteMarkController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = markIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid mark ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteMarkService(p.data.markId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Mark deleted." : `We couldn't delete the mark — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while deleting the mark.",
    });
  }
};

export const markAbsentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to mark absence." });
      return;
    }
    const validation = markAbsentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields and try again.",
        errors: validation.error.format(),
      });
      return;
    }
    const result = await markAbsentService({ ...validation.data, enteredBy: userId });
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't mark absence — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while marking absence.",
    });
  }
};

export const getResultByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = markIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid mark ID.", errors: p.error.format() });
      return;
    }
    const result = await getResultByIdService(p.data.markId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Result retrieved." : "We couldn't find that result.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching the result.",
    });
  }
};

export const getStudentMarksForExamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const e = examIdParamSchema.safeParse(req.params);
    const st = studentIdParamSchema.safeParse(req.params);
    if (!e.success || !st.success) {
      res.status(400).json({ success: false, message: "Invalid exam or student ID." });
      return;
    }
    const result = await getStudentMarksForExamService(e.data.examId, st.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `We couldn't fetch marks — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching student marks.",
    });
  }
};

export const getMarksheetController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const e = examIdParamSchema.safeParse(req.params);
    const c = classIdParamSchema.safeParse(req.params);
    const sub = subjectIdParamSchema.safeParse(req.params);
    if (!s.success || !e.success || !c.success || !sub.success) {
      res.status(400).json({ success: false, message: "Invalid school, exam, class, or subject ID." });
      return;
    }
    const result = await getMarksheetService(s.data.schoolId, e.data.examId, c.data.classId, sub.data.subjectId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? result.message : `We couldn't build the marksheet — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the marksheet.",
    });
  }
};

export const publishMarksController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await publishMarksService(p.data.examId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success
        ? "Marks published. Exam locked. Rankings computed."
        : `We couldn't publish marks — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while publishing marks.",
    });
  }
};

export const getSubjectMarksController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    const e = examIdParamSchema.safeParse(req.params);
    const sub = subjectIdParamSchema.safeParse(req.params);
    if (!s.success || !e.success || !sub.success) {
      res.status(400).json({ success: false, message: "Invalid school, exam, or subject ID." });
      return;
    }
    const result = await getSubjectMarksService(s.data.schoolId, e.data.examId, sub.data.subjectId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} mark(s).`
        : `We couldn't fetch subject marks — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while fetching subject marks.",
    });
  }
};

// ================================================================
// COMPUTATION & REPORTS
// ================================================================

export const computeGradesForExamController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await computeGradesForExamService(p.data.examId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute grades — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing grades.",
    });
  }
};

export const computeSubjectPositionsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await computeSubjectPositionsService(p.data.examId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute subject positions — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing subject positions.",
    });
  }
};

export const computeClassRankingController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await computeClassRankingService(p.data.examId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute class ranking — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing class ranking.",
    });
  }
};

export const computeSubjectStatisticsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await computeSubjectStatisticsService(p.data.examId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute subject statistics — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing subject statistics.",
    });
  }
};

export const computeClassPerformanceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await computeClassPerformanceService(p.data.examId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't compute class performance — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while computing class performance.",
    });
  }
};

export const getStudentTranscriptController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await getStudentTranscriptService(p.data.studentId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? result.message : `We couldn't build the transcript — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the transcript.",
    });
  }
};

export const getExamReportController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = examIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid exam ID.", errors: p.error.format() });
      return;
    }
    const result = await getExamReportService(p.data.examId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? result.message : `We couldn't build the exam report — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while building the exam report.",
    });
  }
};