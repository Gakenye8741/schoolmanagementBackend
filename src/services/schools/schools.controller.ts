import { Request, Response } from "express";
import { z } from "zod";
import {
  // Core
  createSchoolService,
  getSchoolByIdService,
  getSchoolBySlugService,
  getSchoolByRegistrationNumberService,
  getSchoolByKnecCodeService,
  listSchoolsService,
  updateSchoolService,
  softDeleteSchoolService,
  restoreSchoolService,
  permanentlyDeleteSchoolService,
  listDeletedSchoolsService,
  // Availability & slug
  checkSlugAvailabilityService,
  checkRegistrationNumberAvailabilityService,
  updateSchoolSlugService,
  // Status
  toggleSchoolStatusService,
  bulkToggleSchoolStatusService,
  // Branding
  updateSchoolBrandingService,
  updateSchoolLogoService,
  resetSchoolBrandingService,
  getPublicSchoolBrandingService,
  // Identity, contact, localization, curriculum
  updateSchoolSettingsService,
  updateSchoolContactService,
  updateSchoolLocalizationService,
  updateSchoolCurriculumService,
  updateSchoolPrincipalService,
  // Settings JSON & modules
  getSchoolSettingsJsonService,
  mergeSchoolSettingsJsonService,
  toggleSchoolModuleService,
  getSchoolModulesService,
  isSchoolModuleEnabledService,
  // Subscription
  updateSchoolSubscriptionService,
  changeSchoolPlanService,
  extendSchoolSubscriptionService,
  suspendSchoolSubscriptionService,
  reactivateSchoolSubscriptionService,
  cancelSchoolSubscriptionService,
  getExpiringSchoolsService,
  runSubscriptionLifecycleService,
  checkSchoolAccessService,
  // Limits & SMS
  setMaxStudentsService,
  checkStudentLimitService,
  getSmsCreditsService,
  addSmsCreditsService,
  deductSmsCreditsService,
  // Stats
  getSchoolStatsService,
  getPlatformStatsService,
  getSchoolsByCountyService,
  SchoolResponse,
} from "./school.service";
import {
  schoolIdParamSchema,
  schoolSlugParamSchema,
  schoolModuleParamSchema,
  createSchoolSchema,
  updateSchoolSchema,
  updateSchoolSlugSchema,
  toggleSchoolStatusSchema,
  bulkToggleSchoolStatusSchema,
  updateSchoolBrandingSchema,
  updateSchoolLogoSchema,
  updateSchoolSettingsSchema,
  updateSchoolContactSchema,
  updateSchoolLocalizationSchema,
  updateSchoolCurriculumSchema,
  updateSchoolPrincipalSchema,
  mergeSchoolSettingsJsonSchema,
  toggleSchoolModuleSchema,
  updateSchoolSubscriptionSchema,
  changeSchoolPlanSchema,
  extendSchoolSubscriptionSchema,
  suspendSchoolSubscriptionSchema,
  expiringSchoolsQuerySchema,
  subscriptionLifecycleSchema,
  setMaxStudentsSchema,
  checkStudentLimitQuerySchema,
  smsCreditsSchema,
  listSchoolsQuerySchema,
  checkSlugQuerySchema,
  checkRegistrationNumberQuerySchema,
} from "../../validators/school.validator";

/* ============================================================================
 * SMALL HELPERS (keep every controller short and easy to read)
 * ========================================================================== */

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

/** Wraps a controller so any unexpected crash returns a friendly 500 message. */
const safe =
  (errorMessage: string, handler: AsyncHandler): AsyncHandler =>
  async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(`[SchoolController] ${errorMessage}`, error);
      res.status(500).json({ success: false, message: errorMessage });
    }
  };

/** Express can give a param as a string or a list. We always want one string. */
const firstValue = (value: unknown): string | undefined =>
  Array.isArray(value) ? (value[0] as string) : (value as string | undefined);

/** Reads and checks the school ID from the URL. Sends an error and returns null if it is bad. */
const readSchoolId = (req: Request, res: Response): string | null => {
  const parsed = schoolIdParamSchema.safeParse({ id: firstValue(req.params.schoolId) });
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "The school ID is missing or not valid. Please check the link and try again.",
    });
    return null;
  }
  return parsed.data.id;
};

