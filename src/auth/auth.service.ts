// services/auth.service.ts
import { and, eq, or, isNull, desc } from "drizzle-orm";
import {
  users,
  userSessions,
  verificationTokens,
  studentGuardians,
  TInsertUser,
  TSelectUser,
  TInsertUserSession,
  TSelectUserSession,
  TInsertVerificationToken,
  TSelectVerificationToken,
  TInsertStudentGuardian,
  TSelectStudent,
  students,
} from "../drizzle/schema";

import db from "../drizzle/db";

/** Roles a school-scoped member channel may assign. */
export type SchoolMemberRole = "teacher" | "bursar" | "parent";

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: Omit<TSelectUser, "passwordHash">;
  rawUser?: TSelectUser;           // internal: controllers compare hashes / issue tokens
  student?: TSelectStudent | null; // retained for future students-module integration
}

export interface SessionResponse {
  success: boolean;
  message: string;
  session?: TSelectUserSession;
}

export interface VerificationTokenResponse {
  success: boolean;
  message: string;
  token?: TSelectVerificationToken;
}

const stripPassword = (u: TSelectUser): Omit<TSelectUser, "passwordHash"> => {
  const { passwordHash: _pw, ...rest } = u;
  return rest;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/* -------------------------------------------------------------------------- */
/* 1. Registration                                                            */
/* -------------------------------------------------------------------------- */

/** Register the platform-level super admin (no school). */
export const registerSuperAdminService = async (
  data: TInsertUser
): Promise<AuthResponse> => {
  try {
    const email = normalizeEmail(data.email);

    const existing = await db.query.users.findFirst({
      where: and(eq(users.email, email), isNull(users.schoolId)),
    });

    if (existing) {
      return { success: false, message: "An account with this email already exists." };
    }

    const [newUser] = await db
      .insert(users)
      .values({
        ...data,
        email,
        schoolId: null,
        role: "super_admin",
        roles: ["super_admin"],
      })
      .returning();

    return {
      success: true,
      message: "Super Admin registered successfully.",
      user: stripPassword(newUser),
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Super Admin registration failed." };
  }
};

/** Register a school admin — created by a super admin. */
export const registerSchoolAdminService = async (
  data: TInsertUser
): Promise<AuthResponse> => {
  try {
    if (!data.schoolId) {
      return { success: false, message: "School ID is required to register a school administrator." };
    }

    const email = normalizeEmail(data.email);

    const existing = await db.query.users.findFirst({
      where: and(eq(users.schoolId, data.schoolId), eq(users.email, email)),
    });

    if (existing) {
      return { success: false, message: "A user with this email already exists in this school." };
    }

    const [newUser] = await db
      .insert(users)
      .values({
        ...data,
        email,
        role: "school_admin",
        roles: ["school_admin"],
      })
      .returning();

    return {
      success: true,
      message: "School Admin registered successfully.",
      user: stripPassword(newUser),
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "School Admin registration failed." };
  }
};

/**
 * Register a staff member (teacher / bursar / parent) within a school.
 *
 * Students are NOT registered here — they must go through
 * `POST /students/register` in the students module, which writes to
 * both `users` and `students` atomically.
 */
export const registerSchoolMemberService = async (
  data: TInsertUser,
  allowedRoles: SchoolMemberRole[]
): Promise<AuthResponse> => {
  try {
    if (!data.schoolId) {
      return { success: false, message: "School ID is required." };
    }

    // Students have their own lifecycle — reject early with a helpful message.
    if ((data.role as string) === "student") {
      return {
        success: false,
        message: "Students must be registered through POST /students/register.",
      };
    }

    if (!allowedRoles.includes(data.role as SchoolMemberRole)) {
      return { success: false, message: "Invalid role assignment for this registration channel." };
    }

    const email = normalizeEmail(data.email);

    const existing = await db.query.users.findFirst({
      where: and(eq(users.schoolId, data.schoolId), eq(users.email, email)),
    });

    if (existing) {
      return { success: false, message: "A user with this email already exists in this school." };
    }

    const [newUser] = await db
      .insert(users)
      .values({
        ...data,
        email,
        roles: [data.role!],
      })
      .returning();

    return {
      success: true,
      message: `${data.role} registered successfully.`,
      user: stripPassword(newUser),
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Registration failed." };
  }
};

/* -------------------------------------------------------------------------- */
/* 2. Login / session helpers                                                 */
/* -------------------------------------------------------------------------- */

export const loginService = async (
  identifier: string,
  schoolId?: string
): Promise<{ success: boolean; message: string; rawUser?: TSelectUser }> => {
  try {
    const normalized = identifier.trim();
    const emailCandidate = normalizeEmail(normalized);

    const matchedUsers = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, emailCandidate),
          eq(users.phone, normalized),
          eq(users.admissionNumber, normalized),
          eq(users.tscNumber, normalized)
        )
      );

    if (matchedUsers.length === 0) {
      return { success: false, message: "Invalid credentials." };
    }

    let user: TSelectUser | undefined;

    if (schoolId) {
      user = matchedUsers.find((u) => u.schoolId === schoolId);
    } else if (matchedUsers.length === 1) {
      user = matchedUsers[0];
    } else {
      return {
        success: false,
        message: "Multiple accounts found with this identifier. Please provide a school context.",
      };
    }

    if (!user) return { success: false, message: "User not found for the given school." };
    if (!user.isActive) return { success: false, message: "Account is inactive. Please contact administration." };
    if (user.deletedAt) return { success: false, message: "Account no longer exists." };

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return { success: true, message: "User located successfully.", rawUser: user };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Login failed." };
  }
};

