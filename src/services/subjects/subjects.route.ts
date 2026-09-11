import { Router } from "express";
import {
  createSubjectController,
  bulkCreateSubjectsController,
  getSubjectByIdController,
  listSubjectsBySchoolController,
  listSubjectsByTeacherController,
  updateSubjectController,
  assignTeacherToSubjectController,
  removeTeacherFromSubjectController,
  deleteSubjectController,
} from "./subjects.controller";
import { 
  adminAuth, 
  adminOrTeacherAuth, 
  anyAuthenticatedUser 
} from "../../middleware/bearAuth"; 

const router = Router();

// Subject Management Routes (Restricted by Role)
router.post("/", adminAuth, createSubjectController);
router.post("/bulk", adminAuth, bulkCreateSubjectsController);
router.get("/school/:schoolId", anyAuthenticatedUser, listSubjectsBySchoolController);
router.get("/teacher/:teacherId", anyAuthenticatedUser, listSubjectsByTeacherController);
router.get("/:subjectId", anyAuthenticatedUser, getSubjectByIdController);
router.put("/:subjectId", adminAuth, updateSubjectController);
router.delete("/:subjectId", adminAuth, deleteSubjectController);

// Teacher-Subject Assignment Routes (Admin only)
router.post("/:subjectId/teachers", adminAuth, assignTeacherToSubjectController);
router.delete("/:subjectId/teachers/:teacherId", adminAuth, removeTeacherFromSubjectController);

export default router;