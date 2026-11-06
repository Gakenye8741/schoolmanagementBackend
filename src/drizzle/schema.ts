import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  date,
  time,
  decimal,
  boolean,
  index,
  uniqueIndex,
  uuid,
  integer,
  jsonb,
  check,
  pgEnum,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ==========================================
// 0. SHARED HELPERS & INDEXING RULES
// ==========================================
// INDEXING RULES USED IN THIS FILE
//  1. Every tenant table has an index that STARTS with school_id, so
//     "all rows for this school" (and school off-boarding cascades) is fast.
//  2. Composite indexes put equality columns first, range/sort columns last
//     (e.g. school_id, class_id, date).
//  3. Postgres does NOT auto-index foreign keys. Every FK that is joined or
//     cascaded often has an index that starts with it.
//  4. Partial indexes (WHERE ...) cover the "hot" subset only: unpaid invoices,
//     unread notifications, open loans, active sessions, enrolled students.
//     They are much smaller and faster than full indexes.
//  5. BRIN indexes on append-only time columns (audit/SMS logs): tiny, and
//     ideal for huge tables queried by time range.
//  6. No redundant indexes: a composite (a, b) already serves lookups on (a).
//  Trigram (fuzzy name search) and RLS live in indexes_and_rls.sql.

const tz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => tz("created_at").defaultNow().notNull();
const updatedAt = () =>
  tz("updated_at").defaultNow().notNull().$onUpdate(() => new Date());

// ==========================================
// 1. ENUMS & TYPE DEFINITIONS
// ==========================================

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "school_admin",
  "principal",
  "deputy_principal",
  "bursar",
  "registrar",
  "librarian",
  "teacher",
  "parent",
  "student",
]);
export const genderEnum = pgEnum("gender", ["Male", "Female", "Other"]);
export const boardingStatusEnum = pgEnum("boarding_status", ["Day", "Boarding"]);
export const guardianRelationshipEnum = pgEnum("guardian_relationship", [
  "Mother",
  "Father",
  "Guardian",
  "Sponsor",
  "Sibling",
  "Other",
]);
export const weekdayEnum = pgEnum("weekday", [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["Present", "Absent", "Late", "Excused"]);
export const paymentMethodEnum = pgEnum("payment_method", ["M-Pesa", "Bank", "Cash", "Cheque"]);
export const paymentStatusEnum = pgEnum("payment_status", ["Pending", "Completed", "Failed", "Reversed"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "Unpaid",
  "Partial",
  "Paid",
  "Overdue",
  "Waived",
  "Cancelled",
]);
export const subjectCategoryEnum = pgEnum("subject_category", ["Core", "Optional", "Technical", "Other"]);
export const examCategoryEnum = pgEnum("exam_category", [
  "Mid-Term",
  "End-Term",
  "Continuous Assessment",
  "Project",
  "Practical",
  "Opening",
  "Formative",
  "Summative",
  "Mock",
  "End of Year",
]);
export const performanceLevelEnum = pgEnum("performance_level", ["EE", "ME", "AE", "BE"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "Active",
  "Promoted",
  "Repeated",
  "Transferred",
  "Withdrawn",
  "Graduated",
]);
export const disciplineIncidentEnum = pgEnum("discipline_incident", [
  "Merit",
  "Warning",
  "Late-coming",
  "Detention",
  "Suspension",
]);
export const inventoryCategoryEnum = pgEnum("inventory_category", [
  "Textbook",
  "CBC Apparatus",
  "Stationery",
  "Furniture",
  "ICT",
  "Lab Equipment",
  "Sports Equipment",
]);
export const loanStatusEnum = pgEnum("loan_status", ["Borrowed", "Returned", "Overdue", "Lost"]);
export const audienceEnum = pgEnum("audience", ["All", "Parents", "Teachers", "Students", "Staff"]);
export const assignmentStatusEnum = pgEnum("assignment_status", ["Pending", "Submitted", "Graded", "Late"]);
export const smsStatusEnum = pgEnum("sms_status", ["Queued", "Sent", "Delivered", "Failed"]);

export const eventCategories = [
  "Academic",
  "Sports",
  "Cultural",
  "Club",
  "Meeting",
  "Holiday",
  "General",
  "Other",
] as const;
export const eventCategoryEnum = pgEnum("event_category", eventCategories);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "Salary",
  "Utilities",
  "Maintenance",
  "Supplies",
  "Transport",
]);

// -- Tenancy-related enums --
export const schoolTypeEnum = pgEnum("school_type", ["Primary", "Secondary", "HighSchool", "Mixed", "ECD", "Tertiary"]);
export const curriculumTypeEnum = pgEnum("curriculum_type", ["CBC", "8-4-4", "IGCSE", "British", "Other"]);
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
export const termStatusEnum = pgEnum("term_status", ["upcoming", "active", "completed", "archived"]);
export const windowTypeEnum = pgEnum("window_type", [
  "mid_term_break",
  "cat_week",
  "exam_week",
  "registration_deadline",
]);

// -- New in v2 --
export const tokenPurposeEnum = pgEnum("token_purpose", [
  "password_reset",
  "email_verification",
  "phone_otp",
  "login_otp",
  "invite",
]);
export const approvalStatusEnum = pgEnum("approval_status", ["Draft", "Submitted", "Approved", "Rejected"]);
export const documentCategoryEnum = pgEnum("document_category", [
  "BirthCertificate",
  "TransferLetter",
  "ReportForm",
  "MedicalReport",
  "IdentityDocument",
  "Photo",
  "Circular",
  "Other",
]);
export const healthRecordTypeEnum = pgEnum("health_record_type", [
  "Allergy",
  "Condition",
  "Vaccination",
  "SickBayVisit",
  "Injury",
  "Other",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "Fees",
  "Attendance",
  "Exam",
  "Homework",
  "Announcement",
  "Message",
  "Discipline",
  "System",
]);
export const meetingSlotStatusEnum = pgEnum("meeting_slot_status", ["Open", "Booked", "Completed", "Cancelled"]);
export const importJobTypeEnum = pgEnum("import_job_type", ["students", "guardians", "teachers", "fees", "marks"]);
export const importStatusEnum = pgEnum("import_status", ["Queued", "Processing", "Completed", "Failed"]);

// ==========================================
// 2. SCHOOLS (TENANT & BRANDING) MODULE
// ==========================================

export const schools = pgTable(
  "schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // -- Identity --
    name: varchar("name", { length: 255 }).notNull(),
    shortName: varchar("short_name", { length: 50 }),
    slug: varchar("slug", { length: 100 }).unique().notNull(), // subdomain / URL routing
    motto: varchar("motto", { length: 255 }),
    registrationNumber: varchar("registration_number", { length: 100 }).unique(),
    knecCode: varchar("knec_code", { length: 50 }).unique(),
    schoolType: schoolTypeEnum("school_type").notNull(),
    curriculumType: curriculumTypeEnum("curriculum_type").default("CBC").notNull(),
    establishedYear: integer("established_year"),

    // -- Branding --
    logoUrl: text("logo_url"),
    faviconUrl: text("favicon_url"),
    coverImageUrl: text("cover_image_url"),
    primaryColor: varchar("primary_color", { length: 9 }).default("#0F172A").notNull(),
    secondaryColor: varchar("secondary_color", { length: 9 }).default("#64748B").notNull(),
    accentColor: varchar("accent_color", { length: 9 }),
    gradientFrom: varchar("gradient_from", { length: 9 }),
    gradientTo: varchar("gradient_to", { length: 9 }),
    gradientDirection: varchar("gradient_direction", { length: 20 }).default("to-r"),

    // -- Contact & location --
    address: text("address"),
    county: varchar("county", { length: 100 }),
    subCounty: varchar("sub_county", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    alternativePhone: varchar("alternative_phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    website: text("website"),

    // -- Localization / operations --
    timezone: varchar("timezone", { length: 50 }).default("Africa/Nairobi").notNull(),
    currency: varchar("currency", { length: 10 }).default("KES").notNull(),
    principalName: varchar("principal_name", { length: 150 }),

    // -- Subscription / limits --
    subscriptionPlan: subscriptionPlanEnum("subscription_plan").default("Trial").notNull(),
    subscriptionStatus: subscriptionStatusEnum("subscription_status").default("Active").notNull(),
    subscriptionExpiresAt: tz("subscription_expires_at"),
    maxStudents: integer("max_students"), // plan limit, null = unlimited
    smsCredits: integer("sms_credits").default(0).notNull(),
    // Per-school toggles, e.g. { "modules": { "library": true, "transport": false, "boarding": false } }
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tz("deleted_at"),
  },
  (table) => ({
    activeIdx: index("school_active_idx").on(table.isActive),
    // Billing job: "find schools expiring soon" only looks at active-ish rows.
    expiringIdx: index("school_expiring_idx")
      .on(table.subscriptionExpiresAt)
      .where(sql`${table.subscriptionStatus} IN ('Active', 'PastDue')`),
  })
);

export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
    plan: subscriptionPlanEnum("plan").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("KES").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    referenceCode: varchar("reference_code", { length: 100 }).unique().notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    paidAt: tz("paid_at").defaultNow().notNull(),
  },
  (table) => ({
    schoolIdx: index("sub_payment_school_idx").on(table.schoolId, table.periodEnd),
  })
);

