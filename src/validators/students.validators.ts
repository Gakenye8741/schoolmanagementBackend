// validators/students.validator.ts
import { z } from "zod";

// ================================================================
// Reusable primitives
// ================================================================
const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    },
    { message: "Invalid calendar date." }
  );

const phone = z.string().trim().max(20, "Phone number is too long.").optional().nullable();
const shortText = (field: string, max = 100) =>
  z.string().trim().min(1, `${field} is required.`).max(max, `${field} is too long.`);

const genderEnum = z.enum(["Male", "Female", "Other"], {
  errorMap: () => ({ message: 'Gender must be "Male", "Female", or "Other".' }),
});
const boardingEnum = z.enum(["Day", "Boarding"]);
const guardianRelationshipEnum = z.enum([
  "Mother", "Father", "Guardian", "Sponsor", "Sibling", "Other",
]);
const documentCategoryEnum = z.enum([
  "BirthCertificate", "TransferLetter", "ReportForm", "MedicalReport",
  "IdentityDocument", "Photo", "Circular", "Other",
]);
const healthRecordTypeEnum = z.enum([
  "Allergy", "Condition", "Vaccination", "SickBayVisit", "Injury", "Other",
]);

// ================================================================
// REGISTER
// ================================================================
export const registerStudentSchema = z
  .object({
    schoolId: uuid("school ID"),
    email: z.string().email("Invalid email address."),
    password: z.string().min(6, "Password must be at least 6 characters long."),
    admissionNumber: shortText("Admission number", 50),
    firstName: shortText("First name", 100),
    middleName: z.string().trim().max(100).optional().nullable(),
    lastName: shortText("Last name", 100),
    gender: genderEnum.optional(),
    dateOfBirth: isoDate.optional(),
    birthCertificateNumber: z.string().trim().max(50).optional().nullable(),
    nationality: z.string().trim().max(50).optional(),
    photoUrl: z.string().url("Invalid photo URL.").optional().nullable(),
    boardingStatus: boardingEnum.optional(),
    medicalNotes: z.string().trim().optional().nullable(),
    specialNeeds: z.string().trim().optional().nullable(),
    previousSchool: z.string().trim().max(255).optional().nullable(),
    upiNumber: z.string().trim().max(100).optional().nullable(),
    classId: uuid("class ID").optional().nullable(),
    termId: uuid("term ID").optional().nullable(),
    enrollmentDate: isoDate.optional(),
    mustChangePassword: z.boolean().optional(),
  })
  .refine(
    (d) => !d.dateOfBirth || d.dateOfBirth <= new Date().toISOString().split("T")[0],
    { message: "Date of birth cannot be in the future.", path: ["dateOfBirth"] }
  )
  .refine((d) => !d.classId || !!d.termId, {
    message: "termId is required when classId is provided (or ensure the school has a current term).",
    path: ["termId"],
  });

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;

