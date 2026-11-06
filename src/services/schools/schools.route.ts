import { Router } from "express";
import {
  // Core
  createSchoolController,
  getSchoolByIdController,
  getSchoolBySlugController,
  getSchoolByRegistrationNumberController,
  getSchoolByKnecCodeController,
  listSchoolsController,
  updateSchoolController,
  softDeleteSchoolController,
  restoreSchoolController,
  permanentlyDeleteSchoolController,
  listDeletedSchoolsController,
  // Availability & slug
  checkSlugAvailabilityController,
  checkRegistrationNumberAvailabilityController,
  updateSchoolSlugController,
  // Status
  toggleSchoolStatusController,
  bulkToggleSchoolStatusController,
  // Branding
  updateSchoolBrandingController,
  updateSchoolLogoController,
  resetSchoolBrandingController,
  getPublicSchoolBrandingController,
  // Identity, contact, localization, curriculum
  updateSchoolSettingsController,
  updateSchoolContactController,
  updateSchoolLocalizationController,
  updateSchoolCurriculumController,
  updateSchoolPrincipalController,
  // Settings JSON & modules
  getSchoolSettingsJsonController,
  mergeSchoolSettingsJsonController,
  toggleSchoolModuleController,
  getSchoolModulesController,
  isSchoolModuleEnabledController,
  // Subscription
  updateSchoolSubscriptionController,
  changeSchoolPlanController,
  extendSchoolSubscriptionController,
  suspendSchoolSubscriptionController,
  reactivateSchoolSubscriptionController,
  cancelSchoolSubscriptionController,
  getExpiringSchoolsController,
  runSubscriptionLifecycleController,
  checkSchoolAccessController,
  // Limits & SMS
  setMaxStudentsController,
  checkStudentLimitController,
  getSmsCreditsController,
  addSmsCreditsController,
  deductSmsCreditsController,
  // Stats
  getSchoolStatsController,
  getPlatformStatsController,
  getSchoolsByCountyController,
} from "./schools.controller";
import { superAdminAuth, adminAuth, anyAuthenticatedUser } from "../../middleware/bearAuth";

const router = Router();

/* ============================================================================
 * IMPORTANT: routes with fixed words (like /trash or /bulk/status) MUST come
 * before routes with /:schoolId. If not, Express will think "trash" is a school ID.
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 * 1. PUBLIC ROUTES (no login needed) - used by login pages and school portals
 * -------------------------------------------------------------------------- */
router.get("/slug/:slug", getSchoolBySlugController);
router.get("/public/:slug/branding", getPublicSchoolBrandingController);

/* ----------------------------------------------------------------------------
 * 2. SUPER ADMIN - FIXED-WORD ROUTES (platform level)
 * -------------------------------------------------------------------------- */
// Reports & dashboards
router.get("/platform-stats", superAdminAuth, getPlatformStatsController);
router.get("/by-county", superAdminAuth, getSchoolsByCountyController);

// Trash (soft-deleted schools)
router.get("/trash", superAdminAuth, listDeletedSchoolsController);

// Subscription jobs & reminders
router.get("/expiring", superAdminAuth, getExpiringSchoolsController);
router.post("/subscriptions/run-lifecycle", superAdminAuth, runSubscriptionLifecycleController);

// Availability checks (used on the "create school" form)
router.get("/check-slug", superAdminAuth, checkSlugAvailabilityController);
router.get("/check-registration-number", superAdminAuth, checkRegistrationNumberAvailabilityController);

// Find a school by other unique codes
router.get("/registration/:registrationNumber", superAdminAuth, getSchoolByRegistrationNumberController);
router.get("/knec/:knecCode", superAdminAuth, getSchoolByKnecCodeController);

// Bulk actions
router.patch("/bulk/status", superAdminAuth, bulkToggleSchoolStatusController);

/* ----------------------------------------------------------------------------
 * 3. SCHOOL CREATION & LISTING
 * -------------------------------------------------------------------------- */