// ==========================================
// 3. USERS & AUTHENTICATION MODULE
// ==========================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }), // null only for super_admin
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(), // enforced lower-case by CHECK below
    phone: varchar("phone", { length: 20 }),
    nationalId: varchar("national_id", { length: 20 }),
    tscNumber: varchar("tsc_number", { length: 50 }),
    admissionNumber: varchar("admission_number", { length: 50 }), // student login alias, must match students.admission_number
    avatarUrl: text("avatar_url"),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),

    // PRIMARY ROLE — display label only. Kept for backwards compatibility and UI.
    role: userRoleEnum("role").notNull(),

    // FULL SET OF ROLES — source of truth for permission checks.
    // A public-school principal who also runs the account gets
    // ["school_admin", "principal"]. A private-school IT admin gets
    // ["school_admin"]. A private-school head teacher gets ["principal"].
    roles: userRoleEnum("roles").array().notNull().default(sql`ARRAY[]::user_role[]`),

    isActive: boolean("is_active").default(true).notNull(),
    mustChangePassword: boolean("must_change_password").default(false).notNull(),
    emailVerifiedAt: tz("email_verified_at"),
    lastLoginAt: tz("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tz("deleted_at"),
  },
  (table) => ({
    // NOTE: no standalone school_id index; every composite below starts with it.
    schoolEmailIdx: uniqueIndex("user_school_email_idx").on(table.schoolId, table.email),
    platformEmailIdx: uniqueIndex("user_platform_email_idx").on(table.email).where(sql`${table.schoolId} IS NULL`),
    schoolNationalIdIdx: uniqueIndex("user_school_national_id_idx").on(table.schoolId, table.nationalId),
    schoolTscIdx: uniqueIndex("user_school_tsc_idx").on(table.schoolId, table.tscNumber),
    schoolAdmissionIdx: uniqueIndex("user_school_admission_idx").on(table.schoolId, table.admissionNumber),
    // Login happens before the school is known, so these cannot lead with school_id.
    emailLookupIdx: index("user_email_lookup_idx").on(table.email),
    admissionLookupIdx: index("user_admission_lookup_idx").on(table.admissionNumber),
    phoneLookupIdx: index("user_phone_lookup_idx").on(table.phone),
    // "list all teachers / parents / bursars in my school"
    schoolRoleIdx: index("user_school_role_idx").on(table.schoolId, table.role),
    schoolRequiredCheck: check(
      "user_school_required_chk",
      sql`${table.role} = 'super_admin' OR ${table.schoolId} IS NOT NULL`
    ),
    emailLowerCheck: check("user_email_lower_chk", sql`${table.email} = lower(${table.email})`),
    // Ensure `role` is always present in `roles` — prevents drift.
    roleInRolesCheck: check(
      "user_role_in_roles_chk",
      sql`${table.role} = ANY(${table.roles})`
    ),
  })
);

// NEW: server-side sessions / refresh tokens. Lets you "log out everywhere" and revoke access.
export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(), // store a hash, never the raw token
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    lastUsedAt: tz("last_used_at").defaultNow().notNull(),
    expiresAt: tz("expires_at").notNull(),
    revokedAt: tz("revoked_at"),
    createdAt: createdAt(),
  },
  (table) => ({
    activeByUserIdx: index("session_active_user_idx").on(table.userId).where(sql`${table.revokedAt} IS NULL`),
    expiryIdx: index("session_expiry_idx").on(table.expiresAt), // cleanup job
    schoolIdx: index("session_school_idx").on(table.schoolId),
  })
);

// NEW: password resets, email verification, phone OTPs, staff invites.
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), // null for invites sent before the user exists
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    identifier: varchar("identifier", { length: 255 }).notNull(), // email or phone
    purpose: tokenPurposeEnum("purpose").notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    attempts: integer("attempts").default(0).notNull(), // throttle OTP guessing
    expiresAt: tz("expires_at").notNull(),
    consumedAt: tz("consumed_at"),
    createdAt: createdAt(),
  },
  (table) => ({
    lookupIdx: index("vtoken_identifier_purpose_idx").on(table.identifier, table.purpose, table.expiresAt),
    tokenIdx: index("vtoken_hash_idx").on(table.tokenHash),
    userIdx: index("vtoken_user_idx").on(table.userId),
    expiryIdx: index("vtoken_expiry_idx").on(table.expiresAt),
  })
);

// ==========================================
// 4. ACADEMICS & CURRICULUM SETUP
// ==========================================

export const academicTerms = pgTable(
  "academic_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    academicYear: varchar("academic_year", { length: 20 }).notNull(),
    termName: varchar("term_name", { length: 50 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: termStatusEnum("status").default("upcoming").notNull(),
    isCurrentTerm: boolean("is_current_term").default(false).notNull(),
  },
  (table) => ({
    // Unique composite also serves "terms for school + year" (leading columns).
    uniqueTermIdx: uniqueIndex("term_unique_idx").on(table.schoolId, table.academicYear, table.termName),
    oneCurrentTermIdx: uniqueIndex("term_one_current_idx")
      .on(table.schoolId)
      .where(sql`${table.isCurrentTerm} = true`),
    datesCheck: check("term_dates_chk", sql`${table.endDate} > ${table.startDate}`),
  })
);

export const termWindows = pgTable(
  "term_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(),
    windowType: windowTypeEnum("window_type").notNull(),
    title: varchar("title", { length: 100 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
  },
  (table) => ({
    termWindowIdx: index("term_window_idx").on(table.termId, table.startDate),
    datesCheck: check("term_window_dates_chk", sql`${table.endDate} >= ${table.startDate}`),
  })
);

// NEW: ordered grade ladder per school. Powers year-end promotion
// (next_grade_level_id) and curriculum targeting.
export const gradeLevels = pgTable(
  "grade_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 50 }).notNull(), // "Grade 5"
    sortOrder: integer("sort_order").notNull(),
    educationStage: varchar("education_stage", { length: 50 }), // "Lower Primary", "Junior Secondary"
    nextGradeLevelId: uuid("next_grade_level_id").references((): AnyPgColumn => gradeLevels.id, {
      onDelete: "set null",
    }),
    isFinalGrade: boolean("is_final_grade").default(false).notNull(), // learners here "Graduate" instead of promoting
  },
  (table) => ({
    schoolNameIdx: uniqueIndex("grade_level_school_name_idx").on(table.schoolId, table.name),
    schoolOrderIdx: index("grade_level_school_order_idx").on(table.schoolId, table.sortOrder),
  })
);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    gradeLevelId: uuid("grade_level_id")
      .references(() => gradeLevels.id, { onDelete: "restrict" })
      .notNull(),
    stream: varchar("stream", { length: 50 }).notNull(),
    classTeacherId: uuid("class_teacher_id").references(() => users.id, { onDelete: "set null" }),
    academicYear: varchar("academic_year", { length: 20 }).notNull(),
    capacity: integer("capacity"),
  },
  (table) => ({
    schoolClassIdx: uniqueIndex("class_school_year_grade_stream_idx").on(
      table.schoolId,
      table.academicYear,
      table.gradeLevelId,
      table.stream
    ),
    teacherIdx: index("class_teacher_idx").on(table.classTeacherId),
    gradeLevelIdx: index("class_grade_level_idx").on(table.gradeLevelId),
  })
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    category: subjectCategoryEnum("category").notNull(),
  },
  (table) => ({
    schoolSubjectCodeIdx: uniqueIndex("subject_school_code_idx").on(table.schoolId, table.code),
  })
);

export const teacherSubjects = pgTable(
  "teacher_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
  },
  (table) => ({
    teacherSubjectIdx: uniqueIndex("teacher_subject_idx").on(table.teacherId, table.subjectId),
    subjectIdx: index("teacher_subject_subject_idx").on(table.subjectId),
  })
);

export const classSubjects = pgTable(
  "class_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    classSubjectIdx: uniqueIndex("class_subject_unique_idx").on(table.classId, table.subjectId),
    schoolIdx: index("class_subject_school_idx").on(table.schoolId),
    teacherIdx: index("class_subject_teacher_idx").on(table.teacherId),
    subjectIdx: index("class_subject_subject_idx").on(table.subjectId),
  })
);

// NEW: the school's bell schedule (period 1 = 8:00-8:40, break, etc.).
export const periods = pgTable(
  "periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    periodNumber: integer("period_number").notNull(),
    name: varchar("name", { length: 50 }).notNull(), // "Period 1", "Lunch"
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isBreak: boolean("is_break").default(false).notNull(),
  },
  (table) => ({
    schoolPeriodIdx: uniqueIndex("period_school_number_idx").on(table.schoolId, table.periodNumber),
  })
);

export const timetables = pgTable(
  "timetables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
    dayOfWeek: weekdayEnum("day_of_week").notNull(),
    periodNumber: integer("period_number").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
    room: varchar("room", { length: 50 }),
    updatedAt: updatedAt(),
  },
  (table) => ({
    classSlotIdx: uniqueIndex("timetable_class_slot_idx").on(table.classId, table.dayOfWeek, table.periodNumber),
    // "What is teacher X teaching today?" (teacher_id first, then day)
    teacherDayIdx: index("timetable_teacher_day_idx").on(table.teacherId, table.dayOfWeek, table.periodNumber),
    schoolIdx: index("timetable_school_idx").on(table.schoolId),
    subjectIdx: index("timetable_subject_idx").on(table.subjectId),
  })
);

// NEW: curriculum content. Seed these from a platform template when a school onboards.
export const curriculumStrands = pgTable(
  "curriculum_strands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
    gradeLevelId: uuid("grade_level_id").references(() => gradeLevels.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => ({
    uniqueStrandIdx: uniqueIndex("strand_unique_idx").on(table.subjectId, table.gradeLevelId, table.name),
    schoolIdx: index("strand_school_idx").on(table.schoolId),
    gradeIdx: index("strand_grade_idx").on(table.gradeLevelId),
  })
);

export const curriculumSubStrands = pgTable(
  "curriculum_sub_strands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    strandId: uuid("strand_id").references(() => curriculumStrands.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    learningOutcomes: text("learning_outcomes"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => ({
    uniqueSubStrandIdx: uniqueIndex("sub_strand_unique_idx").on(table.strandId, table.name),
    schoolIdx: index("sub_strand_school_idx").on(table.schoolId),
  })
);

// NEW: grading scales for non-CBC (8-4-4, IGCSE) and custom report cards.
export const gradingScales = pgTable(
  "grading_scales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 100 }).notNull(), // "KCSE Grading", "Percentage A-E"
    description: text("description"),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    schoolNameIdx: uniqueIndex("grading_scale_school_name_idx").on(table.schoolId, table.name),
    oneDefaultIdx: uniqueIndex("grading_scale_one_default_idx")
      .on(table.schoolId)
      .where(sql`${table.isDefault} = true`),
  })
);

export const gradingBands = pgTable(
  "grading_bands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scaleId: uuid("scale_id").references(() => gradingScales.id, { onDelete: "cascade" }).notNull(),
    minScore: decimal("min_score", { precision: 5, scale: 2 }).notNull(),
    maxScore: decimal("max_score", { precision: 5, scale: 2 }).notNull(),
    grade: varchar("grade", { length: 10 }).notNull(), // "A", "B+", "EE"
    points: integer("points"),
    descriptor: varchar("descriptor", { length: 100 }), // "Exceeds Expectations"
    remark: text("remark"), // default report-card comment for this band
  },
  (table) => ({
    lookupIdx: index("grading_band_lookup_idx").on(table.scaleId, table.minScore, table.maxScore),
    rangeCheck: check("grading_band_range_chk", sql`${table.maxScore} >= ${table.minScore}`),
  })
);