// ================================================================
// UPDATE / DELETE
// ================================================================
export const updateStudentSchema = z
  .object({
    firstName: shortText("First name", 100).optional(),
    middleName: z.string().trim().max(100).optional().nullable(),
    lastName: shortText("Last name", 100).optional(),
    gender: genderEnum.optional(),
    dateOfBirth: isoDate.optional(),
    birthCertificateNumber: z.string().trim().max(50).optional().nullable(),
    nationality: z.string().trim().max(50).optional(),
    photoUrl: z.string().url("Invalid photo URL.").optional().nullable(),
    boardingStatus: boardingEnum.optional(),
    medicalNotes: z.string().trim().optional().nullable(),
    specialNeeds: z.string().trim().optional().nullable(),
    previousSchool: z.string().trim().max(255).optional().nullable(),
    upiNumber: z.string().trim().max(100).optional().nullable(),
    enrollmentDate: isoDate.optional(),
    exitDate: isoDate.optional().nullable(),
    exitReason: z.string().trim().optional().nullable(),
    isEnrolled: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

// ================================================================
// QUERIES
// ================================================================
export const searchStudentsSchema = z.object({
  query: z.string().trim().min(1, "Provide a search query.").max(100),
});

export const listStudentsBySchoolSchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

export const listStudentsByClassSchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

export const getStudentByAdmissionSchema = z.object({
  admissionNumber: z.string().trim().min(1, "Admission number is required.").max(50),
});

// ================================================================
// ENROLLMENT / LIFECYCLE
// ================================================================
export const enrollStudentInClassSchema = z.object({
  classId: uuid("class ID"),
  termId: uuid("term ID").optional(),
  requireUnplaced: z.boolean().optional(),
});

export const withdrawStudentSchema = z.object({
  reason: z.string().trim().min(1, "A withdrawal reason is required.").max(500),
});

export const promoteStudentSchema = z.object({
  targetClassId: uuid("target class ID").optional(),
  termId: uuid("term ID").optional(),
});

export const graduateStudentSchema = z.object({
  termId: uuid("term ID").optional(),
});

export const repeatGradeSchema = z.object({
  targetClassId: uuid("target class ID").optional(),
  termId: uuid("term ID").optional(),
});

export const transferStudentOutSchema = z.object({
  toSchool: z.string().trim().min(1, "Target school name is required.").max(255),
  reason: z.string().trim().min(1, "A transfer reason is required.").max(500),
});

export const bulkPromoteStudentsSchema = z
  .object({
    schoolId: uuid("school ID"),
    fromClassId: uuid("source class ID"),
    toClassId: uuid("target class ID"),
    termId: uuid("term ID").optional(),
  })
  .refine((d) => d.fromClassId !== d.toClassId, {
    message: "Source and target classes must be different.",
    path: ["toClassId"],
  });

// ================================================================
// GUARDIANS
// ================================================================
export const addGuardianSchema = z.object({
  guardianUserId: uuid("guardian user ID"),
  relationship: guardianRelationshipEnum.optional(),
  isPrimary: z.boolean().optional(),
  isFeePayer: z.boolean().optional(),
  canPickup: z.boolean().optional(),
});

export const removeGuardianSchema = z.object({
  guardianUserId: uuid("guardian user ID"),
});

export const setPrimaryGuardianSchema = z.object({
  guardianUserId: uuid("guardian user ID"),
});

export const updateGuardianRelationshipSchema = z
  .object({
    relationship: guardianRelationshipEnum.optional(),
    isFeePayer: z.boolean().optional(),
    canPickup: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

// ================================================================
// DOCUMENTS
// ================================================================
export const addDocumentSchema = z.object({
  schoolId: uuid("school ID"),
  category: documentCategoryEnum,
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(255),
  fileUrl: z.string().url("Invalid file URL."),
  fileName: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(100).optional(),
  sizeBytes: z.number().int().min(0).optional(),
  isVisibleToParent: z.boolean().optional(),
  uploadedBy: uuid("uploaded-by user ID").optional(),
});

export const toggleDocumentVisibilitySchema = z.object({
  isVisibleToParent: z.boolean({ required_error: "isVisibleToParent is required." }),
});

// ================================================================
// HEALTH RECORDS
// ================================================================
export const addHealthRecordSchema = z.object({
  schoolId: uuid("school ID"),
  recordType: healthRecordTypeEnum,
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(150),
  description: z.string().trim().optional(),
  treatment: z.string().trim().optional(),
  followUpDate: isoDate.optional(),
  recordedBy: uuid("recorder user ID").optional(),
});

// ================================================================
// ROUTE PARAMS
// ================================================================
export const studentIdParamSchema = z.object({
  studentId: uuid("student ID"),
});

export const classIdParamSchema = z.object({
  classId: uuid("class ID"),
});

export const guardianUserIdParamSchema = z.object({
  guardianUserId: uuid("guardian user ID"),
});

export const documentIdParamSchema = z.object({
  documentId: uuid("document ID"),
});

export const userIdParamSchema = z.object({
  userId: uuid("user ID"),
});

export const termIdParamSchema = z.object({
  termId: uuid("term ID"),
});

// ================================================================
// Inferred types
// ================================================================

export type SearchStudentsInput = z.infer<typeof searchStudentsSchema>;
export type EnrollStudentInClassInput = z.infer<typeof enrollStudentInClassSchema>;
export type WithdrawStudentInput = z.infer<typeof withdrawStudentSchema>;
export type PromoteStudentInput = z.infer<typeof promoteStudentSchema>;
export type GraduateStudentInput = z.infer<typeof graduateStudentSchema>;
export type RepeatGradeInput = z.infer<typeof repeatGradeSchema>;
export type TransferStudentOutInput = z.infer<typeof transferStudentOutSchema>;
export type BulkPromoteStudentsInput = z.infer<typeof bulkPromoteStudentsSchema>;
export type AddGuardianInput = z.infer<typeof addGuardianSchema>;
export type UpdateGuardianRelationshipInput = z.infer<typeof updateGuardianRelationshipSchema>;
export type AddDocumentInput = z.infer<typeof addDocumentSchema>;
export type AddHealthRecordInput = z.infer<typeof addHealthRecordSchema>;