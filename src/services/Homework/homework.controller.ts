// src/services/homework/homework.controller.ts
import { Request, Response } from "express";
import {
  // Assignments
  createAssignmentService,
  getAssignmentByIdService,
  listAssignmentsByClassService,
  listAssignmentsBySubjectService,
  listAssignmentsByTeacherService,
  listAssignmentsBySchoolService,
  updateAssignmentService,
  deleteAssignmentService,
  getAssignmentSummaryService,
  listPendingSubmissionsService,
  countAssignmentsForClassService,
  listUpcomingAssignmentsService,
  // Submissions
  submitHomeworkService,
  getSubmissionByIdService,
  listSubmissionsForAssignmentService,
  listSubmissionsForStudentService,
  getStudentSubmissionForAssignmentService,
  gradeSubmissionService,
  ungradeSubmissionService,
  returnForResubmissionService,
  deleteSubmissionService,
  countUngradedForAssignmentService,
  countUngradedForTeacherService,
  markOverdueSubmissionsService,
  bulkGradeSubmissionsService,
  getTeacherGradingQueueService,
  getStudentHomeworkSummaryService,
  // Reports
  getClassCompletionRateService,
  getSubjectHomeworkSummaryService,
  getTeacherWorkloadService,
  getSchoolHomeworkOverviewService,
  rankClassByCompletionService,
} from "./homework.service";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  listAssignmentsQuerySchema,
  submitHomeworkSchema,
  gradeSubmissionSchema,
  returnForResubmissionSchema,
  bulkGradeSubmissionsSchema,
  listSubmissionsQuerySchema,
  assignmentIdParamSchema,
  submissionIdParamSchema,
  classIdParamSchema,
  subjectIdParamSchema,
  teacherIdParamSchema,
  studentIdParamSchema,
  schoolIdParamSchema,
  assignmentStudentParamSchema,
} from "../../validators/homework.validator";

const getUserId = (req: Request): string | undefined =>
  (req as any).user?.id as string | undefined;

// ================================================================
// ASSIGNMENTS
// ================================================================

export const createAssignmentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to create homework." });
      return;
    }
    const v = createAssignmentSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create the homework — check the highlighted fields.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await createAssignmentService(v.data);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't create the homework — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getAssignmentByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = assignmentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid assignment ID.", errors: p.error.format() });
      return;
    }
    const result = await getAssignmentByIdService(p.data.assignmentId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Assignment retrieved." : "We couldn't find that assignment.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listAssignmentsByClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid class ID.", errors: p.error.format() });
      return;
    }
    const q = listAssignmentsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await listAssignmentsByClassService(p.data.classId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} assignment(s).`
        : `We couldn't list assignments — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listAssignmentsBySubjectController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = subjectIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid subject ID.", errors: p.error.format() });
      return;
    }
    const result = await listAssignmentsBySubjectService(p.data.subjectId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} assignment(s).`
        : `We couldn't list assignments — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listAssignmentsByTeacherController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = teacherIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid teacher ID.", errors: p.error.format() });
      return;
    }
    const q = listAssignmentsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await listAssignmentsByTeacherService(p.data.teacherId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} assignment(s).`
        : `We couldn't list assignments — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listAssignmentsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const q = listAssignmentsQuerySchema.safeParse(req.query);
    const opts = q.success ? { limit: q.data.limit } : { limit: 100 };
    const result = await listAssignmentsBySchoolService(p.data.schoolId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} assignment(s).`
        : `We couldn't list assignments — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const updateAssignmentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = assignmentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid assignment ID.", errors: p.error.format() });
      return;
    }
    const v = updateAssignmentSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields and try again.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await updateAssignmentService(p.data.assignmentId, v.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Assignment updated." : `We couldn't update the assignment — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const deleteAssignmentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = assignmentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid assignment ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteAssignmentService(p.data.assignmentId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Assignment deleted." : "We couldn't find that assignment.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getAssignmentSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = assignmentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid assignment ID.", errors: p.error.format() });
      return;
    }
    const result = await getAssignmentSummaryService(p.data.assignmentId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? result.message : `Couldn't build summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listPendingSubmissionsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = assignmentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid assignment ID.", errors: p.error.format() });
      return;
    }
    const result = await listPendingSubmissionsService(p.data.assignmentId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? result.message : `Couldn't list pending submissions — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const countAssignmentsForClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid class ID.", errors: p.error.format() });
      return;
    }
    const q = listAssignmentsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await countAssignmentsForClassService(p.data.classId, opts);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Couldn't count assignments — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listUpcomingAssignmentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid class ID.", errors: p.error.format() });
      return;
    }
    const result = await listUpcomingAssignmentsService(p.data.classId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} upcoming assignment(s).`
        : `Couldn't list upcoming assignments — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

