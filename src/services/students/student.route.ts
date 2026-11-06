// routes/students.router.ts
import { Router } from "express";
import {
  registerStudentController,
  getStudentByIdController,
  getStudentWithRelationsController,
  getStudentByAdmissionController,
  getStudentByUserIdController,
  listStudentsBySchoolController,
  listStudentsByClassController,
  listStudentsByTermController,
  listStudentsByGradeLevelController,
  searchStudentsController,
  updateStudentController,
  softDeleteStudentController,
  restoreStudentController,
  enrollStudentInClassController,
  withdrawStudentController,
  reEnrollStudentController,
  promoteStudentController,
  graduateStudentController,
  repeatGradeController,
  transferStudentOutController,
  bulkPromoteStudentsController,
  addGuardianController,
  removeGuardianController,
  setPrimaryGuardianController,
  updateGuardianRelationshipController,
  listGuardiansController,
  listStudentsForGuardianController,
  countGuardiansForStudentController,
  listEnrollmentHistoryController,
  getCurrentEnrollmentController,
  getEnrollmentHistoryByTermController,
  getPromotionCandidatesController,
  getGraduationCandidatesController,
  addDocumentController,
  listDocumentsController,
  deleteDocumentController,
  toggleDocumentVisibilityController,
  addHealthRecordController,
  listHealthRecordsController,
  countStudentsBySchoolController,
  countStudentsByClassController,
  countStudentsByGenderController,
  validateStudentDataController,
  getStudentStatisticsController,
} from "./student.controller";
import { adminAuth, anyAuthenticatedUser, superAdminAuth } from "../../middleware/bearAuth";


const studentsRouter = Router();

// ================================================================
// REGISTRATION & SEARCH
// ================================================================
studentsRouter.post("/", adminAuth, registerStudentController);

studentsRouter.get("/school/:schoolId", anyAuthenticatedUser, listStudentsBySchoolController);
studentsRouter.get("/school/:schoolId/count", anyAuthenticatedUser, countStudentsBySchoolController);
studentsRouter.get("/school/:schoolId/by-gender", anyAuthenticatedUser, countStudentsByGenderController);
studentsRouter.get("/school/:schoolId/search", anyAuthenticatedUser, searchStudentsController);
studentsRouter.get("/school/:schoolId/admission", anyAuthenticatedUser, getStudentByAdmissionController);
studentsRouter.get("/school/:schoolId/graduation-candidates", anyAuthenticatedUser, getGraduationCandidatesController);

studentsRouter.get("/class/:classId", anyAuthenticatedUser, listStudentsByClassController);
studentsRouter.get("/class/:classId/count", anyAuthenticatedUser, countStudentsByClassController);
studentsRouter.get("/class/:classId/promotion-candidates", anyAuthenticatedUser, getPromotionCandidatesController);

studentsRouter.get("/term/:termId", anyAuthenticatedUser, listStudentsByTermController);
studentsRouter.get("/grade-level/:gradeLevelId", anyAuthenticatedUser, listStudentsByGradeLevelController);

studentsRouter.get("/user/:userId", anyAuthenticatedUser, getStudentByUserIdController);
studentsRouter.get("/guardian/:guardianUserId", anyAuthenticatedUser, listStudentsForGuardianController);

// Bulk promotion — static path before dynamic ones
studentsRouter.post("/bulk-promote", adminAuth, bulkPromoteStudentsController);

// ================================================================
// PER-STUDENT
// ================================================================
studentsRouter.get("/:studentId", anyAuthenticatedUser, getStudentByIdController);
studentsRouter.get("/:studentId/with-relations", anyAuthenticatedUser, getStudentWithRelationsController);
studentsRouter.get("/:studentId/statistics", anyAuthenticatedUser, getStudentStatisticsController);
studentsRouter.get("/:studentId/validate", anyAuthenticatedUser, validateStudentDataController);

studentsRouter.put("/:studentId", adminAuth, updateStudentController);
studentsRouter.delete("/:studentId", superAdminAuth, softDeleteStudentController);
studentsRouter.post("/:studentId/restore", adminAuth, restoreStudentController);

// ================================================================
// LIFECYCLE
// ================================================================
studentsRouter.post("/:studentId/class", adminAuth, enrollStudentInClassController);
studentsRouter.post("/:studentId/withdraw", adminAuth, withdrawStudentController);
studentsRouter.post("/:studentId/re-enroll", adminAuth, reEnrollStudentController);
studentsRouter.post("/:studentId/promote", adminAuth, promoteStudentController);
studentsRouter.post("/:studentId/graduate", adminAuth, graduateStudentController);
studentsRouter.post("/:studentId/repeat", adminAuth, repeatGradeController);
studentsRouter.post("/:studentId/transfer-out", adminAuth, transferStudentOutController);

// ================================================================
// GUARDIANS
// ================================================================
studentsRouter.get("/:studentId/guardians", anyAuthenticatedUser, listGuardiansController);
studentsRouter.get("/:studentId/guardians/count", anyAuthenticatedUser, countGuardiansForStudentController);
studentsRouter.post("/:studentId/guardians", adminAuth, addGuardianController);
studentsRouter.delete("/:studentId/guardians", adminAuth, removeGuardianController);
studentsRouter.put("/:studentId/guardians/primary", adminAuth, setPrimaryGuardianController);
studentsRouter.put("/:studentId/guardians/:guardianUserId", adminAuth, updateGuardianRelationshipController);

// ================================================================
// ENROLLMENT HISTORY
// ================================================================
studentsRouter.get("/:studentId/enrollments", anyAuthenticatedUser, listEnrollmentHistoryController);
studentsRouter.get("/:studentId/enrollments/current", anyAuthenticatedUser, getCurrentEnrollmentController);
studentsRouter.get("/:studentId/enrollments/term/:termId", anyAuthenticatedUser, getEnrollmentHistoryByTermController);

// ================================================================
// DOCUMENTS
// ================================================================
studentsRouter.get("/:studentId/documents", anyAuthenticatedUser, listDocumentsController);
studentsRouter.post("/:studentId/documents", adminAuth, addDocumentController);
studentsRouter.delete("/documents/:documentId", adminAuth, deleteDocumentController);
studentsRouter.patch("/documents/:documentId/visibility", adminAuth, toggleDocumentVisibilityController);

// ================================================================
// HEALTH RECORDS
// ================================================================
studentsRouter.get("/:studentId/health", anyAuthenticatedUser, listHealthRecordsController);
studentsRouter.post("/:studentId/health", adminAuth, addHealthRecordController);

export default studentsRouter;