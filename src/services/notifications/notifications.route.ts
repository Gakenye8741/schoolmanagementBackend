// src/services/notifications/notifications.route.ts
import { Router } from "express";
import {
  // Announcements
  createAnnouncementController,
  getAnnouncementByIdController,
  listAnnouncementsController,
  listMyActiveAnnouncementsController,
  listAnnouncementsForClassController,
  updateAnnouncementController,
  deleteAnnouncementController,
  scheduleAnnouncementController,
  bulkCreateAnnouncementsController,
  countAnnouncementsController,
  // Notifications
  createNotificationController,
  bulkCreateNotificationsController,
  getNotificationByIdController,
  listMyNotificationsController,
  countMyUnreadNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
  deleteNotificationController,
  // SMS
  queueSmsController,
  queueBulkSmsController,
  queueAbsenteeAlertsController,
  queueFeeRemindersController,
  queueReportCardReadyController,
  queueAnnouncementSmsController,
  listSmsLogsController,
  getSmsLogByIdController,
  markSmsAsSentController,
  getSmsStatsController,
  // Direct messages
  sendDirectMessageController,
  getMessageByIdController,
  listThreadController,
  listInboxController,
  markMessageReadController,
  listUnreadMessagesController,
  deleteMessageController,
} from "./notifications.controller";
import {
  adminAuth,
  adminOrTeacherAuth,
  superAdminAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const notificationsRouter = Router();

// ================================================================
// ANNOUNCEMENTS
// ================================================================

// Static routes first
notificationsRouter.get(
  "/announcements/mine",
  anyAuthenticatedUser,
  listMyActiveAnnouncementsController
);
notificationsRouter.post(
  "/announcements/bulk",
  adminAuth,
  bulkCreateAnnouncementsController
);

notificationsRouter.get(
  "/announcements/school/:schoolId",
  anyAuthenticatedUser,
  listAnnouncementsController
);
notificationsRouter.get(
  "/announcements/school/:schoolId/count",
  anyAuthenticatedUser,
  countAnnouncementsController
);
notificationsRouter.get(
  "/announcements/class/:classId",
  anyAuthenticatedUser,
  listAnnouncementsForClassController
);

notificationsRouter.post("/announcements", adminOrTeacherAuth, createAnnouncementController);
notificationsRouter.patch(
  "/announcements/:announcementId",
  adminOrTeacherAuth,
  updateAnnouncementController
);
notificationsRouter.post(
  "/announcements/:announcementId/schedule",
  adminAuth,
  scheduleAnnouncementController
);
notificationsRouter.delete(
  "/announcements/:announcementId",
  adminAuth,
  deleteAnnouncementController
);

// Generic lookup last
notificationsRouter.get(
  "/announcements/:announcementId",
  anyAuthenticatedUser,
  getAnnouncementByIdController
);

// ================================================================
// NOTIFICATIONS
// ================================================================

// Static routes first
notificationsRouter.get(
  "/notifications/mine",
  anyAuthenticatedUser,
  listMyNotificationsController
);
notificationsRouter.get(
  "/notifications/mine/unread-count",
  anyAuthenticatedUser,
  countMyUnreadNotificationsController
);
notificationsRouter.post(
  "/notifications/mark-all-read",
  anyAuthenticatedUser,
  markAllNotificationsReadController
);

notificationsRouter.post(
  "/notifications",
  adminAuth,
  createNotificationController
);
notificationsRouter.post(
  "/notifications/bulk",
  adminAuth,
  bulkCreateNotificationsController
);

notificationsRouter.post(
  "/notifications/:notificationId/read",
  anyAuthenticatedUser,
  markNotificationReadController
);
notificationsRouter.delete(
  "/notifications/:notificationId",
  anyAuthenticatedUser,
  deleteNotificationController
);

// Generic lookup last
notificationsRouter.get(
  "/notifications/:notificationId",
  anyAuthenticatedUser,
  getNotificationByIdController
);

// ================================================================
// SMS — queue only
// ================================================================

// Static routes first
notificationsRouter.post("/sms", adminAuth, queueSmsController);
notificationsRouter.post("/sms/bulk", adminAuth, queueBulkSmsController);
notificationsRouter.post(
  "/sms/absentees",
  adminOrTeacherAuth,
  queueAbsenteeAlertsController
);
notificationsRouter.post(
  "/sms/fee-reminders",
  adminAuth,
  queueFeeRemindersController
);
notificationsRouter.post(
  "/sms/report-cards-ready",
  adminAuth,
  queueReportCardReadyController
);
notificationsRouter.post(
  "/sms/announcement",
  adminAuth,
  queueAnnouncementSmsController
);
notificationsRouter.post("/sms/mark-sent", adminAuth, markSmsAsSentController);

notificationsRouter.get(
  "/sms/school/:schoolId",
  anyAuthenticatedUser,
  listSmsLogsController
);
notificationsRouter.get(
  "/sms/school/:schoolId/stats",
  anyAuthenticatedUser,
  getSmsStatsController
);

// Generic lookup last
notificationsRouter.get(
  "/sms/:smsLogId",
  anyAuthenticatedUser,
  getSmsLogByIdController
);

// ================================================================
// DIRECT MESSAGES
// ================================================================

// Static routes first
notificationsRouter.post("/messages", anyAuthenticatedUser, sendDirectMessageController);
notificationsRouter.get("/messages/inbox", anyAuthenticatedUser, listInboxController);
notificationsRouter.get(
  "/messages/unread",
  anyAuthenticatedUser,
  listUnreadMessagesController
);
notificationsRouter.get("/messages/thread", anyAuthenticatedUser, listThreadController);

notificationsRouter.post(
  "/messages/:messageId/read",
  anyAuthenticatedUser,
  markMessageReadController
);
notificationsRouter.delete(
  "/messages/:messageId",
  anyAuthenticatedUser,
  deleteMessageController
);

// Generic lookup last
notificationsRouter.get(
  "/messages/:messageId",
  anyAuthenticatedUser,
  getMessageByIdController
);

export default notificationsRouter;