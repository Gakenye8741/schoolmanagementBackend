// src/services/notifications/notifications.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

const isoDateTime = z
  .string()
  .datetime({ message: "Must be a valid ISO 8601 datetime (e.g. 2026-11-06T14:30:00Z)." });

const audience = z.enum(
  ["All", "Parents", "Teachers", "Students", "Staff"],
  { errorMap: () => ({ message: 'Audience must be one of: "All", "Parents", "Teachers", "Students", "Staff".' }) }
);

const notificationType = z.enum(
  ["Fees", "Attendance", "Exam", "Homework", "Announcement", "Message", "Discipline", "System"],
  { errorMap: () => ({ message: "Invalid notification type." }) }
);

const smsStatus = z.enum(
  ["Queued", "Sent", "Delivered", "Failed"],
  { errorMap: () => ({ message: 'SMS status must be one of: "Queued", "Sent", "Delivered", "Failed".' }) }
);

/**
 * Kenyan phone number:
 *   07XXXXXXXX   (10 digits, leading 0)
 *   01XXXXXXXX   (10 digits, leading 0)
 *   254XXXXXXXXX (12 digits, no +)
 *   +254XXXXXXXXX (13 digits with +)
 */
const kenyanPhone = z
  .string()
  .trim()
  .regex(/^(\+?254|0)[17]\d{8}$/, "Phone must be a valid Kenyan number (e.g. +254712345678 or 0712345678).");

/** One SMS can hold at most 3 segments of 160 chars. */
const smsMessage = z
  .string()
  .trim()
  .min(1, "Message cannot be empty.")
  .max(480, "Message cannot exceed 480 characters (3 SMS segments).");

// ================================================================
// ANNOUNCEMENTS
// ================================================================
const announcementObjectSchema = z.object({
  schoolId: uuid("school ID"),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
  message: z.string().trim().min(2, "Message must be at least 2 characters.").max(5000),
  targetAudience: audience,
  classId: uuid("class ID").optional().nullable(),
  sendViaSms: z.boolean().optional().default(false),
  expiresAt: isoDateTime.optional().nullable(),
});

// CREATE
export const createAnnouncementSchema = announcementObjectSchema
  // If a classId is set, audience must be Parents — announcements to a class
  // target the parents of those students, not the students themselves.
  .refine(
    (d) => !d.classId || d.targetAudience === "Parents",
    {
      message: 'When targeting a specific class, audience must be "Parents".',
      path: ["targetAudience"],
    }
  );

// UPDATE
export const updateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(2).max(255).optional(),
    message: z.string().trim().min(2).max(5000).optional(),
    targetAudience: audience.optional(),
    classId: uuid("class ID").optional().nullable(),
    expiresAt: isoDateTime.optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

// SCHEDULE / EXPIRY
export const scheduleAnnouncementSchema = z.object({
  expiresAt: isoDateTime,
});

// BULK CREATE
const announcementBulkItemSchema = z.object({
  title: z.string().trim().min(2).max(255),
  message: z.string().trim().min(2).max(5000),
  targetAudience: audience,
  classId: uuid("class ID").optional().nullable(),
});

export const bulkCreateAnnouncementsSchema = z.object({
  schoolId: uuid("school ID"),
  announcements: z
    .array(announcementBulkItemSchema)
    .min(1, "At least one announcement is required.")
    .max(50, "Cannot create more than 50 announcements in one request."),
});

// LIST QUERY
export const listAnnouncementsSchema = z.object({
  audience: audience.optional(),
  classId: uuid("class ID").optional(),
  fromDate: isoDateTime.optional(),
  toDate: isoDateTime.optional(),
});

// ================================================================
// NOTIFICATIONS
// ================================================================
const notificationObjectSchema = z.object({
  schoolId: uuid("school ID"),
  userId: uuid("user ID"),
  type: notificationType,
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
  body: z.string().trim().max(5000).optional().nullable(),
  data: z.record(z.unknown()).optional().nullable(),
});

// CREATE
export const createNotificationSchema = notificationObjectSchema;

// BULK CREATE
export const bulkCreateNotificationsSchema = z.object({
  schoolId: uuid("school ID"),
  userIds: z
    .array(uuid("user ID"))
    .min(1, "At least one user ID is required.")
    .max(500, "Cannot notify more than 500 users in one request.")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Duplicate user IDs are not allowed.",
    }),
  type: notificationType,
  title: z.string().trim().min(2).max(255),
  body: z.string().trim().max(5000).optional().nullable(),
  data: z.record(z.unknown()).optional().nullable(),
});