router.post("/", superAdminAuth, createSchoolController);
router.get("/", anyAuthenticatedUser, listSchoolsController);

/* ----------------------------------------------------------------------------
 * 4. SUPER ADMIN - ONE SCHOOL (/:schoolId)
 * -------------------------------------------------------------------------- */
// General update (both PUT and PATCH work)
router.put("/:schoolId", superAdminAuth, updateSchoolController);
router.patch("/:schoolId", superAdminAuth, updateSchoolController);

// Delete / restore
router.delete("/:schoolId", superAdminAuth, softDeleteSchoolController);
router.patch("/:schoolId/restore", superAdminAuth, restoreSchoolController);
router.delete("/:schoolId/permanent", superAdminAuth, permanentlyDeleteSchoolController);

// Status & slug
router.patch("/:schoolId/status", superAdminAuth, toggleSchoolStatusController);
router.patch("/:schoolId/slug", superAdminAuth, updateSchoolSlugController);

// Subscription & billing
router.patch("/:schoolId/subscription", superAdminAuth, updateSchoolSubscriptionController);
router.patch("/:schoolId/subscription/plan", superAdminAuth, changeSchoolPlanController);
router.patch("/:schoolId/subscription/extend", superAdminAuth, extendSchoolSubscriptionController);
router.patch("/:schoolId/subscription/suspend", superAdminAuth, suspendSchoolSubscriptionController);
router.patch("/:schoolId/subscription/reactivate", superAdminAuth, reactivateSchoolSubscriptionController);
router.patch("/:schoolId/subscription/cancel", superAdminAuth, cancelSchoolSubscriptionController);

// Student limit & SMS credits (money-related, so Super Admin only)
router.patch("/:schoolId/max-students", superAdminAuth, setMaxStudentsController);
router.post("/:schoolId/sms-credits/add", superAdminAuth, addSmsCreditsController);
router.post("/:schoolId/sms-credits/deduct", superAdminAuth, deductSmsCreditsController);

/* ----------------------------------------------------------------------------
 * 5. SCHOOL ADMIN - ONE SCHOOL (/:schoolId)
 * -------------------------------------------------------------------------- */
// Branding
router.patch("/:schoolId/branding", adminAuth, updateSchoolBrandingController);
router.patch("/:schoolId/branding/reset", adminAuth, resetSchoolBrandingController);
router.patch("/:schoolId/logo", adminAuth, updateSchoolLogoController);

// School details
router.patch("/:schoolId/settings", adminAuth, updateSchoolSettingsController);
router.patch("/:schoolId/contact", adminAuth, updateSchoolContactController);
router.patch("/:schoolId/localization", adminAuth, updateSchoolLocalizationController);
router.patch("/:schoolId/curriculum", adminAuth, updateSchoolCurriculumController);
router.patch("/:schoolId/principal", adminAuth, updateSchoolPrincipalController);

// Advanced settings & modules
router.get("/:schoolId/settings-json", adminAuth, getSchoolSettingsJsonController);
router.patch("/:schoolId/settings-json", adminAuth, mergeSchoolSettingsJsonController);
router.patch("/:schoolId/modules", adminAuth, toggleSchoolModuleController);

// Reports for the school
router.get("/:schoolId/stats", adminAuth, getSchoolStatsController);
router.get("/:schoolId/sms-credits", adminAuth, getSmsCreditsController);
router.get("/:schoolId/student-limit", adminAuth, checkStudentLimitController);

/* ----------------------------------------------------------------------------
 * 6. ANY LOGGED-IN USER - ONE SCHOOL (read only)
 * -------------------------------------------------------------------------- */
router.get("/:schoolId/modules", anyAuthenticatedUser, getSchoolModulesController);
router.get("/:schoolId/modules/:moduleKey", anyAuthenticatedUser, isSchoolModuleEnabledController);
router.get("/:schoolId/access", anyAuthenticatedUser, checkSchoolAccessController);
router.get("/:schoolId", anyAuthenticatedUser, getSchoolByIdController);

export default router;