export const createSessionService = async (
  data: TInsertUserSession
): Promise<SessionResponse> => {
  try {
    const [session] = await db.insert(userSessions).values(data).returning();
    return { success: true, message: "Session created.", session };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to create session." };
  }
};

export const getActiveSessionByTokenHashService = async (
  tokenHash: string
): Promise<SessionResponse> => {
  try {
    const session = await db.query.userSessions.findFirst({
      where: and(
        eq(userSessions.tokenHash, tokenHash),
        isNull(userSessions.revokedAt)
      ),
    });

    if (!session) return { success: false, message: "Session not found or revoked." };
    if (session.expiresAt < new Date()) {
      return { success: false, message: "Session expired." };
    }

    return { success: true, message: "Session is active.", session };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to look up session." };
  }
};

export const touchSessionService = async (sessionId: string): Promise<SessionResponse> => {
  try {
    const [session] = await db
      .update(userSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(userSessions.id, sessionId))
      .returning();

    if (!session) return { success: false, message: "Session not found." };
    return { success: true, message: "Session touched.", session };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to touch session." };
  }
};

export const revokeSessionService = async (
  sessionId: string
): Promise<SessionResponse> => {
  try {
    const [session] = await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.id, sessionId))
      .returning();

    if (!session) return { success: false, message: "Session not found." };
    return { success: true, message: "Session revoked.", session };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to revoke session." };
  }
};

export const revokeAllUserSessionsService = async (
  userId: string
): Promise<{ success: boolean; message: string; revokedCount?: number }> => {
  try {
    const revoked = await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .returning({ id: userSessions.id });

    return {
      success: true,
      message: `Revoked ${revoked.length} session(s).`,
      revokedCount: revoked.length,
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to revoke sessions." };
  }
};

export const listActiveUserSessionsService = async (
  userId: string
): Promise<{ success: boolean; message: string; sessions?: TSelectUserSession[] }> => {
  try {
    const sessions = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .orderBy(desc(userSessions.lastUsedAt));

    return { success: true, message: "Sessions fetched.", sessions };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to list sessions." };
  }
};

/* -------------------------------------------------------------------------- */
/* 3. Password / profile                                                      */
/* -------------------------------------------------------------------------- */

export const forgotPasswordService = async (
  email: string
): Promise<{ success: boolean; message: string; userId?: string }> => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, normalizeEmail(email)),
    });

    if (!user || user.deletedAt) {
      return {
        success: true,
        message: "If the email exists, a password reset link has been sent.",
      };
    }

    return {
      success: true,
      message: "If the email exists, a password reset link has been sent.",
      userId: user.id,
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Could not process password reset." };
  }
};

export const resetPasswordService = async (
  userId: string,
  passwordHash: string
): Promise<AuthResponse> => {
  try {
    const [updated] = await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) return { success: false, message: "User not found." };

    await revokeAllUserSessionsService(userId);

    return { success: true, message: "Password has been reset successfully." };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to reset password." };
  }
};

export const changePasswordService = async (
  userId: string,
  passwordHash: string
): Promise<AuthResponse> => {
  try {
    const [updated] = await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) return { success: false, message: "User not found." };
    return { success: true, message: "Password changed successfully." };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to change password." };
  }
};

export const getProfileService = async (userId: string): Promise<AuthResponse> => {
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return { success: false, message: "User not found." };

    return {
      success: true,
      message: "Profile retrieved successfully.",
      user: stripPassword(user),
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to fetch profile." };
  }
};

export const updateProfileService = async (
  userId: string,
  updates: Partial<Omit<TInsertUser, "passwordHash" | "schoolId" | "role" | "roles" | "email">>
): Promise<AuthResponse> => {
  try {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) return { success: false, message: "User not found." };

    return {
      success: true,
      message: "Profile updated successfully.",
      user: stripPassword(updatedUser),
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to update profile." };
  }
};

/* -------------------------------------------------------------------------- */
/* 4. Admin actions                                                           */
/* -------------------------------------------------------------------------- */

export const toggleUserStatusService = async (
  userId: string,
  isActive: boolean
): Promise<AuthResponse> => {
  try {
    const [updatedUser] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) return { success: false, message: "User not found." };

    if (!isActive) await revokeAllUserSessionsService(userId);

    return {
      success: true,
      message: `User account ${isActive ? "activated" : "deactivated"} successfully.`,
      user: stripPassword(updatedUser),
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to update user status." };
  }
};

