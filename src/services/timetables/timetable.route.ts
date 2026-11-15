// routes/timetables.routes.ts
import { Router } from "express";
import {
  // ── Periods ──
  createPeriodController,
  bulkCreatePeriodsController,
  getPeriodByIdController,
  getPeriodByNumberController,
  listPeriodsForSchoolController,
  listTeachingPeriodsController,
  listBreakPeriodsController,
  updatePeriodController,
  deletePeriodController,
  validatePeriodScheduleController,
  countPeriodsController,
  getFirstPeriodController,
  getLastPeriodController,
  reorderPeriodsController,
  getActivePeriodController,
  // ── Slots: create / read / update / delete ──
  createTimetableSlotController,
  bulkCreateTimetableController,
  bulkCreateSchoolTimetableController,
  getTimetableSlotByIdController,
  updateTimetableSlotController,
  deleteTimetableSlotController,
  getSlotByClassDayPeriodController,
  deleteSlotByClassDayPeriodController,
  moveTimetableSlotController,
  swapTimetableSlotsController,
  assignTeacherToSlotController,
  assignRoomToSlotController,
  bulkDeleteSlotsController,
  bulkUpdateSlotsController,
  copyTimetableToClassController,
  cloneTimetableController,
  // ── Class views ──
  getClassTimetableController,
  getClassTimetableForDayController,
  getClassTimetableTodayController,
  getCurrentLessonForClassController,
  getNextLessonForClassController,
  getFreeSlotsForClassController,
  getClassSlotsPerDayController,
  getClassWorkloadController,
  countSlotsForClassController,
  deleteTimetableForClassController,
  // ── Teacher views ──
  getTeacherTimetableController,
  getTeacherTimetableForDayController,
  getCurrentLessonForTeacherController,
  getTeacherFreePeriodsController,
  getTeacherWorkloadController,
  getTeacherAvailabilityMatrixController,
  getTeacherWeeklyViewController,
  getUpcomingLessonsForTeacherController,
  // ── School views / stats ──
  listSlotsForSchoolController,
  getSchoolTimetableGridController,
  exportSchoolTimetableController,
  getSubjectAllocationController,
  getClassesWithNoTimetableController,
  getTimetableCoverageStatsController,
  getUnassignedTeacherSlotsController,
  getSlotsWithoutRoomController,
  getSlotsBySubjectController,
  getSlotsByTeacherController,
  getSlotsByRoomController,
  findLeastLoadedTeacherForSubjectController,
  deleteTimetableForSchoolController,
  deleteTimetableForDayController,
  // ── Conflicts / validation ──
  checkTeacherConflictController,
  checkClassConflictController,
  checkRoomConflictController,
  validateSchoolTimetableController,
  // ── 🆕 Setup / Generator / Bulk / Analytics ──
  previewSchoolTimetableController,
  generateSchoolTimetableController,
  seedStandardSchoolDayController,
  resetSchoolSetupController,
  duplicateDayController,
  autoAssignMissingTeachersController,
  getPerClassCoverageController,
  getPreferredTeachersForSubjectController,
  getDetailedConflictsController,
} from "./timetables.controller";
import {
  schoolManagementAuth,
  staffAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth";

const timetableRouter = Router();

/* ================================================================
   ⚠️  ROUTE ORDERING RULES — READ BEFORE EDITING
   ================================================================
   1. STATIC routes ALWAYS come before PARAM routes for the same
      HTTP method. Otherwise Express treats the static segment as
      a param value:
        ✗ /slots/:slotId  (registered first)
          /slots/bulk-update  → slotId = "bulk-update"
        ✓ /slots/bulk-update  (registered first)
          /slots/:slotId  (only reached if bulk-update not matched)

   2. More-specific STATIC paths come before less-specific ones
      when they share a prefix:
        ✓ /schools/:schoolId/timetable/generate/preview
          /schools/:schoolId/timetable/generate

   3. When in doubt, register top-to-bottom:
        /resource
        /resource/static-keyword
        /resource/static-keyword/nested
        /resource/:id
        /resource/:id/nested

   4. HTTP method differences (GET vs POST vs PATCH) do NOT save
      you from ordering bugs when params are involved — always
      keep static first.

   ACCESS LEVELS
   ─────────────────────────────────────────────────────────────
   schoolManagementAuth   super_admin, school_admin, principal,
                          deputy_principal
   staffAuth              management + bursar, registrar, librarian,
                          teacher
   anyAuthenticatedUser   everyone signed in (incl. parents/students)
   ================================================================ */


// ================================================================
// 1. PERIODS — CRUD
// ================================================================

// ── Create / modify (School Management) ──
timetableRouter.post("/periods", schoolManagementAuth, createPeriodController);
timetableRouter.post("/periods/bulk", schoolManagementAuth, bulkCreatePeriodsController);
timetableRouter.patch("/periods/:periodId", schoolManagementAuth, updatePeriodController);
timetableRouter.delete("/periods/:periodId", schoolManagementAuth, deletePeriodController);
timetableRouter.put("/schools/:schoolId/periods/reorder", schoolManagementAuth, reorderPeriodsController);
timetableRouter.get("/schools/:schoolId/periods/validate", schoolManagementAuth, validatePeriodScheduleController);

// ── 🆕 One-click seed (13-period Kenyan day) — School Management ──
timetableRouter.post(
  "/schools/:schoolId/periods/seed-standard",
  schoolManagementAuth,
  seedStandardSchoolDayController
);

// ── Lookup (Any authenticated user) ──
// ⚠️ Static suffixes (teaching/breaks/count/first/last/active) must
//    come BEFORE :periodNumber or :periodId would swallow them.
timetableRouter.get("/schools/:schoolId/periods", anyAuthenticatedUser, listPeriodsForSchoolController);
timetableRouter.get("/schools/:schoolId/periods/teaching", anyAuthenticatedUser, listTeachingPeriodsController);
timetableRouter.get("/schools/:schoolId/periods/breaks", anyAuthenticatedUser, listBreakPeriodsController);
timetableRouter.get("/schools/:schoolId/periods/count", anyAuthenticatedUser, countPeriodsController);
timetableRouter.get("/schools/:schoolId/periods/first", anyAuthenticatedUser, getFirstPeriodController);
timetableRouter.get("/schools/:schoolId/periods/last", anyAuthenticatedUser, getLastPeriodController);
timetableRouter.get("/schools/:schoolId/periods/active", anyAuthenticatedUser, getActivePeriodController);
timetableRouter.get("/schools/:schoolId/periods/number/:periodNumber", anyAuthenticatedUser, getPeriodByNumberController);
timetableRouter.get("/periods/:periodId", anyAuthenticatedUser, getPeriodByIdController);


// ================================================================
// 2. SLOTS — WRITE OPERATIONS (School Management)
// ================================================================

// ── Create ──
timetableRouter.post("/slots", schoolManagementAuth, createTimetableSlotController);
timetableRouter.post("/slots/bulk/class", schoolManagementAuth, bulkCreateTimetableController);
timetableRouter.post("/slots/bulk/school", schoolManagementAuth, bulkCreateSchoolTimetableController);

// ── Copy / clone / swap ──
timetableRouter.post("/slots/copy", schoolManagementAuth, copyTimetableToClassController);
timetableRouter.post("/slots/clone", schoolManagementAuth, cloneTimetableController);
timetableRouter.post("/slots/swap", schoolManagementAuth, swapTimetableSlotsController);

// ── Bulk mutations (⚠️ must come before PATCH/DELETE /slots/:slotId) ──
timetableRouter.post("/slots/bulk-delete", schoolManagementAuth, bulkDeleteSlotsController);
timetableRouter.patch("/slots/bulk-update", schoolManagementAuth, bulkUpdateSlotsController);

// ── Single-slot mutations ──
timetableRouter.patch("/slots/:slotId/move", schoolManagementAuth, moveTimetableSlotController);
timetableRouter.patch("/slots/:slotId/teacher", schoolManagementAuth, assignTeacherToSlotController);
timetableRouter.patch("/slots/:slotId/room", schoolManagementAuth, assignRoomToSlotController);
timetableRouter.patch("/slots/:slotId", schoolManagementAuth, updateTimetableSlotController);
timetableRouter.delete("/slots/:slotId", schoolManagementAuth, deleteTimetableSlotController);

// ── Single-slot lookup (Any authenticated user) ──
timetableRouter.get("/slots/:slotId", anyAuthenticatedUser, getTimetableSlotByIdController);


// ================================================================
// 3. 🆕 TIMETABLE GENERATOR (School Management)
// ================================================================

// ⚠️ Order: /generate/preview BEFORE /generate (more-specific first)
timetableRouter.post(
  "/schools/:schoolId/timetable/generate/preview",
  schoolManagementAuth,
  previewSchoolTimetableController
);
timetableRouter.post(
  "/schools/:schoolId/timetable/generate",
  schoolManagementAuth,
  generateSchoolTimetableController
);


// ================================================================
// 4. 🆕 SETUP / RESET / BULK UTILITIES (School Management)
// ================================================================

// Wipe ALL slots + periods for a school (requires ?confirm=true)
timetableRouter.delete(
  "/schools/:schoolId/timetable/reset",
  schoolManagementAuth,
  resetSchoolSetupController
);

// Copy all slots from one weekday to another
timetableRouter.post(
  "/schools/:schoolId/timetable/duplicate-day",
  schoolManagementAuth,
  duplicateDayController
);

// Fill every `teacherId IS NULL` slot with the least-loaded available teacher
timetableRouter.patch(
  "/schools/:schoolId/timetable/auto-assign-teachers",
  schoolManagementAuth,
  autoAssignMissingTeachersController
);


// ================================================================
// 5. CLASS VIEWS
// ================================================================

// ── Clearance / destructive (School Management) ──
timetableRouter.delete("/classes/:classId/timetable", schoolManagementAuth, deleteTimetableForClassController);
timetableRouter.delete(
  "/classes/:classId/timetable/day/:dayOfWeek/period/:periodId",
  schoolManagementAuth,
  deleteSlotByClassDayPeriodController
);

// ── Audit helpers (School Management) ──
// ⚠️ Static suffixes (free-slots / slots-per-day / count / workload)
//    must come BEFORE /classes/:classId/timetable (bare).
timetableRouter.get("/classes/:classId/conflicts", schoolManagementAuth, checkClassConflictController);
timetableRouter.get("/classes/:classId/timetable/free-slots", schoolManagementAuth, getFreeSlotsForClassController);
timetableRouter.get("/classes/:classId/timetable/slots-per-day", schoolManagementAuth, getClassSlotsPerDayController);
timetableRouter.get("/classes/:classId/timetable/count", schoolManagementAuth, countSlotsForClassController);
timetableRouter.get("/classes/:classId/workload", schoolManagementAuth, getClassWorkloadController);

// ── Lookup (Any authenticated user) ──
// ⚠️ Specific suffixes (today/current/next/day/...) before bare /timetable.
timetableRouter.get("/classes/:classId/timetable/today", anyAuthenticatedUser, getClassTimetableTodayController);
timetableRouter.get("/classes/:classId/timetable/current", anyAuthenticatedUser, getCurrentLessonForClassController);
timetableRouter.get("/classes/:classId/timetable/next", anyAuthenticatedUser, getNextLessonForClassController);
timetableRouter.get(
  "/classes/:classId/timetable/day/:dayOfWeek/period/:periodId",
  anyAuthenticatedUser,
  getSlotByClassDayPeriodController
);
timetableRouter.get(
  "/classes/:classId/timetable/day/:dayOfWeek",
  anyAuthenticatedUser,
  getClassTimetableForDayController
);
timetableRouter.get("/classes/:classId/timetable", anyAuthenticatedUser, getClassTimetableController);


// ================================================================
// 6. TEACHER VIEWS
// ================================================================

// ── Audit helper (School Management) ──
timetableRouter.get("/teachers/:teacherId/conflicts", schoolManagementAuth, checkTeacherConflictController);

// ── Lookup (Staff) ──
// ⚠️ More-specific suffixes (weekly/current/upcoming/day/...) before
//    the bare /teachers/:teacherId/timetable.
timetableRouter.get("/teachers/:teacherId/timetable/weekly", staffAuth, getTeacherWeeklyViewController);
timetableRouter.get("/teachers/:teacherId/timetable/current", staffAuth, getCurrentLessonForTeacherController);
timetableRouter.get("/teachers/:teacherId/timetable/upcoming", staffAuth, getUpcomingLessonsForTeacherController);
timetableRouter.get(
  "/teachers/:teacherId/timetable/day/:dayOfWeek",
  staffAuth,
  getTeacherTimetableForDayController
);
timetableRouter.get("/teachers/:teacherId/timetable", staffAuth, getTeacherTimetableController);

timetableRouter.get("/teachers/:teacherId/free-periods", staffAuth, getTeacherFreePeriodsController);
timetableRouter.get("/teachers/:teacherId/workload", staffAuth, getTeacherWorkloadController);
timetableRouter.get("/teachers/:teacherId/availability", staffAuth, getTeacherAvailabilityMatrixController);


// ================================================================
// 7. SCHOOL VIEWS
// ================================================================

// ── Audit / clearance (School Management) ──
timetableRouter.delete("/schools/:schoolId/timetable", schoolManagementAuth, deleteTimetableForSchoolController);
timetableRouter.delete(
  "/schools/:schoolId/timetable/day/:dayOfWeek",
  schoolManagementAuth,
  deleteTimetableForDayController
);

// ── Validation & coverage ──
// ⚠️ All static suffixes — no ordering conflicts among them.
timetableRouter.get("/schools/:schoolId/timetable/validate", schoolManagementAuth, validateSchoolTimetableController);
timetableRouter.get("/schools/:schoolId/timetable/coverage", schoolManagementAuth, getTimetableCoverageStatsController);
timetableRouter.get(
  "/schools/:schoolId/timetable/per-class-coverage",
  schoolManagementAuth,
  getPerClassCoverageController
);
timetableRouter.get(
  "/schools/:schoolId/timetable/conflicts-detailed",
  schoolManagementAuth,
  getDetailedConflictsController
);
timetableRouter.get("/schools/:schoolId/rooms/conflicts", schoolManagementAuth, checkRoomConflictController);

// ── Gap detection ──
timetableRouter.get(
  "/schools/:schoolId/timetable/empty-classes",
  schoolManagementAuth,
  getClassesWithNoTimetableController
);
timetableRouter.get(
  "/schools/:schoolId/timetable/unassigned-teachers",
  schoolManagementAuth,
  getUnassignedTeacherSlotsController
);
timetableRouter.get(
  "/schools/:schoolId/timetable/without-room",
  schoolManagementAuth,
  getSlotsWithoutRoomController
);

// ── Allocation / export ──
timetableRouter.get(
  "/schools/:schoolId/timetable/subject-allocation",
  schoolManagementAuth,
  getSubjectAllocationController
);
timetableRouter.get("/schools/:schoolId/timetable/export", schoolManagementAuth, exportSchoolTimetableController);
timetableRouter.get("/schools/:schoolId/timetable/slots", schoolManagementAuth, listSlotsForSchoolController);

// ── Teacher-ranking helpers ──
timetableRouter.get(
  "/schools/:schoolId/subjects/:subjectId/least-loaded-teacher",
  schoolManagementAuth,
  findLeastLoadedTeacherForSubjectController
);
timetableRouter.get(
  "/schools/:schoolId/subjects/:subjectId/preferred-teachers",
  schoolManagementAuth,
  getPreferredTeachersForSubjectController
);

// ── Lookup (Staff) ──
timetableRouter.get("/schools/:schoolId/timetable/grid", staffAuth, getSchoolTimetableGridController);
timetableRouter.get("/schools/:schoolId/timetable/subject/:subjectId", staffAuth, getSlotsBySubjectController);
timetableRouter.get("/schools/:schoolId/timetable/teacher/:teacherId", staffAuth, getSlotsByTeacherController);
timetableRouter.get("/schools/:schoolId/timetable/room/:room", staffAuth, getSlotsByRoomController);


export default timetableRouter;