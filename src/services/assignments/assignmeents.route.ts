import { Router } from "express";
import {
  createHomeworkAssignmentController,
  getHomeworkAssignmentByIdController,
  getHomeworkAssignmentsByClassController,
  getHomeworkAssignmentsByTeacherController,
  updateHomeworkAssignmentController,
  deleteHomeworkAssignmentController,
  upsertHomeworkSubmissionController,
  getHomeworkSubmissionByIdController,
  getStudentHomeworkSubmissionsController,
  gradeHomeworkSubmissionController,
  deleteHomeworkSubmissionController
} from "./assignment.controller";
import { 
  adminAuth, 
  adminOrTeacherAuth, 
  superAdminAuth, 
  anyAuthenticatedUser 
} from "../../middleware/bearAuth";

const homeworkRouter = Router();

// ==========================================
// HOMEWORK ASSIGNMENTS ROUTES (Teachers & Admins)
// ==========================================

homeworkRouter.post("/assignments", adminOrTeacherAuth, createHomeworkAssignmentController);
homeworkRouter.get("/assignments/class/:classId", anyAuthenticatedUser, getHomeworkAssignmentsByClassController);
homeworkRouter.get("/assignments/teacher/:teacherId", anyAuthenticatedUser, getHomeworkAssignmentsByTeacherController);
homeworkRouter.get("/assignments/:id", anyAuthenticatedUser, getHomeworkAssignmentByIdController);
homeworkRouter.patch("/assignments/:id", adminOrTeacherAuth, updateHomeworkAssignmentController);
homeworkRouter.delete("/assignments/:id", adminAuth, deleteHomeworkAssignmentController);


// ==========================================
// HOMEWORK SUBMISSIONS ROUTES (Students & Teachers)
// ==========================================

homeworkRouter.post("/submissions", anyAuthenticatedUser, upsertHomeworkSubmissionController);
homeworkRouter.get("/submissions/:id", anyAuthenticatedUser, getHomeworkSubmissionByIdController);
homeworkRouter.get("/submissions/student/:studentId", anyAuthenticatedUser, getStudentHomeworkSubmissionsController);
homeworkRouter.patch("/submissions/:id/grade", adminOrTeacherAuth, gradeHomeworkSubmissionController);
homeworkRouter.delete("/submissions/:id", adminAuth, deleteHomeworkSubmissionController);

export default homeworkRouter;