// src/services/notifications/notifications.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, or, inArray, gte, lte,
} from "drizzle-orm";

import {
  announcements,
  notifications,
  smsLogs,
  directMessages,
  students,
  studentGuardians,
  users,
  classes,
  schools,
  attendance,
  studentInvoices,
  reportCards,
  feeTransactions,
  academicTerms,
  TSelectAnnouncement,
  TSelectNotification,
  TSelectSmsLog,
  TSelectDirectMessage,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Input types
// ================================================================
export type Audience = "All" | "Parents" | "Teachers" | "Students" | "Staff";
export type NotifType =
  | "Fees" | "Attendance" | "Exam" | "Homework"
  | "Announcement" | "Message" | "Discipline" | "System";
export type SmsStatus = "Queued" | "Sent" | "Delivered" | "Failed";

export interface CreateAnnouncementInput {
  schoolId: string;
  title: string;
  message: string;
  targetAudience: Audience;
  classId?: string | null;
  sendViaSms?: boolean;
  expiresAt?: string | null;
}

export interface UpdateAnnouncementInput {
  title?: string;
  message?: string;
  targetAudience?: Audience;
  classId?: string | null;
  expiresAt?: string | null;
}

export interface CreateNotificationInput {
  schoolId: string;
  userId: string;
  type: NotifType;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

export interface BulkCreateNotificationsInput {
  schoolId: string;
  userIds: string[];
  type: NotifType;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

export interface QueueSmsInput {
  schoolId: string;
  to: string;
  message: string;
  recipientUserId?: string | null;
  announcementId?: string | null;
}

export interface SendDirectMessageInput {
  schoolId: string;
  senderId: string;
  receiverId: string;
  messageText: string;
}

// ================================================================
// Response envelope
// ================================================================
export interface NotifResponse {
  success: boolean;
  message: string;
  announcement?: TSelectAnnouncement;
  announcements?: TSelectAnnouncement[];
  notification?: TSelectNotification;
  notifications?: TSelectNotification[];
  smsLog?: TSelectSmsLog;
  smsLogs?: TSelectSmsLog[];
  messageRow?: TSelectDirectMessage;
  messages?: TSelectDirectMessage[];
  queued?: Array<{ to: string; message: string; recipientUserId: string | null }>;
  stats?: Record<string, any>;
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
/** Validate a Kenyan phone number. Returns the raw string if valid, null otherwise. */
const isValidKenyanPhone = (p: string | null | undefined): boolean => {
  if (!p) return false;
  return /^(\+?254|0)?[17]\d{8}$/.test(p.trim());
};

/**
 * Resolve which user IDs should receive an announcement.
 * - classId set  → guardians of students in that class
 * - classId null → all users matching the audience role filter
 */
const resolveAnnouncementRecipients = async (
  schoolId: string,
  audience: Audience,
  classId: string | null
): Promise<string[]> => {
  if (classId) {
    const roster = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.classId, classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
      columns: { id: true },
    });
    if (roster.length === 0) return [];
    const ids = roster.map((s) => s.id);
    const guardians = await db.query.studentGuardians.findMany({
      where: inArray(studentGuardians.studentId, ids),
      columns: { guardianUserId: true },
    });
    return [...new Set(guardians.map((g) => g.guardianUserId))];
  }

  const filters: any[] = [
    eq(users.schoolId, schoolId),
    eq(users.isActive, true),
    isNull(users.deletedAt),
  ];

  switch (audience) {
    case "Parents":
      filters.push(eq(users.role, "parent"));
      break;
    case "Teachers":
      filters.push(eq(users.role, "teacher"));
      break;
    case "Students":
      filters.push(eq(users.role, "student"));
      break;
    case "Staff":
      filters.push(
        inArray(users.role, [
          "teacher", "bursar", "principal", "deputy_principal",
          "registrar", "librarian", "school_admin",
        ])
      );
      break;
    case "All":
    default:
      // no role filter — send to everyone in the school
      break;
  }

  const rows = await db.query.users.findMany({
    where: and(...filters),
    columns: { id: true },
  });
  return rows.map((u) => u.id);
};

/** Insert Queued smsLog rows in chunks of 100. No provider call. */
const queueSmsRows = async (
  schoolId: string,
  rows: Array<{
    to: string;
    message: string;
    recipientUserId: string | null;
    announcementId?: string | null;
  }>
): Promise<TSelectSmsLog[]> => {
  if (rows.length === 0) return [];
  const values = rows.map((r) => ({
    schoolId,
    phone: r.to.trim(),
    message: r.message.trim(),
    status: "Queued" as const,
    recipientUserId: r.recipientUserId,
    announcementId: r.announcementId ?? null,
  }));

  const inserted: TSelectSmsLog[] = [];
  for (let i = 0; i < values.length; i += 100) {
    const chunk = values.slice(i, i + 100);
    const result = await db.insert(smsLogs).values(chunk).returning();
    inserted.push(...result);
  }
  return inserted;
};

// ================================================================
// ANNOUNCEMENTS — 10 services
// ================================================================

/** 1. Create announcement + fan-out in-app notifications + optional SMS queue. */
export const createAnnouncementService = async (
  data: CreateAnnouncementInput
): Promise<NotifResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.title || data.title.trim().length < 2)
      return { success: false, message: "Announcement title must be at least 2 characters." };
    if (!data.message || data.message.trim().length < 2)
      return { success: false, message: "Announcement message must be at least 2 characters." };

    const [announcement] = await db
      .insert(announcements)
      .values({
        schoolId: data.schoolId,
        title: data.title.trim(),
        message: data.message.trim(),
        targetAudience: data.targetAudience,
        classId: data.classId ?? null,
        sendViaSms: data.sendViaSms ?? false,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      })
      .returning();

    // Fan out in-app notifications
    const recipients = await resolveAnnouncementRecipients(
      data.schoolId,
      data.targetAudience,
      data.classId ?? null
    );

    if (recipients.length > 0) {
      const values = recipients.map((uid) => ({
        schoolId: data.schoolId,
        userId: uid,
        type: "Announcement" as NotifType,
        title: announcement.title,
        body: announcement.message,
        data: { announcementId: announcement.id } as Record<string, unknown>,
      }));
      for (let i = 0; i < values.length; i += 100) {
        await db.insert(notifications).values(values.slice(i, i + 100));
      }
    }

    // Optional SMS queue — writes Queued rows, does NOT send
    let smsQueued = 0;
    if (data.sendViaSms && recipients.length > 0) {
      const recipientUsers = await db.query.users.findMany({
        where: inArray(users.id, recipients),
        columns: { id: true, phone: true },
      });
      const withPhone = recipientUsers.filter((u) => isValidKenyanPhone(u.phone));
      const smsRows = withPhone.map((u) => ({
        to: u.phone!.trim(),
        message: announcement.message,
        recipientUserId: u.id,
        announcementId: announcement.id,
      }));
      const queued = await queueSmsRows(data.schoolId, smsRows);
      smsQueued = queued.length;
    }

    return {
      success: true,
      message:
        `Announcement posted — ${recipients.length} recipient(s) notified` +
        (smsQueued > 0 ? `, ${smsQueued} SMS queued.` : "."),
      announcement,
      count: recipients.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create announcement." };
  }
};

