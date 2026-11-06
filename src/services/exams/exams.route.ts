// src/services/exams/exams.route.ts
import { Router } from "express";
import {
  // Exams (1–10)
  createExamController,
  getExamByIdController,
  listExamsByTermController,
  listExamsBySchoolController,
  listExamsByCategoryController,
  updateExamController,
  lockExamController,
  unlockExamController,
  deleteExamController,
  getExamStatisticsController,
  // Schedules (11–18)
  createScheduleController,
  bulkCreateSchedulesController,
  getScheduleByIdController,
  listSchedulesByExamController,
  listSchedulesByClassController,
  listSchedulesByDateController,
  updateScheduleController,
  deleteScheduleController,
  // Marks (19–28)
  enterMarkController,
  bulkEnterMarksController,
  updateMarkController,
  deleteMarkController,
  markAbsentController,
  getResultByIdController,
  getStudentMarksForExamController,
  getMarksheetController,
  publishMarksController,
  getSubjectMarksController,
  // Computation & reports (29–35)
  computeGradesForExamController,
  computeSubjectPositionsController,
  computeClassRankingController,
  computeSubjectStatisticsController,
  computeClassPerformanceController,
  getStudentTranscriptController,
  getExamReportController,
} from "./exams.controller";
import {
  adminAuth,
  adminOrTeacherAuth,
  superAdminAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const examsRouter = Router();

// ================================================================
// EXAMS
// ================================================================

// Static-prefix reads — must come before "/:examId"
examsRouter.get(
  "/school/:schoolId",
  anyAuthenticatedUser,
  listExamsBySchoolController
);
examsRouter.get(
  "/school/:schoolId/term/:termId",
  anyAuthenticatedUser,
  listExamsByTermController
);
examsRouter.get(
  "/school/:schoolId/by-category",
  anyAuthenticatedUser,
  listExamsByCategoryController
);

// Exam mutations
examsRouter.post("/", adminAuth, createExamController);
examsRouter.put("/:examId", adminAuth, updateExamController);
examsRouter.delete("/:examId", superAdminAuth, deleteExamController);
examsRouter.post("/:examId/lock", adminAuth, lockExamController);
examsRouter.post("/:examId/unlock", adminAuth, unlockExamController);

// Per-exam reads
examsRouter.get(
  "/:examId/statistics",
  anyAuthenticatedUser,
  getExamStatisticsController
);
examsRouter.get(
  "/:examId/report",
  anyAuthenticatedUser,
  getExamReportController
);

// ================================================================
// SCHEDULES
// ================================================================

// Static paths first
examsRouter.post("/schedules", adminAuth, createScheduleController);
examsRouter.post(
  "/schedules/bulk",
  adminAuth,
  bulkCreateSchedulesController
);
examsRouter.get(
  "/school/:schoolId/class/:classId/schedules",
  anyAuthenticatedUser,
  listSchedulesByClassController
);
examsRouter.get(
  "/school/:schoolId/schedules/by-date",
  anyAuthenticatedUser,
  listSchedulesByDateController
);

// Per-exam schedule reads
examsRouter.get(
  "/:examId/schedules",
  anyAuthenticatedUser,
  listSchedulesByExamController
);

// Per-schedule mutations
examsRouter.put(
  "/schedules/:scheduleId",
  adminAuth,
  updateScheduleController
);
examsRouter.delete(
  "/schedules/:scheduleId",
  adminAuth,
  deleteScheduleController
);

// Generic schedule lookup LAST
examsRouter.get(
  "/schedules/:scheduleId",
  anyAuthenticatedUser,
  getScheduleByIdController
);

// ================================================================
// MARKS
// ================================================================

// Static mark mutations
examsRouter.post("/marks", adminOrTeacherAuth, enterMarkController);
examsRouter.post("/marks/bulk", adminOrTeacherAuth, bulkEnterMarksController);
examsRouter.post("/marks/absent", adminOrTeacherAuth, markAbsentController);

// Per-mark mutations
examsRouter.put("/marks/:markId", adminOrTeacherAuth, updateMarkController);
examsRouter.delete("/marks/:markId", adminAuth, deleteMarkController);

// Generic mark lookup LAST
examsRouter.get(
  "/marks/:markId",
  anyAuthenticatedUser,
  getResultByIdController
);

// Marksheet — per exam + class + subject
examsRouter.get(
  "/:examId/marksheet/:classId/:subjectId",
  anyAuthenticatedUser,
  getMarksheetController
);

// Publish marks
examsRouter.post("/:examId/publish", adminAuth, publishMarksController);

// Subject marks
examsRouter.get(
  "/:examId/subject/:subjectId/marks",
  anyAuthenticatedUser,
  getSubjectMarksController
);

// ================================================================
// STUDENT-FACING
// ================================================================

// Student marks for a specific exam
examsRouter.get(
  "/:examId/student/:studentId/marks",
  anyAuthenticatedUser,
  getStudentMarksForExamController
);

// Student transcript (all exams across all terms)
examsRouter.get(
  "/student/:studentId/transcript",
  anyAuthenticatedUser,
  getStudentTranscriptController
);

// ================================================================
// COMPUTATION
// ================================================================

examsRouter.post(
  "/:examId/compute-grades",
  adminAuth,
  computeGradesForExamController
);
examsRouter.post(
  "/:examId/compute-subject-positions",
  adminAuth,
  computeSubjectPositionsController
);
examsRouter.post(
  "/:examId/compute-class-ranking",
  adminAuth,
  computeClassRankingController
);
examsRouter.get(
  "/:examId/subject-statistics",
  anyAuthenticatedUser,
  computeSubjectStatisticsController
);
examsRouter.get(
  "/:examId/class-performance",
  anyAuthenticatedUser,
  computeClassPerformanceController
);

// ================================================================
// GENERIC EXAM LOOKUP — LAST
// ================================================================
examsRouter.get(
  "/:examId",
  anyAuthenticatedUser,
  getExamByIdController
);

export default examsRouter;