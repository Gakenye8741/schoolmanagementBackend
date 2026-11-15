// src/services/discipline/discipline.route.ts
import { Router } from "express";
import {
  recordIncidentController,
  bulkRecordIncidentsController,
  updateIncidentController,
  markParentNotifiedController,
  deleteIncidentController,
  getIncidentByIdController,
  listIncidentsForStudentController,
  listIncidentsForClassController,
  listIncidentsForSchoolController,
  listIncidentsByTypeController,
  listIncidentsByDateRangeController,
  getStudentDisciplineSummaryController,
  getClassDisciplineSummaryController,
  getSchoolDisciplineStatsController,
  getDisciplineTrendController,
  getMeritStudentsController,
} from "./discipline.controller";
import {
  adminAuth,
  adminOrTeacherAuth,
  superAdminAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const disciplineRouter = Router();

// ================================================================
// RECORDING
// ================================================================

disciplineRouter.post("/", adminOrTeacherAuth, recordIncidentController);
disciplineRouter.post("/bulk", adminOrTeacherAuth, bulkRecordIncidentsController);

// ================================================================
// SCHOOL-LEVEL READS — static prefixes first
// ================================================================

disciplineRouter.get(
  "/school/:schoolId",
  anyAuthenticatedUser,
  listIncidentsForSchoolController
);
disciplineRouter.get(
  "/school/:schoolId/by-type",
  anyAuthenticatedUser,
  listIncidentsByTypeController
);
disciplineRouter.get(
  "/school/:schoolId/by-date-range",
  anyAuthenticatedUser,
  listIncidentsByDateRangeController
);
disciplineRouter.get(
  "/school/:schoolId/stats",
  anyAuthenticatedUser,
  getSchoolDisciplineStatsController
);
disciplineRouter.get(
  "/school/:schoolId/trend",
  anyAuthenticatedUser,
  getDisciplineTrendController
);
disciplineRouter.get(
  "/school/:schoolId/merits",
  anyAuthenticatedUser,
  getMeritStudentsController
);

// ================================================================
// CLASS-LEVEL READS
// ================================================================

disciplineRouter.get(
  "/class/:classId",
  anyAuthenticatedUser,
  listIncidentsForClassController
);
disciplineRouter.get(
  "/class/:classId/summary",
  anyAuthenticatedUser,
  getClassDisciplineSummaryController
);

// ================================================================
// STUDENT-LEVEL READS
// ================================================================

disciplineRouter.get(
  "/student/:studentId",
  anyAuthenticatedUser,
  listIncidentsForStudentController
);
disciplineRouter.get(
  "/student/:studentId/summary",
  anyAuthenticatedUser,
  getStudentDisciplineSummaryController
);

// ================================================================
// PER-INCIDENT MUTATIONS & READS
// ================================================================

disciplineRouter.patch(
  "/:incidentId/mark-notified",
  adminOrTeacherAuth,
  markParentNotifiedController
);
disciplineRouter.put("/:incidentId", adminOrTeacherAuth, updateIncidentController);
disciplineRouter.delete("/:incidentId", adminAuth, deleteIncidentController);

// Generic lookup LAST
disciplineRouter.get(
  "/:incidentId",
  anyAuthenticatedUser,
  getIncidentByIdController
);

export default disciplineRouter;