/** Reads and checks the slug from the URL. */
const readSlug = (req: Request, res: Response): string | null => {
  const parsed = schoolSlugParamSchema.safeParse({ slug: firstValue(req.params.slug) });
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "The school slug is missing or not valid. Use only small letters, numbers and dashes.",
    });
    return null;
  }
  return parsed.data.slug;
};

/** Checks any data (body or query) against a schema. Sends a clear error if it is wrong. */
const readData = <S extends z.ZodTypeAny>(schema: S, data: unknown, res: Response): z.infer<S> | null => {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    res.status(400).json({
      success: false,
      message: "Some of the information you sent is not correct. Please fix the errors and try again.",
      errors: { formErrors: flat.formErrors, fieldErrors: flat.fieldErrors },
    });
    return null;
  }
  return parsed.data;
};

/** Picks a suitable HTTP status for a failed service result. */
const failureStatus = (message: string): number => {
  const text = message.toLowerCase();
  if (text.includes("not found")) return 404;
  if (text.includes("already exists")) return 409;
  return 400;
};

/** Sends the result: our own friendly message on success, the service message on failure. */
const respond = (res: Response, result: SchoolResponse<any>, successMessage: string, successStatus = 200): void => {
  if (result.success) {
    res.status(successStatus).json({ ...result, message: successMessage });
    return;
  }
  res.status(failureStatus(result.message)).json(result);
};

/* ============================================================================
 * 1. CORE: CREATE, READ, LIST, UPDATE, DELETE
 * ========================================================================== */

/** POST /schools */
export const createSchoolController = safe(
  "Something went wrong while creating the school. Please try again.",
  async (req, res) => {
    const data = readData(createSchoolSchema, req.body, res);
    if (!data) return;

    const result = await createSchoolService(data);
    respond(res, result, "Great! The school has been created successfully.", 201);
  }
);

/** GET /schools/:schoolId */
export const getSchoolByIdController = safe(
  "Something went wrong while getting the school. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await getSchoolByIdService(schoolId);
    respond(res, result, "School details loaded successfully.");
  }
);

/** GET /schools/slug/:slug */
export const getSchoolBySlugController = safe(
  "Something went wrong while finding the school by its slug. Please try again.",
  async (req, res) => {
    const slug = readSlug(req, res);
    if (!slug) return;

    const result = await getSchoolBySlugService(slug);
    respond(res, result, "School found successfully.");
  }
);

/** GET /schools/registration/:registrationNumber */
export const getSchoolByRegistrationNumberController = safe(
  "Something went wrong while finding the school by its registration number. Please try again.",
  async (req, res) => {
    const registrationNumber = firstValue(req.params.registrationNumber)?.trim();
    if (!registrationNumber) {
      res.status(400).json({ success: false, message: "Please give a registration number." });
      return;
    }

    const result = await getSchoolByRegistrationNumberService(registrationNumber);
    respond(res, result, "School found successfully.");
  }
);

/** GET /schools/knec/:knecCode */
export const getSchoolByKnecCodeController = safe(
  "Something went wrong while finding the school by its KNEC code. Please try again.",
  async (req, res) => {
    const knecCode = firstValue(req.params.knecCode)?.trim();
    if (!knecCode) {
      res.status(400).json({ success: false, message: "Please give a KNEC code." });
      return;
    }

    const result = await getSchoolByKnecCodeService(knecCode);
    respond(res, result, "School found successfully.");
  }
);

/** GET /schools?page=1&limit=20&search=...&county=...&isActive=true */
export const listSchoolsController = safe(
  "Something went wrong while loading the schools. Please try again.",
  async (req, res) => {
    const query = readData(listSchoolsQuerySchema, req.query, res);
    if (!query) return;

    const result = await listSchoolsService(query);
    respond(res, result, "Schools loaded successfully.");
  }
);

/** PATCH /schools/:schoolId */
export const updateSchoolController = safe(
  "Something went wrong while updating the school. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const updates = readData(updateSchoolSchema, req.body, res);
    if (!updates) return;

    const result = await updateSchoolService(schoolId, updates);
    respond(res, result, "The school has been updated successfully.");
  }
);

/** DELETE /schools/:schoolId  (soft delete, can be restored later) */
export const softDeleteSchoolController = safe(
  "Something went wrong while deleting the school. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await softDeleteSchoolService(schoolId);
    respond(res, result, "The school has been moved to the trash. You can restore it later.");
  }
);

