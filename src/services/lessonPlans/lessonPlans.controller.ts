// src/services/lessonPlans/lessonPlans.controller.ts
import { Request, Response } from "express";
import {
  createSchemeService,
  bulkCreateSchemesService,
  getSchemeByIdService,
  listSchemesForSchoolService,
  listSchemesForTeacherService,
  listPendingSchemesService,
  updateSchemeService,
  submitSchemeService,
  approveSchemeService,
  rejectSchemeService,
  deleteSchemeService,
  createEntryService,
  bulkCreateEntriesService,
  getEntryByIdService,
  listEntriesForSchemeService,
  updateEntryService,
  markEntryCoveredService,
  unmarkEntryCoveredService,
  reorderEntriesService,
  deleteEntryService,
  createLessonPlanService,
  bulkCreateLessonPlansService,
  getLessonPlanByIdService,
  listLessonPlansForTeacherService,
  listLessonPlansForClassService,
  listLessonPlansForDateRangeService,
  updateLessonPlanService,
  submitLessonPlanService,
  approveLessonPlanService,
  rejectLessonPlanService,
  addReflectionService,
  deleteLessonPlanService,
  getSchemeCoverageService,
} from "./lessonPlans.service";
import {
  createSchemeSchema,
  bulkCreateSchemesSchema,
  updateSchemeSchema,
  rejectSchema,
  listSchemesQuerySchema,
  createEntrySchema,
  bulkCreateEntriesSchema,
  updateEntrySchema,
  markCoveredSchema,
  reorderEntriesSchema,
  createLessonPlanSchema,
  bulkCreateLessonPlansSchema,
  updateLessonPlanSchema,
  addReflectionSchema,
  listLessonPlansQuerySchema,
  schemeIdParamSchema,
  entryIdParamSchema,
  lessonPlanIdParamSchema,
  schoolIdParamSchema,
  teacherIdParamSchema,
} from "../../validators/lessonPlans.validator";

const fail = (res: Response, status: number, message: string, issues?: any) =>
  res.status(status).json({ success: false, message, issues });
const ok = (res: Response, result: any, status = 200) => res.status(status).json(result);
const handleZod = (res: Response, err: any) => {
  const first = err?.errors?.[0];
  const field = first?.path?.join(".") ?? "input";
  return fail(res, 400, `${field}: ${first?.message ?? "invalid value"}`, err?.errors);
};
const isZod = (e: any) => e?.name === "ZodError" || Array.isArray(e?.errors);
const actorId = (req: Request): string => (req as any).user?.id ?? "";

// ================================================================
// SCHEMES OF WORK
// ================================================================

export const createSchemeController = async (req: Request, res: Response) => {
  try {
    const body = createSchemeSchema.parse(req.body);
    const result = await createSchemeService(body, actorId(req));
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not create scheme.", e?.message);
  }
};

export const bulkCreateSchemesController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreateSchemesSchema.parse(req.body);
    const result = await bulkCreateSchemesService(body, actorId(req));
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-create schemes.", e?.message);
  }
};

export const getSchemeByIdController = async (req: Request, res: Response) => {
  try {
    const { schemeId } = schemeIdParamSchema.parse(req.params);
    const result = await getSchemeByIdService(schemeId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load scheme.", e?.message);
  }
};

export const listSchemesForSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = listSchemesQuerySchema.parse(req.query);
    const result = await listSchemesForSchoolService(schoolId, q);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list schemes.", e?.message);
  }
};

export const listSchemesForTeacherController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const q = listSchemesQuerySchema.parse(req.query);
    const result = await listSchemesForTeacherService(teacherId, q.termId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list schemes.", e?.message);
  }
};

export const listPendingSchemesController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await listPendingSchemesService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load approval queue.", e?.message);
  }
};

