// src/services/homework/homework.route.ts
import { Router } from "express";
import {
  // Assignments
  createAssignmentController,
  getAssignmentByIdController,
  listAssignmentsByClassController,
  listAssignmentsBySubjectController,
  listAssignmentsByTeacherController,
  listAssignmentsBySchoolController,
  updateAssignmentController,
  deleteAssignmentController,
  getAssignmentSummaryController,
  listPendingSubmissionsController,
  countAssignmentsForClassController,
  listUpcomingAssignmentsController,
  // Submissions
  submitHomeworkController,
  getSubmissionByIdController,
  listSubmissionsForAssignmentController,
  listSubmissionsForStudentController,
  getStudentSubmissionForAssignmentController,
  gradeSubmissionController,
  ungradeSubmissionController,
  returnForResubmissionController,
  deleteSubmissionController,
  countUngradedForAssignmentController,
  countUngradedForTeacherController,
  markOverdueSubmissionsController,
  bulkGradeSubmissionsController,
  getTeacherGradingQueueController,
  getStudentHomeworkSummaryController,
  // Reports
  getClassCompletionRateController,
  getSubjectHomeworkSummaryController,
  getTeacherWorkloadController,
  getSchoolHomeworkOverviewController,
  rankClassByCompletionController,
} from "./homework.controller";
import {
  adminAuth,
  adminOrTeacherAuth,
  superAdminAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const homeworkRouter = Router();

// ================================================================
// ASSIGNMENTS
// ================================================================

// Static-prefix routes BEFORE dynamic segments

// Per-class, per-subject, per-school listings
homeworkRouter.get(
  "/class/:classId",
  anyAuthenticatedUser,
  listAssignmentsByClassController
);
homeworkRouter.get(
  "/class/:classId/upcoming",
  anyAuthenticatedUser,
  listUpcomingAssignmentsController
);
homeworkRouter.get(
  "/class/:classId/count",
  anyAuthenticatedUser,
  countAssignmentsForClassController
);
homeworkRouter.get(
  "/class/:classId/completion-rate",
  anyAuthenticatedUser,
  getClassCompletionRateController
);
homeworkRouter.get(
  "/class/:classId/ranking",
  anyAuthenticatedUser,
  rankClassByCompletionController
);

homeworkRouter.get(
  "/subject/:subjectId",
  anyAuthenticatedUser,
  listAssignmentsBySubjectController
);
homeworkRouter.get(
  "/subject/:subjectId/summary",
  anyAuthenticatedUser,
  getSubjectHomeworkSummaryController
);

homeworkRouter.get(
  "/teacher/:teacherId",
  anyAuthenticatedUser,
  listAssignmentsByTeacherController
);
homeworkRouter.get(
  "/teacher/:teacherId/workload",
  anyAuthenticatedUser,
  getTeacherWorkloadController
);
homeworkRouter.get(
  "/teacher/:teacherId/ungraded-count",
  anyAuthenticatedUser,
  countUngradedForTeacherController
);

homeworkRouter.get(
  "/school/:schoolId",
  anyAuthenticatedUser,
  listAssignmentsBySchoolController
);
homeworkRouter.get(
  "/school/:schoolId/overview",
  anyAuthenticatedUser,
  getSchoolHomeworkOverviewController
);

// Cron / admin housekeeping — mark pending → late for past-due assignments
homeworkRouter.post(
  "/school/:schoolId/mark-overdue",
  adminAuth,
  markOverdueSubmissionsController
);

// Assignment creation
homeworkRouter.post("/", adminOrTeacherAuth, createAssignmentController);

// Per-assignment reads and mutations
homeworkRouter.get(
  "/:assignmentId/summary",
  anyAuthenticatedUser,
  getAssignmentSummaryController
);
homeworkRouter.get(
  "/:assignmentId/pending",
  anyAuthenticatedUser,
  listPendingSubmissionsController
);
homeworkRouter.get(
  "/:assignmentId/ungraded-count",
  anyAuthenticatedUser,
  countUngradedForAssignmentController
);
homeworkRouter.get(
  "/:assignmentId/submissions",
  anyAuthenticatedUser,
  listSubmissionsForAssignmentController
);
homeworkRouter.put(
  "/:assignmentId",
  adminOrTeacherAuth,
  updateAssignmentController
);
homeworkRouter.delete(
  "/:assignmentId",
  adminAuth,
  deleteAssignmentController
);

// Generic lookup LAST
homeworkRouter.get(
  "/:assignmentId",
  anyAuthenticatedUser,
  getAssignmentByIdController
);

// ================================================================
// SUBMISSIONS
// ================================================================

// Static-prefix routes first

// Student-facing: my submissions, my summary
homeworkRouter.get(
  "/student/:studentId/submissions",
  anyAuthenticatedUser,
  listSubmissionsForStudentController
);
homeworkRouter.get(
  "/student/:studentId/summary",
  anyAuthenticatedUser,
  getStudentHomeworkSummaryController
);

// Per-student submission on a specific assignment
homeworkRouter.get(
  "/assignments/:assignmentId/student/:studentId/submission",
  anyAuthenticatedUser,
  getStudentSubmissionForAssignmentController
);

// Submit homework (student)
homeworkRouter.post("/submissions", anyAuthenticatedUser, submitHomeworkController);

// Teacher grading queue — no param → uses caller's own ID
homeworkRouter.get(
  "/grading-queue",
  adminOrTeacherAuth,
  getTeacherGradingQueueController
);
// With param → admin viewing a specific teacher's queue
homeworkRouter.get(
  "/grading-queue/:teacherId",
  adminOrTeacherAuth,
  getTeacherGradingQueueController
);

// Bulk grade multiple submissions
homeworkRouter.post(
  "/submissions/bulk-grade",
  adminOrTeacherAuth,
  bulkGradeSubmissionsController
);

// Per-submission actions
homeworkRouter.post(
  "/submissions/:submissionId/grade",
  adminOrTeacherAuth,
  gradeSubmissionController
);
homeworkRouter.post(
  "/submissions/:submissionId/ungrade",
  adminOrTeacherAuth,
  ungradeSubmissionController
);
homeworkRouter.post(
  "/submissions/:submissionId/return",
  adminOrTeacherAuth,
  returnForResubmissionController
);
homeworkRouter.delete(
  "/submissions/:submissionId",
  adminAuth,
  deleteSubmissionController
);

// Generic submission lookup LAST
homeworkRouter.get(
  "/submissions/:submissionId",
  anyAuthenticatedUser,
  getSubmissionByIdController
);

export default homeworkRouter;