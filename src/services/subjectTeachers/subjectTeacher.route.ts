import { Router } from "express";
import {
  assignTeacherSubjectController,
  removeTeacherSubjectController,
  getSubjectsByTeacherController,
  getTeachersBySubjectController,
  bulkAssignSubjectsController,
  syncTeacherSubjectsController,
} from "./SubjectTeacher.controller";
import { adminAuth, anyAuthenticatedUser } from "../../middleware/bearAuth";

const teacherSubjectRouter = Router();

// Assignment & Modification Routes (School Admin restricted)
teacherSubjectRouter.post("/", adminAuth, assignTeacherSubjectController);
teacherSubjectRouter.post("/bulk", adminAuth, bulkAssignSubjectsController);
teacherSubjectRouter.put("/sync", adminAuth, syncTeacherSubjectsController);
teacherSubjectRouter.delete("/teacher/:teacherId/subject/:subjectId", adminAuth, removeTeacherSubjectController);

// Query / Lookup Routes (Authenticated users)
teacherSubjectRouter.get("/teacher/:teacherId", anyAuthenticatedUser, getSubjectsByTeacherController);
teacherSubjectRouter.get("/subject/:subjectId", anyAuthenticatedUser, getTeachersBySubjectController);

export default teacherSubjectRouter;