// src/services/events/events.controller.ts
import { Request, Response } from "express";
import {
  createSchoolEventService,
  bulkCreateSchoolEventsService,
  getSchoolEventByIdService,
  listSchoolEventsForSchoolService,
  listUpcomingSchoolEventsService,
  listSchoolEventsByCategoryService,
  listSchoolEventsInRangeService,
  getSchoolEventsTodayService,
  updateSchoolEventService,
  deleteSchoolEventService,
  getSchoolEventsCalendarService,
  getSchoolEventStatsService,
  createActivityService,
  getActivityByIdService,
  listActivitiesForSchoolService,
  listActivitiesByCategoryService,
  listActivitiesByPatronService,
  updateActivityService,
  assignPatronService,
  deleteActivityService,
  listActivityCategoriesService,
  getActivityStatsService,
  addStudentToActivityService,
  bulkAddStudentsToActivityService,
  getMembershipByIdService,
  listActivitiesForStudentService,
  listMembershipsForActivityService,
  listMembershipsForTermService,
  updateMembershipRoleService,
  removeStudentFromActivityService,
  listStudentsNotInActivityService,
  getStudentActivitySummaryService,
} from "./events.service";
import {
  createSchoolEventSchema,
  bulkCreateSchoolEventsSchema,
  updateSchoolEventSchema,
  listSchoolEventsQuerySchema,
  upcomingEventsQuerySchema,
  eventsInRangeQuerySchema,
  createActivitySchema,
  updateActivitySchema,
  assignPatronSchema,
  listActivitiesQuerySchema,
  addStudentToActivitySchema,
  bulkAddStudentsSchema,
  updateMembershipRoleSchema,
  listMembershipsQuerySchema,
  listActivitiesForStudentQuerySchema,
  eventIdParamSchema,
  activityIdParamSchema,
  membershipIdParamSchema,
  schoolIdParamSchema,
  studentIdParamSchema,
  teacherIdParamSchema,
  termIdParamSchema,
} from "../../validators/events.validator";

const fail = (res: Response, status: number, message: string, issues?: any) =>
  res.status(status).json({ success: false, message, issues });
const ok = (res: Response, result: any, status = 200) => res.status(status).json(result);
const handleZod = (res: Response, err: any) => {
  const first = err?.errors?.[0];
  const field = first?.path?.join(".") ?? "input";
  return fail(res, 400, `${field}: ${first?.message ?? "invalid value"}`, err?.errors);
};
const isZod = (e: any) => e?.name === "ZodError" || Array.isArray(e?.errors);
const userId = (req: Request): string => (req as any).user?.id ?? "";

// ================================================================
// SCHOOL EVENTS
// ================================================================

export const createSchoolEventController = async (req: Request, res: Response) => {
  try {
    const body = createSchoolEventSchema.parse(req.body);
    const result = await createSchoolEventService(body, userId(req));
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not create the event.", e?.message);
  }
};

export const bulkCreateSchoolEventsController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreateSchoolEventsSchema.parse(req.body);
    const result = await bulkCreateSchoolEventsService(body, userId(req));
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-create events.", e?.message);
  }
};

export const getSchoolEventByIdController = async (req: Request, res: Response) => {
  try {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const result = await getSchoolEventByIdService(eventId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load the event.", e?.message);
  }
};

export const listSchoolEventsForSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = listSchoolEventsQuerySchema.parse(req.query);
    const result = await listSchoolEventsForSchoolService(schoolId, {
      category: q.category,
      from: q.from,
      to: q.to,
      upcomingOnly: q.upcomingOnly === "true",
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list events.", e?.message);
  }
};

export const listUpcomingSchoolEventsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = upcomingEventsQuerySchema.parse(req.query);
    const result = await listUpcomingSchoolEventsService(schoolId, q.withinDays, q.limit);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list upcoming events.", e?.message);
  }
};

export const listSchoolEventsByCategoryController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = listSchoolEventsQuerySchema.parse(req.query);
    if (!q.category) return fail(res, 400, "category query parameter is required.");
    const result = await listSchoolEventsByCategoryService(schoolId, q.category);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list events.", e?.message);
  }
};

export const listSchoolEventsInRangeController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = eventsInRangeQuerySchema.parse(req.query);
    const result = await listSchoolEventsInRangeService(schoolId, q.from, q.to);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list events in range.", e?.message);
  }
};

export const getSchoolEventsTodayController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getSchoolEventsTodayService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load today's events.", e?.message);
  }
};

export const updateSchoolEventController = async (req: Request, res: Response) => {
  try {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const body = updateSchoolEventSchema.parse(req.body);
    const result = await updateSchoolEventService(eventId, body);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update the event.", e?.message);
  }
};

export const deleteSchoolEventController = async (req: Request, res: Response) => {
  try {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const result = await deleteSchoolEventService(eventId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete the event.", e?.message);
  }
};

export const getSchoolEventsCalendarController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = req.query ?? {};
    const result = await getSchoolEventsCalendarService(schoolId, {
      from: typeof q.from === "string" ? q.from : undefined,
      to: typeof q.to === "string" ? q.to : undefined,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    return fail(res, 500, "Could not build calendar.", e?.message);
  }
};

export const getSchoolEventStatsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await getSchoolEventStatsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute stats.", e?.message);
  }
};

