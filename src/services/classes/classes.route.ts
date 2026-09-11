import { Router } from "express";
import {
  createClassController,
  getClassByIdController,
  listClassesBySchoolController,
  updateClassController,
  assignClassTeacherController,
  deleteClassController,
} from "./classes.controller";
import { 
  adminAuth, 
  adminOrTeacherAuth, 
  superAdminAuth, 
  anyAuthenticatedUser 
} from "../../middleware/bearAuth";

const classRouter = Router();

// Class Management classRouter (Admin & School Admin Level)
classRouter.post("/", adminAuth, createClassController);
classRouter.put("/:classId", adminAuth, updateClassController);
classRouter.patch("/:classId/teacher", adminAuth, assignClassTeacherController);
classRouter.delete("/:classId", superAdminAuth, deleteClassController);

// Class Retrieval classRouter (Open to authenticated users like teachers, admins, and students/parents)
classRouter.get("/school/:schoolId", anyAuthenticatedUser, listClassesBySchoolController);
classRouter.get("/:classId", anyAuthenticatedUser, getClassByIdController);

export default classRouter;