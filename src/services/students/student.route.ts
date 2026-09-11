import { Router } from "express";
import {
  createStudentController,
  getStudentByIdController,
  getStudentsBySchoolController,
  updateStudentController,
  deleteStudentController,
  createEnrollmentHistoryController,
  getStudentEnrollmentHistoryController,
} from "./student.controller";
import { adminAuth, anyAuthenticatedUser } from "../../middleware/bearAuth";

const studentRouter = Router();

// Student Management Routes (School Admin)
studentRouter.post("/", adminAuth, createStudentController);
studentRouter.get("/school/:schoolId", anyAuthenticatedUser, getStudentsBySchoolController);
studentRouter.get("/:studentId", anyAuthenticatedUser, getStudentByIdController);
studentRouter.put("/:studentId", adminAuth, updateStudentController);
studentRouter.delete("/:studentId", adminAuth, deleteStudentController);

// Enrollment History Routes
studentRouter.post("/enrollment-history", adminAuth, createEnrollmentHistoryController);
studentRouter.get("/:studentId/enrollment-history", anyAuthenticatedUser, getStudentEnrollmentHistoryController);

export default studentRouter;