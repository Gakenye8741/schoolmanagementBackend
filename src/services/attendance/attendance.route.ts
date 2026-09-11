import { Router } from "express";
import {
  createAttendanceController,
  bulkCreateAttendanceController,
  getAttendanceByIdController,
  getStudentAttendanceController,
  deleteAttendanceController,
  createDisciplinaryRecordController,
  getDisciplinaryRecordByIdController,
  getStudentDisciplinaryRecordsController,
  updateDisciplinaryRecordController,
  deleteDisciplinaryRecordController
} from "./attendance.controller";
import { 
  adminAuth, 
  adminOrTeacherAuth, 
  superAdminAuth, 
  anyAuthenticatedUser 
} from "../../middleware/bearAuth";

const attendanceRouter = Router();

// ==========================================
// ATTENDANCE ROUTES (Teachers & Admins)
// ==========================================

attendanceRouter.post("/attendance", adminOrTeacherAuth, createAttendanceController);
attendanceRouter.post("/attendance/bulk", adminOrTeacherAuth, bulkCreateAttendanceController);
attendanceRouter.get("/attendance/:id", anyAuthenticatedUser, getAttendanceByIdController);
attendanceRouter.get("/attendance/student/:studentId", anyAuthenticatedUser, getStudentAttendanceController);
attendanceRouter.delete("/attendance/:id", adminAuth, deleteAttendanceController);


// ==========================================
// DISCIPLINARY RECORDS ROUTES (Teachers & Admins)
// ==========================================

attendanceRouter.post("/discipline", adminOrTeacherAuth, createDisciplinaryRecordController);
attendanceRouter.get("/discipline/:id", anyAuthenticatedUser, getDisciplinaryRecordByIdController);
attendanceRouter.get("/discipline/student/:studentId", anyAuthenticatedUser, getStudentDisciplinaryRecordsController);
attendanceRouter.patch("/discipline/:id", adminOrTeacherAuth, updateDisciplinaryRecordController);
attendanceRouter.delete("/discipline/:id", adminAuth, deleteDisciplinaryRecordController);

export default attendanceRouter;