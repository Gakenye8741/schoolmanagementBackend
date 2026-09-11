import { relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, date, decimal, boolean, index, uniqueIndex, uuid, integer, pgEnum } from "drizzle-orm/pg-core";

// ==========================================
// 1. ENUMS & TYPE DEFINITIONS
// ==========================================


export const userRoleEnum = pgEnum("user_role", ['super_admin', 'school_admin', 'bursar', 'teacher', 'parent', 'student']);
export const attendanceStatusEnum = pgEnum("attendance_status", ["Present", "Absent", "Late", "Excused"]);
export const paymentMethodEnum = pgEnum("payment_method", ['M-Pesa', 'Bank', 'Cash']);
export const subjectCategoryEnum = pgEnum("subject_category", ["Core", "Optional","Technical","Other"]);
export const examCategoryEnum = pgEnum("exam_category", ["Mid-Term" , "End-Term" , "Continuous Assessment" , "Project" , "Practical" , "Opening" , "Formative" , "Summative" , "Mock" , "End of Year"]);
export const performanceLevelEnum = pgEnum("performance_level", ['EE', 'ME', 'AE', 'BE']);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ['Active', 'Promoted', 'Transferred']);
export const disciplineIncidentEnum = pgEnum("discipline_incident", ['Merit', 'Warning', 'Late-coming']);
export const inventoryCategoryEnum = pgEnum("inventory_category", ['Textbook', 'CBC Apparatus', 'Stationery']);
export const loanStatusEnum = pgEnum("loan_status", ['Borrowed', 'Returned', 'Overdue']);
export const audienceEnum = pgEnum("audience", ['All', 'Parents', 'Teachers',"Students","Staff"]);
export const assignmentStatusEnum = pgEnum("assignment_status", ["Pending", "Submitted", "Graded", "Late"]);
export const eventCategories = [
  'Academic', 
  'Sports', 
  'Cultural', 
  'Club', 
  'Meeting', 
  'Holiday', 
  'General',
  'Other'
] as const;

export const eventCategoryEnum = pgEnum("event_category", eventCategories);
export const expenseCategoryEnum = pgEnum("expense_category", ['Salary', 'Utilities', 'Maintenance', 'Supplies', 'Transport']);

// -- New: tenancy-related enums --
export const schoolTypeEnum = pgEnum("school_type", ["Primary", "Secondary", "HighSchool", "Mixed", "ECD", "Tertiary"]);
export const curriculumTypeEnum = pgEnum("curriculum_type", ['CBC', '8-4-4', 'IGCSE','British','Other']);
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "Trial",
  "Basic",
  "Standard",
  "Premium",
  "Enterprise",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "Active",
  "PastDue",
  "Suspended",
  "Cancelled",
  "Expired",
]);

export const termStatusEnum = pgEnum("term_status", [
  "upcoming",
  "active",
  "completed",
  "archived",
]);

export const windowTypeEnum = pgEnum("window_type", [
  "mid_term_break",
  "cat_week",
  "exam_week",
  "registration_deadline",
]);

