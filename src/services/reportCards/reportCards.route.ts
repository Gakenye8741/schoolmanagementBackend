// src/services/reportCards/reportCards.route.ts
import { Router } from "express";
import {
  generateReportCardController,
  generateReportCardsForClassController,
  generateReportCardsForSchoolController,
  previewReportCardController,
  regenerateReportCardController,
  getReportCardByIdController,
  getReportCardByStudentTermController,
  listReportCardsForStudentController,
  listReportCardsForClassController,
  listReportCardsForTermController,
  updateRemarksController,
  overrideReportCardFieldsController,
  publishReportCardController,
  publishReportCardsForClassController,
  unpublishReportCardController,
  deleteReportCardController,
  deleteReportCardsForTermController,
  getReportCardDataController,
} from "./reportCards.controller";
import {
  adminAuth,
  adminOrTeacherAuth,
  superAdminAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const reportCardsRouter = Router();

// ================================================================
// GENERATE
// ================================================================
reportCardsRouter.post("/generate", adminAuth, generateReportCardController);
reportCardsRouter.post("/generate/class", adminAuth, generateReportCardsForClassController);
reportCardsRouter.post("/generate/school", adminAuth, generateReportCardsForSchoolController);
reportCardsRouter.post("/preview", adminAuth, previewReportCardController);
reportCardsRouter.post("/:reportCardId/regenerate", adminAuth, regenerateReportCardController);

// ================================================================
// READS — static paths first
// ================================================================
reportCardsRouter.get(
  "/school/:schoolId/term/:termId",
  anyAuthenticatedUser,
  listReportCardsForTermController
);
reportCardsRouter.get(
  "/school/:schoolId/class/:classId/term/:termId",
  anyAuthenticatedUser,
  listReportCardsForClassController
);
reportCardsRouter.get(
  "/school/:schoolId/student/:studentId",
  anyAuthenticatedUser,
  listReportCardsForStudentController
);
reportCardsRouter.get(
  "/student/:studentId/term/:termId",
  anyAuthenticatedUser,
  getReportCardByStudentTermController
);

// ================================================================
// PUBLISH — static paths first
// ================================================================
reportCardsRouter.post(
  "/publish/class",
  adminAuth,
  publishReportCardsForClassController
);
reportCardsRouter.delete(
  "/school/:schoolId/term/:termId/all",
  adminAuth,
  deleteReportCardsForTermController
);

// ================================================================
// PER-REPORT-CARD MUTATIONS
// ================================================================
reportCardsRouter.patch(
  "/:reportCardId/remarks",
  adminOrTeacherAuth,
  updateRemarksController
);
reportCardsRouter.patch(
  "/:reportCardId/override",
  adminAuth,
  overrideReportCardFieldsController
);
reportCardsRouter.post(
  "/:reportCardId/publish",
  adminAuth,
  publishReportCardController
);
reportCardsRouter.post(
  "/:reportCardId/unpublish",
  adminAuth,
  unpublishReportCardController
);
reportCardsRouter.get(
  "/:reportCardId/data",
  anyAuthenticatedUser,
  getReportCardDataController
);
reportCardsRouter.delete(
  "/:reportCardId",
  superAdminAuth,
  deleteReportCardController
);

// ================================================================
// GENERIC LOOKUP — LAST
// ================================================================
reportCardsRouter.get(
  "/:reportCardId",
  anyAuthenticatedUser,
  getReportCardByIdController
);

export default reportCardsRouter;