/** PATCH /schools/:schoolId/restore */
export const restoreSchoolController = safe(
  "Something went wrong while restoring the school. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await restoreSchoolService(schoolId);
    respond(res, result, "The school has been restored and is active again.");
  }
);

/** DELETE /schools/:schoolId/permanent  (cannot be undone) */
export const permanentlyDeleteSchoolController = safe(
  "Something went wrong while permanently deleting the school. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await permanentlyDeleteSchoolService(schoolId);
    respond(res, result, "The school has been deleted forever. This cannot be undone.");
  }
);

/** GET /schools/trash */
export const listDeletedSchoolsController = safe(
  "Something went wrong while loading deleted schools. Please try again.",
  async (_req, res) => {
    const result = await listDeletedSchoolsService();
    respond(res, result, "Deleted schools loaded successfully.");
  }
);

/* ============================================================================
 * 2. AVAILABILITY CHECKS & SLUG
 * ========================================================================== */

/** GET /schools/check-slug?slug=my-school&excludeSchoolId=... */
export const checkSlugAvailabilityController = safe(
  "Something went wrong while checking the slug. Please try again.",
  async (req, res) => {
    const query = readData(checkSlugQuerySchema, req.query, res);
    if (!query) return;

    const result = await checkSlugAvailabilityService(query.slug, query.excludeSchoolId);
    if (!result.success) {
      res.status(failureStatus(result.message)).json(result);
      return;
    }

    const available = result.data?.available === true;
    res.status(200).json({
      ...result,
      message: available
        ? "Good news! This slug is free to use."
        : "Sorry, this slug cannot be used. It may be taken or not allowed.",
    });
  }
);

/** GET /schools/check-registration-number?registrationNumber=... */
export const checkRegistrationNumberAvailabilityController = safe(
  "Something went wrong while checking the registration number. Please try again.",
  async (req, res) => {
    const query = readData(checkRegistrationNumberQuerySchema, req.query, res);
    if (!query) return;

    const result = await checkRegistrationNumberAvailabilityService(
      query.registrationNumber,
      query.excludeSchoolId
    );
    if (!result.success) {
      res.status(failureStatus(result.message)).json(result);
      return;
    }

    const available = result.data?.available === true;
    res.status(200).json({
      ...result,
      message: available
        ? "Good news! This registration number is free to use."
        : "Sorry, another school is already using this registration number.",
    });
  }
);

/** PATCH /schools/:schoolId/slug */
export const updateSchoolSlugController = safe(
  "Something went wrong while changing the school slug. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(updateSchoolSlugSchema, req.body, res);
    if (!body) return;

    const result = await updateSchoolSlugService(schoolId, body.slug);
    respond(res, result, "The school slug has been changed. The school web address is now different.");
  }
);

/* ============================================================================
 * 3. STATUS
 * ========================================================================== */

/** PATCH /schools/:schoolId/status */
export const toggleSchoolStatusController = safe(
  "Something went wrong while changing the school status. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(toggleSchoolStatusSchema, req.body, res);
    if (!body) return;

    const result = await toggleSchoolStatusService(schoolId, body.isActive);
    respond(
      res,
      result,
      body.isActive ? "The school is now active." : "The school has been switched off (deactivated)."
    );
  }
);

/** PATCH /schools/bulk/status */
export const bulkToggleSchoolStatusController = safe(
  "Something went wrong while changing the status of the schools. Please try again.",
  async (req, res) => {
    const body = readData(bulkToggleSchoolStatusSchema, req.body, res);
    if (!body) return;

    const result = await bulkToggleSchoolStatusService(body.ids, body.isActive);
    respond(
      res,
      result,
      `${result.data?.affected ?? 0} school(s) ${body.isActive ? "activated" : "deactivated"} successfully.`
    );
  }
);

/* ============================================================================
 * 4. BRANDING
 * ========================================================================== */

/** PATCH /schools/:schoolId/branding */
export const updateSchoolBrandingController = safe(
  "Something went wrong while updating the school branding. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(updateSchoolBrandingSchema, req.body, res);
    if (!body) return;

    const result = await updateSchoolBrandingService(schoolId, body);
    respond(res, result, "The school look and colors have been updated.");
  }
);

