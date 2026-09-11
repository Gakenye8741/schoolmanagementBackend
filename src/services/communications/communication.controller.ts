import { Request, Response } from "express";
import {
  createAnnouncementService,
  getAnnouncementByIdService,
  getAnnouncementsBySchoolService,
  updateAnnouncementService,
  deleteAnnouncementService,
  createDirectMessageService,
  getDirectMessageByIdService,
  getDirectMessageConversationService,
  getUserInboxService,
  markDirectMessageAsReadService,
  deleteDirectMessageService
} from "./communication.service";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  createDirectMessageSchema
} from "../../validators/communication.validator";

/**
 * Helper function to translate raw database error messages into human-friendly explanations.
 */
const formatDatabaseError = (errorMessage: string = ""): string => {
  if (errorMessage.includes("announcements_school_id_schools_id_fk") || (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("school_id"))) {
    return "The school selected does not exist in the system.";
  }
  if (errorMessage.includes("announcements_posted_by_users_id_fk") || (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("posted_by"))) {
    return "The user account posting this announcement could not be found.";
  }
  if (errorMessage.includes("direct_messages_sender_id_users_id_fk") || (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("sender_id"))) {
    return "The sender user account does not exist. Please check the sender profile and try again.";
  }
  if (errorMessage.includes("direct_messages_receiver_id_users_id_fk") || (errorMessage.includes("violates foreign key constraint") && errorMessage.includes("receiver_id"))) {
    return "The recipient user account does not exist in the system. Please verify the recipient ID.";
  }
  if (errorMessage.includes("unique constraint") || errorMessage.includes("duplicate key")) {
    return "A conflicting record already exists.";
  }
  return errorMessage || "An unexpected database error occurred.";
};

// ==========================================
// ANNOUNCEMENTS CONTROLLERS
// ==========================================

/**
 * Create a new announcement controller
 */
export const createAnnouncementController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createAnnouncementSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Please ensure all announcement fields are correctly filled out.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createAnnouncementService(validationResult.data);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: formatDatabaseError(result.message),
    });
    return;
  }

  res.status(201).json({
    ...result,
    message: "Announcement has been successfully published to the school portal.",
  });
};

/**
 * Get announcement by ID controller
 */
export const getAnnouncementByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await getAnnouncementByIdService(id);
  
  if (!result.success) {
    res.status(404).json({
      success: false,
      message: "We couldn't find the announcement you were looking for. It may have been removed.",
    });
    return;
  }

  res.status(200).json(result);
};

/**
 * Get all announcements for a school controller
 */
export const getAnnouncementsBySchoolController = async (req: Request, res: Response): Promise<void> => {
  const schoolId = String(req.params.schoolId);
  const targetAudience = req.query.targetAudience as string | undefined;

  const result = await getAnnouncementsBySchoolService(schoolId, targetAudience);
  const statusCode = result.success ? 200 : 400;
  
  if (!result.success) {
    res.status(statusCode).json({
      success: false,
      message: "Unable to retrieve announcements for this school at the moment.",
    });
    return;
  }

  res.status(statusCode).json(result);
};

/**
 * Update an announcement controller
 */
export const updateAnnouncementController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const validationResult = updateAnnouncementSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: The update details provided for this announcement are invalid.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await updateAnnouncementService(id, validationResult.data);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: formatDatabaseError(result.message),
    });
    return;
  }

  res.status(200).json({
    ...result,
    message: "Announcement has been successfully updated.",
  });
};

/**
 * Delete an announcement controller
 */
export const deleteAnnouncementController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await deleteAnnouncementService(id);
  
  if (!result.success) {
    res.status(404).json({
      success: false,
      message: "The announcement you are trying to delete could not be found.",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Announcement has been permanently deleted from the system.",
  });
};


// ==========================================
// DIRECT MESSAGES CONTROLLERS
// ==========================================

/**
 * Send a direct message controller
 */
export const createDirectMessageController = async (req: Request, res: Response): Promise<void> => {
  const validationResult = createDirectMessageSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed: Please check your message content and recipient details before sending.",
      errors: validationResult.error.format(),
    });
    return;
  }

  const result = await createDirectMessageService(validationResult.data);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: formatDatabaseError(result.message),
    });
    return;
  }

  res.status(201).json({
    ...result,
    message: "Your direct message has been successfully sent.",
  });
};

/**
 * Get direct message by ID controller
 */
export const getDirectMessageByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await getDirectMessageByIdService(id);
  
  if (!result.success) {
    res.status(404).json({
      success: false,
      message: "The requested message could not be found.",
    });
    return;
  }

  res.status(200).json(result);
};

/**
 * Get conversation thread between two users controller
 */
export const getDirectMessageConversationController = async (req: Request, res: Response): Promise<void> => {
  const userOneId = String(req.params.userOneId);
  const userTwoId = String(req.params.userTwoId);

  const result = await getDirectMessageConversationService(userOneId, userTwoId);
  
  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Unable to load the conversation thread between these users.",
    });
    return;
  }

  res.status(200).json(result);
};

/**
 * Get user inbox and message threads controller
 */
export const getUserInboxController = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);
  const result = await getUserInboxService(userId);
  
  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Unable to load your inbox at this time. Please try again later.",
    });
    return;
  }

  res.status(200).json(result);
};

/**
 * Mark direct message as read controller
 */
export const markDirectMessageAsReadController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await markDirectMessageAsReadService(id);
  
  if (!result.success) {
    res.status(404).json({
      success: false,
      message: "The message you are trying to update could not be found.",
    });
    return;
  }

  res.status(200).json({
    ...result,
    message: "Message has been marked as read.",
  });
};

/**
 * Delete a direct message controller
 */
export const deleteDirectMessageController = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await deleteDirectMessageService(id);
  
  if (!result.success) {
    res.status(404).json({
      success: false,
      message: "The message you are trying to delete no longer exists.",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Direct message has been successfully deleted.",
  });
};