// LIST QUERY
export const listNotificationsSchema = z.object({
  unreadOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// MARK ALL READ
export const markAllReadSchema = z.object({
  onlyIds: z
    .array(uuid("notification ID"))
    .optional()
    .refine(
      (ids) => !ids || new Set(ids).size === ids.length,
      { message: "Duplicate notification IDs are not allowed." }
    ),
});

// ================================================================
// SMS — queue-only
// ================================================================
export const queueSmsSchema = z.object({
  schoolId: uuid("school ID"),
  to: kenyanPhone,
  message: smsMessage,
  recipientUserId: uuid("recipient user ID").optional().nullable(),
  announcementId: uuid("announcement ID").optional().nullable(),
});

export const queueBulkSmsSchema = z.object({
  schoolId: uuid("school ID"),
  recipients: z
    .array(
      z.object({
        to: kenyanPhone,
        message: smsMessage,
        recipientUserId: uuid("recipient user ID").optional().nullable(),
        announcementId: uuid("announcement ID").optional().nullable(),
      })
    )
    .min(1, "At least one recipient is required.")
    .max(500, "Cannot queue more than 500 SMS in one request."),
});

export const queueAbsenteeAlertsSchema = z.object({
  schoolId: uuid("school ID"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
    .refine(
      (v) => {
        const d = new Date(`${v}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
      },
      { message: "Invalid calendar date." }
    ),
});

export const queueFeeRemindersSchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
  minBalance: z.coerce.number().min(0).optional().default(1),
});

export const queueReportCardReadySchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
});

export const queueAnnouncementSmsSchema = z.object({
  schoolId: uuid("school ID"),
  announcementId: uuid("announcement ID"),
});

export const listSmsLogsSchema = z.object({
  status: smsStatus.optional(),
  fromDate: isoDateTime.optional(),
  toDate: isoDateTime.optional(),
});

export const markSmsAsSentSchema = z.object({
  ids: z
    .array(uuid("SMS log ID"))
    .min(1, "At least one SMS log ID is required.")
    .max(500, "Cannot mark more than 500 messages at once.")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Duplicate SMS log IDs are not allowed.",
    }),
  providerMessageId: z.string().trim().max(100).optional(),
});

// ================================================================
// DIRECT MESSAGES
// ================================================================
export const sendDirectMessageSchema = z.object({
  schoolId: uuid("school ID"),
  receiverId: uuid("receiver user ID"),
  messageText: z.string().trim().min(1, "Message cannot be empty.").max(5000),
});

export const listThreadSchema = z.object({
  withUserId: uuid("user ID"),
});

// ================================================================
// ROUTE PARAMS
// ================================================================
export const announcementIdParamSchema = z.object({
  announcementId: uuid("announcement ID"),
});

export const notificationIdParamSchema = z.object({
  notificationId: uuid("notification ID"),
});

export const messageIdParamSchema = z.object({
  messageId: uuid("message ID"),
});

export const smsLogIdParamSchema = z.object({
  smsLogId: uuid("SMS log ID"),
});

export const schoolIdParamSchema = z.object({
  schoolId: uuid("school ID"),
});

export const classIdParamSchema = z.object({
  classId: uuid("class ID"),
});

// ================================================================
// Inferred types
// ================================================================
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type ScheduleAnnouncementInput = z.infer<typeof scheduleAnnouncementSchema>;
export type BulkCreateAnnouncementsInput = z.infer<typeof bulkCreateAnnouncementsSchema>;
export type ListAnnouncementsInput = z.infer<typeof listAnnouncementsSchema>;

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type BulkCreateNotificationsInput = z.infer<typeof bulkCreateNotificationsSchema>;
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
export type MarkAllReadInput = z.infer<typeof markAllReadSchema>;

export type QueueSmsInput = z.infer<typeof queueSmsSchema>;
export type QueueBulkSmsInput = z.infer<typeof queueBulkSmsSchema>;
export type QueueAbsenteeAlertsInput = z.infer<typeof queueAbsenteeAlertsSchema>;
export type QueueFeeRemindersInput = z.infer<typeof queueFeeRemindersSchema>;
export type QueueReportCardReadyInput = z.infer<typeof queueReportCardReadySchema>;
export type QueueAnnouncementSmsInput = z.infer<typeof queueAnnouncementSmsSchema>;
export type ListSmsLogsInput = z.infer<typeof listSmsLogsSchema>;
export type MarkSmsAsSentInput = z.infer<typeof markSmsAsSentSchema>;

export type SendDirectMessageInput = z.infer<typeof sendDirectMessageSchema>;
export type ListThreadInput = z.infer<typeof listThreadSchema>;