// ================================================================
// CO-CURRICULAR ACTIVITIES
// ================================================================

export const createActivityController = async (req: Request, res: Response) => {
  try {
    const body = createActivitySchema.parse(req.body);
    const result = await createActivityService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not create the activity.", e?.message);
  }
};

export const getActivityByIdController = async (req: Request, res: Response) => {
  try {
    const { activityId } = activityIdParamSchema.parse(req.params);
    const result = await getActivityByIdService(activityId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load the activity.", e?.message);
  }
};

export const listActivitiesForSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = listActivitiesQuerySchema.parse(req.query);
    const result = await listActivitiesForSchoolService(schoolId, {
      category: q.category,
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list activities.", e?.message);
  }
};

export const listActivitiesByCategoryController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const q = listActivitiesQuerySchema.parse(req.query);
    if (!q.category) return fail(res, 400, "category query parameter is required.");
    const result = await listActivitiesByCategoryService(schoolId, q.category);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list activities.", e?.message);
  }
};

export const listActivitiesByPatronController = async (req: Request, res: Response) => {
  try {
    const { teacherId } = teacherIdParamSchema.parse(req.params);
    const result = await listActivitiesByPatronService(teacherId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list activities.", e?.message);
  }
};

export const updateActivityController = async (req: Request, res: Response) => {
  try {
    const { activityId } = activityIdParamSchema.parse(req.params);
    const body = updateActivitySchema.parse(req.body);
    const result = await updateActivityService(activityId, body);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update the activity.", e?.message);
  }
};

export const assignPatronController = async (req: Request, res: Response) => {
  try {
    const { activityId } = activityIdParamSchema.parse(req.params);
    const body = assignPatronSchema.parse(req.body);
    const result = await assignPatronService(activityId, body.patronTeacherId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not assign patron.", e?.message);
  }
};

export const deleteActivityController = async (req: Request, res: Response) => {
  try {
    const { activityId } = activityIdParamSchema.parse(req.params);
    const result = await deleteActivityService(activityId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete the activity.", e?.message);
  }
};

export const listActivityCategoriesController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await listActivityCategoriesService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list categories.", e?.message);
  }
};

export const getActivityStatsController = async (req: Request, res: Response) => {
  try {
    const { activityId } = activityIdParamSchema.parse(req.params);
    const result = await getActivityStatsService(activityId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute stats.", e?.message);
  }
};

// ================================================================
// STUDENT ACTIVITY MEMBERSHIPS
// ================================================================

export const addStudentToActivityController = async (req: Request, res: Response) => {
  try {
    const body = addStudentToActivitySchema.parse(req.body);
    const result = await addStudentToActivityService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not add the student.", e?.message);
  }
};

export const bulkAddStudentsToActivityController = async (req: Request, res: Response) => {
  try {
    const body = bulkAddStudentsSchema.parse(req.body);
    const result = await bulkAddStudentsToActivityService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-add students.", e?.message);
  }
};

export const getMembershipByIdController = async (req: Request, res: Response) => {
  try {
    const { membershipId } = membershipIdParamSchema.parse(req.params);
    const result = await getMembershipByIdService(membershipId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load the membership.", e?.message);
  }
};

export const listActivitiesForStudentController = async (req: Request, res: Response) => {
  try {
    const { studentId } = studentIdParamSchema.parse(req.params);
    const q = listActivitiesForStudentQuerySchema.parse(req.query);
    const result = await listActivitiesForStudentService(studentId, q.termId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list student activities.", e?.message);
  }
};

export const listMembershipsForActivityController = async (req: Request, res: Response) => {
  try {
    const { activityId } = activityIdParamSchema.parse(req.params);
    const q = listMembershipsQuerySchema.parse(req.query);
    const result = await listMembershipsForActivityService(activityId, {
      termId: q.termId,
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list members.", e?.message);
  }
};

export const listMembershipsForTermController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { termId } = termIdParamSchema.parse(req.params);
    const q = listMembershipsQuerySchema.parse(req.query);
    const result = await listMembershipsForTermService(schoolId, termId, {
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list memberships.", e?.message);
  }
};

export const updateMembershipRoleController = async (req: Request, res: Response) => {
  try {
    const { membershipId } = membershipIdParamSchema.parse(req.params);
    const body = updateMembershipRoleSchema.parse(req.body);
    const result = await updateMembershipRoleService(membershipId, body.performanceRole ?? null);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update role.", e?.message);
  }
};

export const removeStudentFromActivityController = async (req: Request, res: Response) => {
  try {
    const { membershipId } = membershipIdParamSchema.parse(req.params);
    const result = await removeStudentFromActivityService(membershipId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not remove the student.", e?.message);
  }
};

export const listStudentsNotInActivityController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { activityId } = activityIdParamSchema.parse(req.params);
    const { termId } = termIdParamSchema.parse(req.params);
    const result = await listStudentsNotInActivityService(schoolId, activityId, termId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list eligible students.", e?.message);
  }
};

export const getStudentActivitySummaryController = async (req: Request, res: Response) => {
  try {
    const { studentId } = studentIdParamSchema.parse(req.params);
    const q = listActivitiesForStudentQuerySchema.parse(req.query);
    const result = await getStudentActivitySummaryService(studentId, q.termId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute summary.", e?.message);
  }
};