// ================================================================
// SUBMISSIONS
// ================================================================

export const submitHomeworkController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = submitHomeworkSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't submit the homework — check the highlighted fields.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await submitHomeworkService(v.data);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't submit the homework — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getSubmissionByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = submissionIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid submission ID.", errors: p.error.format() });
      return;
    }
    const result = await getSubmissionByIdService(p.data.submissionId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Submission retrieved." : "We couldn't find that submission.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listSubmissionsForAssignmentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = assignmentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid assignment ID.", errors: p.error.format() });
      return;
    }
    const q = listSubmissionsQuerySchema.safeParse(req.query);
    const opts = q.success && q.data.status ? { status: q.data.status } : undefined;
    const result = await listSubmissionsForAssignmentService(p.data.assignmentId, opts);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} submission(s).`
        : `Couldn't list submissions — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listSubmissionsForStudentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const result = await listSubmissionsForStudentService(p.data.studentId);
    res.status(200).json({
      ...result,
      message: result.success
        ? `Fetched ${result.count ?? 0} submission(s).`
        : `Couldn't list submissions — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getStudentSubmissionForAssignmentController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const p = assignmentStudentParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({
        success: false,
        message: "Invalid assignment or student ID.",
        errors: p.error.format(),
      });
      return;
    }
    const result = await getStudentSubmissionForAssignmentService(p.data.assignmentId, p.data.studentId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Submission retrieved." : result.message,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const gradeSubmissionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = submissionIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid submission ID.", errors: p.error.format() });
      return;
    }
    const v = gradeSubmissionSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields and try again.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await gradeSubmissionService(p.data.submissionId, v.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't grade submission — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const ungradeSubmissionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = submissionIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid submission ID.", errors: p.error.format() });
      return;
    }
    const result = await ungradeSubmissionService(p.data.submissionId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Grade removed." : `Couldn't ungrade — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const returnForResubmissionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = submissionIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid submission ID.", errors: p.error.format() });
      return;
    }
    const v = returnForResubmissionSchema.safeParse(req.body ?? {});
    const feedback = v.success ? v.data.feedback : undefined;
    const result = await returnForResubmissionService(p.data.submissionId, feedback ?? undefined);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Submission returned for resubmission." : `Couldn't return — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const deleteSubmissionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = submissionIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid submission ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteSubmissionService(p.data.submissionId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Submission deleted." : "We couldn't find that submission.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const countUngradedForAssignmentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = assignmentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid assignment ID.", errors: p.error.format() });
      return;
    }
    const result = await countUngradedForAssignmentService(p.data.assignmentId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Couldn't count ungraded — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const countUngradedForTeacherController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = teacherIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid teacher ID.", errors: p.error.format() });
      return;
    }
    const result = await countUngradedForTeacherService(p.data.teacherId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Couldn't count ungraded — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const markOverdueSubmissionsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await markOverdueSubmissionsService(p.data.schoolId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't mark overdue — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const bulkGradeSubmissionsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = bulkGradeSubmissionsSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields and try again.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await bulkGradeSubmissionsService(v.data.items);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't bulk grade — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getTeacherGradingQueueController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const p = teacherIdParamSchema.safeParse(req.params);
    const teacherId = p.success ? p.data.teacherId : userId;
    const result = await getTeacherGradingQueueService(teacherId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Couldn't build grading queue — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getStudentHomeworkSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = studentIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid student ID.", errors: p.error.format() });
      return;
    }
    const q = listAssignmentsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await getStudentHomeworkSummaryService(p.data.studentId, opts);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? result.message : `Couldn't build summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

// ================================================================
// REPORTS
// ================================================================

export const getClassCompletionRateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid class ID.", errors: p.error.format() });
      return;
    }
    const q = listAssignmentsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await getClassCompletionRateService(p.data.classId, opts);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't compute rate — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getSubjectHomeworkSummaryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = subjectIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid subject ID.", errors: p.error.format() });
      return;
    }
    const q = listAssignmentsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await getSubjectHomeworkSummaryService(p.data.subjectId, opts);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't build summary — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getTeacherWorkloadController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = teacherIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid teacher ID.", errors: p.error.format() });
      return;
    }
    const result = await getTeacherWorkloadService(p.data.teacherId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't compute workload — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getSchoolHomeworkOverviewController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await getSchoolHomeworkOverviewService(p.data.schoolId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't build overview — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const rankClassByCompletionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid class ID.", errors: p.error.format() });
      return;
    }
    const q = listAssignmentsQuerySchema.safeParse(req.query);
    const opts = q.success ? { fromDate: q.data.fromDate, toDate: q.data.toDate } : undefined;
    const result = await rankClassByCompletionService(p.data.classId, opts);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Couldn't rank class — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};