// ==========================================
// 2. SCHOOLS (TENANT & BRANDING) MODULE
// ==========================================
// Every school using the platform gets one row here. All other tables
// scope their data to a school via `schoolId` so many schools can run
// on one shared database (multi-tenant).

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "s1aabb99-9c0b-4ef8-bb6d-6bb9bd380s99"

  // -- Identity --
  name: varchar("name", { length: 255 }).notNull(), // e.g., "Nyayo Primary School"
  shortName: varchar("short_name", { length: 50 }), // e.g., "Nyayo Pri"
  slug: varchar("slug", { length: 100 }).unique().notNull(), // e.g., "nyayo-primary" (used for subdomain / URL routing)
  motto: varchar("motto", { length: 255 }), // e.g., "Discipline, Diligence, Distinction"
  registrationNumber: varchar("registration_number", { length: 100 }).unique(), // e.g., "MOE/PRI/2001/0456" (Ministry of Education code)
  knecCode: varchar("knec_code", { length: 50 }).unique(), // e.g., "12345678"
  schoolType: schoolTypeEnum("school_type").notNull(), // e.g., "Primary"
  curriculumType: curriculumTypeEnum("curriculum_type").default("CBC").notNull(), // e.g., "CBC"
  establishedYear: integer("established_year"), // e.g., 1998

  // -- Branding / theming (used by the frontend to skin the portal per school) --
  logoUrl: text("logo_url"), // e.g., "https://cdn.example.com/schools/nyayo/logo.png"
  faviconUrl: text("favicon_url"), // e.g., "https://cdn.example.com/schools/nyayo/favicon.ico"
  coverImageUrl: text("cover_image_url"), // e.g., "https://cdn.example.com/schools/nyayo/cover.jpg"
  primaryColor: varchar("primary_color", { length: 9 }).default("#0F172A").notNull(), // e.g., "#1D4ED8" (hex, optionally with alpha)
  secondaryColor: varchar("secondary_color", { length: 9 }).default("#64748B").notNull(), // e.g., "#F59E0B"
  accentColor: varchar("accent_color", { length: 9 }), // e.g., "#22C55E"
  gradientFrom: varchar("gradient_from", { length: 9 }), // e.g., "#1D4ED8"
  gradientTo: varchar("gradient_to", { length: 9 }), // e.g., "#9333EA"
  gradientDirection: varchar("gradient_direction", { length: 20 }).default("to-r"), // e.g., "to-br"

  // -- Contact & location --
  address: text("address"), // e.g., "P.O. Box 1234-00100"
  county: varchar("county", { length: 100 }), // e.g., "Nairobi"
  subCounty: varchar("sub_county", { length: 100 }), // e.g., "Westlands"
  phone: varchar("phone", { length: 20 }), // e.g., "+254712345678"
  alternativePhone: varchar("alternative_phone", { length: 20 }), // e.g., "+254798765432"
  email: varchar("email", { length: 255 }), // e.g., "info@nyayoprimary.ac.ke"
  website: text("website"), // e.g., "https://nyayoprimary.ac.ke"

  // -- Localization / operations --
  timezone: varchar("timezone", { length: 50 }).default("Africa/Nairobi").notNull(),
  currency: varchar("currency", { length: 10 }).default("KES").notNull(),
  principalName: varchar("principal_name", { length: 150 }), // e.g., "Mrs. Jane Wambui"

  // -- Subscription / lifecycle (billing the school for platform access) --
  subscriptionPlan: subscriptionPlanEnum("subscription_plan").default("Trial").notNull(),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").default("Active").notNull(),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    slugIdx: index("school_slug_idx").on(table.slug),
    activeIdx: index("school_active_idx").on(table.isActive),
  };
});

// ==========================================
// 3. USERS & AUTHENTICATION MODULE
// ==========================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }), // e.g., "s1aabb99-9c0b-4ef8-bb6d-6bb9bd380s99"
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  nationalId: varchar("national_id", { length: 20 }).unique(), // national ID is unique across the whole platform, not just one school
  tscNumber: varchar("tsc_number", { length: 50 }).unique(), // TSC number is a national teacher registration number
  admissionNumber: varchar("admission_number", { length: 50 }), // unique per school, see composite index below
  parentId: uuid("parent_id"), // links a student user to a parent user ID
  avatarUrl: text("avatar_url"),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    schoolIdx: index("user_school_idx").on(table.schoolId),
    // A person only ever has one account per school, and email must be
    // unique within that school (not globally, since the same parent
    // email could plausibly enroll a child at a second school).
    schoolEmailIdx: uniqueIndex("user_school_email_idx").on(table.schoolId, table.email),
    schoolAdmissionIdx: uniqueIndex("user_school_admission_idx").on(table.schoolId, table.admissionNumber),
    // Plain (non-composite) lookup indexes: login happens before we know
    // which school a user belongs to, so we search by identifier alone
    // across every school first, then narrow down. The composite indexes
    // above can't serve that query since schoolId isn't known yet.
    emailLookupIdx: index("user_email_lookup_idx").on(table.email),
    admissionLookupIdx: index("user_admission_lookup_idx").on(table.admissionNumber),
    phoneLookupIdx: index("user_phone_lookup_idx").on(table.phone),
    roleIdx: index("user_role_idx").on(table.role),
    tscIdx: index("user_tsc_idx").on(table.tscNumber),
  };
});

// ==========================================
// 4. ACADEMICS & CURRICULUM SETUP
// ==========================================

export const academicTerms = pgTable("academic_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  academicYear: varchar("academic_year", { length: 20 }).notNull(), // e.g., "2026"
  termName: varchar("term_name", { length: 50 }).notNull(), // e.g., "Term 1"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: termStatusEnum("status").default("upcoming").notNull(),
  isCurrentTerm: boolean("is_current_term").default(false).notNull(), // Optional: can keep for quick flags
}, (table) => {
  return {
    schoolTermIdx: index("term_school_idx").on(table.schoolId, table.academicYear),
  };
});