/** PATCH /schools/:schoolId/logo */
export const updateSchoolLogoController = safe(
  "Something went wrong while updating the school logo. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(updateSchoolLogoSchema, req.body, res);
    if (!body) return;

    const result = await updateSchoolLogoService(schoolId, body.logoUrl);
    respond(
      res,
      result,
      body.logoUrl ? "The school logo has been updated." : "The school logo has been removed."
    );
  }
);

/** PATCH /schools/:schoolId/branding/reset */
export const resetSchoolBrandingController = safe(
  "Something went wrong while resetting the school branding. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await resetSchoolBrandingService(schoolId);
    respond(res, result, "The school look and colors are back to the default style.");
  }
);

/** GET /public/schools/:slug/branding  (safe for login pages, no login needed) */
export const getPublicSchoolBrandingController = safe(
  "Something went wrong while loading the school branding. Please try again.",
  async (req, res) => {
    const slug = readSlug(req, res);
    if (!slug) return;

    const result = await getPublicSchoolBrandingService(slug);
    respond(res, result, "School branding loaded successfully.");
  }
);

/* ============================================================================
 * 5. IDENTITY, CONTACT, LOCALIZATION, CURRICULUM, PRINCIPAL
 * ========================================================================== */

/** PATCH /schools/:schoolId/settings */
export const updateSchoolSettingsController = safe(
  "Something went wrong while updating the school details. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(updateSchoolSettingsSchema, req.body, res);
    if (!body) return;

    const result = await updateSchoolSettingsService(schoolId, body);
    respond(res, result, "The school details have been updated.");
  }
);

/** PATCH /schools/:schoolId/contact */
export const updateSchoolContactController = safe(
  "Something went wrong while updating the school contact details. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(updateSchoolContactSchema, req.body, res);
    if (!body) return;

    const result = await updateSchoolContactService(schoolId, body);
    respond(res, result, "The school contact and location details have been updated.");
  }
);

/** PATCH /schools/:schoolId/localization */
export const updateSchoolLocalizationController = safe(
  "Something went wrong while updating the timezone or currency. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(updateSchoolLocalizationSchema, req.body, res);
    if (!body) return;

    const result = await updateSchoolLocalizationService(schoolId, body);
    respond(res, result, "The school timezone and currency have been updated.");
  }
);

/** PATCH /schools/:schoolId/curriculum */
export const updateSchoolCurriculumController = safe(
  "Something went wrong while updating the school type or curriculum. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(updateSchoolCurriculumSchema, req.body, res);
    if (!body) return;

    const result = await updateSchoolCurriculumService(schoolId, body);
    respond(res, result, "The school type and curriculum have been updated.");
  }
);

/** PATCH /schools/:schoolId/principal */
export const updateSchoolPrincipalController = safe(
  "Something went wrong while updating the principal. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(updateSchoolPrincipalSchema, req.body, res);
    if (!body) return;

    const result = await updateSchoolPrincipalService(schoolId, body.principalName);
    respond(
      res,
      result,
      body.principalName ? "The principal has been updated." : "The principal name has been removed."
    );
  }
);

/* ============================================================================
 * 6. SETTINGS JSON & MODULES
 * ========================================================================== */

/** GET /schools/:schoolId/settings-json */
export const getSchoolSettingsJsonController = safe(
  "Something went wrong while loading the school settings. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await getSchoolSettingsJsonService(schoolId);
    respond(res, result, "School settings loaded successfully.");
  }
);

/** PATCH /schools/:schoolId/settings-json */
export const mergeSchoolSettingsJsonController = safe(
  "Something went wrong while saving the school settings. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(mergeSchoolSettingsJsonSchema, req.body, res);
    if (!body) return;

    const result = await mergeSchoolSettingsJsonService(schoolId, body.settings);
    respond(res, result, "The school settings have been saved.");
  }
);

/** PATCH /schools/:schoolId/modules */
export const toggleSchoolModuleController = safe(
  "Something went wrong while changing the school module. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(toggleSchoolModuleSchema, req.body, res);
    if (!body) return;

    const result = await toggleSchoolModuleService(schoolId, body.moduleKey, body.enabled);
    respond(
      res,
      result,
      `The "${body.moduleKey}" module is now ${body.enabled ? "turned on" : "turned off"}.`
    );
  }
);

