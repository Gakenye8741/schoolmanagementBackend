import { Router } from "express";
import {
  generateGlobalTimetableController,
  upsertTimetableSlotController,
  getClassTimetableController,
  getTeacherTimetableController,
  clearClassTimetableController,
  auditSchoolTimetableClashesController,
} from "./timetables.controller";
import { adminAuth, anyAuthenticatedUser } from "../../middleware/bearAuth";

const timetableRouter = Router();

// Generation & Modification Routes (School Admin)
timetableRouter.post("/generate-global", adminAuth, generateGlobalTimetableController);
timetableRouter.post("/slot", adminAuth, upsertTimetableSlotController);

// Audit & Clearance Routes (School Admin)
timetableRouter.get("/audit/:schoolId", adminAuth, auditSchoolTimetableClashesController);
timetableRouter.delete("/class/:schoolId/:gradeLevel/:stream", adminAuth, clearClassTimetableController);

// Lookup Routes (Authenticated Users)
timetableRouter.get("/class/:schoolId/:gradeLevel/:stream", anyAuthenticatedUser, getClassTimetableController);
timetableRouter.get("/teacher/:teacherId", anyAuthenticatedUser, getTeacherTimetableController);

export default timetableRouter;