import { Router } from "express";
import {
  // Grade Levels
  createGradeLevelController,
  getGradeLevelByIdController,
  getGradeLevelWithClassesController,
  listGradeLevelsController,
  listGradeLevelsByStageController,
  updateGradeLevelController,
  deleteGradeLevelController,
  setNextGradeLevelController,
  markGradeLevelAsFinalController,
  getFinalGradeLevelController,
  getPromotionChainController,
  getPreviousGradeLevelController,
  countGradeLevelsController,
  bulkCreateGradeLevelsController,
  reorderGradeLevelsController,
  validatePromotionLadderController,
  getGradeLevelByNameController,
  searchGradeLevelsController,
  getRootGradeLevelController,
  getPromotionSummaryController,
  // Subjects
  createSubjectController,
  getSubjectByIdController,
  getSubjectByCodeController,
  listSubjectsController,
  listSubjectsByCategoryController,
  updateSubjectController,
  deleteSubjectController,
  countSubjectsController,
  bulkCreateSubjectsController,
  searchSubjectsController,
  listSubjectsForClassController,
  listSubjectsForTeacherController,
  duplicateSubjectController,
  countClassesUsingSubjectController,
  getSubjectUsageSummaryController,
  renameSubjectCodeController,
  assertSubjectExistsController,
  listCoreSubjectsController,
  // Classes
  createClassController,
  getClassByIdController,
  getClassWithRelationsController,
  listClassesController,
  listClassesByYearController,
  listClassesByGradeLevelController,
  listClassesForTeacherController,
  updateClassController,
  deleteClassController,
  assignClassTeacherController,
  addSubjectToClassController,
  removeSubjectFromClassController,
  assignTeacherToClassSubjectController,
  listClassStudentsController,
  countClassStudentsController,
  checkClassCapacityController,
  bulkCreateClassesController,
  rollClassesToYearController,
  transferStudentBetweenClassesController,
  getClassStatisticsController,
  searchClassesController,
  validateClassReadinessController,
  linkStudentToClassController,
} from "./academicStructure.controller";
import {
  adminAuth,
  adminOrTeacherAuth,
  superAdminAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const academicStructureRouter = Router();

// ================================================================
// GRADE LEVELS
// ================================================================

// Static-prefix routes BEFORE "/:gradeLevelId"
academicStructureRouter.post("/grade-levels", adminAuth, createGradeLevelController);
academicStructureRouter.post("/grade-levels/bulk", adminAuth, bulkCreateGradeLevelsController);
academicStructureRouter.put("/grade-levels/reorder", adminAuth, reorderGradeLevelsController);

academicStructureRouter.get(
  "/grade-levels/school/:schoolId",
  anyAuthenticatedUser,
  listGradeLevelsController
);
academicStructureRouter.get(
  "/grade-levels/school/:schoolId/count",
  anyAuthenticatedUser,
  countGradeLevelsController
);
academicStructureRouter.get(
  "/grade-levels/school/:schoolId/by-stage",
  anyAuthenticatedUser,
  listGradeLevelsByStageController
);
academicStructureRouter.get(
  "/grade-levels/school/:schoolId/final",
  anyAuthenticatedUser,
  getFinalGradeLevelController
);
academicStructureRouter.get(
  "/grade-levels/school/:schoolId/root",
  anyAuthenticatedUser,
  getRootGradeLevelController
);
academicStructureRouter.get(
  "/grade-levels/school/:schoolId/lookup",
  anyAuthenticatedUser,
  getGradeLevelByNameController
);
academicStructureRouter.get(
  "/grade-levels/school/:schoolId/search",
  anyAuthenticatedUser,
  searchGradeLevelsController
);
academicStructureRouter.get(
  "/grade-levels/school/:schoolId/validate-ladder",
  anyAuthenticatedUser,
  validatePromotionLadderController
);
academicStructureRouter.get(
  "/grade-levels/school/:schoolId/promotion-summary",
  anyAuthenticatedUser,
  getPromotionSummaryController
);

// Per-grade-level actions and reads
academicStructureRouter.get(
  "/grade-levels/:gradeLevelId/with-classes",
  anyAuthenticatedUser,
  getGradeLevelWithClassesController
);
academicStructureRouter.get(
  "/grade-levels/:gradeLevelId/chain",
  anyAuthenticatedUser,
  getPromotionChainController
);
academicStructureRouter.get(
  "/grade-levels/:gradeLevelId/previous",
  anyAuthenticatedUser,
  getPreviousGradeLevelController
);
academicStructureRouter.put(
  "/grade-levels/:gradeLevelId/next",
  adminAuth,
  setNextGradeLevelController
);
academicStructureRouter.post(
  "/grade-levels/:gradeLevelId/mark-final",
  adminAuth,
  markGradeLevelAsFinalController
);
academicStructureRouter.put(
  "/grade-levels/:gradeLevelId",
  adminAuth,
  updateGradeLevelController
);
academicStructureRouter.delete(
  "/grade-levels/:gradeLevelId",
  superAdminAuth,
  deleteGradeLevelController
);

// Generic lookup LAST among GET routes
academicStructureRouter.get(
  "/grade-levels/:gradeLevelId",
  anyAuthenticatedUser,
  getGradeLevelByIdController
);

// ================================================================
// SUBJECTS
// ================================================================

// Static-prefix routes BEFORE "/:subjectId"
academicStructureRouter.post("/subjects", adminAuth, createSubjectController);
academicStructureRouter.post("/subjects/bulk", adminAuth, bulkCreateSubjectsController);
academicStructureRouter.get("/subjects/verify", anyAuthenticatedUser, assertSubjectExistsController);

academicStructureRouter.get(
  "/subjects/school/:schoolId",
  anyAuthenticatedUser,
  listSubjectsController
);
academicStructureRouter.get(
  "/subjects/school/:schoolId/count",
  anyAuthenticatedUser,
  countSubjectsController
);
academicStructureRouter.get(
  "/subjects/school/:schoolId/by-code",
  anyAuthenticatedUser,
  getSubjectByCodeController
);
academicStructureRouter.get(
  "/subjects/school/:schoolId/by-category",
  anyAuthenticatedUser,
  listSubjectsByCategoryController
);
academicStructureRouter.get(
  "/subjects/school/:schoolId/search",
  anyAuthenticatedUser,
  searchSubjectsController
);
academicStructureRouter.get(
  "/subjects/school/:schoolId/usage-summary",
  anyAuthenticatedUser,
  getSubjectUsageSummaryController
);
academicStructureRouter.get(
  "/subjects/school/:schoolId/core",
  anyAuthenticatedUser,
  listCoreSubjectsController
);

academicStructureRouter.get(
  "/subjects/class/:classId",
  anyAuthenticatedUser,
  listSubjectsForClassController
);
academicStructureRouter.get(
  "/subjects/teacher/:teacherId",
  anyAuthenticatedUser,
  listSubjectsForTeacherController
);

// Per-subject actions and reads
academicStructureRouter.post(
  "/subjects/:subjectId/duplicate",
  adminAuth,
  duplicateSubjectController
);
academicStructureRouter.put(
  "/subjects/:subjectId/code",
  adminAuth,
  renameSubjectCodeController
);
academicStructureRouter.get(
  "/subjects/:subjectId/usage-count",
  anyAuthenticatedUser,
  countClassesUsingSubjectController
);
academicStructureRouter.put(
  "/subjects/:subjectId",
  adminAuth,
  updateSubjectController
);
academicStructureRouter.delete(
  "/subjects/:subjectId",
  superAdminAuth,
  deleteSubjectController
);

// Generic lookup LAST among GET routes
academicStructureRouter.get(
  "/subjects/:subjectId",
  anyAuthenticatedUser,
  getSubjectByIdController
);

// ================================================================
// CLASSES
// ================================================================

// Static-prefix routes BEFORE "/:classId"
academicStructureRouter.post("/classes", adminAuth, createClassController);
academicStructureRouter.post("/classes/bulk", adminAuth, bulkCreateClassesController);
academicStructureRouter.post("/classes/roll-to-year", adminAuth, rollClassesToYearController);
academicStructureRouter.post(
  "/classes/transfer-student",
  adminAuth,
  transferStudentBetweenClassesController
);

academicStructureRouter.get(
  "/classes/school/:schoolId",
  anyAuthenticatedUser,
  listClassesController
);
academicStructureRouter.get(
  "/classes/school/:schoolId/by-year",
  anyAuthenticatedUser,
  listClassesByYearController
);
academicStructureRouter.get(
  "/classes/school/:schoolId/search",
  anyAuthenticatedUser,
  searchClassesController
);

academicStructureRouter.get(
  "/classes/grade-level/:gradeLevelId",
  anyAuthenticatedUser,
  listClassesByGradeLevelController
);
academicStructureRouter.get(
  "/classes/teacher/:teacherId",
  anyAuthenticatedUser,
  listClassesForTeacherController
);

// Per-class actions and reads
academicStructureRouter.get(
  "/classes/:classId/with-relations",
  anyAuthenticatedUser,
  getClassWithRelationsController
);
academicStructureRouter.get(
  "/classes/:classId/students",
  anyAuthenticatedUser,
  listClassStudentsController
);
academicStructureRouter.get(
  "/classes/:classId/students/count",
  anyAuthenticatedUser,
  countClassStudentsController
);
academicStructureRouter.get(
  "/classes/:classId/capacity",
  anyAuthenticatedUser,
  checkClassCapacityController
);
academicStructureRouter.get(
  "/classes/:classId/statistics",
  anyAuthenticatedUser,
  getClassStatisticsController
);
academicStructureRouter.get(
  "/classes/:classId/readiness",
  anyAuthenticatedUser,
  validateClassReadinessController
);

academicStructureRouter.put(
  "/classes/:classId/teacher",
  adminAuth,
  assignClassTeacherController
);
academicStructureRouter.post(
  "/classes/:classId/subjects",
  adminAuth,
  addSubjectToClassController
);
academicStructureRouter.delete(
  "/classes/:classId/subjects/:subjectId",
  adminAuth,
  removeSubjectFromClassController
);
academicStructureRouter.put(
  "/classes/:classId",
  adminAuth,
  updateClassController
);
academicStructureRouter.delete(
  "/classes/:classId",
  superAdminAuth,
  deleteClassController
);

// Class-subject teacher assignment — its own top-level path
academicStructureRouter.put(
  "/class-subjects/:classSubjectId/teacher",
  adminAuth,
  assignTeacherToClassSubjectController
);

// Generic lookup LAST among GET routes
academicStructureRouter.get(
  "/classes/:classId",
  anyAuthenticatedUser,
  getClassByIdController
);

// ← NEW: link student to class
academicStructureRouter.post(
  "/classes/link-student",
  adminAuth,
  linkStudentToClassController
);

export default academicStructureRouter;