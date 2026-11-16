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

/**
 * ROUTE ORDERING RULES (do not reorder without reading this first):
 *
 *   1. All routes whose FIRST path segment is a static literal
 *      (`/school`, `/schedules`, `/marks`, `/student`) MUST be declared
 *      BEFORE any route whose first segment is `:examId`.
 *
 *      Otherwise `GET /:examId/statistics` would match
 *      `GET /schedules/statistics` and return 404 for a valid schedule,
 *      and `GET /:examId/schedules` would match `GET /marks/schedules`, etc.
 *
 *   2. Within each prefix group, put the most specific static suffix first
 *      (`/schedules/bulk` before `/schedules/:scheduleId`).
 *
 *   3. The generic `GET /:examId` must be registered LAST — it is the
 *      catch-all for exam lookups.
 */
const examsRouter = Router();

// ================================================================
// 1. STATIC-PREFIX ROUTES
// ================================================================

// ----------------------------------------------------------------
// 1a. School-scoped reads (/school/*)
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// 1b. Schedules (/schedules/*)
// ----------------------------------------------------------------
examsRouter.post("/schedules", adminAuth, createScheduleController);
examsRouter.post(
  "/schedules/bulk",
  adminAuth,
  bulkCreateSchedulesController
);
examsRouter.get(
  "/schedules/:scheduleId",
  anyAuthenticatedUser,
  getScheduleByIdController
);
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

// ----------------------------------------------------------------
// 1c. Marks (/marks/*)
// ----------------------------------------------------------------
examsRouter.post("/marks", adminOrTeacherAuth, enterMarkController);
examsRouter.post("/marks/bulk", adminOrTeacherAuth, bulkEnterMarksController);
examsRouter.post("/marks/absent", adminOrTeacherAuth, markAbsentController);
examsRouter.get("/marks/:markId", anyAuthenticatedUser, getResultByIdController);
examsRouter.put(
  "/marks/:markId",
  adminOrTeacherAuth,
  updateMarkController
);
examsRouter.delete(
  "/marks/:markId",
  adminAuth,
  deleteMarkController
);

// ----------------------------------------------------------------
// 1d. Student transcript (/student/*)
// ----------------------------------------------------------------
examsRouter.get(
  "/student/:studentId/transcript",
  anyAuthenticatedUser,
  getStudentTranscriptController
);

// ================================================================
// 2. EXAM-ROOTED ROUTES (/:examId/*)
// ================================================================

// ----------------------------------------------------------------
// 2a. Exam CRUD
// ----------------------------------------------------------------
examsRouter.post("/", adminAuth, createExamController);
examsRouter.put("/:examId", adminAuth, updateExamController);
examsRouter.delete("/:examId", superAdminAuth, deleteExamController);

// ----------------------------------------------------------------
// 2b. Exam lifecycle (lock / unlock / publish)
// ----------------------------------------------------------------
examsRouter.post("/:examId/lock", adminAuth, lockExamController);
examsRouter.post("/:examId/unlock", adminAuth, unlockExamController);
examsRouter.post("/:examId/publish", adminAuth, publishMarksController);

// ----------------------------------------------------------------
// 2c. Exam computation (must run before reads that depend on them)
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// 2d. Exam reads (multi-segment)
// ----------------------------------------------------------------
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
examsRouter.get(
  "/:examId/schedules",
  anyAuthenticatedUser,
  listSchedulesByExamController
);
examsRouter.get(
  "/:examId/marksheet/:classId/:subjectId",
  anyAuthenticatedUser,
  getMarksheetController
);
examsRouter.get(
  "/:examId/subject/:subjectId/marks",
  anyAuthenticatedUser,
  getSubjectMarksController
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
examsRouter.get(
  "/:examId/student/:studentId/marks",
  anyAuthenticatedUser,
  getStudentMarksForExamController
);

// ================================================================
// 3. GENERIC EXAM LOOKUP — MUST BE LAST
// ================================================================
examsRouter.get(
  "/:examId",
  anyAuthenticatedUser,
  getExamByIdController
);

export default examsRouter;