export const termWindows = pgTable("term_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(),
  windowType: windowTypeEnum("window_type").notNull(),
  title: varchar("title", { length: 100 }).notNull(), // e.g., "Term 1 Mid-Term Break"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
}, (table) => {
  return {
    termWindowIdx: index("term_window_idx").on(table.termId),
  };
});

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "c2eeff88-8a0a-3de7-aa5c-5aa8ac270c33"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  gradeLevel: varchar("grade_level", { length: 50 }).notNull(), // e.g., "Grade 5"
  stream: varchar("stream", { length: 50 }).notNull(), // e.g., "East"
  classTeacherId: uuid("class_teacher_id").references(() => users.id, { onDelete: "set null" }), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  academicYear: varchar("academic_year", { length: 20 }).notNull(), // e.g., "2026"
}, (table) => {
  return {
    schoolClassIdx: index("class_school_idx").on(table.schoolId, table.gradeLevel, table.stream),
  };
});


export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "daee6600-0828-5a59-2275-788085497k11"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Mathematics Activities"
  code: varchar("code", { length: 20 }).notNull(), // e.g., "MATH-01" (unique per school, see composite index below)
  category: subjectCategoryEnum("category").notNull(), // e.g., "Core"
}, (table) => {
  return {
    schoolSubjectCodeIdx: uniqueIndex("subject_school_code_idx").on(table.schoolId, table.code),
  };
});

export const teacherSubjects = pgTable("teacher_subjects", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "bebb2266-6484-1615-8831-344741053o55"
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(), // e.g., "daee6600-0828-5a59-2275-788085497k11"
}, (table) => {
  return {
    teacherSubjectIdx: index("teacher_subject_idx").on(table.teacherId, table.subjectId),
  };
});

export const timetables = pgTable("timetables", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  gradeLevel: varchar("grade_level", { length: 50 }).notNull(), // e.g., "Grade 5"
  stream: varchar("stream", { length: 50 }).notNull(), // e.g., "East"
  dayOfWeek: varchar("day_of_week", { length: 20 }).notNull(), // e.g., "Monday"
  periodNumber: integer("period_number").notNull(), // e.g., 1
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    timetableIdx: index("timetable_school_class_day_idx").on(table.schoolId, table.gradeLevel, table.stream, table.dayOfWeek),
    teacherScheduleIdx: index("timetable_teacher_schedule_idx").on(table.schoolId, table.dayOfWeek, table.periodNumber, table.teacherId),
  };
});

// ==========================================
// 5. STUDENT & ENROLLMENT MANAGEMENT
// ==========================================

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), // Removed .notNull() here
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  admissionNumber: varchar("admission_number", { length: 50 }).notNull(),
  upiNumber: varchar("upi_number", { length: 100 }).unique(),
  parentId: uuid("parent_id").references(() => users.id, { onDelete: "set null" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender", { length: 20 }),
  enrollmentDate: date("enrollment_date").defaultNow().notNull(),
  isEnrolled: boolean("is_enrolled").default(true).notNull(),
}, (table) => {
  return {
    schoolAdmNoIdx: uniqueIndex("student_school_adm_idx").on(table.schoolId, table.admissionNumber),
    classIdx: index("student_class_idx").on(table.classId),
    userIdIdx: index("student_user_idx").on(table.userId),
  };
});

export const studentEnrollmentHistory = pgTable("student_enrollment_history", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "e5ccbb55-5d7d-0fa4-772a-2dd5da940f66"
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(), // e.g., "d3aadd77-7f9f-2bc6-994b-4ff7fb160d44"
  termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(), // e.g., "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22"
  gradeLevel: varchar("grade_level", { length: 50 }).notNull(), // e.g., "Grade 4"
  stream: varchar("stream", { length: 50 }).notNull(), // e.g., "East"
  status: enrollmentStatusEnum("status").default("Active").notNull(), // e.g., "Active"
}, (table) => {
  return {
    historyIdx: index("student_history_idx").on(table.studentId, table.termId),
  };
});

// ==========================================
// 6. FINANCE, FEES & EXPENSES MODULE
// ==========================================

export const feeItems = pgTable("fee_items", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "f6ddaa44-4c6c-9e93-6619-1cc4c9830g77"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Tuition Fee"
  description: text("description"), // e.g., "Standard operational tuition fee per term"
  isOptional: boolean("is_optional").default(false).notNull(), // e.g., false
}, (table) => {
  return {
    schoolFeeItemIdx: index("fee_item_school_idx").on(table.schoolId),
  };
});

