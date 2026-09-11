import { Router } from "express";
import {
  createAcademicTermController,
  getAcademicTermByIdController,
  listAcademicTermsBySchoolController,
  getCurrentAcademicTermController,
  updateAcademicTermController,
  deleteAcademicTermController,
  createTermWindowController,
  listTermWindowsByTermController,
  deleteTermWindowController,
} from "./terms.controller";
import { 
  adminAuth, 
  adminOrTeacherAuth, 
  superAdminAuth, 
  anyAuthenticatedUser 
} from "../../middleware/bearAuth";

const termsRouter = Router();

// Academic Term Management Routes (Admin & Super Admin Level)
termsRouter.post("/", adminAuth, createAcademicTermController);
termsRouter.put("/:termId", adminAuth, updateAcademicTermController);
termsRouter.delete("/:termId", superAdminAuth, deleteAcademicTermController);

// Academic Term Retrieval Routes (Open to all authenticated users like students and parents to view calendar)
termsRouter.get("/school/:schoolId", anyAuthenticatedUser, listAcademicTermsBySchoolController);
termsRouter.get("/school/:schoolId/current", anyAuthenticatedUser, getCurrentAcademicTermController);
termsRouter.get("/:termId", anyAuthenticatedUser, getAcademicTermByIdController);

// Term Window Management & Retrieval Routes
termsRouter.post("/windows", adminAuth, createTermWindowController);
termsRouter.get("/:termId/windows", anyAuthenticatedUser, listTermWindowsByTermController);
termsRouter.delete("/windows/:windowId", adminAuth, deleteTermWindowController);

export default termsRouter;