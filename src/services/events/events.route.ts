// src/routes/events.routes.ts
import { Router } from "express";
import {
  createSchoolEventController,
  bulkCreateSchoolEventsController,
  getSchoolEventByIdController,
  listSchoolEventsForSchoolController,
  listUpcomingSchoolEventsController,
  listSchoolEventsByCategoryController,
  listSchoolEventsInRangeController,
  getSchoolEventsTodayController,
  updateSchoolEventController,
  deleteSchoolEventController,
  getSchoolEventsCalendarController,
  getSchoolEventStatsController,
  createActivityController,
  getActivityByIdController,
  listActivitiesForSchoolController,
  listActivitiesByCategoryController,
  listActivitiesByPatronController,
  updateActivityController,
  assignPatronController,
  deleteActivityController,
  listActivityCategoriesController,
  getActivityStatsController,
  addStudentToActivityController,
  bulkAddStudentsToActivityController,
  getMembershipByIdController,
  listActivitiesForStudentController,
  listMembershipsForActivityController,
  listMembershipsForTermController,
  updateMembershipRoleController,
  removeStudentFromActivityController,
  listStudentsNotInActivityController,
  getStudentActivitySummaryController,
} from "./events.controller";
import {
  anyAuthenticatedUser,
  schoolManagementAuth,
  staffAuth,
} from "../../middleware/bearAuth";

const eventsRouter = Router();

// ================================================================
// SCHOOL EVENTS
// ================================================================

// Static-before-parameterised
eventsRouter.get(
  "/schools/:schoolId/events/upcoming",
  anyAuthenticatedUser,
  listUpcomingSchoolEventsController
);
eventsRouter.get(
  "/schools/:schoolId/events/today",
  anyAuthenticatedUser,
  getSchoolEventsTodayController
);
eventsRouter.get(
  "/schools/:schoolId/events/calendar",
  anyAuthenticatedUser,
  getSchoolEventsCalendarController
);
eventsRouter.get(
  "/schools/:schoolId/events/range",
  anyAuthenticatedUser,
  listSchoolEventsInRangeController
);
eventsRouter.get(
  "/schools/:schoolId/events/by-category",
  anyAuthenticatedUser,
  listSchoolEventsByCategoryController
);
eventsRouter.get(
  "/schools/:schoolId/events/stats",
  schoolManagementAuth,
  getSchoolEventStatsController
);
eventsRouter.get(
  "/schools/:schoolId/events",
  anyAuthenticatedUser,
  listSchoolEventsForSchoolController
);
eventsRouter.post(
  "/schools/:schoolId/events/bulk",
  schoolManagementAuth,
  bulkCreateSchoolEventsController
);
eventsRouter.post(
  "/schools/:schoolId/events",
  schoolManagementAuth,
  createSchoolEventController
);

eventsRouter.get(
  "/events/:eventId",
  anyAuthenticatedUser,
  getSchoolEventByIdController
);
eventsRouter.patch(
  "/events/:eventId",
  schoolManagementAuth,
  updateSchoolEventController
);
eventsRouter.delete(
  "/events/:eventId",
  schoolManagementAuth,
  deleteSchoolEventController
);

// ================================================================
// CO-CURRICULAR ACTIVITIES
// ================================================================

// Static-before-parameterised
eventsRouter.get(
  "/schools/:schoolId/activities/categories",
  anyAuthenticatedUser,
  listActivityCategoriesController
);
eventsRouter.get(
  "/schools/:schoolId/activities/by-category",
  anyAuthenticatedUser,
  listActivitiesByCategoryController
);
eventsRouter.get(
  "/schools/:schoolId/activities",
  anyAuthenticatedUser,
  listActivitiesForSchoolController
);
eventsRouter.post(
  "/schools/:schoolId/activities",
  schoolManagementAuth,
  createActivityController
);

eventsRouter.get(
  "/activities/patrons/:teacherId",
  anyAuthenticatedUser,
  listActivitiesByPatronController
);
eventsRouter.get(
  "/activities/:activityId/stats",
  schoolManagementAuth,
  getActivityStatsController
);
eventsRouter.get(
  "/activities/:activityId",
  anyAuthenticatedUser,
  getActivityByIdController
);
eventsRouter.patch(
  "/activities/:activityId",
  schoolManagementAuth,
  updateActivityController
);
eventsRouter.patch(
  "/activities/:activityId/patron",
  schoolManagementAuth,
  assignPatronController
);
eventsRouter.delete(
  "/activities/:activityId",
  schoolManagementAuth,
  deleteActivityController
);

// ================================================================
// STUDENT ACTIVITY MEMBERSHIPS
// ================================================================

// Static-before-parameterised
eventsRouter.get(
  "/schools/:schoolId/terms/:termId/memberships",
  anyAuthenticatedUser,
  listMembershipsForTermController
);
eventsRouter.get(
  "/activities/:activityId/members/not-in/schools/:schoolId/terms/:termId",
  staffAuth,
  listStudentsNotInActivityController
);
eventsRouter.get(
  "/activities/:activityId/members",
  anyAuthenticatedUser,
  listMembershipsForActivityController
);
eventsRouter.post(
  "/activities/:activityId/members/bulk",
  staffAuth,
  bulkAddStudentsToActivityController
);
eventsRouter.post(
  "/activities/members",
  staffAuth,
  addStudentToActivityController
);

eventsRouter.get(
  "/students/:studentId/activities/summary",
  anyAuthenticatedUser,
  getStudentActivitySummaryController
);
eventsRouter.get(
  "/students/:studentId/activities",
  anyAuthenticatedUser,
  listActivitiesForStudentController
);

eventsRouter.patch(
  "/memberships/:membershipId/role",
  staffAuth,
  updateMembershipRoleController
);
eventsRouter.get(
  "/memberships/:membershipId",
  anyAuthenticatedUser,
  getMembershipByIdController
);
eventsRouter.delete(
  "/memberships/:membershipId",
  staffAuth,
  removeStudentFromActivityController
);

export default eventsRouter;