export const classFeeStructures = pgTable("class_fee_structures", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "a7ee9933-3b5b-8d82-5508-0bb3b8720h88"
  termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(), // e.g., "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22"
  gradeLevel: varchar("grade_level", { length: 50 }).notNull(), // e.g., "Grade 5"
  feeItemId: uuid("fee_item_id").references(() => feeItems.id, { onDelete: "cascade" }).notNull(), // e.g., "f6ddaa44-4c6c-9e93-6619-1cc4c9830g77"
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // e.g., 4500.00
}, (table) => {
  return {
    feeStructureIdx: index("class_fee_structure_idx").on(table.termId, table.gradeLevel),
  };
});

export const feeTransactions = pgTable("fee_transactions", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "b8ff8822-2a4a-7c71-4497-9aa2a7619i99"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(), // e.g., "d3aadd77-7f9f-2bc6-994b-4ff7fb160d44"
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(), // e.g., 2000.00
  balanceRemaining: decimal("balance_remaining", { precision: 10, scale: 2 }).notNull(), // e.g., 2500.00
  paymentMethod: paymentMethodEnum("payment_method").notNull(), // e.g., "M-Pesa"
  referenceCode: varchar("reference_code", { length: 100 }).notNull(), // e.g., "QG78HJ2K99" (unique per school, see composite index below)
  termId: uuid("term_id").references(() => academicTerms.id).notNull(), // e.g., "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22"
  recordedBy: uuid("recorded_by").references(() => users.id), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  transactionDate: timestamp("transaction_date").defaultNow().notNull(), // e.g., "2026-02-14T10:30:00Z"
}, (table) => {
  return {
    studentFeeIdx: index("fee_student_idx").on(table.studentId),
    schoolRefCodeIdx: uniqueIndex("fee_school_ref_idx").on(table.schoolId, table.referenceCode),
  };
});

export const schoolExpenses = pgTable("school_expenses", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "f8jj0044-4262-9493-6610-122519831y44"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 150 }).notNull(), // e.g., "Electricity Bill - March"
  category: expenseCategoryEnum("category").notNull(), // e.g., "Utilities"
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // e.g., 35400.00
  paymentMethod: paymentMethodEnum("payment_method").notNull(), // e.g., "Bank"
  referenceCode: varchar("reference_code", { length: 100 }), // e.g., "BK98765432" (unique per school, see composite index below)
  recordedBy: uuid("recorded_by").references(() => users.id).notNull(), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  expenseDate: date("expense_date").notNull(), // e.g., "2026-03-31"
}, (table) => {
  return {
    schoolExpenseRefIdx: uniqueIndex("expense_school_ref_idx").on(table.schoolId, table.referenceCode),
  };
});

// ==========================================
// 7. EXAMINATIONS & CBC ASSESSMENTS
// ==========================================

export const termExams = pgTable("term_exams", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "ebff5599-9717-4948-1164-677074386l22"
  termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(), // e.g., "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22"
  examTitle: varchar("exam_title", { length: 100 }).notNull(), // e.g., "Term 1 Mid-Term Assessment"
  examCategory: examCategoryEnum("exam_category").notNull(), // e.g., "Mid-Term"
  startDate: date("start_date"), // e.g., "2026-03-10"
  endDate: date("end_date"), // e.g., "2026-03-14"
  isLocked: boolean("is_locked").default(false).notNull(), // e.g., false
}, (table) => {
  return {
    termExamIdx: index("term_exam_idx").on(table.termId),
  };
});


export const cbcAssessments = pgTable("cbc_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull(),
  subjectId: uuid("subject_id").notNull(),
  termId: uuid("term_id").notNull(), // <-- Add this line
  examId: uuid("exam_id").notNull(),
  strand: varchar("strand", { length: 255 }).notNull(),
  subStrand: varchar("sub_strand", { length: 255 }),
  scoreValue: decimal("score_value", { precision: 5, scale: 2 }),
  outOf: decimal("out_of", { precision: 5, scale: 2 }),
  performanceLevel: varchar("performance_level", { length: 2 }).notNull(),
  teacherRemarks: text("teacher_remarks"),
  assessedBy: uuid("assessed_by").notNull(),
}, (table) => {
  return {
    studentExamSubjectStrandIdx: uniqueIndex("student_exam_subject_strand_idx").on(
      table.studentId, 
      table.examId, 
      table.subjectId, 
      table.strand
    ),
  };
});