// NEW: schemes of work and lesson plans, with coverage tracking.
export const schemesOfWork = pgTable(
  "schemes_of_work",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    status: approvalStatusEnum("status").default("Draft").notNull(),
    submittedAt: tz("submitted_at"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: tz("approved_at"),
    reviewComments: text("review_comments"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    uniqueSchemeIdx: uniqueIndex("scheme_unique_idx").on(table.termId, table.classId, table.subjectId),
    // Head-of-department approval queue
    reviewQueueIdx: index("scheme_review_queue_idx")
      .on(table.schoolId, table.termId)
      .where(sql`${table.status} = 'Submitted'`),
    teacherIdx: index("scheme_teacher_idx").on(table.teacherId, table.termId),
    classIdx: index("scheme_class_idx").on(table.classId),
  })
);

export const schemeOfWorkEntries = pgTable(
  "scheme_of_work_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemeId: uuid("scheme_id").references(() => schemesOfWork.id, { onDelete: "cascade" }).notNull(),
    strandId: uuid("strand_id").references(() => curriculumStrands.id, { onDelete: "set null" }),
    subStrandId: uuid("sub_strand_id").references(() => curriculumSubStrands.id, { onDelete: "set null" }),
    weekNumber: integer("week_number").notNull(),
    lessonNumber: integer("lesson_number").default(1).notNull(),
    topic: varchar("topic", { length: 255 }).notNull(),
    objectives: text("objectives"),
    learningActivities: text("learning_activities"),
    resources: text("resources"),
    assessmentMethods: text("assessment_methods"),
    remarks: text("remarks"),
    isCovered: boolean("is_covered").default(false).notNull(), // syllabus coverage tracking
    coveredOn: date("covered_on"),
  },
  (table) => ({
    uniqueEntryIdx: uniqueIndex("scheme_entry_unique_idx").on(table.schemeId, table.weekNumber, table.lessonNumber),
    strandIdx: index("scheme_entry_strand_idx").on(table.strandId),
  })
);

export const lessonPlans = pgTable(
  "lesson_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    schemeEntryId: uuid("scheme_entry_id").references(() => schemeOfWorkEntries.id, { onDelete: "set null" }),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
    lessonDate: date("lesson_date").notNull(),
    topic: varchar("topic", { length: 255 }).notNull(),
    objectives: text("objectives"),
    introduction: text("introduction"),
    development: text("development"),
    conclusion: text("conclusion"),
    resources: text("resources"),
    assessment: text("assessment"),
    reflection: text("reflection"), // filled after the lesson
    status: approvalStatusEnum("status").default("Draft").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    teacherDateIdx: index("lesson_plan_teacher_date_idx").on(table.teacherId, table.lessonDate),
    classDateIdx: index("lesson_plan_class_date_idx").on(table.classId, table.lessonDate),
    schoolDateIdx: index("lesson_plan_school_date_idx").on(table.schoolId, table.lessonDate),
  })
);

// ==========================================
// 5. STUDENT & ENROLLMENT MANAGEMENT
// ==========================================

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    admissionNumber: varchar("admission_number", { length: 50 }).notNull(),
    upiNumber: varchar("upi_number", { length: 100 }),

    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    gender: genderEnum("gender"),
    dateOfBirth: date("date_of_birth"),
    birthCertificateNumber: varchar("birth_certificate_number", { length: 50 }),
    nationality: varchar("nationality", { length: 50 }).default("Kenyan"),
    photoUrl: text("photo_url"),
    boardingStatus: boardingStatusEnum("boarding_status").default("Day").notNull(),

    medicalNotes: text("medical_notes"),
    specialNeeds: text("special_needs"),
    previousSchool: varchar("previous_school", { length: 255 }),

    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    enrollmentDate: date("enrollment_date").defaultNow().notNull(),
    exitDate: date("exit_date"),
    exitReason: text("exit_reason"),
    isEnrolled: boolean("is_enrolled").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tz("deleted_at"),
  },
  (table) => ({
    schoolAdmNoIdx: uniqueIndex("student_school_adm_idx").on(table.schoolId, table.admissionNumber),
    schoolUpiIdx: uniqueIndex("student_school_upi_idx").on(table.schoolId, table.upiNumber),
    userIdIdx: uniqueIndex("student_user_idx").on(table.userId),
    classIdx: index("student_class_idx").on(table.classId),
    // Hot path: "list the enrolled learners in this class" (small partial index)
    activeRosterIdx: index("student_active_roster_idx")
      .on(table.schoolId, table.classId)
      .where(sql`${table.isEnrolled} = true AND ${table.deletedAt} IS NULL`),
    nameIdx: index("student_name_idx").on(table.schoolId, table.lastName, table.firstName),
  })
);

export const studentGuardians = pgTable(
  "student_guardians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    guardianUserId: uuid("guardian_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    relationship: guardianRelationshipEnum("relationship").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    isFeePayer: boolean("is_fee_payer").default(false).notNull(),
    canPickup: boolean("can_pickup").default(true).notNull(),
  },
  (table) => ({
    studentGuardianIdx: uniqueIndex("student_guardian_unique_idx").on(table.studentId, table.guardianUserId),
    // "Show a parent all of their children" - the main parent-portal query
    guardianIdx: index("student_guardian_user_idx").on(table.guardianUserId),
    schoolIdx: index("student_guardian_school_idx").on(table.schoolId),
    onePrimaryIdx: uniqueIndex("student_one_primary_idx")
      .on(table.studentId)
      .where(sql`${table.isPrimary} = true`),
  })
);

export const studentEnrollmentHistory = pgTable(
  "student_enrollment_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "restrict" }).notNull(),
    status: enrollmentStatusEnum("status").default("Active").notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    historyIdx: uniqueIndex("student_history_unique_idx").on(table.studentId, table.termId),
    classTermIdx: index("student_history_class_term_idx").on(table.classId, table.termId),
    schoolTermIdx: index("student_history_school_term_idx").on(table.schoolId, table.termId),
  })
);

// NEW: uploaded files (birth certificates, transfer letters, circulars).
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }), // null = school-wide document
    category: documentCategoryEnum("category").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: varchar("file_name", { length: 255 }),
    mimeType: varchar("mime_type", { length: 100 }),
    sizeBytes: integer("size_bytes"),
    isVisibleToParent: boolean("is_visible_to_parent").default(false).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => ({
    studentIdx: index("document_student_idx").on(table.studentId, table.category),
    schoolCategoryIdx: index("document_school_category_idx").on(table.schoolId, table.category, table.createdAt),
  })
);

// NEW: sick-bay visits, allergies, vaccinations.
export const studentHealthRecords = pgTable(
  "student_health_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    recordType: healthRecordTypeEnum("record_type").notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    description: text("description"),
    treatment: text("treatment"),
    followUpDate: date("follow_up_date"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    recordedAt: tz("recorded_at").defaultNow().notNull(),
  },
  (table) => ({
    studentIdx: index("health_student_idx").on(table.studentId, table.recordedAt),
    schoolTypeIdx: index("health_school_type_idx").on(table.schoolId, table.recordType),
  })
);

// ==========================================
// 6. FINANCE, FEES & EXPENSES MODULE
// ==========================================

export const feeItems = pgTable(
  "fee_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isOptional: boolean("is_optional").default(false).notNull(),
  },
  (table) => ({
    schoolFeeItemIdx: uniqueIndex("fee_item_school_name_idx").on(table.schoolId, table.name),
  })
);

export const classFeeStructures = pgTable(
  "class_fee_structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(),

    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    gradeLevelId: uuid("grade_level_id").references(() => gradeLevels.id, { onDelete: "restrict" }),

    feeItemId: uuid("fee_item_id").references(() => feeItems.id, { onDelete: "cascade" }).notNull(),
    boardingStatus: boardingStatusEnum("boarding_status").default("Day").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  },
  (table) => ({
    // Three partial unique indexes instead of one — same guarantee:
    // 1. School-wide: no grade, no class
    schoolWideUniqueIdx: uniqueIndex("class_fee_structure_schoolwide_idx")
      .on(table.termId, table.feeItemId, table.boardingStatus)
      .where(sql`${table.gradeLevelId} IS NULL AND ${table.classId} IS NULL`),

    // 2. Grade-wide: grade set, no class
    gradeWideUniqueIdx: uniqueIndex("class_fee_structure_gradewide_idx")
      .on(table.termId, table.feeItemId, table.boardingStatus, table.gradeLevelId)
      .where(sql`${table.gradeLevelId} IS NOT NULL AND ${table.classId} IS NULL`),

    // 3. Class-specific: both set
    classSpecificUniqueIdx: uniqueIndex("class_fee_structure_classspecific_idx")
      .on(table.termId, table.feeItemId, table.boardingStatus, table.gradeLevelId, table.classId)
      .where(sql`${table.gradeLevelId} IS NOT NULL AND ${table.classId} IS NOT NULL`),

    // Non-unique indexes — unchanged
    schoolTermIdx: index("class_fee_structure_school_idx").on(table.schoolId, table.termId),
    feeItemIdx: index("class_fee_structure_item_idx").on(table.feeItemId),
    gradeLevelIdx: index("class_fee_structure_grade_idx").on(table.gradeLevelId),
    classIdx: index("class_fee_structure_class_idx").on(table.classId),
    boardingIdx: index("class_fee_structure_boarding_idx").on(table.schoolId, table.boardingStatus),
    amountCheck: check("class_fee_amount_chk", sql`${table.amount} >= 0`),
  })
);

export const studentInvoices = pgTable(
  "student_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "restrict" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "restrict" }).notNull(),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0").notNull(),
    status: invoiceStatusEnum("status").default("Unpaid").notNull(),
    dueDate: date("due_date"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    schoolInvoiceNoIdx: uniqueIndex("invoice_school_number_idx").on(table.schoolId, table.invoiceNumber),
    studentTermIdx: index("invoice_student_term_idx").on(table.studentId, table.termId),
    // Arrears dashboard / reminders: only unpaid-ish invoices (small, fast)
    openInvoicesIdx: index("invoice_open_idx")
      .on(table.schoolId, table.termId, table.dueDate)
      .where(sql`${table.status} IN ('Unpaid', 'Partial', 'Overdue')`),
    amountCheck: check("invoice_amount_chk", sql`${table.totalAmount} >= 0 AND ${table.discountAmount} >= 0`),
  })
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").references(() => studentInvoices.id, { onDelete: "cascade" }).notNull(),
    feeItemId: uuid("fee_item_id").references(() => feeItems.id, { onDelete: "set null" }),
    description: varchar("description", { length: 150 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  },
  (table) => ({
    invoiceIdx: index("invoice_item_invoice_idx").on(table.invoiceId),
  })
);

