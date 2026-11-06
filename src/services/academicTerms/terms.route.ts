import { Router } from "express";
import {
  createAcademicTermController,
  getAcademicTermByIdController,
  getAcademicTermWithWindowsController,
  listAcademicTermsBySchoolController,
  listAcademicTermsByYearController,
  listAcademicYearsController,
  getCurrentAcademicTermController,
  getCurrentTermWithWindowsController,
  listTermsByStatusController,
  updateAcademicTermController,
  setCurrentAcademicTermController,
  clearCurrentAcademicTermController,
  changeTermStatusController,
  archiveAcademicTermController,
  deleteAcademicTermController,
  countTermsBySchoolController,
  getTermByYearAndNameController,
  createTermWindowController,
  getTermWindowByIdController,
  listTermWindowsByTermController,
  listTermWindowsByTypeController,
  getActiveWindowsOnDateController,
  updateTermWindowController,
  deleteTermWindowController,
  deleteAllWindowsForTermController,
  countWindowsForTermController,
  copyTermWindowsController,
  getUpcomingWindowsController,
  bulkCreateTermWindowsController,
  validateTermReadinessController,
} from "./terms.controller";
import {
  adminAuth,
  adminOrTeacherAuth,
  superAdminAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const termsRouter = Router();

// ================================================================
// Academic Term Management Routes (Admin & Super Admin Level)
// ================================================================
termsRouter.post("/", adminAuth, createAcademicTermController);
termsRouter.put("/:termId", adminAuth, updateAcademicTermController);
termsRouter.delete("/:termId", superAdminAuth, deleteAcademicTermController);

// ================================================================
// Academic Term Retrieval Routes (Open to all authenticated users)
// NOTE: static-prefix routes MUST come before "/:termId"
// ================================================================

// Static lookups — declared before "/:termId"
termsRouter.get("/school/:schoolId", anyAuthenticatedUser, listAcademicTermsBySchoolController);
termsRouter.get("/school/:schoolId/current", anyAuthenticatedUser, getCurrentAcademicTermController);
termsRouter.get("/school/:schoolId/current/with-windows", anyAuthenticatedUser, getCurrentTermWithWindowsController);
termsRouter.get("/school/:schoolId/years", anyAuthenticatedUser, listAcademicYearsController);
termsRouter.get("/school/:schoolId/by-year", anyAuthenticatedUser, listAcademicTermsByYearController);
termsRouter.get("/school/:schoolId/by-status", anyAuthenticatedUser, listTermsByStatusController);
termsRouter.get("/school/:schoolId/count", anyAuthenticatedUser, countTermsBySchoolController);
termsRouter.get("/school/:schoolId/lookup", anyAuthenticatedUser, getTermByYearAndNameController);
termsRouter.get("/school/:schoolId/windows/active", anyAuthenticatedUser, getActiveWindowsOnDateController);
termsRouter.get("/school/:schoolId/windows/upcoming", anyAuthenticatedUser, getUpcomingWindowsController);

// Term state transitions (admin level)
termsRouter.post("/school/:schoolId/current", adminAuth, setCurrentAcademicTermController);
termsRouter.delete("/school/:schoolId/current", adminAuth, clearCurrentAcademicTermController);

// Per-term actions and reads
termsRouter.patch("/:termId/status", adminAuth, changeTermStatusController);
termsRouter.post("/:termId/archive", adminAuth, archiveAcademicTermController);
termsRouter.get("/:termId/readiness", anyAuthenticatedUser, validateTermReadinessController);
termsRouter.get("/:termId/with-windows", anyAuthenticatedUser, getAcademicTermWithWindowsController);

// Generic term lookup — MUST be last among GET routes
termsRouter.get("/:termId", anyAuthenticatedUser, getAcademicTermByIdController);

// ================================================================
// Term Window Management & Retrieval Routes
// ================================================================

// Static-prefix window routes BEFORE "/windows/:windowId"
termsRouter.post("/windows", adminAuth, createTermWindowController);
termsRouter.post("/windows/bulk", adminAuth, bulkCreateTermWindowsController);
termsRouter.post("/windows/copy", adminAuth, copyTermWindowsController);

// Per-term window routes (term-scoped reads + bulk ops)
termsRouter.get("/:termId/windows", anyAuthenticatedUser, listTermWindowsByTermController);
termsRouter.get("/:termId/windows/by-type", anyAuthenticatedUser, listTermWindowsByTypeController);
termsRouter.get("/:termId/windows/count", anyAuthenticatedUser, countWindowsForTermController);
termsRouter.delete("/:termId/windows", adminAuth, deleteAllWindowsForTermController);

// Per-window actions — dynamic ":windowId" routes last
termsRouter.get("/windows/:windowId", anyAuthenticatedUser, getTermWindowByIdController);
termsRouter.put("/windows/:windowId", adminAuth, updateTermWindowController);
termsRouter.delete("/windows/:windowId", adminAuth, deleteTermWindowController);

export default termsRouter;