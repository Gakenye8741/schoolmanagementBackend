import { z } from "zod";

// ==========================================
// ANNOUNCEMENTS VALIDATORS
// ==========================================

export const createAnnouncementSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID format."),
  title: z.string().min(3, "Title must be at least 3 characters long.").max(255, "Title cannot exceed 255 characters."),
  message: z.string().min(5, "Message must be at least 5 characters long."),
  targetAudience: z.enum(["Parents", "Teachers", "Students", "All", "Staff"], {
    errorMap: () => ({ message: "Target audience must be one of: Parents, Teachers, Students, All, Staff." }),
  }),
  postedBy: z.string().uuid("Invalid user ID format for the poster."),
  sendViaSms: z.boolean().optional().default(false),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();


// ==========================================
// DIRECT MESSAGES VALIDATORS
// ==========================================

export const createDirectMessageSchema = z.object({
  senderId: z.string().uuid("Invalid sender ID format."),
  receiverId: z.string().uuid("Invalid receiver ID format."),
  messageText: z.string().min(1, "Message text cannot be empty."),
  isRead: z.boolean().optional().default(false),
});

export const updateDirectMessageSchema = createDirectMessageSchema.partial();


// TypeScript Type Inference
export type TCreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type TUpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export type TCreateDirectMessageInput = z.infer<typeof createDirectMessageSchema>;
export type TUpdateDirectMessageInput = z.infer<typeof updateDirectMessageSchema>;