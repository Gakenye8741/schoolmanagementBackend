import { relations } from "drizzle-orm";
import {
  schools,
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
} from "./schema"; // Assuming schema is in the same directory

// ==========================================
// 0. SCHOOL (TENANT) RELATIONS
// ==========================================

export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  academicTerms: many(academicTerms),
  classes: many(classes),
  subjects: many(subjects),
  timetables: many(timetables),
  students: many(students),
  feeItems: many(feeItems),
  feeTransactions: many(feeTransactions),
  schoolExpenses: many(schoolExpenses),
  schoolInventory: many(schoolInventory),
  announcements: many(announcements),
  schoolEvents: many(schoolEvents),
  coCurricularActivities: many(coCurricularActivities),
  auditLogs: many(auditLogs),
}));

// ==========================================
// 1. USERS & SYSTEM AUTHENTICATION RELATIONS
// ==========================================

export const usersRelations = relations(users, ({ one, many }) => ({
  school: one(schools, {
    fields: [users.schoolId],
    references: [schools.id],
  }),
  auditLogs: many(auditLogs),
  classesAsTeacher: many(classes, { relationName: "classTeacher" }),
  teacherSubjects: many(teacherSubjects),
  timetables: many(timetables),
  studentsAsParent: many(students, { relationName: "studentParent" }),
  feeTransactionsRecorded: many(feeTransactions, { relationName: "recordedBy" }),
  schoolExpensesRecorded: many(schoolExpenses, { relationName: "recordedBy" }),
  cbcAssessmentsAssessed: many(cbcAssessments, { relationName: "assessedBy" }),
  homeworkAssignments: many(homeworkAssignments),
  attendanceMarked: many(attendance, { relationName: "markedBy" }),
  disciplinaryRecordsRecorded: many(disciplinaryRecords, { relationName: "recordedBy" }),
  coCurricularActivitiesPatron: many(coCurricularActivities, { relationName: "patronTeacher" }),
  announcementsPosted: many(announcements, { relationName: "postedBy" }),
  sentMessages: many(directMessages, { relationName: "messageSender" }),
  receivedMessages: many(directMessages, { relationName: "messageReceiver" }),
  schoolEventsPosted: many(schoolEvents, { relationName: "postedBy" }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  school: one(schools, {
    fields: [auditLogs.schoolId],
    references: [schools.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));


// ==========================================
// 2. ACADEMIC STRUCTURE & CURRICULUM RELATIONS
// ==========================================

export const academicTermsRelations = relations(academicTerms, ({ one, many }) => ({
  school: one(schools, {
    fields: [academicTerms.schoolId],
    references: [schools.id],
  }),
  studentEnrollmentHistory: many(studentEnrollmentHistory),
  classFeeStructures: many(classFeeStructures),
  feeTransactions: many(feeTransactions),
  termExams: many(termExams),
  cbcAssessments: many(cbcAssessments),
  studentActivityMemberships: many(studentActivityMemberships),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, {
    fields: [classes.schoolId],
    references: [schools.id],
  }),
  classTeacher: one(users, {
    fields: [classes.classTeacherId],
    references: [users.id],
    relationName: "classTeacher",
  }),
  students: many(students),
  homeworkAssignments: many(homeworkAssignments),
 }));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  school: one(schools, {
    fields: [subjects.schoolId],
    references: [schools.id],
  }),
  teacherSubjects: many(teacherSubjects),
  timetables: many(timetables),
  cbcAssessments: many(cbcAssessments),
  homeworkAssignments: many(homeworkAssignments),
}));

export const teacherSubjectsRelations = relations(teacherSubjects, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherSubjects.teacherId],
    references: [users.id],
  }),
  subject: one(subjects, {
    fields: [teacherSubjects.subjectId],
    references: [subjects.id],
  }),
}));