// ==========================================
// 8. ATTENDANCE & DISCIPLINE
// ==========================================

export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "c9aa7711-1939-6b60-3386-899196508j00"
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(), // e.g., "d3aadd77-7f9f-2bc6-994b-4ff7fb160d44"
  date: date("date").notNull(), // e.g., "2026-03-01"
  status: attendanceStatusEnum("status").notNull(), // e.g., "Present"
  markedBy: uuid("marked_by").references(() => users.id).notNull(), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
}, (table) => {
  return {
    studentDateIdx: uniqueIndex("attendance_student_date_idx").on(table.studentId, table.date),
  };
});

export const disciplinaryRecords = pgTable("disciplinary_records", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "cfaa1155-5373-0504-7720-233630942p66"
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(), // e.g., "d3aadd77-7f9f-2bc6-994b-4ff7fb160d44"
  recordedBy: uuid("recorded_by").references(() => users.id).notNull(), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  incidentType: disciplineIncidentEnum("incident_type").notNull(), // e.g., "Warning"
  description: text("description").notNull(), // e.g., "Late arrival for morning assembly."
  actionTaken: text("action_taken"), // e.g., "Counseled by class teacher."
  date: timestamp("date").defaultNow().notNull(), // e.g., "2026-02-20T08:15:00Z"
}, (table) => {
  return {
    studentDisciplineIdx: index("discipline_student_idx").on(table.studentId),
  };
});

// ==========================================
// 9. LIBRARY & INVENTORY
// ==========================================

export const schoolInventory = pgTable("school_inventory", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "d0bb0044-4262-9493-6610-122519831q77"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  itemName: varchar("item_name", { length: 150 }).notNull(), // e.g., "Primary Mathematics Grade 5"
  category: inventoryCategoryEnum("category").notNull(), // e.g., "Textbook"
  totalQuantity: integer("total_quantity").notNull(), // e.g., 120
  availableQuantity: integer("available_quantity").notNull(), // e.g., 115
  unitCondition: varchar("unit_condition", { length: 50 }).default("Good").notNull(), // e.g., "Good"
}, (table) => {
  return {
    schoolInventoryIdx: index("inventory_school_idx").on(table.schoolId),
  };
});

export const libraryLoans = pgTable("library_loans", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "e1cc9933-3151-8382-5509-011408720r88"
  inventoryId: uuid("inventory_id").references(() => schoolInventory.id, { onDelete: "cascade" }).notNull(), // e.g., "d0bb0044-4262-9493-6610-122519831q77"
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(), // e.g., "d3aadd77-7f9f-2bc6-994b-4ff7fb160d44"
  borrowDate: date("borrow_date").defaultNow().notNull(), // e.g., "2026-01-15"
  dueDate: date("due_date").notNull(), // e.g., "2026-04-05"
  returnDate: date("return_date"), // e.g., "2026-04-02"
  status: loanStatusEnum("status").default("Borrowed").notNull(), // e.g., "Returned"
}, (table) => {
  return {
    libraryStudentIdx: index("library_student_idx").on(table.studentId),
  };
});

// ==========================================
// 10. HOMEWORK & ASSIGNMENTS
// ==========================================

export const homeworkAssignments = pgTable("homework_assignments", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "c5gg7711-1939-6160-3387-899286508v11"
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(), // e.g., "c2eeff88-8a0a-3de7-aa5c-5aa8ac270c33"
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(), // e.g., "daee6600-0828-5a59-2275-788085497k11"
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  title: varchar("title", { length: 255 }).notNull(), // e.g., "Algebra Practice Exercise"
  description: text("description").notNull(), // e.g., "Complete questions 1 to 10 on page 45."
  dueDate: timestamp("due_date").notNull(), // e.g., "2026-03-20T17:00:00Z"
  createdAt: timestamp("created_at").defaultNow().notNull(), // e.g., "2026-03-15T08:00:00Z"
});

export const homeworkSubmissions = pgTable("homework_submissions", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "d6hh8822-2040-7271-4498-900397619w22"
  assignmentId: uuid("assignment_id").references(() => homeworkAssignments.id, { onDelete: "cascade" }).notNull(), // e.g., "c5gg7711-1939-6160-3387-899286508v11"
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(), // e.g., "d3aadd77-7f9f-2bc6-994b-4ff7fb160d44"
  submissionText: text("submission_text"), // e.g., "Completed and uploaded via student portal PDF."
  status: assignmentStatusEnum("status").default("Pending").notNull(), // e.g., "Submitted"
  gradeScore: decimal("grade_score", { precision: 5, scale: 2 }), // e.g., 95.00
  submittedAt: timestamp("submitted_at"), // e.g., "2026-03-18T14:30:00Z"
}, (table) => {
  return {
    assignmentStudentIdx: uniqueIndex("submission_assignment_student_idx").on(table.assignmentId, table.studentId),
  };
});