/** 2. Get announcement by ID. */
export const getAnnouncementByIdService = async (
  id: string
): Promise<NotifResponse> => {
  try {
    const row = await db.query.announcements.findFirst({
      where: eq(announcements.id, id),
      with: { class: true, postedByUser: true },
    });
    if (!row) return { success: false, message: "Announcement not found." };
    return { success: true, message: "Announcement retrieved.", announcement: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch announcement." };
  }
};

/** 3. List announcements for a school with optional filters. */
export const listAnnouncementsService = async (
  schoolId: string,
  opts?: { audience?: Audience; classId?: string; fromDate?: string; toDate?: string }
): Promise<NotifResponse> => {
  try {
    const filters: any[] = [eq(announcements.schoolId, schoolId)];
    if (opts?.audience) filters.push(eq(announcements.targetAudience, opts.audience));
    if (opts?.classId) filters.push(eq(announcements.classId, opts.classId));
    if (opts?.fromDate) filters.push(gte(announcements.createdAt, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(announcements.createdAt, new Date(opts.toDate)));

    const rows = await db.query.announcements.findMany({
      where: and(...filters),
      orderBy: [desc(announcements.createdAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} announcement(s).`,
      announcements: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list announcements." };
  }
};

/** 4. Active announcements relevant to a specific user. */
export const listActiveAnnouncementsForUserService = async (
  userId: string
): Promise<NotifResponse> => {
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || !user.schoolId) return { success: false, message: "User not found." };

    const now = new Date();
    const rows = await db.query.announcements.findMany({
      where: and(
        eq(announcements.schoolId, user.schoolId),
        or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now))
      ),
      orderBy: [desc(announcements.createdAt)],
    });

    const role = user.role;
    const staffRoles = [
      "teacher", "bursar", "principal", "deputy_principal",
      "registrar", "librarian", "school_admin",
    ];

    const matchesAudience = (a: Audience) => {
      if (a === "All") return true;
      if (a === "Parents" && role === "parent") return true;
      if (a === "Teachers" && role === "teacher") return true;
      if (a === "Students" && role === "student") return true;
      if (a === "Staff" && staffRoles.includes(role)) return true;
      return false;
    };

    const filtered = rows.filter((r) => matchesAudience(r.targetAudience as Audience));
    return {
      success: true,
      message: `Fetched ${filtered.length} active announcement(s).`,
      announcements: filtered,
      count: filtered.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch active announcements." };
  }
};

/** 5. List announcements targeted at a specific class. */
export const listAnnouncementsForClassService = async (
  classId: string
): Promise<NotifResponse> => {
  try {
    const rows = await db.query.announcements.findMany({
      where: eq(announcements.classId, classId),
      orderBy: [desc(announcements.createdAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} announcement(s) for this class.`,
      announcements: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list class announcements." };
  }
};

/** 6. Update announcement. */
export const updateAnnouncementService = async (
  id: string,
  patch: UpdateAnnouncementInput
): Promise<NotifResponse> => {
  try {
    const existing = await db.query.announcements.findFirst({
      where: eq(announcements.id, id),
    });
    if (!existing) return { success: false, message: "Announcement not found." };

    const [row] = await db
      .update(announcements)
      .set({
        ...(patch.title !== undefined && { title: patch.title.trim() }),
        ...(patch.message !== undefined && { message: patch.message.trim() }),
        ...(patch.targetAudience !== undefined && { targetAudience: patch.targetAudience }),
        ...(patch.classId !== undefined && { classId: patch.classId }),
        ...(patch.expiresAt !== undefined && {
          expiresAt: patch.expiresAt ? new Date(patch.expiresAt) : null,
        }),
      })
      .where(eq(announcements.id, id))
      .returning();
    return { success: true, message: "Announcement updated.", announcement: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update announcement." };
  }
};

/** 7. Delete announcement. */
export const deleteAnnouncementService = async (
  id: string
): Promise<NotifResponse> => {
  try {
    const [row] = await db.delete(announcements).where(eq(announcements.id, id)).returning();
    if (!row) return { success: false, message: "Announcement not found." };
    return { success: true, message: "Announcement deleted.", announcement: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete announcement." };
  }
};

/** 8. Schedule / set expiry. */
export const scheduleAnnouncementService = async (
  id: string,
  expiresAt: string
): Promise<NotifResponse> => updateAnnouncementService(id, { expiresAt });

/** 9. Bulk create announcements (no fan-out). */
export const bulkCreateAnnouncementsService = async (
  schoolId: string,
  items: Array<{
    title: string;
    message: string;
    targetAudience: Audience;
    classId?: string | null;
  }>
): Promise<NotifResponse> => {
  try {
    if (items.length === 0) return { success: false, message: "At least one announcement required." };
    const values = items.map((i) => ({
      schoolId,
      title: i.title.trim(),
      message: i.message.trim(),
      targetAudience: i.targetAudience,
      classId: i.classId ?? null,
    }));
    const rows = await db.insert(announcements).values(values).returning();
    return {
      success: true,
      message: `Created ${rows.length} announcement(s).`,
      announcements: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create announcements." };
  }
};

/** 10. Count announcements for a school. */
export const countAnnouncementsService = async (
  schoolId: string
): Promise<NotifResponse> => {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(announcements)
      .where(eq(announcements.schoolId, schoolId));
    return {
      success: true,
      message: `This school has ${Number(row?.c ?? 0)} announcement(s).`,
      count: Number(row?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count announcements." };
  }
};

// ================================================================
// NOTIFICATIONS — 8 services
// ================================================================

/** 11. Create one notification. */
export const createNotificationService = async (
  data: CreateNotificationInput
): Promise<NotifResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.userId) return { success: false, message: "userId is required." };
    if (!data.title || data.title.trim().length < 2)
      return { success: false, message: "Notification title must be at least 2 characters." };

    const [row] = await db
      .insert(notifications)
      .values({
        schoolId: data.schoolId,
        userId: data.userId,
        type: data.type,
        title: data.title.trim(),
        body: data.body ?? null,
        data: data.data ?? null,
      })
      .returning();
    return { success: true, message: "Notification created.", notification: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to create notification." };
  }
};

/** 12. Bulk create notifications (chunks of 100). */
export const bulkCreateNotificationsService = async (
  data: BulkCreateNotificationsInput
): Promise<NotifResponse> => {
  try {
    const uniqueIds = [...new Set(data.userIds)];
    if (uniqueIds.length === 0)
      return { success: false, message: "At least one userId required." };

    const values = uniqueIds.map((uid) => ({
      schoolId: data.schoolId,
      userId: uid,
      type: data.type,
      title: data.title.trim(),
      body: data.body ?? null,
      data: data.data ?? null,
    }));

    let total = 0;
    for (let i = 0; i < values.length; i += 100) {
      const chunk = values.slice(i, i + 100);
      const rows = await db.insert(notifications).values(chunk).returning();
      total += rows.length;
    }
    return {
      success: true,
      message: `Created ${total} notification(s).`,
      count: total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-create notifications." };
  }
};

/** 13. Get notification by ID. */
export const getNotificationByIdService = async (
  id: string
): Promise<NotifResponse> => {
  try {
    const row = await db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    });
    if (!row) return { success: false, message: "Notification not found." };
    return { success: true, message: "Notification retrieved.", notification: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch notification." };
  }
};

/** 14. List notifications for a user. */
export const listNotificationsForUserService = async (
  userId: string,
  opts?: { unreadOnly?: boolean; limit?: number }
): Promise<NotifResponse> => {
  try {
    const filters: any[] = [eq(notifications.userId, userId)];
    if (opts?.unreadOnly) filters.push(isNull(notifications.readAt));

    const rows = await db.query.notifications.findMany({
      where: and(...filters),
      orderBy: [desc(notifications.createdAt)],
      ...(opts?.limit ? { limit: opts.limit } : {}),
    });
    return {
      success: true,
      message: `Fetched ${rows.length} notification(s).`,
      notifications: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list notifications." };
  }
};

/** 15. Count unread notifications for a user. */
export const countUnreadNotificationsService = async (
  userId: string
): Promise<NotifResponse> => {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return {
      success: true,
      message: `${Number(row?.c ?? 0)} unread notification(s).`,
      count: Number(row?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count unread." };
  }
};

/** 16. Mark one notification read. */
export const markNotificationReadService = async (
  id: string
): Promise<NotifResponse> => {
  try {
    const [row] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    if (!row) return { success: false, message: "Notification not found." };
    return { success: true, message: "Marked as read.", notification: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to mark read." };
  }
};

/** 17. Mark all (or a subset) of a user's notifications as read. */
export const markAllNotificationsReadService = async (
  userId: string,
  onlyIds?: string[]
): Promise<NotifResponse> => {
  try {
    const filters: any[] = [eq(notifications.userId, userId), isNull(notifications.readAt)];
    if (onlyIds && onlyIds.length > 0) filters.push(inArray(notifications.id, onlyIds));

    const rows = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(...filters))
      .returning();
    return {
      success: true,
      message: `Marked ${rows.length} notification(s) as read.`,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to mark all as read." };
  }
};

/** 18. Delete one notification. */
export const deleteNotificationService = async (
  id: string
): Promise<NotifResponse> => {
  try {
    const [row] = await db.delete(notifications).where(eq(notifications.id, id)).returning();
    if (!row) return { success: false, message: "Notification not found." };
    return { success: true, message: "Notification deleted.", notification: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete notification." };
  }
};

// ================================================================
// SMS — 10 services (all queue-only, no external provider calls)
// ================================================================

/** 19. Queue one SMS. Never sends — just writes a Queued row. */
export const queueSmsService = async (
  data: QueueSmsInput
): Promise<NotifResponse> => {
  try {
    if (!isValidKenyanPhone(data.to))
      return { success: false, message: "Invalid phone number — must be a valid Kenyan number." };
    if (!data.message || data.message.trim().length === 0)
      return { success: false, message: "Message cannot be empty." };
    if (data.message.length > 480)
      return { success: false, message: "Message cannot exceed 480 characters (3 SMS segments)." };

    const [row] = await db
      .insert(smsLogs)
      .values({
        schoolId: data.schoolId,
        phone: data.to.trim(),
        message: data.message.trim(),
        status: "Queued",
        recipientUserId: data.recipientUserId ?? null,
        announcementId: data.announcementId ?? null,
      })
      .returning();
    return { success: true, message: "SMS queued for sending.", smsLog: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to queue SMS." };
  }
};

/** 20. Queue a batch of SMS (chunks of 100). */
export const queueBulkSmsService = async (
  schoolId: string,
  recipients: Array<{
    to: string;
    message: string;
    recipientUserId?: string | null;
    announcementId?: string | null;
  }>
): Promise<NotifResponse> => {
  try {
    if (recipients.length === 0)
      return { success: false, message: "At least one recipient required." };

    const valid = recipients
      .filter((r) => isValidKenyanPhone(r.to) && r.message.trim().length > 0)
      .map((r) => ({
        to: r.to,
        message: r.message,
        recipientUserId: r.recipientUserId ?? null,   // ← undefined → null
        announcementId: r.announcementId ?? null,
      }));

    const invalid = recipients.length - valid.length;

    const rows = await queueSmsRows(schoolId, valid);
    return {
      success: true,
      message: `Queued ${rows.length} SMS${invalid > 0 ? `; ${invalid} skipped (invalid phone or empty message)` : ""}.`,
      smsLogs: rows,
      count: rows.length,
      issues: invalid > 0 ? [`${invalid} invalid recipient(s) skipped`] : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to queue bulk SMS." };
  }
};

/** 21. Queue absentee alerts for all absentees on a given date. */
export const queueAbsenteeAlertsService = async (
  schoolId: string,
  date: string
): Promise<NotifResponse> => {
  try {
    // Fetch absentees
    const absentees = await db.query.attendance.findMany({
      where: and(
        eq(attendance.schoolId, schoolId),
        eq(attendance.date, date),
        inArray(attendance.status, ["Absent", "Late"])
      ),
    });

    if (absentees.length === 0) {
      return { success: true, message: "No absentees on this date.", count: 0 };
    }

    const studentIds = [...new Set(absentees.map((a) => a.studentId))];

    // Fetch students + school for the SMS body
    const studentRows = await db.query.students.findMany({
      where: inArray(students.id, studentIds),
      columns: { id: true, firstName: true, lastName: true, classId: true },
    });
    const byId = new Map(studentRows.map((s) => [s.id, s]));

    const school = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
      columns: { shortName: true, name: true },
    });
    const schoolName = school?.shortName ?? school?.name ?? "School";

    // Fetch guardians for these students
    const guardians = await db.query.studentGuardians.findMany({
      where: inArray(studentGuardians.studentId, studentIds),
      with: {
        guardian: { columns: { id: true, name: true, phone: true } },
      },
    });

    // Build queued rows — one per guardian with a valid phone
    const rows: Array<{
      to: string;
      message: string;
      recipientUserId: string | null;
    }> = [];

    const statusByStudent = new Map(
      absentees.map((a) => [a.studentId, a.status as "Absent" | "Late"])
    );

    for (const g of guardians) {
      if (!g.guardian || !isValidKenyanPhone(g.guardian.phone)) continue;
      const student = byId.get(g.studentId);
      if (!student) continue;
      const status = statusByStudent.get(g.studentId) ?? "Absent";
      const message =
        `${schoolName}: ${student.firstName} ${student.lastName} was marked ` +
        `${status.toLowerCase()} on ${date}. Please contact the school if this is unexpected.`;

      rows.push({
        to: g.guardian.phone!.trim(),
        message,
        recipientUserId: g.guardian.id,
      });
    }

    if (rows.length === 0) {
      return {
        success: false,
        message: `No valid guardian phone numbers found for ${absentees.length} absentee(s).`,
        issues: ["No valid phone numbers on record for any guardian of these students."],
      };
    }

    const queued = await queueSmsRows(schoolId, rows);
    return {
      success: true,
      message: `Queued ${queued.length} absentee alert SMS for ${absentees.length} absentee(s).`,
      smsLogs: queued,
      count: queued.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to queue absentee alerts." };
  }
};

/** 22. Queue fee reminder SMS for all defaulters in a term. */
export const queueFeeRemindersService = async (
  schoolId: string,
  termId: string,
  minBalance = 1
): Promise<NotifResponse> => {
  try {
    // Compute per-student billed vs paid
    const invoices = await db.query.studentInvoices.findMany({
      where: and(
        eq(studentInvoices.schoolId, schoolId),
        eq(studentInvoices.termId, termId),
        ne(studentInvoices.status, "Cancelled"),
        ne(studentInvoices.status, "Waived")
      ),
    });

    const payments = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.termId, termId),
        eq(feeTransactions.status, "Completed")
      ),
    });

    const billedByStudent = new Map<string, number>();
    for (const inv of invoices) {
      const amt = Number(inv.totalAmount) - Number(inv.discountAmount);
      billedByStudent.set(inv.studentId, (billedByStudent.get(inv.studentId) ?? 0) + amt);
    }

    const paidByStudent = new Map<string, number>();
    for (const p of payments) {
      paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + Number(p.amountPaid));
    }

    const defaulters: Array<{ studentId: string; balance: number }> = [];
    for (const [studentId, billed] of billedByStudent.entries()) {
      const paid = paidByStudent.get(studentId) ?? 0;
      const balance = billed - paid;
      if (balance >= minBalance) defaulters.push({ studentId, balance });
    }

    if (defaulters.length === 0) {
      return { success: true, message: "No defaulters in this term.", count: 0 };
    }

    const studentIds = defaulters.map((d) => d.studentId);
    const studentRows = await db.query.students.findMany({
      where: inArray(students.id, studentIds),
      columns: { id: true, firstName: true, lastName: true },
    });
    const byId = new Map(studentRows.map((s) => [s.id, s]));

    const school = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
      columns: { shortName: true, name: true, currency: true },
    });
    const schoolName = school?.shortName ?? school?.name ?? "School";
    const currency = school?.currency ?? "KES";

    const guardians = await db.query.studentGuardians.findMany({
      where: inArray(studentGuardians.studentId, studentIds),
      with: { guardian: { columns: { id: true, phone: true } } },
    });

    const balanceById = new Map(defaulters.map((d) => [d.studentId, d.balance]));

    const rows: Array<{ to: string; message: string; recipientUserId: string | null }> = [];
    for (const g of guardians) {
      if (!g.guardian || !isValidKenyanPhone(g.guardian.phone)) continue;
      const student = byId.get(g.studentId);
      const balance = balanceById.get(g.studentId);
      if (!student || balance === undefined) continue;
      const message =
        `${schoolName}: Fee balance of ${currency} ${balance.toFixed(2)} for ` +
        `${student.firstName} ${student.lastName}. Please pay to avoid disruption.`;
      rows.push({
        to: g.guardian.phone!.trim(),
        message,
        recipientUserId: g.guardian.id,
      });
    }

    if (rows.length === 0) {
      return {
        success: false,
        message: `No valid guardian phone numbers found for ${defaulters.length} defaulter(s).`,
      };
    }

    const queued = await queueSmsRows(schoolId, rows);
    return {
      success: true,
      message: `Queued ${queued.length} fee reminder SMS for ${defaulters.length} defaulter(s).`,
      smsLogs: queued,
      count: queued.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to queue fee reminders." };
  }
};

/** 23. Queue report card ready notifications for all published report cards in a term. */
export const queueReportCardReadyService = async (
  schoolId: string,
  termId: string
): Promise<NotifResponse> => {
  try {
    const cards = await db.query.reportCards.findMany({
      where: and(
        eq(reportCards.schoolId, schoolId),
        eq(reportCards.termId, termId),
        eq(reportCards.isPublished, true)
      ),
    });
    if (cards.length === 0) {
      return { success: true, message: "No published report cards in this term.", count: 0 };
    }

    const studentIds = [...new Set(cards.map((c) => c.studentId))];
    const studentRows = await db.query.students.findMany({
      where: inArray(students.id, studentIds),
      columns: { id: true, firstName: true, lastName: true },
    });
    const byId = new Map(studentRows.map((s) => [s.id, s]));

    const school = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
      columns: { shortName: true, name: true },
    });
    const schoolName = school?.shortName ?? school?.name ?? "School";

    const guardians = await db.query.studentGuardians.findMany({
      where: inArray(studentGuardians.studentId, studentIds),
      with: { guardian: { columns: { id: true, phone: true } } },
    });

    const rows: Array<{ to: string; message: string; recipientUserId: string | null }> = [];
    for (const g of guardians) {
      if (!g.guardian || !isValidKenyanPhone(g.guardian.phone)) continue;
      const student = byId.get(g.studentId);
      if (!student) continue;
      const message =
        `${schoolName}: Report card for ${student.firstName} ${student.lastName} ` +
        `is now available in the parent portal.`;
      rows.push({
        to: g.guardian.phone!.trim(),
        message,
        recipientUserId: g.guardian.id,
      });
    }

    if (rows.length === 0) {
      return {
        success: false,
        message: `No valid guardian phone numbers found for ${cards.length} report card(s).`,
      };
    }

    const queued = await queueSmsRows(schoolId, rows);
    return {
      success: true,
      message: `Queued ${queued.length} report-card-ready SMS for ${cards.length} student(s).`,
      smsLogs: queued,
      count: queued.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to queue report card alerts." };
  }
};

/** 24. Queue SMS for a specific announcement (uses existing announcement row). */
export const queueAnnouncementSmsService = async (
  schoolId: string,
  announcementId: string
): Promise<NotifResponse> => {
  try {
    const announcement = await db.query.announcements.findFirst({
      where: and(eq(announcements.id, announcementId), eq(announcements.schoolId, schoolId)),
    });
    if (!announcement) return { success: false, message: "Announcement not found." };

    const recipients = await resolveAnnouncementRecipients(
      schoolId,
      announcement.targetAudience as Audience,
      announcement.classId
    );
    if (recipients.length === 0)
      return { success: true, message: "No recipients for this announcement.", count: 0 };

    const usersWithPhone = await db.query.users.findMany({
      where: and(eq(users.id, inArray(users.id, recipients) as any), eq(users.isActive, true)),
      columns: { id: true, phone: true },
    });

    const rows = usersWithPhone
      .filter((u) => isValidKenyanPhone(u.phone))
      .map((u) => ({
        to: u.phone!.trim(),
        message: `${announcement.title}: ${announcement.message}`,
        recipientUserId: u.id,
        announcementId: announcement.id,
      }));

    if (rows.length === 0)
      return { success: false, message: "No recipients have a valid phone number." };

    const queued = await queueSmsRows(schoolId, rows);
    return {
      success: true,
      message: `Queued ${queued.length} SMS for this announcement.`,
      smsLogs: queued,
      count: queued.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to queue announcement SMS." };
  }
};

/** 25. List SMS logs for a school. */
export const listSmsLogsService = async (
  schoolId: string,
  opts?: { status?: SmsStatus; fromDate?: string; toDate?: string }
): Promise<NotifResponse> => {
  try {
    const filters: any[] = [eq(smsLogs.schoolId, schoolId)];
    if (opts?.status) filters.push(eq(smsLogs.status, opts.status));
    if (opts?.fromDate) filters.push(gte(smsLogs.createdAt, new Date(opts.fromDate)));
    if (opts?.toDate) filters.push(lte(smsLogs.createdAt, new Date(opts.toDate)));

    const rows = await db.query.smsLogs.findMany({
      where: and(...filters),
      orderBy: [desc(smsLogs.createdAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} SMS log(s).`,
      smsLogs: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list SMS logs." };
  }
};

/** 26. Get SMS log by ID. */
export const getSmsLogByIdService = async (id: string): Promise<NotifResponse> => {
  try {
    const row = await db.query.smsLogs.findFirst({ where: eq(smsLogs.id, id) });
    if (!row) return { success: false, message: "SMS log not found." };
    return { success: true, message: "SMS log retrieved.", smsLog: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch SMS log." };
  }
};

/** 27. Mark queued SMS as Sent (manual — e.g. after school sends via their bulk provider). */
export const markSmsAsSentService = async (
  ids: string[],
  providerMessageId?: string
): Promise<NotifResponse> => {
  try {
    if (ids.length === 0) return { success: false, message: "No SMS IDs provided." };

    const rows = await db
      .update(smsLogs)
      .set({
        status: "Sent",
        ...(providerMessageId ? { providerMessageId } : {}),
      })
      .where(inArray(smsLogs.id, ids))
      .returning();

    return {
      success: true,
      message: `Marked ${rows.length} SMS as sent.`,
      smsLogs: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to mark SMS as sent." };
  }
};

/** 28. SMS stats by status for a school. */
export const getSmsStatsService = async (
  schoolId: string
): Promise<NotifResponse> => {
  try {
    const rows = await db
      .select({ status: smsLogs.status, count: count() })
      .from(smsLogs)
      .where(eq(smsLogs.schoolId, schoolId))
      .groupBy(smsLogs.status);

    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      breakdown[r.status] = Number(r.count);
      total += Number(r.count);
    }

    return {
      success: true,
      message: `SMS stats across ${total} message(s).`,
      stats: { breakdown, total },
      count: total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute SMS stats." };
  }
};

// ================================================================
// DIRECT MESSAGES — 7 services
// ================================================================

/** 29. Send direct message. */
export const sendDirectMessageService = async (
  data: SendDirectMessageInput
): Promise<NotifResponse> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.senderId) return { success: false, message: "senderId is required." };
    if (!data.receiverId) return { success: false, message: "receiverId is required." };
    if (data.senderId === data.receiverId)
      return { success: false, message: "Cannot send a message to yourself." };
    if (!data.messageText || data.messageText.trim().length === 0)
      return { success: false, message: "Message cannot be empty." };

    // Verify both users belong to this school
    const pair = await db.query.users.findMany({
      where: and(
        eq(users.schoolId, data.schoolId),
        inArray(users.id, [data.senderId, data.receiverId])
      ),
      columns: { id: true },
    });
    if (pair.length !== 2)
      return { success: false, message: "Sender and receiver must both belong to this school." };

    const [row] = await db
      .insert(directMessages)
      .values({
        schoolId: data.schoolId,
        senderId: data.senderId,
        receiverId: data.receiverId,
        messageText: data.messageText.trim(),
      })
      .returning();

    // Also drop a notification in the receiver's inbox
    await createNotificationService({
      schoolId: data.schoolId,
      userId: data.receiverId,
      type: "Message",
      title: "New message",
      body: data.messageText.trim().slice(0, 200),
      data: { messageId: row.id, senderId: data.senderId },
    }).catch(() => void 0);

    return { success: true, message: "Message sent.", messageRow: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to send message." };
  }
};

/** 30. Get message by ID. */
export const getMessageByIdService = async (id: string): Promise<NotifResponse> => {
  try {
    const row = await db.query.directMessages.findFirst({
      where: eq(directMessages.id, id),
      with: { sender: true, receiver: true },
    });
    if (!row) return { success: false, message: "Message not found." };
    return { success: true, message: "Message retrieved.", messageRow: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch message." };
  }
};

/** 31. List thread between two users. */
export const listThreadService = async (
  userId: string,
  withUserId: string
): Promise<NotifResponse> => {
  try {
    const rows = await db.query.directMessages.findMany({
      where: or(
        and(eq(directMessages.senderId, userId), eq(directMessages.receiverId, withUserId)),
        and(eq(directMessages.senderId, withUserId), eq(directMessages.receiverId, userId))
      ),
      orderBy: [asc(directMessages.sentAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} message(s).`,
      messages: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list thread." };
  }
};

/** 32. List inbox — most recent message per sender. */
export const listInboxService = async (userId: string): Promise<NotifResponse> => {
  try {
    const rows = await db.query.directMessages.findMany({
      where: eq(directMessages.receiverId, userId),
      orderBy: [desc(directMessages.sentAt)],
    });

    // Deduplicate by sender — keep latest
    const latestBySender = new Map<string, TSelectDirectMessage>();
    for (const r of rows) {
      if (!latestBySender.has(r.senderId)) latestBySender.set(r.senderId, r);
    }
    const inbox = [...latestBySender.values()];

    return {
      success: true,
      message: `Inbox has ${inbox.length} conversation(s).`,
      messages: inbox,
      count: inbox.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list inbox." };
  }
};

/** 33. Mark message read. */
export const markMessageReadService = async (id: string): Promise<NotifResponse> => {
  try {
    const [row] = await db
      .update(directMessages)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(directMessages.id, id))
      .returning();
    if (!row) return { success: false, message: "Message not found." };
    return { success: true, message: "Message marked as read.", messageRow: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to mark message read." };
  }
};

/** 34. List unread messages for a user. */
export const listUnreadMessagesService = async (
  userId: string
): Promise<NotifResponse> => {
  try {
    const rows = await db.query.directMessages.findMany({
      where: and(eq(directMessages.receiverId, userId), eq(directMessages.isRead, false)),
      orderBy: [desc(directMessages.sentAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} unread message(s).`,
      messages: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list unread messages." };
  }
};

/** 35. Delete message (sender only). */
export const deleteMessageService = async (
  id: string,
  requestingUserId: string
): Promise<NotifResponse> => {
  try {
    const existing = await db.query.directMessages.findFirst({
      where: eq(directMessages.id, id),
    });
    if (!existing) return { success: false, message: "Message not found." };
    if (existing.senderId !== requestingUserId)
      return { success: false, message: "Only the sender can delete this message." };

    const [row] = await db.delete(directMessages).where(eq(directMessages.id, id)).returning();
    return { success: true, message: "Message deleted.", messageRow: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete message." };
  }
};