export const timetablesRelations = relations(timetables, ({ one }) => ({
  school: one(schools, {
    fields: [timetables.schoolId],
    references: [schools.id],
  }),
  subject: one(subjects, {
    fields: [timetables.subjectId],
    references: [subjects.id],
  }),
  teacher: one(users, {
    fields: [timetables.teacherId],
    references: [users.id],
  }),
}));


// ==========================================
// 3. STUDENT MANAGEMENT & ENROLLMENT RELATIONS
// ==========================================

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, {
    fields: [students.schoolId],
    references: [schools.id],
  }),
  parent: one(users, {
    fields: [students.parentId],
    references: [users.id],
    relationName: "studentParent",
  }),
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  enrollmentHistory: many(studentEnrollmentHistory),
  feeTransactions: many(feeTransactions),
  cbcAssessments: many(cbcAssessments),
  homeworkSubmissions: many(homeworkSubmissions),
  attendance: many(attendance),
  disciplinaryRecords: many(disciplinaryRecords),
  studentActivityMemberships: many(studentActivityMemberships),
  libraryLoans: many(libraryLoans),
}));

export const studentEnrollmentHistoryRelations = relations(studentEnrollmentHistory, ({ one }) => ({
  student: one(students, {
    fields: [studentEnrollmentHistory.studentId],
    references: [students.id],
  }),
  term: one(academicTerms, {
    fields: [studentEnrollmentHistory.termId],
    references: [academicTerms.id],
  }),
}));


// ==========================================
// 4. FINANCIALS, FEES & EXPENSES RELATIONS
// ==========================================

export const feeItemsRelations = relations(feeItems, ({ one, many }) => ({
  school: one(schools, {
    fields: [feeItems.schoolId],
    references: [schools.id],
  }),
  classFeeStructures: many(classFeeStructures),
}));

export const classFeeStructuresRelations = relations(classFeeStructures, ({ one }) => ({
  term: one(academicTerms, {
    fields: [classFeeStructures.termId],
    references: [academicTerms.id],
  }),
  feeItem: one(feeItems, {
    fields: [classFeeStructures.feeItemId],
    references: [feeItems.id],
  }),
}));

export const feeTransactionsRelations = relations(feeTransactions, ({ one }) => ({
  school: one(schools, {
    fields: [feeTransactions.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [feeTransactions.studentId],
    references: [students.id],
  }),
  term: one(academicTerms, {
    fields: [feeTransactions.termId],
    references: [academicTerms.id],
  }),
  recordedByUser: one(users, {
    fields: [feeTransactions.recordedBy],
    references: [users.id],
    relationName: "recordedBy",
  }),
}));

export const schoolExpensesRelations = relations(schoolExpenses, ({ one }) => ({
  school: one(schools, {
    fields: [schoolExpenses.schoolId],
    references: [schools.id],
  }),
  recordedByUser: one(users, {
    fields: [schoolExpenses.recordedBy],
    references: [users.id],
    relationName: "recordedBy",
  }),
}));


// ==========================================
// 5. ASSESSMENTS, EXAMS & HOMEWORK RELATIONS
// ==========================================

export const termExamsRelations = relations(termExams, ({ one, many }) => ({
  term: one(academicTerms, {
    fields: [termExams.termId],
    references: [academicTerms.id],
  }),
  cbcAssessments: many(cbcAssessments),
}));

export const cbcAssessmentsRelations = relations(cbcAssessments, ({ one }) => ({
  student: one(students, {
    fields: [cbcAssessments.studentId],
    references: [students.id],
  }),
  subject: one(subjects, {
    fields: [cbcAssessments.subjectId],
    references: [subjects.id],
  }),
  term: one(academicTerms, {
    fields: [cbcAssessments.termId],
    references: [academicTerms.id],
  }),
  exam: one(termExams, {
    fields: [cbcAssessments.examId],
    references: [termExams.id],
  }),
  assessedByUser: one(users, {
    fields: [cbcAssessments.assessedBy],
    references: [users.id],
    relationName: "assessedBy",
  }),
}));

export const homeworkAssignmentsRelations = relations(homeworkAssignments, ({ one, many }) => ({
  class: one(classes, {
    fields: [homeworkAssignments.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [homeworkAssignments.subjectId],
    references: [subjects.id],
  }),
  teacher: one(users, {
    fields: [homeworkAssignments.teacherId],
    references: [users.id],
  }),
  submissions: many(homeworkSubmissions),
}));

export const homeworkSubmissionsRelations = relations(homeworkSubmissions, ({ one }) => ({
  assignment: one(homeworkAssignments, {
    fields: [homeworkSubmissions.assignmentId],
    references: [homeworkAssignments.id],
  }),
  student: one(students, {
    fields: [homeworkSubmissions.studentId],
    references: [students.id],
  }),
}));


// ==========================================
// 6. ATTENDANCE, DISCIPLINE & CO-CURRICULAR
// ==========================================

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(students, {
    fields: [attendance.studentId],
    references: [students.id],
  }),
  markedByUser: one(users, {
    fields: [attendance.markedBy],
    references: [users.id],
    relationName: "markedBy",
  }),
}));

