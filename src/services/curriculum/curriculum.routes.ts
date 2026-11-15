// src/routes/curriculum.routes.ts
import { Router } from "express";
import {
  createStrandController,
  bulkCreateStrandsController,
  getStrandByIdController,
  getStrandWithSubStrandsController,
  listStrandsForSubjectAndGradeController,
  listStrandsForSchoolController,
  updateStrandController,
  deleteStrandController,
  reorderStrandsController,
  countStrandsController,
  getCurriculumTreeController,
  createSubStrandController,
  bulkCreateSubStrandsController,
  getSubStrandByIdController,
  listSubStrandsForStrandController,
  listSubStrandsForSchoolController,
  updateSubStrandController,
  deleteSubStrandController,
  reorderSubStrandsController,
  countSubStrandsController,
  searchSubStrandsController,
  getSubStrandsWithOutcomesController,
  copyCurriculumFromSchoolController,
  getCurriculumCoverageController,
  getCurriculumStatsController,
} from "./curriculum.controller";
import {
  anyAuthenticatedUser,
  schoolManagementAuth,
  staffAuth,
} from "../../middleware/bearAuth";

const curriculumRouter = Router();

// ================================================================
// STRANDS
// ================================================================

// Static / scoped routes first
curriculumRouter.get(
  "/schools/:schoolId/strands/count",
  anyAuthenticatedUser,
  countStrandsController
);
curriculumRouter.get(
  "/schools/:schoolId/tree",
  anyAuthenticatedUser,
  getCurriculumTreeController
);
curriculumRouter.get(
  "/schools/:schoolId/strands/by-subject-grade",
  anyAuthenticatedUser,
  listStrandsForSubjectAndGradeController
);
curriculumRouter.get(
  "/schools/:schoolId/strands",
  anyAuthenticatedUser,
  listStrandsForSchoolController
);
curriculumRouter.put(
  "/schools/:schoolId/strands/reorder",
  schoolManagementAuth,
  reorderStrandsController
);
curriculumRouter.post(
  "/schools/:schoolId/strands/bulk",
  schoolManagementAuth,
  bulkCreateStrandsController
);
curriculumRouter.post(
  "/schools/:schoolId/strands",
  schoolManagementAuth,
  createStrandController
);

curriculumRouter.get(
  "/strands/:strandId/with-sub-strands",
  anyAuthenticatedUser,
  getStrandWithSubStrandsController
);
curriculumRouter.get(
  "/strands/:strandId",
  anyAuthenticatedUser,
  getStrandByIdController
);
curriculumRouter.patch(
  "/strands/:strandId",
  schoolManagementAuth,
  updateStrandController
);
curriculumRouter.delete(
  "/strands/:strandId",
  schoolManagementAuth,
  deleteStrandController
);

// ================================================================
// SUB-STRANDS
// ================================================================

// Static / scoped routes first
curriculumRouter.get(
  "/schools/:schoolId/sub-strands/count",
  anyAuthenticatedUser,
  countSubStrandsController
);
curriculumRouter.get(
  "/schools/:schoolId/sub-strands/search",
  anyAuthenticatedUser,
  searchSubStrandsController
);
curriculumRouter.get(
  "/schools/:schoolId/sub-strands/with-outcomes",
  staffAuth,
  getSubStrandsWithOutcomesController
);
curriculumRouter.get(
  "/schools/:schoolId/sub-strands",
  anyAuthenticatedUser,
  listSubStrandsForSchoolController
);
curriculumRouter.put(
  "/schools/:schoolId/sub-strands/reorder",
  schoolManagementAuth,
  reorderSubStrandsController
);
curriculumRouter.post(
  "/schools/:schoolId/sub-strands/bulk",
  schoolManagementAuth,
  bulkCreateSubStrandsController
);
curriculumRouter.post(
  "/schools/:schoolId/sub-strands",
  schoolManagementAuth,
  createSubStrandController
);

curriculumRouter.get(
  "/strands/:strandId/sub-strands",
  anyAuthenticatedUser,
  listSubStrandsForStrandController
);
curriculumRouter.get(
  "/sub-strands/:subStrandId",
  anyAuthenticatedUser,
  getSubStrandByIdController
);
curriculumRouter.patch(
  "/sub-strands/:subStrandId",
  schoolManagementAuth,
  updateSubStrandController
);
curriculumRouter.delete(
  "/sub-strands/:subStrandId",
  schoolManagementAuth,
  deleteSubStrandController
);

// ================================================================
// CROSS-CUTTING
// ================================================================

curriculumRouter.get(
  "/schools/:schoolId/stats",
  schoolManagementAuth,
  getCurriculumStatsController
);
curriculumRouter.get(
  "/schools/:schoolId/coverage",
  staffAuth,
  getCurriculumCoverageController
);
curriculumRouter.post(
  "/schools/:schoolId/copy-from",
  schoolManagementAuth,
  copyCurriculumFromSchoolController
);

export default curriculumRouter;