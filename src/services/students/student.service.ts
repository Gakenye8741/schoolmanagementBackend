import {
  eq, and, ne, asc, desc, count, sql, ilike, isNull, inArray, or,
} from "drizzle-orm";
import bcrypt from "bcrypt";

import {
  students,
  studentGuardians,
  studentEnrollmentHistory,
  documents,
  studentHealthRecords,
  classes,
  gradeLevels,
  academicTerms,
  users,
  schools,
  TSelectStudent,
  TSelectStudentGuardian,
  TSelectStudentEnrollmentHistory,
  TSelectDocument,
  TSelectStudentHealthRecord,
  TSelectClass,
  TSelectGradeLevel,
  TInsertStudent,
} from "../../drizzle/schema";
import db from "../../drizzle/db";
import { linkStudentToClassService } from "../classswithgradesandSubjects/academicStructure.service";


// ================================================================
// Response envelope
// ================================================================
export interface StudentResponse {
  success: boolean;
  message: string;
  student?: TSelectStudent;
  students?: TSelectStudent[];
  guardian?: TSelectStudentGuardian;
  guardians?: Array<
    TSelectStudentGuardian & {
      guardian?: { id: string; name: string; email: string; phone: string | null };
    }
  >;
  enrollment?: TSelectStudentEnrollmentHistory;
  enrollments?: TSelectStudentEnrollmentHistory[];
  document?: TSelectDocument;
  documents?: TSelectDocument[];
  healthRecord?: TSelectStudentHealthRecord;
  healthRecords?: TSelectStudentHealthRecord[];
  classRow?: TSelectClass;
  gradeLevel?: TSelectGradeLevel;
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const normalizeEmail = (s: string) => s.trim().toLowerCase();

const getCurrentTerm = async (schoolId: string) => {
  return await db.query.academicTerms.findFirst({
    where: and(
      eq(academicTerms.schoolId, schoolId),
      eq(academicTerms.isCurrentTerm, true)
    ),
  });
};

const requireCurrentTerm = async (schoolId: string): Promise<string | null> => {
  const t = await getCurrentTerm(schoolId);
  return t?.id ?? null;
};

const studentIsActive = (s: TSelectStudent) =>
  s.isEnrolled === true && s.deletedAt === null;

// ================================================================
// 1. REGISTRATION — atomic users + students
// ================================================================
export interface RegisterStudentInput {
  schoolId: string;
  email: string;
  password: string;
  admissionNumber: string;
  firstName: string;
  middleName?: string | null;            // ← was `string | undefined`
  lastName: string;
  gender?: "Male" | "Female" | "Other";
  dateOfBirth?: string;
  birthCertificateNumber?: string | null; // ← add `| null`
  nationality?: string;
  photoUrl?: string | null;              // ← add `| null`
  boardingStatus?: "Day" | "Boarding";
  medicalNotes?: string | null;          // ← add `| null`
  specialNeeds?: string | null;          // ← add `| null`
  previousSchool?: string | null;        // ← add `| null`
  upiNumber?: string | null;             // ← add `| null`
  classId?: string | null;               // already has it
  termId?: string | null;                // already has it
  enrollmentDate?: string;
  mustChangePassword?: boolean;
}

export const registerStudentService = async (
  data: RegisterStudentInput
): Promise<StudentResponse & { user?: any }> => {
  try {
    if (!data.schoolId) return { success: false, message: "schoolId is required." };
    if (!data.email) return { success: false, message: "email is required." };
    if (!data.password || data.password.length < 6)
      return { success: false, message: "Password must be at least 6 characters." };
    if (!data.admissionNumber)
      return { success: false, message: "admissionNumber is required." };
    if (!data.firstName || !data.lastName)
      return { success: false, message: "firstName and lastName are required." };

    const email = normalizeEmail(data.email);

    // Class validation + term resolution (read-only, before transaction)
    let validatedClassId: string | null = null;
    let resolvedTermId: string | null = null;

    if (data.classId) {
      const cls = await db.query.classes.findFirst({
        where: and(eq(classes.id, data.classId), eq(classes.schoolId, data.schoolId)),
      });
      if (!cls)
        return {
          success: false,
          message: "The selected class does not belong to this school.",
        };
      validatedClassId = cls.id;

      if (data.termId) {
        const term = await db.query.academicTerms.findFirst({
          where: and(
            eq(academicTerms.id, data.termId),
            eq(academicTerms.schoolId, data.schoolId)
          ),
        });
        if (!term)
          return {
            success: false,
            message: "The selected term does not belong to this school.",
          };
        resolvedTermId = term.id;
      } else {
        const current = await getCurrentTerm(data.schoolId);
        if (!current)
          return {
            success: false,
            message:
              "Cannot assign a class at admission — no current academic term is set for this school. Set one first or pass termId.",
          };
        resolvedTermId = current.id;
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const result = await db.transaction(async (tx) => {
      // Duplicate checks inside the transaction for race-safety
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.schoolId, data.schoolId), eq(users.email, email)))
        .limit(1);
      if (existingUser) throw new Error("EMAIL_DUPLICATE");

      const [existingStudent] = await tx
        .select({ id: students.id })
        .from(students)
        .where(
          and(
            eq(students.schoolId, data.schoolId),
            eq(students.admissionNumber, data.admissionNumber)
          )
        )
        .limit(1);
      if (existingStudent) throw new Error("ADMISSION_DUPLICATE");

      // 1. Auth identity
      const [newUser] = await tx
        .insert(users)
        .values({
          schoolId: data.schoolId,
          name: `${data.firstName} ${data.lastName}`.trim(),
          email,
          role: "student",
          roles: ["student"],
          admissionNumber: data.admissionNumber,
          passwordHash,
          mustChangePassword: data.mustChangePassword ?? true,
        })
        .returning();

      // 2. Academic identity — ALWAYS created, no conditional
      const [newStudent] = await tx
        .insert(students)
        .values({
          userId: newUser.id,
          schoolId: data.schoolId,
          admissionNumber: data.admissionNumber,
          upiNumber: data.upiNumber ?? null,
          firstName: data.firstName,
          middleName: data.middleName ?? null,
          lastName: data.lastName,
          gender: data.gender ?? null,
          dateOfBirth: data.dateOfBirth ?? null,
          birthCertificateNumber: data.birthCertificateNumber ?? null,
          nationality: data.nationality ?? "Kenyan",
          photoUrl: data.photoUrl ?? null,
          boardingStatus: data.boardingStatus ?? "Day",
          medicalNotes: data.medicalNotes ?? null,
          specialNeeds: data.specialNeeds ?? null,
          previousSchool: data.previousSchool ?? null,
          classId: validatedClassId,
          enrollmentDate:
            data.enrollmentDate ?? new Date().toISOString().split("T")[0],
          isEnrolled: true,
        })
        .returning();

      // 3. Enrollment history if placed
      if (validatedClassId && resolvedTermId) {
        await tx.insert(studentEnrollmentHistory).values({
          schoolId: data.schoolId,
          studentId: newStudent.id,
          termId: resolvedTermId,
          classId: validatedClassId,
          status: "Active",
        });
      }

      return { user: newUser, student: newStudent };
    });

    const { passwordHash: _pw, ...userWithoutPassword } = result.user;

    return {
      success: true,
      message: validatedClassId
        ? "Student registered and placed in their class successfully."
        : "Student registered successfully. Assign them to a class when ready.",
      student: result.student,
      user: userWithoutPassword,
    };
  } catch (e: any) {
    if (e?.message === "EMAIL_DUPLICATE")
      return {
        success: false,
        message: "A user with this email already exists in this school.",
      };
    if (e?.message === "ADMISSION_DUPLICATE")
      return {
        success: false,
        message: "A student with this admission number already exists in this school.",
      };
    if (String(e?.code) === "23505")
      return {
        success: false,
        message: "Duplicate email or admission number in this school.",
      };
    return { success: false, message: e?.message || "Failed to register student." };
  }
};

