// routes/attendance.router.ts
import { Router } from "express";
import {
  // Marking
  markAttendanceController,
  bulkMarkAttendanceController,
  updateAttendanceController,
  deleteAttendanceController,
  markAbsentFromSheetController,
  // Reads
  getAttendanceByIdController,
  getStudentAttendanceForDateController,
  getStudentAttendanceHistoryController,
  getClassAttendanceForDateController,
  getClassAttendanceSummaryController,
  getSchoolAttendanceForDateController,
  getMonthlyAttendanceRegisterController,
  getStudentAttendanceStatsController,
  // Lists
  listAbsenteesForDateController,
  listLateArrivalsForDateController,
  listChronicAbsenteesController,
  listStudentsNotMarkedController,
  // Analytics
  getAttendanceRateByClassController,
  countAttendanceByStatusController,
  getAttendanceTrendController,
  getAttendanceByGenderController,
  getSchoolAttendanceStatsController,
  getAttendanceComparisonController,
  // Bulk & Import
  bulkUpsertAttendanceController,
  copyAttendanceFromDateController,
  importAttendanceCsvController,
  // Helpers
  validateAttendanceDateController,
  canMarkAttendanceController,
  getAttendanceAuditTrailController,
  getAttendanceSettingsController,
} from "./attendance.controller";
import { adminAuth, adminOrTeacherAuth, anyAuthenticatedUser, superAdminAuth } from "../../middleware/bearAuth";


const attendanceRouter = Router();

// ================================================================
// MARKING
// ================================================================
attendanceRouter.post("/", adminOrTeacherAuth, markAttendanceController);
attendanceRouter.post("/bulk", adminOrTeacherAuth, bulkMarkAttendanceController);
attendanceRouter.post("/upsert", adminOrTeacherAuth, bulkUpsertAttendanceController);
attendanceRouter.post("/copy", adminOrTeacherAuth, copyAttendanceFromDateController);
attendanceRouter.post("/import", adminAuth, importAttendanceCsvController);
attendanceRouter.post(
  "/class/:classId/date/:date/auto-absent",
  adminOrTeacherAuth,
  markAbsentFromSheetController
);

attendanceRouter.put("/:attendanceId", adminOrTeacherAuth, updateAttendanceController);
attendanceRouter.delete(
  "/:attendanceId",
  superAdminAuth,
  deleteAttendanceController
);

// ================================================================
// HELPERS (static — must come before dynamic class/student routes)
// ================================================================
attendanceRouter.get(
  "/school/:schoolId/validate-date",
  anyAuthenticatedUser,
  validateAttendanceDateController
);
attendanceRouter.get(
  "/user/:userId/class/:classId/can-mark",
  anyAuthenticatedUser,
  canMarkAttendanceController
);
attendanceRouter.get(
  "/school/:schoolId/settings",
  anyAuthenticatedUser,
  getAttendanceSettingsController
);

// ================================================================
// SCHOOL-LEVEL READS
// ================================================================
attendanceRouter.get(
  "/school/:schoolId/date/:date",
  anyAuthenticatedUser,
  getSchoolAttendanceForDateController
);
attendanceRouter.get(
  "/school/:schoolId/absentees",
  anyAuthenticatedUser,
  listAbsenteesForDateController
);
attendanceRouter.get(
  "/school/:schoolId/late-arrivals",
  anyAuthenticatedUser,
  listLateArrivalsForDateController
);
attendanceRouter.get(
  "/school/:schoolId/chronic-absentees",
  anyAuthenticatedUser,
  listChronicAbsenteesController
);
attendanceRouter.get(
  "/school/:schoolId/stats",
  anyAuthenticatedUser,
  getSchoolAttendanceStatsController
);
attendanceRouter.get(
  "/school/:schoolId/by-status",
  anyAuthenticatedUser,
  countAttendanceByStatusController
);
attendanceRouter.get(
  "/school/:schoolId/by-gender",
  anyAuthenticatedUser,
  getAttendanceByGenderController
);
attendanceRouter.get(
  "/school/:schoolId/comparison",
  anyAuthenticatedUser,
  getAttendanceComparisonController
);

// ================================================================
// CLASS-LEVEL READS
// ================================================================
attendanceRouter.get(
  "/class/:classId/date/:date",
  anyAuthenticatedUser,
  getClassAttendanceForDateController
);
attendanceRouter.get(
  "/class/:classId/date/:date/summary",
  anyAuthenticatedUser,
  getClassAttendanceSummaryController
);
attendanceRouter.get(
  "/class/:classId/date/:date/not-marked",
  anyAuthenticatedUser,
  listStudentsNotMarkedController
);
attendanceRouter.get(
  "/class/:classId/date/:date/audit",
  anyAuthenticatedUser,
  getAttendanceAuditTrailController
);
attendanceRouter.get(
  "/class/:classId/register",
  anyAuthenticatedUser,
  getMonthlyAttendanceRegisterController
);
attendanceRouter.get(
  "/class/:classId/rate",
  anyAuthenticatedUser,
  getAttendanceRateByClassController
);
attendanceRouter.get(
  "/class/:classId/trend",
  anyAuthenticatedUser,
  getAttendanceTrendController
);

// ================================================================
// STUDENT-LEVEL READS
// ================================================================
attendanceRouter.get(
  "/student/:studentId/date/:date",
  anyAuthenticatedUser,
  getStudentAttendanceForDateController
);
attendanceRouter.get(
  "/student/:studentId/history",
  anyAuthenticatedUser,
  getStudentAttendanceHistoryController
);
attendanceRouter.get(
  "/student/:studentId/stats",
  anyAuthenticatedUser,
  getStudentAttendanceStatsController
);

// ================================================================
// SINGLE RECORD (dynamic last)
// ================================================================
attendanceRouter.get(
  "/:attendanceId",
  anyAuthenticatedUser,
  getAttendanceByIdController
);

export default attendanceRouter;