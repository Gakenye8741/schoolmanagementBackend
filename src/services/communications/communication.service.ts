import { eq, and, or, desc, asc, sql } from "drizzle-orm";
import db from "../../drizzle/db";
import { announcements, directMessages, schools, users } from "../../drizzle/schema";
import { 
  TInsertAnnouncement, 
  TSelectAnnouncement,
  TInsertDirectMessage,
  TSelectDirectMessage
} from "../../drizzle/types";

// ==========================================
// ANNOUNCEMENTS SERVICES
// ==========================================

/**
 * Create a new school announcement
 */
export const createAnnouncementService = async (data: TInsertAnnouncement) => {
  try {
    const [announcement] = await db.insert(announcements)
      .values(data)
      .returning();

    return {
      success: true,
      message: "Announcement created successfully.",
      announcement,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create announcement." };
  }
};

/**
 * Get announcement by ID with school and author details
 */
export const getAnnouncementByIdService = async (announcementId: string) => {
  try {
    const announcement = await db.query.announcements.findFirst({
      where: eq(announcements.id, announcementId),
      with: {
        school: true,
        postedByUser: true,
      },
    });

    if (!announcement) {
      return { success: false, message: "Announcement not found." };
    }

    return { success: true, announcement };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all announcements for a specific school, optionally filtered by target audience
 */
export const getAnnouncementsBySchoolService = async (schoolId: string, targetAudience?: string) => {
  try {
    const conditions = [eq(announcements.schoolId, schoolId)];
    if (targetAudience) {
      conditions.push(eq(announcements.targetAudience, targetAudience as any));
    }

    const schoolAnnouncements = await db.query.announcements.findMany({
      where: and(...conditions),
      with: {
        postedByUser: true,
      },
      orderBy: [desc(announcements.createdAt)],
    });

    return {
      success: true,
      totalAnnouncements: schoolAnnouncements.length,
      announcements: schoolAnnouncements,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Update an existing school announcement
 */
export const updateAnnouncementService = async (announcementId: string, data: Partial<TInsertAnnouncement>) => {
  try {
    const existing = await db.query.announcements.findFirst({
      where: eq(announcements.id, announcementId),
    });

    if (!existing) {
      return { success: false, message: "Announcement not found." };
    }

    const [updated] = await db
      .update(announcements)
      .set(data)
      .where(eq(announcements.id, announcementId))
      .returning();

    return {
      success: true,
      message: "Announcement updated successfully.",
      announcement: updated,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update announcement." };
  }
};

/**
 * Delete an announcement record
 */
export const deleteAnnouncementService = async (announcementId: string) => {
  try {
    const [deleted] = await db
      .delete(announcements)
      .where(eq(announcements.id, announcementId))
      .returning();

    if (!deleted) {
      return { success: false, message: "Announcement not found." };
    }

    return { success: true, message: "Announcement deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};


// ==========================================
// DIRECT MESSAGES SERVICES
// ==========================================

/**
 * Send a direct message between users
 */
export const createDirectMessageService = async (data: TInsertDirectMessage) => {
  try {
    const [message] = await db.insert(directMessages)
      .values(data)
      .returning();

    return {
      success: true,
      message: "Direct message sent successfully.",
      directMessage: message,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to send direct message." };
  }
};

/**
 * Get direct message by ID with sender and receiver details
 */
export const getDirectMessageByIdService = async (messageId: string) => {
  try {
    const message = await db.query.directMessages.findFirst({
      where: eq(directMessages.id, messageId),
      with: {
        sender: true,
        receiver: true,
      },
    });

    if (!message) {
      return { success: false, message: "Direct message not found." };
    }

    return { success: true, message };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get conversation thread between two users
 */
export const getDirectMessageConversationService = async (userOneId: string, userTwoId: string) => {
  try {
    const conversation = await db.query.directMessages.findMany({
      where: or(
        and(eq(directMessages.senderId, userOneId), eq(directMessages.receiverId, userTwoId)),
        and(eq(directMessages.senderId, userTwoId), eq(directMessages.receiverId, userOneId))
      ),
      with: {
        sender: true,
        receiver: true,
      },
      orderBy: [asc(directMessages.sentAt)],
    });

    return {
      success: true,
      totalMessages: conversation.length,
      messages: conversation,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get recent message summary or inbox threads for a specific user
 */
export const getUserInboxService = async (userId: string) => {
  try {
    const messages = await db.query.directMessages.findMany({
      where: or(
        eq(directMessages.senderId, userId),
        eq(directMessages.receiverId, userId)
      ),
      with: {
        sender: true,
        receiver: true,
      },
      orderBy: [desc(directMessages.sentAt)],
    });

    const unreadCount = messages.filter((m) => m.receiverId === userId && !m.isRead).length;

    return {
      success: true,
      totalMessages: messages.length,
      unreadCount,
      messages,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Mark a direct message as read
 */
export const markDirectMessageAsReadService = async (messageId: string) => {
  try {
    const existing = await db.query.directMessages.findFirst({
      where: eq(directMessages.id, messageId),
    });

    if (!existing) {
      return { success: false, message: "Direct message not found." };
    }

    const [updated] = await db
      .update(directMessages)
      .set({ isRead: true })
      .where(eq(directMessages.id, messageId))
      .returning();

    return {
      success: true,
      message: "Message marked as read.",
      directMessage: updated,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update message status." };
  }
};

/**
 * Delete a direct message record
 */
export const deleteDirectMessageService = async (messageId: string) => {
  try {
    const [deleted] = await db
      .delete(directMessages)
      .where(eq(directMessages.id, messageId))
      .returning();

    if (!deleted) {
      return { success: false, message: "Direct message not found." };
    }

    return { success: true, message: "Direct message deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};