export const feeTransactions = pgTable(
  "fee_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "restrict" }).notNull(),
    invoiceId: uuid("invoice_id").references(() => studentInvoices.id, { onDelete: "set null" }),
    amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
    balanceRemaining: decimal("balance_remaining", { precision: 10, scale: 2 }).notNull(), // snapshot for receipts only
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    status: paymentStatusEnum("status").default("Completed").notNull(),
    referenceCode: varchar("reference_code", { length: 100 }).notNull(),
    mpesaCheckoutRequestId: varchar("mpesa_checkout_request_id", { length: 100 }),
    payerName: varchar("payer_name", { length: 150 }),
    payerPhone: varchar("payer_phone", { length: 20 }),
    notes: text("notes"),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "restrict" }).notNull(),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    transactionDate: tz("transaction_date").defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    schoolRefCodeIdx: uniqueIndex("fee_school_ref_idx").on(table.schoolId, table.referenceCode),
    studentFeeIdx: index("fee_student_idx").on(table.studentId, table.termId),
    invoiceIdx: index("fee_invoice_idx").on(table.invoiceId),
    schoolDateIdx: index("fee_school_date_idx").on(table.schoolId, table.transactionDate),
    // M-Pesa callback lookup: only pending STK pushes
    pendingCheckoutIdx: index("fee_pending_checkout_idx")
      .on(table.mpesaCheckoutRequestId)
      .where(sql`${table.status} = 'Pending'`),
    amountCheck: check("fee_amount_chk", sql`${table.amountPaid} > 0`),
  })
);

export const schoolExpenses = pgTable(
  "school_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    category: expenseCategoryEnum("category").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    referenceCode: varchar("reference_code", { length: 100 }),
    receiptUrl: text("receipt_url"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "restrict" }).notNull(),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    expenseDate: date("expense_date").notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    schoolExpenseRefIdx: uniqueIndex("expense_school_ref_idx").on(table.schoolId, table.referenceCode),
    schoolDateIdx: index("expense_school_date_idx").on(table.schoolId, table.expenseDate),
    schoolCategoryIdx: index("expense_school_category_idx").on(table.schoolId, table.category, table.expenseDate),
    amountCheck: check("expense_amount_chk", sql`${table.amount} > 0`),
  })
);

// ==========================================
// 7. EXAMINATIONS & ASSESSMENTS
// ==========================================

export const termExams = pgTable(
  "term_exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(),
    examTitle: varchar("exam_title", { length: 100 }).notNull(),
    examCategory: examCategoryEnum("exam_category").notNull(),
    weighting: decimal("weighting", { precision: 5, scale: 2 }),
    gradingScaleId: uuid("grading_scale_id").references(() => gradingScales.id, { onDelete: "set null" }), // null = school default
    startDate: date("start_date"),
    endDate: date("end_date"),
    isLocked: boolean("is_locked").default(false).notNull(),
  },
  (table) => ({
    schoolTermIdx: index("term_exam_school_term_idx").on(table.schoolId, table.termId),
  })
);

// NEW: exam timetable (which class sits which paper when, where, who invigilates).
export const examSchedules = pgTable(
  "exam_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    examId: uuid("exam_id").references(() => termExams.id, { onDelete: "cascade" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
    examDate: date("exam_date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    venue: varchar("venue", { length: 100 }),
    invigilatorId: uuid("invigilator_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    uniquePaperIdx: uniqueIndex("exam_schedule_unique_idx").on(table.examId, table.classId, table.subjectId),
    schoolDateIdx: index("exam_schedule_school_date_idx").on(table.schoolId, table.examDate),
    invigilatorIdx: index("exam_schedule_invigilator_idx").on(table.invigilatorId, table.examDate),
    classIdx: index("exam_schedule_class_idx").on(table.classId),
  })
);

// NEW: marks-based results (8-4-4 / IGCSE / any numeric exam). CBC strand ratings stay in cbc_assessments.
export const examResults = pgTable(
  "exam_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    examId: uuid("exam_id").references(() => termExams.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "restrict" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    marks: decimal("marks", { precision: 5, scale: 2 }),
    outOf: decimal("out_of", { precision: 5, scale: 2 }).default("100").notNull(),
    isAbsent: boolean("is_absent").default(false).notNull(), // absent is not the same as zero
    grade: varchar("grade", { length: 10 }),
    points: integer("points"),
    subjectPosition: integer("subject_position"),
    remarks: text("remarks"),
    enteredBy: uuid("entered_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    uniqueResultIdx: uniqueIndex("exam_result_unique_idx").on(table.examId, table.studentId, table.subjectId),
    // Learner transcript / report card: all results for a student
    studentExamIdx: index("exam_result_student_exam_idx").on(table.studentId, table.examId),
    // Class mark sheet / ranking: one subject across an exam
    markSheetIdx: index("exam_result_marksheet_idx").on(table.schoolId, table.examId, table.subjectId),
    classIdx: index("exam_result_class_idx").on(table.classId, table.examId),
    marksCheck: check(
      "exam_result_marks_chk",
      sql`${table.marks} IS NULL OR (${table.marks} >= 0 AND ${table.marks} <= ${table.outOf})`
    ),
  })
);

export const cbcAssessments = pgTable(
  "cbc_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "restrict" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "restrict" }).notNull(),
    examId: uuid("exam_id").references(() => termExams.id, { onDelete: "cascade" }).notNull(),
    // Optional links to the curriculum tables; text columns stay for free-text / legacy rows.
    strandId: uuid("strand_id").references(() => curriculumStrands.id, { onDelete: "set null" }),
    subStrandId: uuid("sub_strand_id").references(() => curriculumSubStrands.id, { onDelete: "set null" }),
    strand: varchar("strand", { length: 255 }).notNull(),
    subStrand: varchar("sub_strand", { length: 255 }),
    scoreValue: decimal("score_value", { precision: 5, scale: 2 }),
    outOf: decimal("out_of", { precision: 5, scale: 2 }),
    performanceLevel: performanceLevelEnum("performance_level").notNull(),
    teacherRemarks: text("teacher_remarks"),
    assessedBy: uuid("assessed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    studentExamSubjectStrandIdx: uniqueIndex("student_exam_subject_strand_idx").on(
      table.studentId,
      table.examId,
      table.subjectId,
      table.strand
    ),
    studentTermIdx: index("cbc_student_term_idx").on(table.studentId, table.termId),
    examSubjectIdx: index("cbc_exam_subject_idx").on(table.examId, table.subjectId),
    schoolTermSubjectIdx: index("cbc_school_term_subject_idx").on(table.schoolId, table.termId, table.subjectId),
    scoreCheck: check(
      "cbc_score_chk",
      sql`${table.scoreValue} IS NULL OR ${table.outOf} IS NULL OR (${table.scoreValue} >= 0 AND ${table.scoreValue} <= ${table.outOf})`
    ),
  })
);

export const reportCards = pgTable(
  "report_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "restrict" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "restrict" }).notNull(),
    meanScore: decimal("mean_score", { precision: 5, scale: 2 }),
    classPosition: integer("class_position"),
    streamSize: integer("stream_size"),
    attendanceDays: integer("attendance_days"),
    classTeacherRemarks: text("class_teacher_remarks"),
    principalRemarks: text("principal_remarks"),
    isPublished: boolean("is_published").default(false).notNull(),
    publishedAt: tz("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    studentTermIdx: uniqueIndex("report_card_student_term_idx").on(table.studentId, table.termId),
    classTermIdx: index("report_card_class_term_idx").on(table.classId, table.termId),
    schoolTermIdx: index("report_card_school_term_idx").on(table.schoolId, table.termId),
  })
);

// ==========================================
// 8. ATTENDANCE & DISCIPLINE
// ==========================================

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    remarks: varchar("remarks", { length: 255 }),
    markedBy: uuid("marked_by").references(() => users.id, { onDelete: "restrict" }).notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    studentDateIdx: uniqueIndex("attendance_student_date_idx").on(table.studentId, table.date),
    classDateIdx: index("attendance_class_date_idx").on(table.classId, table.date),
    schoolDateIdx: index("attendance_school_date_idx").on(table.schoolId, table.date),
    // "Who was absent today?" - the SMS-alert query; excludes the (huge) Present majority.
    absenceIdx: index("attendance_absence_idx")
      .on(table.schoolId, table.date)
      .where(sql`${table.status} IN ('Absent', 'Late')`),
  })
);

export const disciplinaryRecords = pgTable(
  "disciplinary_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "restrict" }).notNull(),
    incidentType: disciplineIncidentEnum("incident_type").notNull(),
    description: text("description").notNull(),
    actionTaken: text("action_taken"),
    parentNotified: boolean("parent_notified").default(false).notNull(),
    date: tz("date").defaultNow().notNull(),
  },
  (table) => ({
    studentDisciplineIdx: index("discipline_student_idx").on(table.studentId, table.date),
    schoolDateIdx: index("discipline_school_date_idx").on(table.schoolId, table.date),
  })
);

// ==========================================
// 9. LIBRARY, INVENTORY & STUDENT SERVICES
// ==========================================

export const schoolInventory = pgTable(
  "school_inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    itemName: varchar("item_name", { length: 150 }).notNull(),
    category: inventoryCategoryEnum("category").notNull(),
    isbn: varchar("isbn", { length: 20 }),
    author: varchar("author", { length: 150 }),
    totalQuantity: integer("total_quantity").notNull(),
    availableQuantity: integer("available_quantity").notNull(),
    unitCondition: varchar("unit_condition", { length: 50 }).default("Good").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    schoolCategoryIdx: index("inventory_school_category_idx").on(table.schoolId, table.category),
    schoolIsbnIdx: index("inventory_school_isbn_idx").on(table.schoolId, table.isbn),
    quantityCheck: check(
      "inventory_qty_chk",
      sql`${table.availableQuantity} >= 0 AND ${table.availableQuantity} <= ${table.totalQuantity}`
    ),
  })
);