// ==========================================
// 11. COMMUNICATIONS & PORTAL MESSAGING
// ==========================================

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "f2dd8822-2040-7271-4498-900397619s99"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(), // e.g., "Closing Day Notice"
  message: text("message").notNull(), // e.g., "Term 1 officially closes on Friday 10th April 2026."
  targetAudience: audienceEnum("target_audience").notNull(), // e.g., "Parents"
  postedBy: uuid("posted_by").references(() => users.id, { onDelete: "cascade" }).notNull(), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  sendViaSms: boolean("send_via_sms").default(false).notNull(), // e.g., true
  createdAt: timestamp("created_at").defaultNow().notNull(), // e.g., "2026-04-01T10:00:00Z"
}, (table) => {
  return {
    schoolAudienceIdx: index("announcement_school_audience_idx").on(table.schoolId, table.targetAudience),
  };
});

export const directMessages = pgTable("direct_messages", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "a3ee7711-1939-6160-3387-899286508t00"
  senderId: uuid("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  receiverId: uuid("receiver_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // e.g., "e4bbcc66-6e8e-1ab5-883a-3ee6ea050e55"
  messageText: text("message_text").notNull(), // e.g., "Hello, I would like to discuss John's math progress."
  isRead: boolean("is_read").default(false).notNull(), // e.g., false
  sentAt: timestamp("sent_at").defaultNow().notNull(), // e.g., "2026-02-18T16:45:00Z"
}, (table) => {
  return {
    messageThreadIdx: index("message_thread_idx").on(table.senderId, table.receiverId),
  };
});

// ==========================================
// 12. SCHOOL EVENTS & CO-CURRICULAR ACTIVITIES
// ==========================================

export const schoolEvents = pgTable("school_events", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "e7ii9933-3151-8382-5509-011408720x33"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(), // e.g., "Annual Sports Day"
  description: text("description"), // e.g., "Inter-house athletic competitions at the main sports field."
  category: eventCategoryEnum("category").notNull(), // e.g., "Sports"
  startDate: timestamp("start_date").notNull(), // e.g., "2026-06-10T08:00:00Z"
  endDate: timestamp("end_date").notNull(), // e.g., "2026-06-10T17:00:00Z"
  postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
}, (table) => {
  return {
    schoolEventIdx: index("event_school_idx").on(table.schoolId),
  };
});

export const coCurricularActivities = pgTable("co_curricular_activities", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "a9kk1155-5373-0504-7720-233630942z55"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Scouts and Guides Club"
  category: varchar("category", { length: 50 }).notNull(), // e.g., "Club"
  patronTeacherId: uuid("patron_teacher_id").references(() => users.id, { onDelete: "set null" }), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
}, (table) => {
  return {
    schoolActivityIdx: index("activity_school_idx").on(table.schoolId),
  };
});

export const studentActivityMemberships = pgTable("student_activity_memberships", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "b0ll2266-6484-1615-8831-344741053a66"
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(), // e.g., "d3aadd77-7f9f-2bc6-994b-4ff7fb160d44"
  activityId: uuid("activity_id").references(() => coCurricularActivities.id, { onDelete: "cascade" }).notNull(), // e.g., "a9kk1155-5373-0504-7720-233630942z55"
  termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(), // e.g., "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22"
  performanceRole: varchar("performance_role", { length: 100 }), // e.g., "Patrol Leader"
});

// ==========================================
// 13. SYSTEM & AUDIT LOGS
// ==========================================

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(), // e.g., "b4ff6600-0828-5059-2276-788075497u11"
  schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }), // nullable: platform-level actions (e.g., super_admin creating a school) have no school
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // e.g., "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  action: text("action").notNull(), // e.g., "UPDATED_FEE_STRUCTURE"
  ipAddress: varchar("ip_address", { length: 45 }), // e.g., "192.168.1.50"
  timestamp: timestamp("timestamp").defaultNow().notNull(), // e.g., "2026-02-10T11:22:33Z"
}, (table) => {
  return {
    schoolAuditIdx: index("audit_school_idx").on(table.schoolId),
  };
});

/// ==========================================
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