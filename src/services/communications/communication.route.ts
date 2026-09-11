import { Router } from "express";
import {
  createAnnouncementController,
  getAnnouncementByIdController,
  getAnnouncementsBySchoolController,
  updateAnnouncementController,
  deleteAnnouncementController,
  createDirectMessageController,
  getDirectMessageByIdController,
  getDirectMessageConversationController,
  getUserInboxController,
  markDirectMessageAsReadController,
  deleteDirectMessageController
} from "./communication.controller";
import { 
  adminAuth, 
  adminOrTeacherAuth, 
  anyAuthenticatedUser 
} from "../../middleware/bearAuth";

const communicationRouter = Router();

// ==========================================
// ANNOUNCEMENTS ROUTES (School Admins & Teachers)
// ==========================================

communicationRouter.post("/announcements", adminOrTeacherAuth, createAnnouncementController);
communicationRouter.get("/announcements/school/:schoolId", anyAuthenticatedUser, getAnnouncementsBySchoolController);
communicationRouter.get("/announcements/:id", anyAuthenticatedUser, getAnnouncementByIdController);
communicationRouter.patch("/announcements/:id", adminOrTeacherAuth, updateAnnouncementController);
communicationRouter.delete("/announcements/:id", adminAuth, deleteAnnouncementController);


// ==========================================
// DIRECT MESSAGES ROUTES (All Authenticated Portal Users)
// ==========================================

communicationRouter.post("/messages", anyAuthenticatedUser, createDirectMessageController);
communicationRouter.get("/messages/inbox/:userId", anyAuthenticatedUser, getUserInboxController);
communicationRouter.get("/messages/conversation/:userOneId/:userTwoId", anyAuthenticatedUser, getDirectMessageConversationController);
communicationRouter.get("/messages/:id", anyAuthenticatedUser, getDirectMessageByIdController);
communicationRouter.patch("/messages/:id/read", anyAuthenticatedUser, markDirectMessageAsReadController);
communicationRouter.delete("/messages/:id", anyAuthenticatedUser, deleteDirectMessageController);

export default communicationRouter;