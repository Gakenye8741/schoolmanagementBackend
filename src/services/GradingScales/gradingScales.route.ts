// routes/gradingScales.router.ts
import { Router } from "express";
import {
  createGradingScaleController,
  getGradingScaleByIdController,
  listGradingScalesController,
  getDefaultGradingScaleController,
  setDefaultGradingScaleController,
  updateGradingScaleController,
  deleteGradingScaleController,
  searchGradingScalesController,
  copyGradingScaleController,
  seedDefaultGradingScaleController,
  createGradingBandController,
  bulkCreateGradingBandsController,
  listGradingBandsController,
  updateGradingBandController,
  deleteGradingBandController,
  deleteAllBandsForScaleController,
  resolveGradeForMarkController,
  validateGradingScaleController,
} from "./gradingScales.controller";
import {
  adminAuth,
  adminOrTeacherAuth,
  superAdminAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const gradingScalesRouter = Router();

// ================================================================
// RESOLVE — static path, no conflicts
// ================================================================
gradingScalesRouter.post("/resolve", adminOrTeacherAuth, resolveGradeForMarkController);

// ================================================================
// SCALES
// ================================================================

// Static prefix first
gradingScalesRouter.post("/scales", adminAuth, createGradingScaleController);
gradingScalesRouter.post("/scales/copy", adminAuth, copyGradingScaleController);
gradingScalesRouter.post("/scales/seed", adminAuth, seedDefaultGradingScaleController);

gradingScalesRouter.get(
  "/scales/school/:schoolId",
  anyAuthenticatedUser,
  listGradingScalesController
);
gradingScalesRouter.get(
  "/scales/school/:schoolId/default",
  anyAuthenticatedUser,
  getDefaultGradingScaleController
);
gradingScalesRouter.get(
  "/scales/school/:schoolId/search",
  anyAuthenticatedUser,
  searchGradingScalesController
);
gradingScalesRouter.post(
  "/scales/school/:schoolId/set-default",
  adminAuth,
  setDefaultGradingScaleController
);

// Per-scale
gradingScalesRouter.get(
  "/scales/:scaleId/bands",
  anyAuthenticatedUser,
  listGradingBandsController
);
gradingScalesRouter.post(
  "/scales/:scaleId/bands",
  adminAuth,
  createGradingBandController
);
gradingScalesRouter.post(
  "/scales/:scaleId/bands/bulk",
  adminAuth,
  bulkCreateGradingBandsController
);
gradingScalesRouter.delete(
  "/scales/:scaleId/bands",
  adminAuth,
  deleteAllBandsForScaleController
);
gradingScalesRouter.get(
  "/scales/:scaleId/validate",
  anyAuthenticatedUser,
  validateGradingScaleController
);
gradingScalesRouter.put(
  "/scales/:scaleId",
  adminAuth,
  updateGradingScaleController
);
gradingScalesRouter.delete(
  "/scales/:scaleId",
  superAdminAuth,
  deleteGradingScaleController
);

// Generic lookup LAST
gradingScalesRouter.get(
  "/scales/:scaleId",
  anyAuthenticatedUser,
  getGradingScaleByIdController
);

// ================================================================
// BANDS (top-level mutations)
// ================================================================
gradingScalesRouter.put("/bands/:bandId", adminAuth, updateGradingBandController);
gradingScalesRouter.delete(
  "/bands/:bandId",
  adminAuth,
  deleteGradingBandController
);

export default gradingScalesRouter;