/** GET /schools/:schoolId/modules */
export const getSchoolModulesController = safe(
  "Something went wrong while loading the school modules. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await getSchoolModulesService(schoolId);
    respond(res, result, "School modules loaded successfully.");
  }
);

/** GET /schools/:schoolId/modules/:moduleKey */
export const isSchoolModuleEnabledController = safe(
  "Something went wrong while checking the school module. Please try again.",
  async (req, res) => {
    const params = readData(
      schoolModuleParamSchema,
      { id: firstValue(req.params.schoolId), moduleKey: firstValue(req.params.moduleKey) },
      res
    );
    if (!params) return;

    const result = await isSchoolModuleEnabledService(params.id, params.moduleKey);
    if (!result.success) {
      res.status(failureStatus(result.message)).json(result);
      return;
    }

    const enabled = result.data?.enabled === true;
    res.status(200).json({
      ...result,
      message: enabled
        ? `The "${params.moduleKey}" module is turned on for this school.`
        : `The "${params.moduleKey}" module is turned off for this school.`,
    });
  }
);

/* ============================================================================
 * 7. SUBSCRIPTION & BILLING
 * ========================================================================== */

/** PATCH /schools/:schoolId/subscription */
export const updateSchoolSubscriptionController = safe(
  "Something went wrong while updating the subscription. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(updateSchoolSubscriptionSchema, req.body, res);
    if (!body) return;

    const result = await updateSchoolSubscriptionService(schoolId, body);
    respond(res, result, "The school subscription has been updated.");
  }
);

/** PATCH /schools/:schoolId/subscription/plan */
export const changeSchoolPlanController = safe(
  "Something went wrong while changing the plan. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(changeSchoolPlanSchema, req.body, res);
    if (!body) return;

    const result = await changeSchoolPlanService(schoolId, body.plan, {
      maxStudents: body.maxStudents,
      keepExistingLimit: body.keepExistingLimit,
    });
    respond(res, result, `The school is now on the ${body.plan} plan.`);
  }
);

/** PATCH /schools/:schoolId/subscription/extend */
export const extendSchoolSubscriptionController = safe(
  "Something went wrong while extending the subscription. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(extendSchoolSubscriptionSchema, req.body, res);
    if (!body) return;

    const result = await extendSchoolSubscriptionService(schoolId, body.days);
    respond(res, result, `The subscription has been extended by ${body.days} day(s) and is active.`);
  }
);

/** PATCH /schools/:schoolId/subscription/suspend */
export const suspendSchoolSubscriptionController = safe(
  "Something went wrong while suspending the subscription. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(suspendSchoolSubscriptionSchema, req.body ?? {}, res);
    if (!body) return;

    const result = await suspendSchoolSubscriptionService(schoolId, { deactivate: body.deactivate });
    respond(
      res,
      result,
      body.deactivate
        ? "The subscription is suspended and the school has been switched off."
        : "The subscription has been suspended."
    );
  }
);

/** PATCH /schools/:schoolId/subscription/reactivate */
export const reactivateSchoolSubscriptionController = safe(
  "Something went wrong while reactivating the subscription. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await reactivateSchoolSubscriptionService(schoolId);
    respond(res, result, "The subscription is active again and the school can use the system.");
  }
);

/** PATCH /schools/:schoolId/subscription/cancel */
export const cancelSchoolSubscriptionController = safe(
  "Something went wrong while cancelling the subscription. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await cancelSchoolSubscriptionService(schoolId);
    respond(res, result, "The subscription has been cancelled.");
  }
);

/** GET /schools/expiring?withinDays=14 */
export const getExpiringSchoolsController = safe(
  "Something went wrong while loading the schools that are about to expire. Please try again.",
  async (req, res) => {
    const query = readData(expiringSchoolsQuerySchema, req.query, res);
    if (!query) return;

    const result = await getExpiringSchoolsService(query.withinDays);
    respond(
      res,
      result,
      `Found ${result.schools?.length ?? 0} school(s) that will expire in the next ${query.withinDays} day(s).`
    );
  }
);