export const disciplinaryRecordsRelations = relations(disciplinaryRecords, ({ one }) => ({
  student: one(students, {
    fields: [disciplinaryRecords.studentId],
    references: [students.id],
  }),
  recordedByUser: one(users, {
    fields: [disciplinaryRecords.recordedBy],
    references: [users.id],
    relationName: "recordedBy",
  }),
}));

export const coCurricularActivitiesRelations = relations(coCurricularActivities, ({ one, many }) => ({
  school: one(schools, {
    fields: [coCurricularActivities.schoolId],
    references: [schools.id],
  }),
  patronTeacher: one(users, {
    fields: [coCurricularActivities.patronTeacherId],
    references: [users.id],
    relationName: "patronTeacher",
  }),
  memberships: many(studentActivityMemberships),
}));

export const studentActivityMembershipsRelations = relations(studentActivityMemberships, ({ one }) => ({
  student: one(students, {
    fields: [studentActivityMemberships.studentId],
    references: [students.id],
  }),
  activity: one(coCurricularActivities, {
    fields: [studentActivityMemberships.activityId],
    references: [coCurricularActivities.id],
  }),
  term: one(academicTerms, {
    fields: [studentActivityMemberships.termId],
    references: [academicTerms.id],
  }),
}));


// ==========================================
// 7. INVENTORY & LIBRARY RELATIONS
// ==========================================

export const schoolInventoryRelations = relations(schoolInventory, ({ one, many }) => ({
  school: one(schools, {
    fields: [schoolInventory.schoolId],
    references: [schools.id],
  }),
  libraryLoans: many(libraryLoans),
}));

export const libraryLoansRelations = relations(libraryLoans, ({ one }) => ({
  inventory: one(schoolInventory, {
    fields: [libraryLoans.inventoryId],
    references: [schoolInventory.id],
  }),
  student: one(students, {
    fields: [libraryLoans.studentId],
    references: [students.id],
  }),
}));


// ==========================================
// 8. COMMUNICATIONS & EVENTS RELATIONS
// ==========================================

export const announcementsRelations = relations(announcements, ({ one }) => ({
  school: one(schools, {
    fields: [announcements.schoolId],
    references: [schools.id],
  }),
  postedByUser: one(users, {
    fields: [announcements.postedBy],
    references: [users.id],
    relationName: "postedBy",
  }),
}));

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  sender: one(users, {
    fields: [directMessages.senderId],
    references: [users.id],
    relationName: "messageSender",
  }),
  receiver: one(users, {
    fields: [directMessages.receiverId],
    references: [users.id],
    relationName: "messageReceiver",
  }),
}));

export const schoolEventsRelations = relations(schoolEvents, ({ one }) => ({
  school: one(schools, {
    fields: [schoolEvents.schoolId],
    references: [schools.id],
  }),
  postedByUser: one(users, {
    fields: [schoolEvents.postedBy],
    references: [users.id],
    relationName: "postedBy",
  }),
}));