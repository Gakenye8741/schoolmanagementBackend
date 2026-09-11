import { Router } from "express";
import {
  createSchoolController,
  getSchoolByIdController,
  getSchoolBySlugController,
  listSchoolsController,
  updateSchoolController,
  toggleSchoolStatusController,
  updateSchoolBrandingController,
  updateSchoolSubscriptionController,
  updateSchoolSettingsController,
  updateSchoolContactController,
} from "./schools.controller";
import { superAdminAuth, adminAuth, anyAuthenticatedUser } from "../../middleware/bearAuth";

const router = Router();

// School Creation & Management Routes (Super Admin level)
router.post("/", superAdminAuth, createSchoolController);
router.put("/:schoolId", superAdminAuth, updateSchoolController);
router.patch("/:schoolId/status", superAdminAuth, toggleSchoolStatusController);
router.patch("/:schoolId/subscription", superAdminAuth, updateSchoolSubscriptionController);

// Public / Portal Resolution Routes
router.get("/slug/:slug", getSchoolBySlugController);

// Administrative / Management Routes (Admin & School Admin levels)
router.get("/", anyAuthenticatedUser, listSchoolsController);
router.get("/:schoolId", anyAuthenticatedUser, getSchoolByIdController);
router.patch("/:schoolId/branding", adminAuth, updateSchoolBrandingController);
router.patch("/:schoolId/settings", adminAuth, updateSchoolSettingsController);
router.patch("/:schoolId/contact", adminAuth, updateSchoolContactController);

export default router;