export const libraryLoans = pgTable(
  "library_loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    inventoryId: uuid("inventory_id").references(() => schoolInventory.id, { onDelete: "restrict" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    issuedBy: uuid("issued_by").references(() => users.id, { onDelete: "set null" }),
    borrowDate: date("borrow_date").defaultNow().notNull(),
    dueDate: date("due_date").notNull(),
    returnDate: date("return_date"),
    fineAmount: decimal("fine_amount", { precision: 8, scale: 2 }).default("0").notNull(),
    status: loanStatusEnum("status").default("Borrowed").notNull(),
  },
  (table) => ({
    studentIdx: index("library_student_idx").on(table.studentId),
    inventoryIdx: index("library_inventory_idx").on(table.inventoryId),
    // Overdue sweep: only loans still out
    openLoansIdx: index("library_open_loans_idx")
      .on(table.schoolId, table.dueDate)
      .where(sql`${table.status} IN ('Borrowed', 'Overdue')`),
  })
);

// NEW: school transport (optional module).
export const transportRoutes = pgTable(
  "transport_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 100 }).notNull(), // "Route A - Kasarani"
    vehicleRegistration: varchar("vehicle_registration", { length: 20 }),
    driverName: varchar("driver_name", { length: 150 }),
    driverPhone: varchar("driver_phone", { length: 20 }),
    capacity: integer("capacity"),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => ({
    schoolNameIdx: uniqueIndex("transport_route_school_name_idx").on(table.schoolId, table.name),
  })
);

export const studentTransport = pgTable(
  "student_transport",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    routeId: uuid("route_id").references(() => transportRoutes.id, { onDelete: "cascade" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(),
    pickupPoint: varchar("pickup_point", { length: 150 }),
  },
  (table) => ({
    studentTermIdx: uniqueIndex("student_transport_student_term_idx").on(table.studentId, table.termId),
    routeTermIdx: index("student_transport_route_term_idx").on(table.routeId, table.termId),
    schoolIdx: index("student_transport_school_idx").on(table.schoolId),
  })
);

// NEW: boarding (optional module).
export const dormitories = pgTable(
  "dormitories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    gender: genderEnum("gender"),
    capacity: integer("capacity"),
    wardenId: uuid("warden_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    schoolNameIdx: uniqueIndex("dormitory_school_name_idx").on(table.schoolId, table.name),
    wardenIdx: index("dormitory_warden_idx").on(table.wardenId),
  })
);

export const boardingAssignments = pgTable(
  "boarding_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    dormitoryId: uuid("dormitory_id").references(() => dormitories.id, { onDelete: "cascade" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(),
    bedNumber: varchar("bed_number", { length: 20 }),
  },
  (table) => ({
    studentTermIdx: uniqueIndex("boarding_student_term_idx").on(table.studentId, table.termId),
    bedIdx: uniqueIndex("boarding_bed_unique_idx").on(table.dormitoryId, table.termId, table.bedNumber),
    schoolIdx: index("boarding_school_idx").on(table.schoolId),
  })
);

// ==========================================
// 10. HOMEWORK & ASSIGNMENTS
// ==========================================

export const homeworkAssignments = pgTable(
  "homework_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    attachmentUrl: text("attachment_url"),
    maxScore: decimal("max_score", { precision: 5, scale: 2 }),
    dueDate: tz("due_date").notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    classDueIdx: index("homework_class_due_idx").on(table.classId, table.dueDate),
    teacherIdx: index("homework_teacher_idx").on(table.teacherId, table.dueDate),
    schoolIdx: index("homework_school_idx").on(table.schoolId, table.createdAt),
    subjectIdx: index("homework_subject_idx").on(table.subjectId),
  })
);

export const homeworkSubmissions = pgTable(
  "homework_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    assignmentId: uuid("assignment_id").references(() => homeworkAssignments.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    submissionText: text("submission_text"),
    attachmentUrl: text("attachment_url"),
    status: assignmentStatusEnum("status").default("Pending").notNull(),
    gradeScore: decimal("grade_score", { precision: 5, scale: 2 }),
    teacherFeedback: text("teacher_feedback"),
    submittedAt: tz("submitted_at"),
    gradedAt: tz("graded_at"),
  },
  (table) => ({
    assignmentStudentIdx: uniqueIndex("submission_assignment_student_idx").on(table.assignmentId, table.studentId),
    studentIdx: index("submission_student_idx").on(table.studentId, table.status),
    schoolIdx: index("submission_school_idx").on(table.schoolId),
    // Teacher "needs marking" queue
    toGradeIdx: index("submission_to_grade_idx")
      .on(table.assignmentId)
      .where(sql`${table.status} = 'Submitted'`),
  })
);

// ==========================================
// 11. COMMUNICATIONS, NOTIFICATIONS & MEETINGS
// ==========================================

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    targetAudience: audienceEnum("target_audience").notNull(),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
    sendViaSms: boolean("send_via_sms").default(false).notNull(),
    expiresAt: tz("expires_at"),
    createdAt: createdAt(),
  },
  (table) => ({
    schoolAudienceIdx: index("announcement_school_audience_idx").on(
      table.schoolId,
      table.targetAudience,
      table.createdAt
    ),
    classIdx: index("announcement_class_idx").on(table.classId),
  })
);

export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    receiverId: uuid("receiver_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    messageText: text("message_text").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: tz("read_at"),
    sentAt: tz("sent_at").defaultNow().notNull(),
  },
  (table) => ({
    threadIdx: index("message_thread_idx").on(table.senderId, table.receiverId, table.sentAt),
    inboxIdx: index("message_inbox_idx").on(table.receiverId, table.sentAt),
    unreadIdx: index("message_unread_idx").on(table.receiverId).where(sql`${table.isRead} = false`),
    schoolIdx: index("message_school_idx").on(table.schoolId),
  })
);

// NEW: in-app notification feed (bell icon / push).
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    data: jsonb("data").$type<Record<string, unknown>>(), // deep-link payload e.g. { invoiceId }
    readAt: tz("read_at"),
    createdAt: createdAt(),
  },
  (table) => ({
    feedIdx: index("notification_feed_idx").on(table.userId, table.createdAt),
    unreadIdx: index("notification_unread_idx").on(table.userId).where(sql`${table.readAt} IS NULL`),
    schoolIdx: index("notification_school_idx").on(table.schoolId),
  })
);

// NEW: parent-teacher meeting booking.
export const meetingSlots = pgTable(
  "meeting_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    bookedBy: uuid("booked_by").references(() => users.id, { onDelete: "set null" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
    startsAt: tz("starts_at").notNull(),
    endsAt: tz("ends_at").notNull(),
    status: meetingSlotStatusEnum("status").default("Open").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (table) => ({
    teacherSlotIdx: uniqueIndex("meeting_teacher_start_idx").on(table.teacherId, table.startsAt),
    openSlotsIdx: index("meeting_open_idx")
      .on(table.schoolId, table.startsAt)
      .where(sql`${table.status} = 'Open'`),
    bookedByIdx: index("meeting_booked_by_idx").on(table.bookedBy),
    timeCheck: check("meeting_time_chk", sql`${table.endsAt} > ${table.startsAt}`),
  })
);

export const smsLogs = pgTable(
  "sms_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
    announcementId: uuid("announcement_id").references(() => announcements.id, { onDelete: "set null" }),
    phone: varchar("phone", { length: 20 }).notNull(),
    message: text("message").notNull(),
    status: smsStatusEnum("status").default("Queued").notNull(),
    providerMessageId: varchar("provider_message_id", { length: 100 }),
    cost: decimal("cost", { precision: 8, scale: 4 }),
    errorMessage: text("error_message"),
    createdAt: createdAt(),
  },
  (table) => ({
    schoolDateIdx: index("sms_school_date_idx").on(table.schoolId, table.createdAt),
    providerIdx: index("sms_provider_idx").on(table.providerMessageId),
    announcementIdx: index("sms_announcement_idx").on(table.announcementId),
    // Retry worker: only queued / failed messages
    retryIdx: index("sms_retry_idx")
      .on(table.createdAt)
      .where(sql`${table.status} IN ('Queued', 'Failed')`),
    // Time-range scans on a huge append-only table
    createdBrinIdx: index("sms_created_brin_idx").using("brin", table.createdAt),
  })
);

// ==========================================
// 12. SCHOOL EVENTS & CO-CURRICULAR ACTIVITIES
// ==========================================

export const schoolEvents = pgTable(
  "school_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    category: eventCategoryEnum("category").notNull(),
    location: varchar("location", { length: 150 }),
    startDate: tz("start_date").notNull(),
    endDate: tz("end_date").notNull(),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    schoolEventIdx: index("event_school_idx").on(table.schoolId, table.startDate),
    datesCheck: check("event_dates_chk", sql`${table.endDate} >= ${table.startDate}`),
  })
);

export const coCurricularActivities = pgTable(
  "co_curricular_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    patronTeacherId: uuid("patron_teacher_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    schoolActivityIdx: index("activity_school_idx").on(table.schoolId),
    patronIdx: index("activity_patron_idx").on(table.patronTeacherId),
  })
);

export const studentActivityMemberships = pgTable(
  "student_activity_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
    activityId: uuid("activity_id").references(() => coCurricularActivities.id, { onDelete: "cascade" }).notNull(),
    termId: uuid("term_id").references(() => academicTerms.id, { onDelete: "cascade" }).notNull(),
    performanceRole: varchar("performance_role", { length: 100 }),
  },
  (table) => ({
    membershipIdx: uniqueIndex("membership_unique_idx").on(table.studentId, table.activityId, table.termId),
    activityTermIdx: index("membership_activity_term_idx").on(table.activityId, table.termId),
    schoolIdx: index("membership_school_idx").on(table.schoolId),
  })
);

// ==========================================
// 13. PLATFORM PLUMBING: IMPORTS, WEBHOOKS, AUDIT
// ==========================================

// NEW: bulk CSV import tracking (students, marks, fees). Schools onboard by importing.
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    type: importJobTypeEnum("type").notNull(),
    status: importStatusEnum("status").default("Queued").notNull(),
    fileUrl: text("file_url").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    successRows: integer("success_rows").default(0).notNull(),
    failedRows: integer("failed_rows").default(0).notNull(),
    errors: jsonb("errors").$type<Array<{ row: number; message: string }>>(),
    createdAt: createdAt(),
    completedAt: tz("completed_at"),
  },
  (table) => ({
    schoolDateIdx: index("import_school_date_idx").on(table.schoolId, table.createdAt),
    activeIdx: index("import_active_idx")
      .on(table.createdAt)
      .where(sql`${table.status} IN ('Queued', 'Processing')`),
  })
);