// ================================================================
// 2. READ — single, with relations
// ================================================================
export const getStudentByIdService = async (id: string): Promise<StudentResponse> => {
  try {
    const s = await db.query.students.findFirst({ where: eq(students.id, id) });
    if (!s) return { success: false, message: "Student not found." };
    return { success: true, message: "Student retrieved.", student: s };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch student." };
  }
};

export const getStudentWithRelationsService = async (
  id: string
): Promise<StudentResponse> => {
  try {
    const s = await db.query.students.findFirst({
      where: eq(students.id, id),
      with: {
        class: true,
        guardians: true,
        enrollmentHistory: true,
      },
    });
    if (!s) return { success: false, message: "Student not found." };

    return {
      success: true,
      message: "Student with relations retrieved.",
      student: s as TSelectStudent,
      classRow: (s as any).class,
      guardians: (s as any).guardians,
      enrollments: (s as any).enrollmentHistory,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch student with relations." };
  }
};

export const getStudentByAdmissionNumberService = async (
  schoolId: string,
  admissionNumber: string
): Promise<StudentResponse> => {
  try {
    const s = await db.query.students.findFirst({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.admissionNumber, admissionNumber)
      ),
    });
    if (!s) return { success: false, message: `Student "${admissionNumber}" not found.` };
    return { success: true, message: "Student retrieved.", student: s };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch student." };
  }
};

export const getStudentByUserIdService = async (userId: string): Promise<StudentResponse> => {
  try {
    const s = await db.query.students.findFirst({
      where: eq(students.userId, userId),
    });
    if (!s) return { success: false, message: "No student profile linked to this user." };
    return { success: true, message: "Student retrieved.", student: s };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch student." };
  }
};

