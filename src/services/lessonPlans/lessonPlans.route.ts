// src/services/lessonPlans/lessonPlans.route.ts
import { Router } from "express";
import {
  createSchemeController,
  bulkCreateSchemesController,
  getSchemeByIdController,
  listSchemesForSchoolController,
  listSchemesForTeacherController,
  listPendingSchemesController,
  updateSchemeController,
  submitSchemeController,
  approveSchemeController,
  rejectSchemeController,
  deleteSchemeController,
  createEntryController,
  bulkCreateEntriesController,
  getEntryByIdController,
  listEntriesForSchemeController,
  updateEntryController,
  markEntryCoveredController,
  unmarkEntryCoveredController,
  reorderEntriesController,
  deleteEntryController,
  createLessonPlanController,
  bulkCreateLessonPlansController,
  getLessonPlanByIdController,
  listLessonPlansForTeacherController,
  listLessonPlansForClassController,
  listLessonPlansForDateRangeController,
  updateLessonPlanController,
  submitLessonPlanController,
  approveLessonPlanController,
  rejectLessonPlanController,
  addReflectionController,
  deleteLessonPlanController,
  getSchemeCoverageController,
} from "./lessonPlans.controller";
import {
  schoolManagementAuth,
  staffAuth,
} from "../../middleware/bearAuth";

const planningRouter = Router();

// ================================================================
// SCHEMES OF WORK
// ================================================================

// Static / scoped — before parameterised
planningRouter.get(
  "/schools/:schoolId/schemes/pending",
  schoolManagementAuth,
  listPendingSchemesController
);
planningRouter.get(
  "/schools/:schoolId/schemes",
  staffAuth,
  listSchemesForSchoolController
);
planningRouter.post(
  "/schools/:schoolId/schemes/bulk",
  staffAuth,
  bulkCreateSchemesController
);
planningRouter.post(
  "/schools/:schoolId/schemes",
  staffAuth,
  createSchemeController
);

planningRouter.get(
  "/teachers/:teacherId/schemes",
  staffAuth,
  listSchemesForTeacherController
);

planningRouter.get("/schemes/:schemeId", staffAuth, getSchemeByIdController);
planningRouter.get(
  "/schemes/:schemeId/coverage",
  staffAuth,
  getSchemeCoverageController
);
planningRouter.patch("/schemes/:schemeId", staffAuth, updateSchemeController);
planningRouter.post("/schemes/:schemeId/submit", staffAuth, submitSchemeController);
planningRouter.post(
  "/schemes/:schemeId/approve",
  schoolManagementAuth,
  approveSchemeController
);
planningRouter.post(
  "/schemes/:schemeId/reject",
  schoolManagementAuth,
  rejectSchemeController
);
planningRouter.delete("/schemes/:schemeId", staffAuth, deleteSchemeController);

// ================================================================
// SCHEME ENTRIES
// ================================================================

planningRouter.get(
  "/schemes/:schemeId/entries",
  staffAuth,
  listEntriesForSchemeController
);
planningRouter.post(
  "/schemes/:schemeId/entries/bulk",
  staffAuth,
  bulkCreateEntriesController
);
planningRouter.put(
  "/schemes/:schemeId/entries/reorder",
  staffAuth,
  reorderEntriesController
);
planningRouter.post("/entries", staffAuth, createEntryController);

planningRouter.get("/entries/:entryId", staffAuth, getEntryByIdController);
planningRouter.patch("/entries/:entryId", staffAuth, updateEntryController);
planningRouter.post(
  "/entries/:entryId/mark-covered",
  staffAuth,
  markEntryCoveredController
);
planningRouter.post(
  "/entries/:entryId/unmark-covered",
  staffAuth,
  unmarkEntryCoveredController
);
planningRouter.delete("/entries/:entryId", staffAuth, deleteEntryController);

// ================================================================
// LESSON PLANS
// ================================================================

planningRouter.get(
  "/schools/:schoolId/lesson-plans",
  staffAuth,
  listLessonPlansForDateRangeController
);
planningRouter.post(
  "/schools/:schoolId/lesson-plans/bulk",
  staffAuth,
  bulkCreateLessonPlansController
);
planningRouter.post(
  "/schools/:schoolId/lesson-plans",
  staffAuth,
  createLessonPlanController
);

planningRouter.get(
  "/teachers/:teacherId/lesson-plans",
  staffAuth,
  listLessonPlansForTeacherController
);

planningRouter.get(
  "/classes/lesson-plans",
  staffAuth,
  listLessonPlansForClassController
);

planningRouter.get(
  "/lesson-plans/:lessonPlanId",
  staffAuth,
  getLessonPlanByIdController
);
planningRouter.patch(
  "/lesson-plans/:lessonPlanId",
  staffAuth,
  updateLessonPlanController
);
planningRouter.post(
  "/lesson-plans/:lessonPlanId/submit",
  staffAuth,
  submitLessonPlanController
);
planningRouter.post(
  "/lesson-plans/:lessonPlanId/approve",
  schoolManagementAuth,
  approveLessonPlanController
);
planningRouter.post(
  "/lesson-plans/:lessonPlanId/reject",
  schoolManagementAuth,
  rejectLessonPlanController
);
planningRouter.post(
  "/lesson-plans/:lessonPlanId/reflection",
  staffAuth,
  addReflectionController
);
planningRouter.delete(
  "/lesson-plans/:lessonPlanId",
  staffAuth,
  deleteLessonPlanController
);

export default planningRouter;