/* -------------------------------------------------------------------------- */
/* 5. Guardian ↔ Student links                                                */
/* -------------------------------------------------------------------------- */

/**
 * Link a parent user to a student via the `student_guardians` join table.
 * @param studentId        students.id (NOT users.id)
 * @param guardianUserId   users.id where role = 'parent'
 */
export const linkParentChildService = async (
  studentId: string,
  guardianUserId: string,
  extras: Partial<
    Pick<TInsertStudentGuardian, "relationship" | "isPrimary" | "isFeePayer" | "canPickup">
  > = {}
): Promise<AuthResponse> => {
  try {
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (!student) return { success: false, message: "Student not found." };

    const guardian = await db.query.users.findFirst({
      where: and(eq(users.id, guardianUserId), eq(users.role, "parent")),
    });

    if (!guardian) return { success: false, message: "Parent user not found." };

    if (guardian.schoolId !== student.schoolId) {
      return {
        success: false,
        message: "Guardian and student must belong to the same school.",
      };
    }

    const existing = await db.query.studentGuardians.findFirst({
      where: and(
        eq(studentGuardians.studentId, studentId),
        eq(studentGuardians.guardianUserId, guardianUserId)
      ),
    });
    if (existing) {
      return { success: true, message: "Guardian is already linked to this student." };
    }

    if (extras.isPrimary) {
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

    await db.insert(studentGuardians).values({
      schoolId: student.schoolId,
      studentId,
      guardianUserId,
      relationship: extras.relationship ?? "Guardian",
      isPrimary: extras.isPrimary ?? false,
      isFeePayer: extras.isFeePayer ?? false,
      canPickup: extras.canPickup ?? true,
    });

    return {
      success: true,
      message: "Parent successfully linked to student.",
      user: stripPassword(guardian),
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to link parent and student." };
  }
};

/** Remove a guardian ↔ student link. */
export const unlinkParentChildService = async (
  studentId: string,
  guardianUserId: string
): Promise<AuthResponse> => {
  try {
    const deleted = await db
      .delete(studentGuardians)
      .where(
        and(
          eq(studentGuardians.studentId, studentId),
          eq(studentGuardians.guardianUserId, guardianUserId)
        )
      )
      .returning({ id: studentGuardians.id });

    if (deleted.length === 0) {
      return { success: false, message: "Guardian link not found." };
    }
    return { success: true, message: "Guardian unlinked from student." };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to unlink guardian." };
  }
};

/**
 * List all guardians linked to a given student.
 * Requires `studentGuardiansRelations` with a `guardian` relation to `users`.
 */
export const listGuardiansForStudentService = async (studentId: string) => {
  try {
    const links = await db.query.studentGuardians.findMany({
      where: eq(studentGuardians.studentId, studentId),
      with: {
        guardian: {
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
    });

    return {
      success: true,
      message: "Guardians fetched.",
      guardians: links.map((link) => ({
        ...link.guardian,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
        isFeePayer: link.isFeePayer,
        canPickup: link.canPickup,
      })),
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to fetch guardians." };
  }
};

export const listSchoolUsersService = async (
  schoolId: string,
  role?: TInsertUser["role"]
) => {
  try {
    const whereClause = role
      ? and(eq(users.schoolId, schoolId), eq(users.role, role))
      : eq(users.schoolId, schoolId);

    const schoolUsers = await db.select().from(users).where(whereClause);

    return {
      success: true,
      message: "School users fetched successfully.",
      users: schoolUsers.map(stripPassword),
    };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to fetch school users." };
  }
};

/* -------------------------------------------------------------------------- */
/* 6. Verification tokens                                                     */
/* -------------------------------------------------------------------------- */

export const issueVerificationTokenService = async (
  data: TInsertVerificationToken
): Promise<VerificationTokenResponse> => {
  try {
    const [token] = await db.insert(verificationTokens).values(data).returning();
    return { success: true, message: "Verification token issued.", token };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to issue verification token." };
  }
};

export const consumeVerificationTokenService = async (
  tokenHash: string,
  purpose: TInsertVerificationToken["purpose"]
): Promise<VerificationTokenResponse> => {
  try {
    const token = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.tokenHash, tokenHash),
        eq(verificationTokens.purpose, purpose),
        isNull(verificationTokens.consumedAt)
      ),
    });

    if (!token) return { success: false, message: "Invalid or used token." };
    if (token.expiresAt < new Date()) return { success: false, message: "Token expired." };

    const [consumed] = await db
      .update(verificationTokens)
      .set({ consumedAt: new Date() })
      .where(eq(verificationTokens.id, token.id))
      .returning();

    return { success: true, message: "Token consumed.", token: consumed };
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Failed to consume token." };
  }
};