// NEW: raw inbound webhooks (M-Pesa, SMS delivery reports). The unique key makes retries idempotent,
// so a callback delivered twice can never double-credit a payment.
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "set null" }),
    provider: varchar("provider", { length: 50 }).notNull(), // "mpesa", "africastalking"
    eventId: varchar("event_id", { length: 150 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: tz("received_at").defaultNow().notNull(),
    processedAt: tz("processed_at"),
    error: text("error"),
  },
  (table) => ({
    uniqueEventIdx: uniqueIndex("webhook_provider_event_idx").on(table.provider, table.eventId),
    unprocessedIdx: index("webhook_unprocessed_idx").on(table.receivedAt).where(sql`${table.processedAt} IS NULL`),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    timestamp: tz("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    schoolTimeIdx: index("audit_school_time_idx").on(table.schoolId, table.timestamp),
    entityIdx: index("audit_entity_idx").on(table.entityType, table.entityId),
    userIdx: index("audit_user_idx").on(table.userId, table.timestamp),
    timeBrinIdx: index("audit_time_brin_idx").using("brin", table.timestamp),
  })
);

// ==========================================
// RELATIONS
// ==========================================

export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  academicTerms: many(academicTerms),
  gradeLevels: many(gradeLevels),
  classes: many(classes),
  subjects: many(subjects),
  timetables: many(timetables),
  students: many(students),
  feeItems: many(feeItems),
  studentInvoices: many(studentInvoices),
  feeTransactions: many(feeTransactions),
  schoolExpenses: many(schoolExpenses),
  schoolInventory: many(schoolInventory),
  announcements: many(announcements),
  schoolEvents: many(schoolEvents),
  coCurricularActivities: many(coCurricularActivities),
  smsLogs: many(smsLogs),
  subscriptionPayments: many(subscriptionPayments),
  auditLogs: many(auditLogs),
}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({ one }) => ({
  school: one(schools, { fields: [subscriptionPayments.schoolId], references: [schools.id] }),
}));

// ---- Users & auth ----