/** POST /schools/subscriptions/run-lifecycle  (also good for a daily cron job) */
export const runSubscriptionLifecycleController = safe(
  "Something went wrong while checking the subscriptions. Please try again.",
  async (req, res) => {
    const body = readData(subscriptionLifecycleSchema, req.body ?? {}, res);
    if (!body) return;

    const result = await runSubscriptionLifecycleService(body.graceDays);
    respond(
      res,
      result,
      `Subscription check finished. ${result.data?.markedPastDue ?? 0} marked as past due and ${
        result.data?.markedExpired ?? 0
      } marked as expired.`
    );
  }
);

/** GET /schools/:schoolId/access */
export const checkSchoolAccessController = safe(
  "Something went wrong while checking the school access. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await checkSchoolAccessService(schoolId);
    if (!result.success) {
      res.status(failureStatus(result.message)).json(result);
      return;
    }

    const allowed = result.data?.allowed === true;
    res.status(200).json({
      ...result,
      message: allowed
        ? "This school can use the system."
        : result.data?.reason || "This school cannot use the system right now.",
    });
  }
);

/* ============================================================================
 * 8. STUDENT LIMITS
 * ========================================================================== */

/** PATCH /schools/:schoolId/max-students */
export const setMaxStudentsController = safe(
  "Something went wrong while changing the student limit. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(setMaxStudentsSchema, req.body, res);
    if (!body) return;

    const result = await setMaxStudentsService(schoolId, body.maxStudents);
    respond(
      res,
      result,
      body.maxStudents === null
        ? "The school can now have an unlimited number of students."
        : `The student limit is now ${body.maxStudents}.`
    );
  }
);

/** GET /schools/:schoolId/student-limit?toAdd=1 */
export const checkStudentLimitController = safe(
  "Something went wrong while checking the student limit. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const query = readData(checkStudentLimitQuerySchema, req.query, res);
    if (!query) return;

    const result = await checkStudentLimitService(schoolId, query.toAdd);
    if (!result.success) {
      res.status(failureStatus(result.message)).json(result);
      return;
    }

    const allowed = result.data?.allowed === true;
    res.status(200).json({
      ...result,
      message: allowed
        ? "The school has enough space for these students."
        : "The school has reached its student limit. Please upgrade the plan to add more students.",
    });
  }
);

/* ============================================================================
 * 9. SMS CREDITS
 * ========================================================================== */

/** GET /schools/:schoolId/sms-credits */
export const getSmsCreditsController = safe(
  "Something went wrong while loading the SMS credits. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await getSmsCreditsService(schoolId);
    respond(res, result, `The school has ${result.data?.smsCredits ?? 0} SMS credit(s) left.`);
  }
);

/** POST /schools/:schoolId/sms-credits/add */
export const addSmsCreditsController = safe(
  "Something went wrong while adding SMS credits. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(smsCreditsSchema, req.body, res);
    if (!body) return;

    const result = await addSmsCreditsService(schoolId, body.amount);
    respond(
      res,
      result,
      `${body.amount} SMS credit(s) added. The new balance is ${result.school?.smsCredits ?? 0}.`
    );
  }
);

/** POST /schools/:schoolId/sms-credits/deduct */
export const deductSmsCreditsController = safe(
  "Something went wrong while using SMS credits. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const body = readData(smsCreditsSchema, req.body, res);
    if (!body) return;

    const result = await deductSmsCreditsService(schoolId, body.amount);
    respond(
      res,
      result,
      `${body.amount} SMS credit(s) used. The school has ${result.school?.smsCredits ?? 0} left.`
    );
  }
);

/* ============================================================================
 * 10. STATS & REPORTS
 * ========================================================================== */

/** GET /schools/:schoolId/stats */
export const getSchoolStatsController = safe(
  "Something went wrong while loading the school statistics. Please try again.",
  async (req, res) => {
    const schoolId = readSchoolId(req, res);
    if (!schoolId) return;

    const result = await getSchoolStatsService(schoolId);
    respond(res, result, "School statistics loaded successfully.");
  }
);

/** GET /schools/platform-stats */
export const getPlatformStatsController = safe(
  "Something went wrong while loading the platform statistics. Please try again.",
  async (_req, res) => {
    const result = await getPlatformStatsService();
    respond(res, result, "Platform statistics loaded successfully.");
  }
);

/** GET /schools/by-county */
export const getSchoolsByCountyController = safe(
  "Something went wrong while loading the schools by county. Please try again.",
  async (_req, res) => {
    const result = await getSchoolsByCountyService();
    respond(res, result, "Schools by county loaded successfully.");
  }
);