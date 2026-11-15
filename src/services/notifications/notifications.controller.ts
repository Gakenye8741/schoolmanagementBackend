// src/services/notifications/notifications.controller.ts
import { Request, Response } from "express";
import {
  // Announcements
  createAnnouncementService,
  getAnnouncementByIdService,
  listAnnouncementsService,
  listActiveAnnouncementsForUserService,
  listAnnouncementsForClassService,
  updateAnnouncementService,
  deleteAnnouncementService,
  scheduleAnnouncementService,
  bulkCreateAnnouncementsService,
  countAnnouncementsService,
  // Notifications
  createNotificationService,
  bulkCreateNotificationsService,
  getNotificationByIdService,
  listNotificationsForUserService,
  countUnreadNotificationsService,
  markNotificationReadService,
  markAllNotificationsReadService,
  deleteNotificationService,
  // SMS (queue-only)
  queueSmsService,
  queueBulkSmsService,
  queueAbsenteeAlertsService,
  queueFeeRemindersService,
  queueReportCardReadyService,
  queueAnnouncementSmsService,
  listSmsLogsService,
  getSmsLogByIdService,
  markSmsAsSentService,
  getSmsStatsService,
  // Direct messages
  sendDirectMessageService,
  getMessageByIdService,
  listThreadService,
  listInboxService,
  markMessageReadService,
  listUnreadMessagesService,
  deleteMessageService,
} from "./notifications.service";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  scheduleAnnouncementSchema,
  bulkCreateAnnouncementsSchema,
  listAnnouncementsSchema,
  createNotificationSchema,
  bulkCreateNotificationsSchema,
  listNotificationsSchema,
  markAllReadSchema,
  queueSmsSchema,
  queueBulkSmsSchema,
  queueAbsenteeAlertsSchema,
  queueFeeRemindersSchema,
  queueReportCardReadySchema,
  queueAnnouncementSmsSchema,
  listSmsLogsSchema,
  markSmsAsSentSchema,
  sendDirectMessageSchema,
  listThreadSchema,
  announcementIdParamSchema,
  notificationIdParamSchema,
  messageIdParamSchema,
  smsLogIdParamSchema,
  schoolIdParamSchema,
  classIdParamSchema,
} from "../../validators/notifications.validator";

const getUserId = (req: Request): string | undefined =>
  (req as any).user?.id as string | undefined;

// ================================================================
// ANNOUNCEMENTS
// ================================================================