export const usersRelations = relations(users, ({ one, many }) => ({
  school: one(schools, { fields: [users.schoolId], references: [schools.id] }),
  sessions: many(userSessions),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
  classesAsTeacher: many(classes, { relationName: "classTeacher" }),
  teacherSubjects: many(teacherSubjects),
  classSubjectsTaught: many(classSubjects),
  timetables: many(timetables),
  lessonPlans: many(lessonPlans),
  guardianLinks: many(studentGuardians),
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

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));

export const verificationTokensRelations = relations(verificationTokens, ({ one }) => ({
  user: one(users, { fields: [verificationTokens.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  school: one(schools, { fields: [auditLogs.schoolId], references: [schools.id] }),
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

// ---- Academic structure ----

export const academicTermsRelations = relations(academicTerms, ({ one, many }) => ({
  school: one(schools, { fields: [academicTerms.schoolId], references: [schools.id] }),
  windows: many(termWindows),
  studentEnrollmentHistory: many(studentEnrollmentHistory),
  classFeeStructures: many(classFeeStructures),
  studentInvoices: many(studentInvoices),
  feeTransactions: many(feeTransactions),
  termExams: many(termExams),
  cbcAssessments: many(cbcAssessments),
  reportCards: many(reportCards),
  schemesOfWork: many(schemesOfWork),
  studentActivityMemberships: many(studentActivityMemberships),
}));

export const termWindowsRelations = relations(termWindows, ({ one }) => ({
  term: one(academicTerms, { fields: [termWindows.termId], references: [academicTerms.id] }),
}));

export const gradeLevelsRelations = relations(gradeLevels, ({ one, many }) => ({
  school: one(schools, { fields: [gradeLevels.schoolId], references: [schools.id] }),
  nextGradeLevel: one(gradeLevels, {
    fields: [gradeLevels.nextGradeLevelId],
    references: [gradeLevels.id],
    relationName: "gradeProgression",
  }),
  previousGradeLevels: many(gradeLevels, { relationName: "gradeProgression" }),
  classes: many(classes),
  strands: many(curriculumStrands),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, { fields: [classes.schoolId], references: [schools.id] }),
  gradeLevelRef: one(gradeLevels, { fields: [classes.gradeLevelId], references: [gradeLevels.id] }),
  classTeacher: one(users, {
    fields: [classes.classTeacherId],
    references: [users.id],
    relationName: "classTeacher",
  }),
  students: many(students),
  classSubjects: many(classSubjects),
  timetables: many(timetables),
  homeworkAssignments: many(homeworkAssignments),
  reportCards: many(reportCards),
  schemesOfWork: many(schemesOfWork),
  lessonPlans: many(lessonPlans),
  examSchedules: many(examSchedules),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  school: one(schools, { fields: [subjects.schoolId], references: [schools.id] }),
  teacherSubjects: many(teacherSubjects),
  classSubjects: many(classSubjects),
  timetables: many(timetables),
  strands: many(curriculumStrands),
  cbcAssessments: many(cbcAssessments),
  examResults: many(examResults),
  examSchedules: many(examSchedules),
  schemesOfWork: many(schemesOfWork),
  lessonPlans: many(lessonPlans),
  homeworkAssignments: many(homeworkAssignments),
}));

export const teacherSubjectsRelations = relations(teacherSubjects, ({ one }) => ({
  teacher: one(users, { fields: [teacherSubjects.teacherId], references: [users.id] }),
  subject: one(subjects, { fields: [teacherSubjects.subjectId], references: [subjects.id] }),
}));

export const classSubjectsRelations = relations(classSubjects, ({ one }) => ({
  school: one(schools, { fields: [classSubjects.schoolId], references: [schools.id] }),
  class: one(classes, { fields: [classSubjects.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [classSubjects.subjectId], references: [subjects.id] }),
  teacher: one(users, { fields: [classSubjects.teacherId], references: [users.id] }),
}));

export const periodsRelations = relations(periods, ({ one }) => ({
  school: one(schools, { fields: [periods.schoolId], references: [schools.id] }),
}));

export const timetablesRelations = relations(timetables, ({ one }) => ({
  school: one(schools, { fields: [timetables.schoolId], references: [schools.id] }),
  class: one(classes, { fields: [timetables.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [timetables.subjectId], references: [subjects.id] }),
  teacher: one(users, { fields: [timetables.teacherId], references: [users.id] }),
}));

export const curriculumStrandsRelations = relations(curriculumStrands, ({ one, many }) => ({
  school: one(schools, { fields: [curriculumStrands.schoolId], references: [schools.id] }),
  subject: one(subjects, { fields: [curriculumStrands.subjectId], references: [subjects.id] }),
  gradeLevel: one(gradeLevels, { fields: [curriculumStrands.gradeLevelId], references: [gradeLevels.id] }),
  subStrands: many(curriculumSubStrands),
}));

export const curriculumSubStrandsRelations = relations(curriculumSubStrands, ({ one }) => ({
  strand: one(curriculumStrands, { fields: [curriculumSubStrands.strandId], references: [curriculumStrands.id] }),
}));

export const gradingScalesRelations = relations(gradingScales, ({ one, many }) => ({
  school: one(schools, { fields: [gradingScales.schoolId], references: [schools.id] }),
  bands: many(gradingBands),
}));

export const gradingBandsRelations = relations(gradingBands, ({ one }) => ({
  scale: one(gradingScales, { fields: [gradingBands.scaleId], references: [gradingScales.id] }),
}));

export const schemesOfWorkRelations = relations(schemesOfWork, ({ one, many }) => ({
  school: one(schools, { fields: [schemesOfWork.schoolId], references: [schools.id] }),
  term: one(academicTerms, { fields: [schemesOfWork.termId], references: [academicTerms.id] }),
  class: one(classes, { fields: [schemesOfWork.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [schemesOfWork.subjectId], references: [subjects.id] }),
  teacher: one(users, {
    fields: [schemesOfWork.teacherId],
    references: [users.id],
    relationName: "schemeTeacher",
  }),
  approver: one(users, {
    fields: [schemesOfWork.approvedBy],
    references: [users.id],
    relationName: "schemeApprover",
  }),
  entries: many(schemeOfWorkEntries),
}));

export const schemeOfWorkEntriesRelations = relations(schemeOfWorkEntries, ({ one, many }) => ({
  scheme: one(schemesOfWork, { fields: [schemeOfWorkEntries.schemeId], references: [schemesOfWork.id] }),
  strand: one(curriculumStrands, { fields: [schemeOfWorkEntries.strandId], references: [curriculumStrands.id] }),
  subStrand: one(curriculumSubStrands, {
    fields: [schemeOfWorkEntries.subStrandId],
    references: [curriculumSubStrands.id],
  }),
  lessonPlans: many(lessonPlans),
}));

export const lessonPlansRelations = relations(lessonPlans, ({ one }) => ({
  school: one(schools, { fields: [lessonPlans.schoolId], references: [schools.id] }),
  schemeEntry: one(schemeOfWorkEntries, {
    fields: [lessonPlans.schemeEntryId],
    references: [schemeOfWorkEntries.id],
  }),
  teacher: one(users, { fields: [lessonPlans.teacherId], references: [users.id] }),
  class: one(classes, { fields: [lessonPlans.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [lessonPlans.subjectId], references: [subjects.id] }),
}));

// ---- Students ----

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, { fields: [students.schoolId], references: [schools.id] }),
  user: one(users, { fields: [students.userId], references: [users.id] }),
  class: one(classes, { fields: [students.classId], references: [classes.id] }),
  guardians: many(studentGuardians),
  enrollmentHistory: many(studentEnrollmentHistory),
  documents: many(documents),
  healthRecords: many(studentHealthRecords),
  invoices: many(studentInvoices),
  feeTransactions: many(feeTransactions),
  cbcAssessments: many(cbcAssessments),
  examResults: many(examResults),
  reportCards: many(reportCards),
  homeworkSubmissions: many(homeworkSubmissions),
  attendance: many(attendance),
  disciplinaryRecords: many(disciplinaryRecords),
  studentActivityMemberships: many(studentActivityMemberships),
  libraryLoans: many(libraryLoans),
  transport: many(studentTransport),
  boardingAssignments: many(boardingAssignments),
}));

export const studentGuardiansRelations = relations(studentGuardians, ({ one }) => ({
  student: one(students, { fields: [studentGuardians.studentId], references: [students.id] }),
  guardian: one(users, { fields: [studentGuardians.guardianUserId], references: [users.id] }),
}));

export const studentEnrollmentHistoryRelations = relations(studentEnrollmentHistory, ({ one }) => ({
  student: one(students, { fields: [studentEnrollmentHistory.studentId], references: [students.id] }),
  term: one(academicTerms, { fields: [studentEnrollmentHistory.termId], references: [academicTerms.id] }),
  class: one(classes, { fields: [studentEnrollmentHistory.classId], references: [classes.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  student: one(students, { fields: [documents.studentId], references: [students.id] }),
  uploadedByUser: one(users, { fields: [documents.uploadedBy], references: [users.id] }),
}));

export const studentHealthRecordsRelations = relations(studentHealthRecords, ({ one }) => ({
  student: one(students, { fields: [studentHealthRecords.studentId], references: [students.id] }),
  recordedByUser: one(users, { fields: [studentHealthRecords.recordedBy], references: [users.id] }),
}));

// ---- Finance ----

export const feeItemsRelations = relations(feeItems, ({ one, many }) => ({
  school: one(schools, { fields: [feeItems.schoolId], references: [schools.id] }),
  classFeeStructures: many(classFeeStructures),
  invoiceItems: many(invoiceItems),
}));

export const classFeeStructuresRelations = relations(classFeeStructures, ({ one }) => ({
  term: one(academicTerms, { fields: [classFeeStructures.termId], references: [academicTerms.id] }),
  feeItem: one(feeItems, { fields: [classFeeStructures.feeItemId], references: [feeItems.id] }),
  gradeLevel: one(gradeLevels, {
    fields: [classFeeStructures.gradeLevelId],
    references: [gradeLevels.id],
  }),
  class: one(classes, {
    fields: [classFeeStructures.classId],
    references: [classes.id],
  }),
}));

export const studentInvoicesRelations = relations(studentInvoices, ({ one, many }) => ({
  school: one(schools, { fields: [studentInvoices.schoolId], references: [schools.id] }),
  student: one(students, { fields: [studentInvoices.studentId], references: [students.id] }),
  term: one(academicTerms, { fields: [studentInvoices.termId], references: [academicTerms.id] }),
  items: many(invoiceItems),
  payments: many(feeTransactions),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(studentInvoices, { fields: [invoiceItems.invoiceId], references: [studentInvoices.id] }),
  feeItem: one(feeItems, { fields: [invoiceItems.feeItemId], references: [feeItems.id] }),
}));

export const feeTransactionsRelations = relations(feeTransactions, ({ one }) => ({
  school: one(schools, { fields: [feeTransactions.schoolId], references: [schools.id] }),
  student: one(students, { fields: [feeTransactions.studentId], references: [students.id] }),
  invoice: one(studentInvoices, { fields: [feeTransactions.invoiceId], references: [studentInvoices.id] }),
  term: one(academicTerms, { fields: [feeTransactions.termId], references: [academicTerms.id] }),
  recordedByUser: one(users, {
    fields: [feeTransactions.recordedBy],
    references: [users.id],
    relationName: "recordedBy",
  }),
}));

export const schoolExpensesRelations = relations(schoolExpenses, ({ one }) => ({
  school: one(schools, { fields: [schoolExpenses.schoolId], references: [schools.id] }),
  recordedByUser: one(users, {
    fields: [schoolExpenses.recordedBy],
    references: [users.id],
    relationName: "recordedBy",
  }),
}));

// ---- Assessments, exams & homework ----

export const termExamsRelations = relations(termExams, ({ one, many }) => ({
  term: one(academicTerms, { fields: [termExams.termId], references: [academicTerms.id] }),
  gradingScale: one(gradingScales, { fields: [termExams.gradingScaleId], references: [gradingScales.id] }),
  cbcAssessments: many(cbcAssessments),
  results: many(examResults),
  schedules: many(examSchedules),
}));

export const examSchedulesRelations = relations(examSchedules, ({ one }) => ({
  exam: one(termExams, { fields: [examSchedules.examId], references: [termExams.id] }),
  class: one(classes, { fields: [examSchedules.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [examSchedules.subjectId], references: [subjects.id] }),
  invigilator: one(users, { fields: [examSchedules.invigilatorId], references: [users.id] }),
}));

export const examResultsRelations = relations(examResults, ({ one }) => ({
  exam: one(termExams, { fields: [examResults.examId], references: [termExams.id] }),
  student: one(students, { fields: [examResults.studentId], references: [students.id] }),
  subject: one(subjects, { fields: [examResults.subjectId], references: [subjects.id] }),
  class: one(classes, { fields: [examResults.classId], references: [classes.id] }),
  enteredByUser: one(users, { fields: [examResults.enteredBy], references: [users.id] }),
}));

export const cbcAssessmentsRelations = relations(cbcAssessments, ({ one }) => ({
  student: one(students, { fields: [cbcAssessments.studentId], references: [students.id] }),
  subject: one(subjects, { fields: [cbcAssessments.subjectId], references: [subjects.id] }),
  term: one(academicTerms, { fields: [cbcAssessments.termId], references: [academicTerms.id] }),
  exam: one(termExams, { fields: [cbcAssessments.examId], references: [termExams.id] }),
  strandRef: one(curriculumStrands, { fields: [cbcAssessments.strandId], references: [curriculumStrands.id] }),
  subStrandRef: one(curriculumSubStrands, {
    fields: [cbcAssessments.subStrandId],
    references: [curriculumSubStrands.id],
  }),
  assessedByUser: one(users, {
    fields: [cbcAssessments.assessedBy],
    references: [users.id],
    relationName: "assessedBy",
  }),
}));

export const reportCardsRelations = relations(reportCards, ({ one }) => ({
  student: one(students, { fields: [reportCards.studentId], references: [students.id] }),
  term: one(academicTerms, { fields: [reportCards.termId], references: [academicTerms.id] }),
  class: one(classes, { fields: [reportCards.classId], references: [classes.id] }),
}));

export const homeworkAssignmentsRelations = relations(homeworkAssignments, ({ one, many }) => ({
  class: one(classes, { fields: [homeworkAssignments.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [homeworkAssignments.subjectId], references: [subjects.id] }),
  teacher: one(users, { fields: [homeworkAssignments.teacherId], references: [users.id] }),
  submissions: many(homeworkSubmissions),
}));

export const homeworkSubmissionsRelations = relations(homeworkSubmissions, ({ one }) => ({
  assignment: one(homeworkAssignments, {
    fields: [homeworkSubmissions.assignmentId],
    references: [homeworkAssignments.id],
  }),
  student: one(students, { fields: [homeworkSubmissions.studentId], references: [students.id] }),
}));

// ---- Attendance, discipline & co-curricular ----

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(students, { fields: [attendance.studentId], references: [students.id] }),
  class: one(classes, { fields: [attendance.classId], references: [classes.id] }),
  markedByUser: one(users, {
    fields: [attendance.markedBy],
    references: [users.id],
    relationName: "markedBy",
  }),
}));

export const disciplinaryRecordsRelations = relations(disciplinaryRecords, ({ one }) => ({
  student: one(students, { fields: [disciplinaryRecords.studentId], references: [students.id] }),
  recordedByUser: one(users, {
    fields: [disciplinaryRecords.recordedBy],
    references: [users.id],
    relationName: "recordedBy",
  }),
}));

export const coCurricularActivitiesRelations = relations(coCurricularActivities, ({ one, many }) => ({
  school: one(schools, { fields: [coCurricularActivities.schoolId], references: [schools.id] }),
  patronTeacher: one(users, {
    fields: [coCurricularActivities.patronTeacherId],
    references: [users.id],
    relationName: "patronTeacher",
  }),
  memberships: many(studentActivityMemberships),
}));

export const studentActivityMembershipsRelations = relations(studentActivityMemberships, ({ one }) => ({
  student: one(students, { fields: [studentActivityMemberships.studentId], references: [students.id] }),
  activity: one(coCurricularActivities, {
    fields: [studentActivityMemberships.activityId],
    references: [coCurricularActivities.id],
  }),
  term: one(academicTerms, { fields: [studentActivityMemberships.termId], references: [academicTerms.id] }),
}));

// ---- Inventory, library & services ----

export const schoolInventoryRelations = relations(schoolInventory, ({ one, many }) => ({
  school: one(schools, { fields: [schoolInventory.schoolId], references: [schools.id] }),
  libraryLoans: many(libraryLoans),
}));

export const libraryLoansRelations = relations(libraryLoans, ({ one }) => ({
  inventory: one(schoolInventory, { fields: [libraryLoans.inventoryId], references: [schoolInventory.id] }),
  student: one(students, { fields: [libraryLoans.studentId], references: [students.id] }),
  issuedByUser: one(users, { fields: [libraryLoans.issuedBy], references: [users.id] }),
}));

export const transportRoutesRelations = relations(transportRoutes, ({ one, many }) => ({
  school: one(schools, { fields: [transportRoutes.schoolId], references: [schools.id] }),
  riders: many(studentTransport),
}));

export const studentTransportRelations = relations(studentTransport, ({ one }) => ({
  student: one(students, { fields: [studentTransport.studentId], references: [students.id] }),
  route: one(transportRoutes, { fields: [studentTransport.routeId], references: [transportRoutes.id] }),
  term: one(academicTerms, { fields: [studentTransport.termId], references: [academicTerms.id] }),
}));

export const dormitoriesRelations = relations(dormitories, ({ one, many }) => ({
  school: one(schools, { fields: [dormitories.schoolId], references: [schools.id] }),
  warden: one(users, { fields: [dormitories.wardenId], references: [users.id] }),
  assignments: many(boardingAssignments),
}));

export const boardingAssignmentsRelations = relations(boardingAssignments, ({ one }) => ({
  student: one(students, { fields: [boardingAssignments.studentId], references: [students.id] }),
  dormitory: one(dormitories, { fields: [boardingAssignments.dormitoryId], references: [dormitories.id] }),
  term: one(academicTerms, { fields: [boardingAssignments.termId], references: [academicTerms.id] }),
}));

// ---- Communications, notifications & events ----

export const announcementsRelations = relations(announcements, ({ one }) => ({
  school: one(schools, { fields: [announcements.schoolId], references: [schools.id] }),
  class: one(classes, { fields: [announcements.classId], references: [classes.id] }),
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

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const meetingSlotsRelations = relations(meetingSlots, ({ one }) => ({
  teacher: one(users, {
    fields: [meetingSlots.teacherId],
    references: [users.id],
    relationName: "meetingTeacher",
  }),
  booker: one(users, {
    fields: [meetingSlots.bookedBy],
    references: [users.id],
    relationName: "meetingBooker",
  }),
  student: one(students, { fields: [meetingSlots.studentId], references: [students.id] }),
}));

export const smsLogsRelations = relations(smsLogs, ({ one }) => ({
  school: one(schools, { fields: [smsLogs.schoolId], references: [schools.id] }),
  recipient: one(users, { fields: [smsLogs.recipientUserId], references: [users.id] }),
  announcement: one(announcements, { fields: [smsLogs.announcementId], references: [announcements.id] }),
}));

export const schoolEventsRelations = relations(schoolEvents, ({ one }) => ({
  school: one(schools, { fields: [schoolEvents.schoolId], references: [schools.id] }),
  postedByUser: one(users, {
    fields: [schoolEvents.postedBy],
    references: [users.id],
    relationName: "postedBy",
  }),
}));

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  school: one(schools, { fields: [importJobs.schoolId], references: [schools.id] }),
  createdByUser: one(users, { fields: [importJobs.createdBy], references: [users.id] }),
}));

// =======================
// TYPES (INFER TYPES)
// =======================

// ---- SCHOOLS & BILLING ----
export type TSelectSchool = typeof schools.$inferSelect;
export type TInsertSchool = typeof schools.$inferInsert;

export type TSelectSubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type TInsertSubscriptionPayment = typeof subscriptionPayments.$inferInsert;

// ---- USERS & AUTH ----
export type TSelectUser = typeof users.$inferSelect;
export type TInsertUser = typeof users.$inferInsert;

export type TSelectUserSession = typeof userSessions.$inferSelect;
export type TInsertUserSession = typeof userSessions.$inferInsert;

export type TSelectVerificationToken = typeof verificationTokens.$inferSelect;
export type TInsertVerificationToken = typeof verificationTokens.$inferInsert;

// ---- ACADEMIC SETUP ----
export type TSelectAcademicTerm = typeof academicTerms.$inferSelect;
export type TInsertAcademicTerm = typeof academicTerms.$inferInsert;

export type TSelectTermWindow = typeof termWindows.$inferSelect;
export type TInsertTermWindow = typeof termWindows.$inferInsert;

export type TSelectGradeLevel = typeof gradeLevels.$inferSelect;
export type TInsertGradeLevel = typeof gradeLevels.$inferInsert;

export type TSelectClass = typeof classes.$inferSelect;
export type TInsertClass = typeof classes.$inferInsert;

export type TSelectSubject = typeof subjects.$inferSelect;
export type TInsertSubject = typeof subjects.$inferInsert;

export type TSelectTeacherSubject = typeof teacherSubjects.$inferSelect;
export type TInsertTeacherSubject = typeof teacherSubjects.$inferInsert;

export type TSelectClassSubject = typeof classSubjects.$inferSelect;
export type TInsertClassSubject = typeof classSubjects.$inferInsert;

export type TSelectPeriod = typeof periods.$inferSelect;
export type TInsertPeriod = typeof periods.$inferInsert;

export type TSelectTimetable = typeof timetables.$inferSelect;
export type TInsertTimetable = typeof timetables.$inferInsert;

// ---- CURRICULUM, GRADING & TEACHING ----
export type TSelectCurriculumStrand = typeof curriculumStrands.$inferSelect;
export type TInsertCurriculumStrand = typeof curriculumStrands.$inferInsert;

export type TSelectCurriculumSubStrand = typeof curriculumSubStrands.$inferSelect;
export type TInsertCurriculumSubStrand = typeof curriculumSubStrands.$inferInsert;

export type TSelectGradingScale = typeof gradingScales.$inferSelect;
export type TInsertGradingScale = typeof gradingScales.$inferInsert;

export type TSelectGradingBand = typeof gradingBands.$inferSelect;
export type TInsertGradingBand = typeof gradingBands.$inferInsert;

export type TSelectSchemeOfWork = typeof schemesOfWork.$inferSelect;
export type TInsertSchemeOfWork = typeof schemesOfWork.$inferInsert;

export type TSelectSchemeOfWorkEntry = typeof schemeOfWorkEntries.$inferSelect;
export type TInsertSchemeOfWorkEntry = typeof schemeOfWorkEntries.$inferInsert;

export type TSelectLessonPlan = typeof lessonPlans.$inferSelect;
export type TInsertLessonPlan = typeof lessonPlans.$inferInsert;

// ---- STUDENTS ----
export type TSelectStudent = typeof students.$inferSelect;
export type TInsertStudent = typeof students.$inferInsert;

export type TSelectStudentGuardian = typeof studentGuardians.$inferSelect;
export type TInsertStudentGuardian = typeof studentGuardians.$inferInsert;

export type TSelectStudentEnrollmentHistory = typeof studentEnrollmentHistory.$inferSelect;
export type TInsertStudentEnrollmentHistory = typeof studentEnrollmentHistory.$inferInsert;

export type TSelectDocument = typeof documents.$inferSelect;
export type TInsertDocument = typeof documents.$inferInsert;

export type TSelectStudentHealthRecord = typeof studentHealthRecords.$inferSelect;
export type TInsertStudentHealthRecord = typeof studentHealthRecords.$inferInsert;

// ---- FINANCE ----
export type TSelectFeeItem = typeof feeItems.$inferSelect;
export type TInsertFeeItem = typeof feeItems.$inferInsert;

export type TSelectClassFeeStructure = typeof classFeeStructures.$inferSelect;
export type TInsertClassFeeStructure = typeof classFeeStructures.$inferInsert;

export type TSelectStudentInvoice = typeof studentInvoices.$inferSelect;
export type TInsertStudentInvoice = typeof studentInvoices.$inferInsert;

export type TSelectInvoiceItem = typeof invoiceItems.$inferSelect;
export type TInsertInvoiceItem = typeof invoiceItems.$inferInsert;

export type TSelectFeeTransaction = typeof feeTransactions.$inferSelect;
export type TInsertFeeTransaction = typeof feeTransactions.$inferInsert;

export type TSelectSchoolExpense = typeof schoolExpenses.$inferSelect;
export type TInsertSchoolExpense = typeof schoolExpenses.$inferInsert;

// ---- EXAMS & ASSESSMENTS ----
export type TSelectTermExam = typeof termExams.$inferSelect;
export type TInsertTermExam = typeof termExams.$inferInsert;

export type TSelectExamSchedule = typeof examSchedules.$inferSelect;
export type TInsertExamSchedule = typeof examSchedules.$inferInsert;

export type TSelectExamResult = typeof examResults.$inferSelect;
export type TInsertExamResult = typeof examResults.$inferInsert;

export type TSelectCbcAssessment = typeof cbcAssessments.$inferSelect;
export type TInsertCbcAssessment = typeof cbcAssessments.$inferInsert;

export type TSelectReportCard = typeof reportCards.$inferSelect;
export type TInsertReportCard = typeof reportCards.$inferInsert;

// ---- ATTENDANCE & DISCIPLINE ----
export type TSelectAttendance = typeof attendance.$inferSelect;
export type TInsertAttendance = typeof attendance.$inferInsert;

export type TSelectDisciplinaryRecord = typeof disciplinaryRecords.$inferSelect;
export type TInsertDisciplinaryRecord = typeof disciplinaryRecords.$inferInsert;

// ---- LIBRARY, INVENTORY & STUDENT SERVICES ----
export type TSelectSchoolInventory = typeof schoolInventory.$inferSelect;
export type TInsertSchoolInventory = typeof schoolInventory.$inferInsert;

export type TSelectLibraryLoan = typeof libraryLoans.$inferSelect;
export type TInsertLibraryLoan = typeof libraryLoans.$inferInsert;

export type TSelectTransportRoute = typeof transportRoutes.$inferSelect;
export type TInsertTransportRoute = typeof transportRoutes.$inferInsert;

export type TSelectStudentTransport = typeof studentTransport.$inferSelect;
export type TInsertStudentTransport = typeof studentTransport.$inferInsert;

export type TSelectDormitory = typeof dormitories.$inferSelect;
export type TInsertDormitory = typeof dormitories.$inferInsert;

export type TSelectBoardingAssignment = typeof boardingAssignments.$inferSelect;
export type TInsertBoardingAssignment = typeof boardingAssignments.$inferInsert;

// ---- HOMEWORK ----
export type TSelectHomeworkAssignment = typeof homeworkAssignments.$inferSelect;
export type TInsertHomeworkAssignment = typeof homeworkAssignments.$inferInsert;

export type TSelectHomeworkSubmission = typeof homeworkSubmissions.$inferSelect;
export type TInsertHomeworkSubmission = typeof homeworkSubmissions.$inferInsert;

// ---- COMMUNICATIONS & EVENTS ----
export type TSelectAnnouncement = typeof announcements.$inferSelect;
export type TInsertAnnouncement = typeof announcements.$inferInsert;

export type TSelectDirectMessage = typeof directMessages.$inferSelect;
export type TInsertDirectMessage = typeof directMessages.$inferInsert;

export type TSelectNotification = typeof notifications.$inferSelect;
export type TInsertNotification = typeof notifications.$inferInsert;

export type TSelectMeetingSlot = typeof meetingSlots.$inferSelect;
export type TInsertMeetingSlot = typeof meetingSlots.$inferInsert;

export type TSelectSmsLog = typeof smsLogs.$inferSelect;
export type TInsertSmsLog = typeof smsLogs.$inferInsert;

export type TSelectSchoolEvent = typeof schoolEvents.$inferSelect;
export type TInsertSchoolEvent = typeof schoolEvents.$inferInsert;

export type TSelectCoCurricularActivity = typeof coCurricularActivities.$inferSelect;
export type TInsertCoCurricularActivity = typeof coCurricularActivities.$inferInsert;

export type TSelectStudentActivityMembership = typeof studentActivityMemberships.$inferSelect;
export type TInsertStudentActivityMembership = typeof studentActivityMemberships.$inferInsert;

// ---- PLATFORM ----
export type TSelectImportJob = typeof importJobs.$inferSelect;
export type TInsertImportJob = typeof importJobs.$inferInsert;

export type TSelectWebhookEvent = typeof webhookEvents.$inferSelect;
export type TInsertWebhookEvent = typeof webhookEvents.$inferInsert;

export type TSelectAuditLog = typeof auditLogs.$inferSelect;
export type TInsertAuditLog = typeof auditLogs.$inferInsert;