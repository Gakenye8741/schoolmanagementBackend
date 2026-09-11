import {
  users,
  auditLogs,
  academicTerms,
  classes,
  subjects,
  teacherSubjects,
  timetables,
  students,
  studentEnrollmentHistory,
  feeItems,
  classFeeStructures,
  feeTransactions,
  schoolExpenses,
  termExams,
  cbcAssessments,
  homeworkAssignments,
  homeworkSubmissions,
  attendance,
  disciplinaryRecords,
  coCurricularActivities,
  studentActivityMemberships,
  schoolInventory,
  libraryLoans,
  announcements,
  directMessages,
  schoolEvents,
  schools,
  termWindows,
} from "./schema";

// =======================
// TYPES
// =======================

// Users & System Authentication
export type TSelectUser = typeof users.$inferSelect;
export type TInsertUser = typeof users.$inferInsert;

export type TSelectAuditLog = typeof auditLogs.$inferSelect;
export type TInsertAuditLog = typeof auditLogs.$inferInsert;

// Academic Structure & Curriculum
export type TSelectAcademicTerm = typeof academicTerms.$inferSelect;
export type TInsertAcademicTerm = typeof academicTerms.$inferInsert;

export type TSelectTermWindows = typeof termWindows.$inferSelect;
export type TInsertTermWindows = typeof termWindows.$inferInsert;

export type TSelectClass = typeof classes.$inferSelect;
export type TInsertClass = typeof classes.$inferInsert;

export type TSelectSubject = typeof subjects.$inferSelect;
export type TInsertSubject = typeof subjects.$inferInsert;

export type TSelectTeacherSubject = typeof teacherSubjects.$inferSelect;
export type TInsertTeacherSubject = typeof teacherSubjects.$inferInsert;

export type TSelectTimetable = typeof timetables.$inferSelect;
export type TInsertTimetable = typeof timetables.$inferInsert;

// Student Management & Enrollment
export type TSelectSchool= typeof schools.$inferSelect;
export type TInsertSchool = typeof schools.$inferInsert;

export type TSelectStudent = typeof students.$inferSelect;
export type TInsertStudent = typeof students.$inferInsert;
export type TSelectStudentEnrollmentHistory = typeof studentEnrollmentHistory.$inferSelect;
export type TInsertStudentEnrollmentHistory = typeof studentEnrollmentHistory.$inferInsert;

// Financials, Fees & Expenses
export type TSelectFeeItem = typeof feeItems.$inferSelect;
export type TInsertFeeItem = typeof feeItems.$inferInsert;

export type TSelectClassFeeStructure = typeof classFeeStructures.$inferSelect;
export type TInsertClassFeeStructure = typeof classFeeStructures.$inferInsert;

export type TSelectFeeTransaction = typeof feeTransactions.$inferSelect;
export type TInsertFeeTransaction = typeof feeTransactions.$inferInsert;

export type TSelectSchoolExpense = typeof schoolExpenses.$inferSelect;
export type TInsertSchoolExpense = typeof schoolExpenses.$inferInsert;

// Assessments, Exams & Homework
export type TSelectTermExam = typeof termExams.$inferSelect;
export type TInsertTermExam = typeof termExams.$inferInsert;

export type TSelectCbcAssessment = typeof cbcAssessments.$inferSelect;
export type TInsertCbcAssessment = typeof cbcAssessments.$inferInsert;

export type TSelectHomeworkAssignment = typeof homeworkAssignments.$inferSelect;
export type TInsertHomeworkAssignment = typeof homeworkAssignments.$inferInsert;

export type TSelectHomeworkSubmission = typeof homeworkSubmissions.$inferSelect;
export type TInsertHomeworkSubmission = typeof homeworkSubmissions.$inferInsert;

// Attendance, Discipline & Co-Curricular
export type TSelectAttendance = typeof attendance.$inferSelect;
export type TInsertAttendance = typeof attendance.$inferInsert;

export type TSelectDisciplinaryRecord = typeof disciplinaryRecords.$inferSelect;
export type TInsertDisciplinaryRecord = typeof disciplinaryRecords.$inferInsert;

export type TSelectCoCurricularActivity = typeof coCurricularActivities.$inferSelect;
export type TInsertCoCurricularActivity = typeof coCurricularActivities.$inferInsert;

export type TSelectStudentActivityMembership = typeof studentActivityMemberships.$inferSelect;
export type TInsertStudentActivityMembership = typeof studentActivityMemberships.$inferInsert;

// Inventory & Library
export type TSelectSchoolInventory = typeof schoolInventory.$inferSelect;
export type TInsertSchoolInventory = typeof schoolInventory.$inferInsert;

export type TSelectLibraryLoan = typeof libraryLoans.$inferSelect;
export type TInsertLibraryLoan = typeof libraryLoans.$inferInsert;

// Communications & Events
export type TSelectAnnouncement = typeof announcements.$inferSelect;
export type TInsertAnnouncement = typeof announcements.$inferInsert;

export type TSelectDirectMessage = typeof directMessages.$inferSelect;
export type TInsertDirectMessage = typeof directMessages.$inferInsert;

export type TSelectSchoolEvent = typeof schoolEvents.$inferSelect;
export type TInsertSchoolEvent = typeof schoolEvents.$inferInsert;