// ================================================================
// 3. LISTS
// ================================================================
export const listStudentsBySchoolService = async (
  schoolId: string,
  opts?: { includeInactive?: boolean }
): Promise<StudentResponse> => {
  try {
    const conditions: any[] = [eq(students.schoolId, schoolId)];
    if (!opts?.includeInactive) {
      conditions.push(eq(students.isEnrolled, true));
    }
    conditions.push(isNull(students.deletedAt));

    const rows = await db.query.students.findMany({
      where: and(...conditions),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });

    return {
      success: true,
      message: `Fetched ${rows.length} student(s).`,
      students: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list students." };
  }
};

export const listStudentsByClassService = async (
  classId: string,
  opts?: { includeInactive?: boolean }
): Promise<StudentResponse> => {
  try {
    const conditions: any[] = [eq(students.classId, classId)];
    if (!opts?.includeInactive) conditions.push(eq(students.isEnrolled, true));
    conditions.push(isNull(students.deletedAt));

    const rows = await db.query.students.findMany({
      where: and(...conditions),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });

    return {
      success: true,
      message: `Fetched ${rows.length} student(s) in this class.`,
      students: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list class students." };
  }
};

export const listStudentsByTermService = async (
  termId: string
): Promise<StudentResponse> => {
  try {
    const rows = await db.query.studentEnrollmentHistory.findMany({
      where: and(
        eq(studentEnrollmentHistory.termId, termId),
        eq(studentEnrollmentHistory.status, "Active")
      ),
      with: { student: true },
    });

    const studentRows = rows
      .map((r) => (r as any).student)
      .filter(Boolean) as TSelectStudent[];

    return {
      success: true,
      message: `Fetched ${studentRows.length} student(s) for this term.`,
      students: studentRows,
      count: studentRows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list term students." };
  }
};

export const listStudentsByGradeLevelService = async (
  gradeLevelId: string
): Promise<StudentResponse> => {
  try {
    const classIds = (
      await db.query.classes.findMany({
        where: eq(classes.gradeLevelId, gradeLevelId),
        columns: { id: true },
      })
    ).map((c) => c.id);

    if (classIds.length === 0) {
      return { success: true, message: "No students — grade level has no classes.", students: [], count: 0 };
    }

    const rows = await db.query.students.findMany({
      where: and(
        inArray(students.classId, classIds),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });

    return {
      success: true,
      message: `Fetched ${rows.length} student(s) for this grade level.`,
      students: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list grade level students." };
  }
};

export const searchStudentsService = async (
  schoolId: string,
  query: string
): Promise<StudentResponse> => {
  try {
    const rows = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        isNull(students.deletedAt),
        or(
          ilike(students.firstName, `%${query}%`),
          ilike(students.lastName, `%${query}%`),
          ilike(students.admissionNumber, `%${query}%`),
          ilike(students.upiNumber, `%${query}%`)
        )
      ),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });

    return {
      success: true,
      message: `Found ${rows.length} student(s) matching "${query}".`,
      students: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to search students." };
  }
};

// ================================================================
// 4. UPDATE / DELETE
// ================================================================
export const updateStudentService = async (
  id: string,
  patch: Partial<Omit<TInsertStudent, "id" | "schoolId" | "userId" | "admissionNumber">>
): Promise<StudentResponse> => {
  try {
    const existing = await db.query.students.findFirst({ where: eq(students.id, id) });
    if (!existing) return { success: false, message: "Student not found." };

    const [updated] = await db
      .update(students)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(students.id, id))
      .returning();

    return { success: true, message: "Student updated.", student: updated };
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return { success: false, message: "Duplicate UPI or admission number." };
    return { success: false, message: e?.message || "Failed to update student." };
  }
};

export const softDeleteStudentService = async (id: string): Promise<StudentResponse> => {
  try {
    const [updated] = await db
      .update(students)
      .set({ deletedAt: new Date(), isEnrolled: false })
      .where(eq(students.id, id))
      .returning();
    if (!updated) return { success: false, message: "Student not found." };
    return { success: true, message: "Student deleted (soft).", student: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete student." };
  }
};

export const restoreStudentService = async (id: string): Promise<StudentResponse> => {
  try {
    const [updated] = await db
      .update(students)
      .set({ deletedAt: null, isEnrolled: true })
      .where(eq(students.id, id))
      .returning();
    if (!updated) return { success: false, message: "Student not found." };
    return { success: true, message: "Student restored.", student: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to restore student." };
  }
};

// ================================================================
// 5. LIFECYCLE — assign / withdraw / promote / graduate / repeat
// ================================================================

/** Thin wrapper around the class-module link service. */
export const enrollStudentInClassService = async (
  studentId: string,
  classId: string,
  opts?: { termId?: string; requireUnplaced?: boolean }
): Promise<StudentResponse> => {
  const result = await linkStudentToClassService(studentId, classId, opts);
  return {
    success: result.success,
    message: result.message,
    student: (result.students && result.students[0]) as TSelectStudent | undefined,
    classRow: result.classRow,
  };
};

export const withdrawStudentService = async (
  id: string,
  reason: string
): Promise<StudentResponse> => {
  try {
    const existing = await db.query.students.findFirst({ where: eq(students.id, id) });
    if (!existing) return { success: false, message: "Student not found." };

    const today = new Date().toISOString().split("T")[0];

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(students)
        .set({
          isEnrolled: false,
          exitDate: today,
          exitReason: reason,
        })
        .where(eq(students.id, id))
        .returning();

      // Mark the active enrollment as Withdrawn
      if (existing.classId) {
        const currentTerm = await getCurrentTerm(existing.schoolId);
        if (currentTerm) {
          await tx
            .update(studentEnrollmentHistory)
            .set({ status: "Withdrawn" })
            .where(
              and(
                eq(studentEnrollmentHistory.studentId, id),
                eq(studentEnrollmentHistory.termId, currentTerm.id)
              )
            );
        }
      }

      return updated;
    });

    return { success: true, message: "Student withdrawn.", student: result };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to withdraw student." };
  }
};

export const reEnrollStudentService = async (id: string): Promise<StudentResponse> => {
  try {
    const [updated] = await db
      .update(students)
      .set({
        isEnrolled: true,
        exitDate: null,
        exitReason: null,
        enrollmentDate: new Date().toISOString().split("T")[0],
      })
      .where(eq(students.id, id))
      .returning();
    if (!updated) return { success: false, message: "Student not found." };
    return { success: true, message: "Student re-enrolled.", student: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to re-enroll student." };
  }
};

export const promoteStudentService = async (
  id: string,
  opts?: { targetClassId?: string; termId?: string }
): Promise<StudentResponse> => {
  try {
    const student = await db.query.students.findFirst({ where: eq(students.id, id) });
    if (!student) return { success: false, message: "Student not found." };
    if (!student.classId)
      return { success: false, message: "Student is not currently in a class." };

    const currentClass = await db.query.classes.findFirst({
      where: eq(classes.id, student.classId),
    });
    if (!currentClass) return { success: false, message: "Current class not found." };

    const currentGrade = await db.query.gradeLevels.findFirst({
      where: eq(gradeLevels.id, currentClass.gradeLevelId),
    });
    if (!currentGrade) return { success: false, message: "Current grade level not found." };
    if (currentGrade.isFinalGrade)
      return {
        success: false,
        message: "Student is in the final grade — use graduate instead of promote.",
      };
    if (!currentGrade.nextGradeLevelId)
      return {
        success: false,
        message: "Promotion ladder is broken — current grade has no next grade.",
      };

    // Find target class (explicit or first class in next grade for same year)
    let targetClassId = opts?.targetClassId;
    if (!targetClassId) {
      const candidates = await db.query.classes.findMany({
        where: and(
          eq(classes.schoolId, student.schoolId),
          eq(classes.gradeLevelId, currentGrade.nextGradeLevelId)
        ),
        orderBy: [asc(classes.stream)],
        limit: 1,
      });
      if (candidates.length === 0)
        return {
          success: false,
          message:
            "No class exists in the next grade level. Create one or pass targetClassId.",
        };
      targetClassId = candidates[0].id;
    }

    // Reuse the class-module link service (handles capacity, history, transfer)
    const result = await linkStudentToClassService(id, targetClassId, {
      termId: opts?.termId,
    });

    return {
      success: result.success,
      message: result.success
        ? `Student promoted to the next grade.`
        : `Promotion failed — ${result.message}`,
      student: (result.students && result.students[0]) as TSelectStudent | undefined,
      classRow: result.classRow,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to promote student." };
  }
};

export const graduateStudentService = async (
  id: string,
  opts?: { termId?: string }
): Promise<StudentResponse> => {
  try {
    const student = await db.query.students.findFirst({ where: eq(students.id, id) });
    if (!student) return { success: false, message: "Student not found." };
    if (!student.classId)
      return { success: false, message: "Student is not in a class." };

    const cls = await db.query.classes.findFirst({ where: eq(classes.id, student.classId) });
    if (!cls) return { success: false, message: "Class not found." };

    const grade = await db.query.gradeLevels.findFirst({
      where: eq(gradeLevels.id, cls.gradeLevelId),
    });
    if (!grade?.isFinalGrade)
      return {
        success: false,
        message: "Student is not in the final grade — cannot graduate.",
      };

    const today = new Date().toISOString().split("T")[0];

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(students)
        .set({
          isEnrolled: false,
          exitDate: today,
          exitReason: "Graduated",
        })
        .where(eq(students.id, id))
        .returning();

      // Update enrollment history
      const termId =
        opts?.termId ?? (await requireCurrentTerm(student.schoolId));
      if (termId) {
        await tx
          .update(studentEnrollmentHistory)
          .set({ status: "Graduated" })
          .where(
            and(
              eq(studentEnrollmentHistory.studentId, id),
              eq(studentEnrollmentHistory.termId, termId)
            )
          );
      }

      return row;
    });

    return { success: true, message: "Student graduated.", student: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to graduate student." };
  }
};

export const repeatGradeService = async (
  id: string,
  opts?: { targetClassId?: string; termId?: string }
): Promise<StudentResponse> => {
  try {
    const student = await db.query.students.findFirst({ where: eq(students.id, id) });
    if (!student) return { success: false, message: "Student not found." };
    if (!student.classId)
      return { success: false, message: "Student is not in a class." };

    // For repeat, target is another class in the same grade level (usually next academic year)
    const currentClass = await db.query.classes.findFirst({
      where: eq(classes.id, student.classId),
    });
    if (!currentClass) return { success: false, message: "Current class not found." };

    let targetClassId = opts?.targetClassId;
    if (!targetClassId) {
      const candidates = await db.query.classes.findMany({
        where: and(
          eq(classes.schoolId, student.schoolId),
          eq(classes.gradeLevelId, currentClass.gradeLevelId),
          ne(classes.id, currentClass.id)
        ),
        limit: 1,
      });
      if (candidates.length === 0)
        return {
          success: false,
          message:
            "No alternate class in the same grade exists. Create one or pass targetClassId.",
        };
      targetClassId = candidates[0].id;
    }

    const result = await linkStudentToClassService(id, targetClassId, {
      termId: opts?.termId,
    });

    return {
      success: result.success,
      message: result.success
        ? "Student retained in the same grade (repeat)."
        : `Repeat failed — ${result.message}`,
      student: (result.students && result.students[0]) as TSelectStudent | undefined,
      classRow: result.classRow,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to repeat grade." };
  }
};

export const transferStudentOutService = async (
  id: string,
  toSchool: string,
  reason: string
): Promise<StudentResponse> => {
  try {
    const existing = await db.query.students.findFirst({ where: eq(students.id, id) });
    if (!existing) return { success: false, message: "Student not found." };

    const today = new Date().toISOString().split("T")[0];

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(students)
        .set({
          isEnrolled: false,
          exitDate: today,
          exitReason: `Transferred to ${toSchool} — ${reason}`,
        })
        .where(eq(students.id, id))
        .returning();

      const termId = await requireCurrentTerm(existing.schoolId);
      if (termId) {
        await tx
          .update(studentEnrollmentHistory)
          .set({ status: "Transferred" })
          .where(
            and(
              eq(studentEnrollmentHistory.studentId, id),
              eq(studentEnrollmentHistory.termId, termId)
            )
          );
      }

      return row;
    });

    return { success: true, message: `Student transferred out to ${toSchool}.`, student: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to transfer student out." };
  }
};

export const bulkPromoteStudentsService = async (
  schoolId: string,
  fromClassId: string,
  toClassId: string,
  opts?: { termId?: string }
): Promise<StudentResponse & { promoted?: number; failed?: number }> => {
  try {
    const fromClass = await db.query.classes.findFirst({
      where: and(eq(classes.id, fromClassId), eq(classes.schoolId, schoolId)),
    });
    if (!fromClass)
      return { success: false, message: "Source class not found in this school." };

    const toClass = await db.query.classes.findFirst({
      where: and(eq(classes.id, toClassId), eq(classes.schoolId, schoolId)),
    });
    if (!toClass) return { success: false, message: "Target class not found in this school." };

    const studentRows = await db.query.students.findMany({
      where: and(
        eq(students.classId, fromClassId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
    });

    let promoted = 0;
    let failed = 0;

    for (const s of studentRows) {
      const result = await linkStudentToClassService(s.id, toClassId, {
        termId: opts?.termId,
      });
      if (result.success) promoted++;
      else failed++;
    }

    return {
      success: true,
      message: `Promoted ${promoted} of ${studentRows.length} students.${failed ? ` ${failed} failed.` : ""}`,
      promoted,
      failed,
      count: studentRows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk-promote students." };
  }
};

// ================================================================
// 6. GUARDIANS
// ================================================================
export const addGuardianService = async (
  studentId: string,
  guardianUserId: string,
  opts?: {
    relationship?: "Mother" | "Father" | "Guardian" | "Sponsor" | "Sibling" | "Other";
    isPrimary?: boolean;
    isFeePayer?: boolean;
    canPickup?: boolean;
  }
): Promise<StudentResponse> => {
  try {
    const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
    if (!student) return { success: false, message: "Student not found." };

    const guardian = await db.query.users.findFirst({
      where: and(eq(users.id, guardianUserId), eq(users.role, "parent")),
    });
    if (!guardian) return { success: false, message: "Parent user not found." };
    if (guardian.schoolId !== student.schoolId)
      return { success: false, message: "Guardian and student must belong to the same school." };

    const existing = await db.query.studentGuardians.findFirst({
      where: and(
        eq(studentGuardians.studentId, studentId),
        eq(studentGuardians.guardianUserId, guardianUserId)
      ),
    });
    if (existing)
      return { success: true, message: "Guardian is already linked.", guardian: existing };

    if (opts?.isPrimary) {
      await db
        .update(studentGuardians)
        .set({ isPrimary: false })
        .where(
          and(
            eq(studentGuardians.studentId, studentId),
            eq(studentGuardians.isPrimary, true)
          )
        );
    }

    const [link] = await db
      .insert(studentGuardians)
      .values({
        schoolId: student.schoolId,
        studentId,
        guardianUserId,
        relationship: opts?.relationship ?? "Guardian",
        isPrimary: opts?.isPrimary ?? false,
        isFeePayer: opts?.isFeePayer ?? false,
        canPickup: opts?.canPickup ?? true,
      })
      .returning();

    return { success: true, message: "Guardian linked.", guardian: link };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to add guardian." };
  }
};

export const removeGuardianService = async (
  studentId: string,
  guardianUserId: string
): Promise<StudentResponse> => {
  try {
    const deleted = await db
      .delete(studentGuardians)
      .where(
        and(
          eq(studentGuardians.studentId, studentId),
          eq(studentGuardians.guardianUserId, guardianUserId)
        )
      )
      .returning();
    if (deleted.length === 0) return { success: false, message: "Link not found." };
    return { success: true, message: "Guardian unlinked." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to remove guardian." };
  }
};

export const setPrimaryGuardianService = async (
  studentId: string,
  guardianUserId: string
): Promise<StudentResponse> => {
  try {
    const exists = await db.query.studentGuardians.findFirst({
      where: and(
        eq(studentGuardians.studentId, studentId),
        eq(studentGuardians.guardianUserId, guardianUserId)
      ),
    });
    if (!exists) return { success: false, message: "Guardian link not found." };

    await db.transaction(async (tx) => {
      await tx
        .update(studentGuardians)
        .set({ isPrimary: false })
        .where(eq(studentGuardians.studentId, studentId));

      await tx
        .update(studentGuardians)
        .set({ isPrimary: true })
        .where(
          and(
            eq(studentGuardians.studentId, studentId),
            eq(studentGuardians.guardianUserId, guardianUserId)
          )
        );
    });

    return { success: true, message: "Primary guardian updated." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to set primary guardian." };
  }
};

export const updateGuardianRelationshipService = async (
  studentId: string,
  guardianUserId: string,
  patch: {
    relationship?: "Mother" | "Father" | "Guardian" | "Sponsor" | "Sibling" | "Other";
    isFeePayer?: boolean;
    canPickup?: boolean;
  }
): Promise<StudentResponse> => {
  try {
    const [updated] = await db
      .update(studentGuardians)
      .set(patch)
      .where(
        and(
          eq(studentGuardians.studentId, studentId),
          eq(studentGuardians.guardianUserId, guardianUserId)
        )
      )
      .returning();
    if (!updated) return { success: false, message: "Guardian link not found." };
    return { success: true, message: "Guardian updated.", guardian: updated };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update guardian." };
  }
};

export const listGuardiansService = async (studentId: string): Promise<StudentResponse> => {
  try {
    const links = await db.query.studentGuardians.findMany({
      where: eq(studentGuardians.studentId, studentId),
      with: {
        guardian: {
          columns: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    return {
      success: true,
      message: `Fetched ${links.length} guardian(s).`,
      guardians: links as any,
      count: links.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list guardians." };
  }
};

export const listStudentsForGuardianService = async (
  guardianUserId: string
): Promise<StudentResponse> => {
  try {
    const links = await db.query.studentGuardians.findMany({
      where: eq(studentGuardians.guardianUserId, guardianUserId),
      with: { student: true },
    });

    const rows = links
      .map((l) => (l as any).student)
      .filter(Boolean) as TSelectStudent[];

    return {
      success: true,
      message: `Fetched ${rows.length} student(s) for this guardian.`,
      students: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list guardian's students." };
  }
};

export const countGuardiansForStudentService = async (
  studentId: string
): Promise<StudentResponse> => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(studentGuardians)
      .where(eq(studentGuardians.studentId, studentId));
    return {
      success: true,
      message: `This student has ${Number(row?.count ?? 0)} guardian(s).`,
      count: Number(row?.count ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count guardians." };
  }
};

// ================================================================
// 7. ENROLLMENT HISTORY
// ================================================================
export const listEnrollmentHistoryService = async (
  studentId: string
): Promise<StudentResponse> => {
  try {
    const rows = await db.query.studentEnrollmentHistory.findMany({
      where: eq(studentEnrollmentHistory.studentId, studentId),
      with: { term: true, class: true },
      orderBy: [desc(studentEnrollmentHistory.createdAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} enrollment record(s).`,
      enrollments: rows as any,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list enrollment history." };
  }
};

export const getCurrentEnrollmentService = async (
  studentId: string
): Promise<StudentResponse> => {
  try {
    const student = await db.query.students.findFirst({ where: eq(students.id, studentId) });
    if (!student) return { success: false, message: "Student not found." };

    const termId = await requireCurrentTerm(student.schoolId);
    if (!termId)
      return { success: false, message: "No current academic term is set for this school." };

    const row = await db.query.studentEnrollmentHistory.findFirst({
      where: and(
        eq(studentEnrollmentHistory.studentId, studentId),
        eq(studentEnrollmentHistory.termId, termId)
      ),
      with: { term: true, class: true },
    });

    if (!row) return { success: false, message: "No enrollment record for the current term." };
    return { success: true, message: "Current enrollment fetched.", enrollment: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch current enrollment." };
  }
};

export const getEnrollmentHistoryByTermService = async (
  studentId: string,
  termId: string
): Promise<StudentResponse> => {
  try {
    const row = await db.query.studentEnrollmentHistory.findFirst({
      where: and(
        eq(studentEnrollmentHistory.studentId, studentId),
        eq(studentEnrollmentHistory.termId, termId)
      ),
      with: { term: true, class: true },
    });
    if (!row) return { success: false, message: "No enrollment record for that term." };
    return { success: true, message: "Enrollment fetched.", enrollment: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch enrollment." };
  }
};

export const getPromotionCandidatesService = async (
  classId: string
): Promise<StudentResponse> => {
  try {
    const rows = await db.query.students.findMany({
      where: and(
        eq(students.classId, classId),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });
    return {
      success: true,
      message: `${rows.length} student(s) are candidates for promotion from this class.`,
      students: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list promotion candidates." };
  }
};

export const getGraduationCandidatesService = async (
  schoolId: string
): Promise<StudentResponse> => {
  try {
    const finalGrade = await db.query.gradeLevels.findFirst({
      where: and(
        eq(gradeLevels.schoolId, schoolId),
        eq(gradeLevels.isFinalGrade, true)
      ),
    });
    if (!finalGrade)
      return { success: false, message: "No final grade level is configured for this school." };

    const classRows = await db.query.classes.findMany({
      where: eq(classes.gradeLevelId, finalGrade.id),
      columns: { id: true },
    });
    const classIds = classRows.map((c) => c.id);
    if (classIds.length === 0)
      return { success: true, message: "No classes in final grade.", students: [], count: 0 };

    const rows = await db.query.students.findMany({
      where: and(
        inArray(students.classId, classIds),
        eq(students.isEnrolled, true),
        isNull(students.deletedAt)
      ),
      orderBy: [asc(students.lastName), asc(students.firstName)],
    });

    return {
      success: true,
      message: `${rows.length} student(s) are candidates for graduation.`,
      students: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list graduation candidates." };
  }
};

// ================================================================
// 8. DOCUMENTS
// ================================================================
export const addDocumentService = async (
  data: {
    schoolId: string;
    studentId: string;
    category: "BirthCertificate" | "TransferLetter" | "ReportForm" | "MedicalReport" | "IdentityDocument" | "Photo" | "Circular" | "Other";
    title: string;
    fileUrl: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    isVisibleToParent?: boolean;
    uploadedBy?: string;
  }
): Promise<StudentResponse> => {
  try {
    const student = await db.query.students.findFirst({
      where: and(
        eq(students.id, data.studentId),
        eq(students.schoolId, data.schoolId)
      ),
    });
    if (!student) return { success: false, message: "Student not found in this school." };

    const [row] = await db.insert(documents).values(data).returning();
    return { success: true, message: "Document added.", document: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to add document." };
  }
};

export const listDocumentsService = async (studentId: string): Promise<StudentResponse> => {
  try {
    const rows = await db.query.documents.findMany({
      where: eq(documents.studentId, studentId),
      orderBy: [desc(documents.createdAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} document(s).`,
      documents: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list documents." };
  }
};

export const deleteDocumentService = async (id: string): Promise<StudentResponse> => {
  try {
    const [deleted] = await db.delete(documents).where(eq(documents.id, id)).returning();
    if (!deleted) return { success: false, message: "Document not found." };
    return { success: true, message: "Document deleted.", document: deleted };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete document." };
  }
};

export const toggleDocumentVisibilityService = async (
  id: string,
  visible: boolean
): Promise<StudentResponse> => {
  try {
    const [updated] = await db
      .update(documents)
      .set({ isVisibleToParent: visible })
      .where(eq(documents.id, id))
      .returning();
    if (!updated) return { success: false, message: "Document not found." };
    return {
      success: true,
      message: visible
        ? "Document is now visible to parents."
        : "Document is now hidden from parents.",
      document: updated,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to toggle visibility." };
  }
};

// ================================================================
// 9. HEALTH RECORDS
// ================================================================
export const addHealthRecordService = async (
  data: {
    schoolId: string;
    studentId: string;
    recordType: "Allergy" | "Condition" | "Vaccination" | "SickBayVisit" | "Injury" | "Other";
    title: string;
    description?: string;
    treatment?: string;
    followUpDate?: string;
    recordedBy?: string;
  }
): Promise<StudentResponse> => {
  try {
    const student = await db.query.students.findFirst({
      where: and(
        eq(students.id, data.studentId),
        eq(students.schoolId, data.schoolId)
      ),
    });
    if (!student) return { success: false, message: "Student not found in this school." };

    const [row] = await db.insert(studentHealthRecords).values(data).returning();
    return { success: true, message: "Health record added.", healthRecord: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to add health record." };
  }
};

export const listHealthRecordsService = async (
  studentId: string
): Promise<StudentResponse> => {
  try {
    const rows = await db.query.studentHealthRecords.findMany({
      where: eq(studentHealthRecords.studentId, studentId),
      orderBy: [desc(studentHealthRecords.recordedAt)],
    });
    return {
      success: true,
      message: `Fetched ${rows.length} health record(s).`,
      healthRecords: rows,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list health records." };
  }
};

// ================================================================
// 10. STATS & VALIDATION
// ================================================================
export const countStudentsBySchoolService = async (
  schoolId: string
): Promise<StudentResponse> => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(students)
      .where(
        and(
          eq(students.schoolId, schoolId),
          eq(students.isEnrolled, true),
          isNull(students.deletedAt)
        )
      );
    return {
      success: true,
      message: `This school has ${Number(row?.count ?? 0)} enrolled student(s).`,
      count: Number(row?.count ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count students." };
  }
};

export const countStudentsByClassService = async (
  classId: string
): Promise<StudentResponse> => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(students)
      .where(
        and(
          eq(students.classId, classId),
          eq(students.isEnrolled, true),
          isNull(students.deletedAt)
        )
      );
    return {
      success: true,
      message: `This class has ${Number(row?.count ?? 0)} enrolled student(s).`,
      count: Number(row?.count ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count class students." };
  }
};

export const countStudentsByGenderService = async (
  schoolId: string
): Promise<StudentResponse & { breakdown?: Record<string, number> }> => {
  try {
    const rows = await db
      .select({ gender: students.gender, count: count() })
      .from(students)
      .where(
        and(
          eq(students.schoolId, schoolId),
          eq(students.isEnrolled, true),
          isNull(students.deletedAt)
        )
      )
      .groupBy(students.gender);

    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const key = r.gender ?? "Unknown";
      breakdown[key] = Number(r.count);
      total += Number(r.count);
    }

    return {
      success: true,
      message: `Gender breakdown computed across ${total} student(s).`,
      breakdown,
      count: total,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count by gender." };
  }
};

export const validateStudentDataService = async (
  id: string
): Promise<StudentResponse> => {
  try {
    const s = await db.query.students.findFirst({ where: eq(students.id, id) });
    if (!s) return { success: false, message: "Student not found." };

    const issues: string[] = [];
    if (!s.admissionNumber) issues.push("Missing admission number.");
    if (!s.firstName) issues.push("Missing first name.");
    if (!s.lastName) issues.push("Missing last name.");
    if (!s.gender) issues.push("Missing gender.");
    if (!s.dateOfBirth) issues.push("Missing date of birth.");
    if (!s.classId) issues.push("Not assigned to a class.");
    if (!s.userId) issues.push("No linked user account (cannot log in).");
    if (s.isEnrolled && !s.classId)
      issues.push("Marked enrolled but not in a class.");

    return {
      success: issues.length === 0,
      message:
        issues.length === 0
          ? "Student data is complete."
          : `${issues.length} issue(s) found.`,
      student: s,
      issues,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to validate student." };
  }
};

export const getStudentStatisticsService = async (
  id: string
): Promise<StudentResponse & { stats?: Record<string, any> }> => {
  try {
    const s = await db.query.students.findFirst({ where: eq(students.id, id) });
    if (!s) return { success: false, message: "Student not found." };

    const [guardianCountRow] = await db
      .select({ count: count() })
      .from(studentGuardians)
      .where(eq(studentGuardians.studentId, id));

    const [enrollmentCountRow] = await db
      .select({ count: count() })
      .from(studentEnrollmentHistory)
      .where(eq(studentEnrollmentHistory.studentId, id));

    const [docCountRow] = await db
      .select({ count: count() })
      .from(documents)
      .where(eq(documents.studentId, id));

    return {
      success: true,
      message: "Student statistics computed.",
      student: s,
      stats: {
        guardians: Number(guardianCountRow?.count ?? 0),
        enrollmentRecords: Number(enrollmentCountRow?.count ?? 0),
        documents: Number(docCountRow?.count ?? 0),
        isEnrolled: s.isEnrolled,
        hasClass: !!s.classId,
        hasLogin: !!s.userId,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute statistics." };
  }
};