export const updateSchemeController = async (req: Request, res: Response) => {
  try {
    const { schemeId } = schemeIdParamSchema.parse(req.params);
    const body = updateSchemeSchema.parse(req.body);
    const result = await updateSchemeService(schemeId, body, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update scheme.", e?.message);
  }
};

export const submitSchemeController = async (req: Request, res: Response) => {
  try {
    const { schemeId } = schemeIdParamSchema.parse(req.params);
    const result = await submitSchemeService(schemeId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not submit scheme.", e?.message);
  }
};

export const approveSchemeController = async (req: Request, res: Response) => {
  try {
    const { schemeId } = schemeIdParamSchema.parse(req.params);
    const result = await approveSchemeService(schemeId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not approve scheme.", e?.message);
  }
};

export const rejectSchemeController = async (req: Request, res: Response) => {
  try {
    const { schemeId } = schemeIdParamSchema.parse(req.params);
    const body = rejectSchema.parse(req.body);
    const result = await rejectSchemeService(schemeId, body.reviewComments, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not reject scheme.", e?.message);
  }
};

export const deleteSchemeController = async (req: Request, res: Response) => {
  try {
    const { schemeId } = schemeIdParamSchema.parse(req.params);
    const result = await deleteSchemeService(schemeId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete scheme.", e?.message);
  }
};

// ================================================================
// SCHEME ENTRIES
// ================================================================

export const createEntryController = async (req: Request, res: Response) => {
  try {
    const body = createEntrySchema.parse(req.body);
    const result = await createEntryService(body, actorId(req));
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not create entry.", e?.message);
  }
};

export const bulkCreateEntriesController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreateEntriesSchema.parse(req.body);
    const result = await bulkCreateEntriesService(body, actorId(req));
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-create entries.", e?.message);
  }
};

export const getEntryByIdController = async (req: Request, res: Response) => {
  try {
    const { entryId } = entryIdParamSchema.parse(req.params);
    const result = await getEntryByIdService(entryId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load entry.", e?.message);
  }
};

export const listEntriesForSchemeController = async (req: Request, res: Response) => {
  try {
    const { schemeId } = schemeIdParamSchema.parse(req.params);
    const result = await listEntriesForSchemeService(schemeId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list entries.", e?.message);
  }
};

export const updateEntryController = async (req: Request, res: Response) => {
  try {
    const { entryId } = entryIdParamSchema.parse(req.params);
    const body = updateEntrySchema.parse(req.body);
    const result = await updateEntryService(entryId, body, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update entry.", e?.message);
  }
};

export const markEntryCoveredController = async (req: Request, res: Response) => {
  try {
    const { entryId } = entryIdParamSchema.parse(req.params);
    const body = markCoveredSchema.parse(req.body ?? {});
    const result = await markEntryCoveredService(entryId, body.coveredOn, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not mark coverage.", e?.message);
  }
};

export const unmarkEntryCoveredController = async (req: Request, res: Response) => {
  try {
    const { entryId } = entryIdParamSchema.parse(req.params);
    const result = await unmarkEntryCoveredService(entryId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not unmark coverage.", e?.message);
  }
};

export const reorderEntriesController = async (req: Request, res: Response) => {
  try {
    const { schemeId } = schemeIdParamSchema.parse(req.params);
    const { orderedIds } = reorderEntriesSchema.parse(req.body);
    const result = await reorderEntriesService(schemeId, orderedIds, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not reorder entries.", e?.message);
  }
};

export const deleteEntryController = async (req: Request, res: Response) => {
  try {
    const { entryId } = entryIdParamSchema.parse(req.params);
    const result = await deleteEntryService(entryId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete entry.", e?.message);
  }
};

// ================================================================
// LESSON PLANS
// ================================================================

export const createLessonPlanController = async (req: Request, res: Response) => {
  try {
    const body = createLessonPlanSchema.parse(req.body);
    const result = await createLessonPlanService(body, actorId(req));
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not create lesson plan.", e?.message);
  }
};

export const bulkCreateLessonPlansController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreateLessonPlansSchema.parse(req.body);
    const result = await bulkCreateLessonPlansService(body, actorId(req));
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-create lesson plans.", e?.message);
  }
};

export const getLessonPlanByIdController = async (req: Request, res: Response) => {
  try {
    const { lessonPlanId } = lessonPlanIdParamSchema.parse(req.params);
    const result = await getLessonPlanByIdService(lessonPlanId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load lesson plan.", e?.message);
  }
};

export const listLessonPlansForTeacherController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const q = listLessonPlansQuerySchema.parse(req.query);
    const result = await listLessonPlansForTeacherService(teacherId, {
      from: q.from,
      to: q.to,
      status: q.status,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list lesson plans.", e?.message);
  }
};

export const listLessonPlansForClassController = async (req: Request, res: Response) => {
  try {
    const { teacherId: _t } = { teacherId: "" } as any; // placeholder — actual param
    const q = listLessonPlansQuerySchema.parse(req.query);
    // classId comes from query
    if (!q.classId) return fail(res, 400, "classId query parameter is required.");
    const result = await listLessonPlansForClassService(q.classId, {
      from: q.from,
      to: q.to,
      subjectId: q.subjectId,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list lesson plans.", e?.message);
  }
};

export const listLessonPlansForDateRangeController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = listLessonPlansQuerySchema.parse(req.query);
    if (!q.from || !q.to) {
      return fail(res, 400, "Both 'from' and 'to' query parameters are required.");
    }
    const result = await listLessonPlansForDateRangeService(schoolId, q.from, q.to, {
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list lesson plans.", e?.message);
  }
};

export const updateLessonPlanController = async (req: Request, res: Response) => {
  try {
    const { lessonPlanId } = lessonPlanIdParamSchema.parse(req.params);
    const body = updateLessonPlanSchema.parse(req.body);
    const result = await updateLessonPlanService(lessonPlanId, body, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update lesson plan.", e?.message);
  }
};

export const submitLessonPlanController = async (req: Request, res: Response) => {
  try {
    const { lessonPlanId } = lessonPlanIdParamSchema.parse(req.params);
    const result = await submitLessonPlanService(lessonPlanId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not submit lesson plan.", e?.message);
  }
};

export const approveLessonPlanController = async (req: Request, res: Response) => {
  try {
    const { lessonPlanId } = lessonPlanIdParamSchema.parse(req.params);
    const result = await approveLessonPlanService(lessonPlanId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not approve lesson plan.", e?.message);
  }
};

export const rejectLessonPlanController = async (req: Request, res: Response) => {
  try {
    const { lessonPlanId } = lessonPlanIdParamSchema.parse(req.params);
    const result = await rejectLessonPlanService(lessonPlanId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not reject lesson plan.", e?.message);
  }
};

export const addReflectionController = async (req: Request, res: Response) => {
  try {
    const { lessonPlanId } = lessonPlanIdParamSchema.parse(req.params);
    const body = addReflectionSchema.parse(req.body);
    const result = await addReflectionService(lessonPlanId, body.reflection, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not save reflection.", e?.message);
  }
};

export const deleteLessonPlanController = async (req: Request, res: Response) => {
  try {
    const { lessonPlanId } = lessonPlanIdParamSchema.parse(req.params);
    const result = await deleteLessonPlanService(lessonPlanId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete lesson plan.", e?.message);
  }
};

// ================================================================
// ANALYTICS
// ================================================================

export const getSchemeCoverageController = async (req: Request, res: Response) => {
  try {
    const { schemeId } = schemeIdParamSchema.parse(req.params);
    const result = await getSchemeCoverageService(schemeId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute coverage.", e?.message);
  }
};