export const createAnnouncementController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in to post an announcement." });
      return;
    }
    const v = createAnnouncementSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't post the announcement — check the highlighted fields.",
        errors: v.error.format(),
      });
      return;
    }
    const result = await createAnnouncementService({ ...v.data, postedBy: userId } as any);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `We couldn't post the announcement — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getAnnouncementByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = announcementIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid announcement ID.", errors: p.error.format() });
      return;
    }
    const result = await getAnnouncementByIdService(p.data.announcementId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Announcement retrieved." : "We couldn't find that announcement.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listAnnouncementsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    if (!s.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: s.error.format() });
      return;
    }
    const q = listAnnouncementsSchema.safeParse(req.query);
    const opts = q.success ? q.data : undefined;
    const result = await listAnnouncementsService(s.data.schoolId, opts);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} announcement(s).` : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listMyActiveAnnouncementsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const result = await listActiveAnnouncementsForUserService(userId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listAnnouncementsForClassController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = classIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid class ID.", errors: p.error.format() });
      return;
    }
    const result = await listAnnouncementsForClassService(p.data.classId);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} announcement(s).` : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const updateAnnouncementController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = announcementIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid announcement ID.", errors: p.error.format() });
      return;
    }
    const v = updateAnnouncementSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await updateAnnouncementService(p.data.announcementId, v.data);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Announcement updated." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const deleteAnnouncementController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = announcementIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid announcement ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteAnnouncementService(p.data.announcementId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Announcement deleted." : "We couldn't find that announcement.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const scheduleAnnouncementController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = announcementIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid announcement ID.", errors: p.error.format() });
      return;
    }
    const v = scheduleAnnouncementSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Provide a valid expiresAt datetime.", errors: v.error.format() });
      return;
    }
    const result = await scheduleAnnouncementService(p.data.announcementId, v.data.expiresAt);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Announcement scheduled." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const bulkCreateAnnouncementsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const v = bulkCreateAnnouncementsSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await bulkCreateAnnouncementsService(v.data.schoolId, v.data.announcements);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const countAnnouncementsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await countAnnouncementsService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

// ================================================================
// NOTIFICATIONS
// ================================================================

export const createNotificationController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = createNotificationSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await createNotificationService(v.data);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? "Notification created." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const bulkCreateNotificationsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = bulkCreateNotificationsSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await bulkCreateNotificationsService(v.data);
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getNotificationByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = notificationIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid notification ID.", errors: p.error.format() });
      return;
    }
    const result = await getNotificationByIdService(p.data.notificationId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Notification retrieved." : "We couldn't find that notification.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listMyNotificationsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const q = listNotificationsSchema.safeParse(req.query);
    const opts = q.success ? q.data : { unreadOnly: false, limit: 50 };
    const result = await listNotificationsForUserService(userId, opts);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} notification(s).` : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const countMyUnreadNotificationsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const result = await countUnreadNotificationsService(userId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const markNotificationReadController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = notificationIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid notification ID.", errors: p.error.format() });
      return;
    }
    const result = await markNotificationReadService(p.data.notificationId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Marked as read." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const markAllNotificationsReadController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const v = markAllReadSchema.safeParse(req.body ?? {});
    const onlyIds = v.success ? v.data.onlyIds : undefined;
    const result = await markAllNotificationsReadService(userId, onlyIds);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const deleteNotificationController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = notificationIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid notification ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteNotificationService(p.data.notificationId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Notification deleted." : "We couldn't find that notification.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

// ================================================================
// SMS — queue only
// ================================================================

export const queueSmsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = queueSmsSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await queueSmsService(v.data);
    res.status(result.success ? 202 : 400).json({
      ...result,
      message: result.success ? "SMS queued for sending." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const queueBulkSmsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = queueBulkSmsSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await queueBulkSmsService(v.data.schoolId, v.data.recipients);
    res.status(result.success ? 202 : 400).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const queueAbsenteeAlertsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = queueAbsenteeAlertsSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Provide a valid school ID and date.", errors: v.error.format() });
      return;
    }
    const result = await queueAbsenteeAlertsService(v.data.schoolId, v.data.date);
    res.status(result.success ? 202 : 400).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const queueFeeRemindersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = queueFeeRemindersSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await queueFeeRemindersService(v.data.schoolId, v.data.termId, v.data.minBalance);
    res.status(result.success ? 202 : 400).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const queueReportCardReadyController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = queueReportCardReadySchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await queueReportCardReadyService(v.data.schoolId, v.data.termId);
    res.status(result.success ? 202 : 400).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const queueAnnouncementSmsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = queueAnnouncementSmsSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await queueAnnouncementSmsService(v.data.schoolId, v.data.announcementId);
    res.status(result.success ? 202 : 400).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listSmsLogsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const s = schoolIdParamSchema.safeParse(req.params);
    if (!s.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: s.error.format() });
      return;
    }
    const q = listSmsLogsSchema.safeParse(req.query);
    const opts = q.success ? q.data : undefined;
    const result = await listSmsLogsService(s.data.schoolId, opts);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} SMS log(s).` : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getSmsLogByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = smsLogIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid SMS log ID.", errors: p.error.format() });
      return;
    }
    const result = await getSmsLogByIdService(p.data.smsLogId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "SMS log retrieved." : "We couldn't find that SMS log.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const markSmsAsSentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = markSmsAsSentSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Provide valid SMS log IDs.", errors: v.error.format() });
      return;
    }
    const result = await markSmsAsSentService(v.data.ids, v.data.providerMessageId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getSmsStatsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = schoolIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid school ID.", errors: p.error.format() });
      return;
    }
    const result = await getSmsStatsService(p.data.schoolId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

// ================================================================
// DIRECT MESSAGES
// ================================================================

export const sendDirectMessageController = async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = getUserId(req);
    if (!senderId) {
      res.status(401).json({ success: false, message: "You need to be signed in to send messages." });
      return;
    }
    const v = sendDirectMessageSchema.safeParse(req.body);
    if (!v.success) {
      res.status(400).json({ success: false, message: "Check the highlighted fields.", errors: v.error.format() });
      return;
    }
    const result = await sendDirectMessageService({ ...v.data, senderId });
    res.status(result.success ? 201 : 400).json({
      ...result,
      message: result.success ? "Message sent." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const getMessageByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = messageIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid message ID.", errors: p.error.format() });
      return;
    }
    const result = await getMessageByIdService(p.data.messageId);
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: result.success ? "Message retrieved." : "We couldn't find that message.",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listThreadController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const q = listThreadSchema.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ success: false, message: "Provide a valid withUserId.", errors: q.error.format() });
      return;
    }
    const result = await listThreadService(userId, q.data.withUserId);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} message(s).` : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listInboxController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const result = await listInboxService(userId);
    res.status(200).json({
      ...result,
      message: result.success ? result.message : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const markMessageReadController = async (req: Request, res: Response): Promise<void> => {
  try {
    const p = messageIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid message ID.", errors: p.error.format() });
      return;
    }
    const result = await markMessageReadService(p.data.messageId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Message marked as read." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const listUnreadMessagesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const result = await listUnreadMessagesService(userId);
    res.status(200).json({
      ...result,
      message: result.success ? `Fetched ${result.count ?? 0} unread message(s).` : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};

export const deleteMessageController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "You need to be signed in." });
      return;
    }
    const p = messageIdParamSchema.safeParse(req.params);
    if (!p.success) {
      res.status(400).json({ success: false, message: "Invalid message ID.", errors: p.error.format() });
      return;
    }
    const result = await deleteMessageService(p.data.messageId, userId);
    res.status(result.success ? 200 : 400).json({
      ...result,
      message: result.success ? "Message deleted." : `Failed — ${result.message}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Something went wrong." });
  }
};