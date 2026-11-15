// src/services/users/users.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, isNotNull, inArray, gte, ilike, or,
} from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";

import {
  users,
  userSessions,
  schools,
  classes,
  TSelectUser,
  TSelectUserSession,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Types
// ================================================================
export type AssignableRole =
  | "school_admin" | "principal" | "deputy_principal"
  | "bursar" | "registrar" | "librarian" | "teacher" | "parent";

/** Roles you can FILTER BY when listing — includes read-only roles. */
export type ListableRole = AssignableRole | "student" | "super_admin";

/** User without the sensitive passwordHash field. */
export type PublicUser = Omit<TSelectUser, "passwordHash">;

export interface UsersResponse {
  success: boolean;
  message: string;
  user?: PublicUser;
  users?: PublicUser[];
  session?: TSelectUserSession;
  sessions?: TSelectUserSession[];
  tempPasswords?: Array<{ userId: string; email: string; password: string }>;
  stats?: Record<string, any>;
  count?: number;
  issues?: string[];
}

// ================================================================
// Constants & helpers
// ================================================================
const SALT_ROUNDS = 10;
const hashPassword = (pwd: string) => bcrypt.hash(pwd, SALT_ROUNDS);

/**
 * Generate a readable 10-char temp password.
 * Uses a char set that excludes confusing glyphs (0/O, 1/l/I).
 */
const genTempPassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[bytes[i] % chars.length];
  return pwd;
};

const sanitize = (u: TSelectUser): PublicUser => {
  const { passwordHash, ...rest } = u;
  return rest;
};

const assertSchoolExists = async (schoolId: string) =>
  await db.query.schools.findFirst({ where: eq(schools.id, schoolId) });

const assertUserInSchool = async (userId: string, schoolId: string) =>
  await db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      eq(users.schoolId, schoolId),
      isNull(users.deletedAt)
    ),
  });

/** Guard: block if this would remove the last active admin in the school. */
const isLastActiveAdmin = async (userId: string, schoolId: string): Promise<boolean> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return false;
  const isAdminRole =
    user.role === "school_admin" || user.role === "principal";
  if (!isAdminRole) return false;

  const [others] = await db
    .select({ c: count() })
    .from(users)
    .where(
      and(
        eq(users.schoolId, schoolId),
        ne(users.id, userId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
        or(eq(users.role, "school_admin"), eq(users.role, "principal"))
      )
    );
  return Number(others?.c ?? 0) === 0;
};

// ================================================================
// 1. Create single user (admin)
// ================================================================
export const createUserService = async (data: {
  schoolId: string;
  name: string;
  email: string;
  phone?: string | null;
  nationalId?: string | null;
  tscNumber?: string | null;
  role: AssignableRole;
  extraRoles?: AssignableRole[];
  password: string;
  mustChangePassword?: boolean;
  avatarUrl?: string | null;
}): Promise<UsersResponse> => {
  try {
    const school = await assertSchoolExists(data.schoolId);
    if (!school) return { success: false, message: "School not found." };

    // roles array must include the primary role (schema check constraint)
    const roles = [...new Set([data.role, ...(data.extraRoles ?? [])])];

    const passwordHash = await hashPassword(data.password);

    const [row] = await db
      .insert(users)
      .values({
        schoolId: data.schoolId,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() || null,
        nationalId: data.nationalId?.trim() || null,
        tscNumber: data.tscNumber?.trim() || null,
        avatarUrl: data.avatarUrl || null,
        passwordHash,
        role: data.role,
        roles,
        isActive: true,
        mustChangePassword: data.mustChangePassword ?? true,
      })
      .returning();

    return {
      success: true,
      message: `User "${row.name}" created as ${data.role}.`,
      user: sanitize(row),
    };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return {
        success: false,
        message:
          "A user with this email, national ID, or TSC number already exists in this school.",
      };
    }
    return { success: false, message: e?.message || "Failed to create user." };
  }
};

// ================================================================
// 2. Bulk create (auto-generated passwords returned once)
// ================================================================
export const bulkCreateUsersService = async (data: {
  schoolId: string;
  users: Array<{
    name: string;
    email: string;
    phone?: string | null;
    nationalId?: string | null;
    tscNumber?: string | null;
    role: AssignableRole;
    extraRoles?: AssignableRole[];
    mustChangePassword?: boolean;
  }>;
}): Promise<UsersResponse> => {
  try {
    const school = await assertSchoolExists(data.schoolId);
    if (!school) return { success: false, message: "School not found." };

    // Hash all passwords in parallel (saves ~90% vs serial)
    const prepared = await Promise.all(
      data.users.map(async (u) => {
        const tempPassword = genTempPassword();
        const passwordHash = await hashPassword(tempPassword);
        return { u, tempPassword, passwordHash };
      })
    );

    const issues: string[] = [];
    const created: PublicUser[] = [];
    const tempPasswords: Array<{ userId: string; email: string; password: string }> = [];

    await db.transaction(async (tx) => {
      for (const { u, tempPassword, passwordHash } of prepared) {
        const roles = [...new Set([u.role, ...(u.extraRoles ?? [])])];
        try {
          const [row] = await tx
            .insert(users)
            .values({
              schoolId: data.schoolId,
              name: u.name.trim(),
              email: u.email.trim().toLowerCase(),
              phone: u.phone?.trim() || null,
              nationalId: u.nationalId?.trim() || null,
              tscNumber: u.tscNumber?.trim() || null,
              passwordHash,
              role: u.role,
              roles,
              isActive: true,
              mustChangePassword: u.mustChangePassword ?? true,
            })
            .returning();
          created.push(sanitize(row));
          tempPasswords.push({ userId: row.id, email: row.email, password: tempPassword });
        } catch (e: any) {
          if (String(e?.code) === "23505") {
            issues.push(`${u.email}: duplicate email/national ID/TSC`);
          } else {
            issues.push(`${u.email}: ${e?.message ?? "insert failed"}`);
          }
        }
      }
    });

    return {
      success: created.length > 0,
      message: `Created ${created.length} of ${data.users.length} user(s).${
        issues.length ? ` ${issues.length} skipped.` : ""
      }`,
      users: created,
      tempPasswords: tempPasswords.length > 0 ? tempPasswords : undefined,
      count: created.length,
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk create users." };
  }
};

// ================================================================
// 3. Get by ID
// ================================================================
export const getUserByIdService = async (
  userId: string
): Promise<UsersResponse> => {
  try {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { school: { columns: { id: true, name: true } } },
    });
    if (!row || row.deletedAt) return { success: false, message: "User not found." };
    return {
      success: true,
      message: "User retrieved.",
      user: sanitize(row as any),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch user." };
  }
};

// ================================================================
// 3b. NEW — List ALL users across the system (super admin)
// ================================================================
export const listAllUsersService = async (opts: {
  schoolId?: string;
  role?: ListableRole;
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
}): Promise<UsersResponse> => {
  try {
    const filters: any[] = [isNull(users.deletedAt)];

    if (opts.schoolId) filters.push(eq(users.schoolId, opts.schoolId));
    if (opts.role) filters.push(eq(users.role, opts.role as any));
    if (opts.isActive !== undefined) filters.push(eq(users.isActive, opts.isActive));
    if (opts.search) {
      const needle = `%${opts.search}%`;
      filters.push(
        or(
          ilike(users.name, needle),
          ilike(users.email, needle),
          ilike(users.phone, needle),
          ilike(users.tscNumber, needle)
        )
      );
    }

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.users.findMany({
        where: and(...filters),
        with: { school: { columns: { id: true, name: true } } },
        orderBy: [asc(users.schoolId), asc(users.role), asc(users.name)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(users).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} user(s) on this page.`,
      users: rows.map((r) => sanitize(r as any)),
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list users." };
  }
};

// ================================================================
// 4. List users for school (paginated, filterable)
// ================================================================
export const listUsersForSchoolService = async (
  schoolId: string,
  opts: {
    role?: ListableRole;
    isActive?: boolean;
    includeStudents?: boolean;
    page: number;
    limit: number;
  }
): Promise<UsersResponse> => {
  try {
    const filters: any[] = [
      eq(users.schoolId, schoolId),
      isNull(users.deletedAt),
    ];

    // Explicit role filter wins (fixes student + includeStudents=false contradiction)
    if (opts.role) {
      filters.push(eq(users.role, opts.role as any));
    } else if (opts.includeStudents === false) {
      filters.push(ne(users.role, "student"));
    }
    if (opts.isActive !== undefined) filters.push(eq(users.isActive, opts.isActive));

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.users.findMany({
        where: and(...filters),
        orderBy: [asc(users.role), asc(users.name)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(users).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} user(s) on this page.`,
      users: rows.map(sanitize),
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list users." };
  }
};

// ================================================================
// 5. List users by role
// ================================================================
export const listUsersByRoleService = async (
  schoolId: string,
  role: ListableRole
): Promise<UsersResponse> => {
  try {
    const rows = await db.query.users.findMany({
      where: and(
        eq(users.schoolId, schoolId),
        eq(users.role, role as any),
        isNull(users.deletedAt)
      ),
      orderBy: [asc(users.name)],
    });
    return {
      success: true,
      message: `${rows.length} ${role}(s).`,
      users: rows.map(sanitize),
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list users." };
  }
};

// ================================================================
// 6. Search (fuzzy by name/email/phone/tsc)
// ================================================================
export const searchUsersService = async (
  schoolId: string,
  q: string,
  opts: { role?: ListableRole; includeStudents?: boolean; limit: number }
): Promise<UsersResponse> => {
  try {
    const filters: any[] = [
      eq(users.schoolId, schoolId),
      isNull(users.deletedAt),
      or(
        ilike(users.name, `%${q}%`),
        ilike(users.email, `%${q}%`),
        ilike(users.phone, `%${q}%`),
        ilike(users.tscNumber, `%${q}%`)
      ),
    ];

    // Explicit role wins
    if (opts.role) {
      filters.push(eq(users.role, opts.role as any));
    } else if (opts.includeStudents === false) {
      filters.push(ne(users.role, "student"));
    }

    const rows = await db.query.users.findMany({
      where: and(...filters),
      orderBy: [asc(users.name)],
      limit: opts.limit,
    });

    return {
      success: true,
      message: `${rows.length} match(es) for "${q}".`,
      users: rows.map(sanitize),
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to search users." };
  }
};

// ================================================================
// 7. Update profile fields (name/phone/nationalId/tsc/avatar)
// ================================================================
export const updateUserService = async (
  userId: string,
  patch: {
    name?: string;
    phone?: string | null;
    nationalId?: string | null;
    tscNumber?: string | null;
    avatarUrl?: string | null;
  }
): Promise<UsersResponse> => {
  try {
    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!existing) return { success: false, message: "User not found." };

    const [row] = await db
      .update(users)
      .set({
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.phone !== undefined && { phone: patch.phone?.trim() || null }),
        ...(patch.nationalId !== undefined && {
          nationalId: patch.nationalId?.trim() || null,
        }),
        ...(patch.tscNumber !== undefined && {
          tscNumber: patch.tscNumber?.trim() || null,
        }),
        ...(patch.avatarUrl !== undefined && { avatarUrl: patch.avatarUrl || null }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return { success: true, message: "User updated.", user: sanitize(row) };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return {
        success: false,
        message: "National ID or TSC number already in use by another user.",
      };
    }
    return { success: false, message: e?.message || "Failed to update user." };
  }
};

// ================================================================
// 8. Update primary role (ensures it stays in roles array)
// ================================================================
export const updateUserRoleService = async (
  userId: string,
  role: AssignableRole
): Promise<UsersResponse> => {
  try {
    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!existing) return { success: false, message: "User not found." };
    if (existing.role === "super_admin") {
      return { success: false, message: "Cannot change super_admin role via this endpoint." };
    }

    // If downgrading last admin, block
    if (
      (existing.role === "school_admin" || existing.role === "principal") &&
      role !== existing.role &&
      (await isLastActiveAdmin(userId, existing.schoolId!))
    ) {
      return {
        success: false,
        message: "Cannot change role: this is the last active admin in the school.",
      };
    }

    // roles array MUST include the new primary role
    const roles = existing.roles.includes(role)
      ? existing.roles
      : [...existing.roles, role];

    const [row] = await db
      .update(users)
      .set({ role, roles, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return {
      success: true,
      message: `Primary role changed to ${role}.`,
      user: sanitize(row),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update role." };
  }
};

// ================================================================
// 9. Replace roles array (primary must be in the new set)
// ================================================================
export const updateUserRolesService = async (
  userId: string,
  roles: AssignableRole[],
  primaryRole?: AssignableRole
): Promise<UsersResponse> => {
  try {
    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!existing) return { success: false, message: "User not found." };
    if (existing.role === "super_admin") {
      return { success: false, message: "Cannot change super_admin roles." };
    }

    const uniqueRoles = [...new Set(roles)];
    const newPrimary = primaryRole ?? existing.role;

    if (!uniqueRoles.includes(newPrimary as any)) {
      return {
        success: false,
        message: `Primary role "${newPrimary}" must be included in the roles array.`,
      };
    }

    // Block last-admin demotion
    if (
      (existing.role === "school_admin" || existing.role === "principal") &&
      !uniqueRoles.includes(existing.role as any) &&
      (await isLastActiveAdmin(userId, existing.schoolId!))
    ) {
      return {
        success: false,
        message: "Cannot remove admin role: this is the last active admin in the school.",
      };
    }

    const [row] = await db
      .update(users)
      .set({ role: newPrimary, roles: uniqueRoles, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return {
      success: true,
      message: `Roles replaced (${uniqueRoles.length}). Primary: ${newPrimary}.`,
      user: sanitize(row),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to update roles." };
  }
};

// ================================================================
// 10. Add one role
// ================================================================
export const addUserRoleService = async (
  userId: string,
  role: AssignableRole
): Promise<UsersResponse> => {
  try {
    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!existing) return { success: false, message: "User not found." };
    if (existing.roles.includes(role)) {
      return { success: true, message: `User already has "${role}".`, user: sanitize(existing) };
    }

    const roles = [...existing.roles, role];
    const [row] = await db
      .update(users)
      .set({ roles, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return {
      success: true,
      message: `Role "${role}" added.`,
      user: sanitize(row),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to add role." };
  }
};

// ================================================================
// 11. Remove one role (blocked if it's the primary role)
// ================================================================
export const removeUserRoleService = async (
  userId: string,
  role: AssignableRole
): Promise<UsersResponse> => {
  try {
    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!existing) return { success: false, message: "User not found." };
    if (existing.role === role) {
      return {
        success: false,
        message:
          "Cannot remove the primary role. Change the primary role first, then remove.",
      };
    }
    if (!existing.roles.includes(role)) {
      return { success: true, message: `User does not have "${role}".`, user: sanitize(existing) };
    }

    const roles = existing.roles.filter((r) => r !== role);
    if (roles.length === 0) {
      return { success: false, message: "User must have at least one role." };
    }

    const [row] = await db
      .update(users)
      .set({ roles, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return {
      success: true,
      message: `Role "${role}" removed.`,
      user: sanitize(row),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to remove role." };
  }
};

// ================================================================
// 12. Activate
// ================================================================
export const activateUserService = async (
  userId: string
): Promise<UsersResponse> => {
  try {
    const [row] = await db
      .update(users)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();
    if (!row) return { success: false, message: "User not found." };
    return { success: true, message: "User activated.", user: sanitize(row) };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to activate user." };
  }
};

// ================================================================
// 13. Deactivate (guards self + last admin)
// ================================================================
export const deactivateUserService = async (
  userId: string,
  actorId: string
): Promise<UsersResponse> => {
  try {
    if (userId === actorId) {
      return { success: false, message: "You cannot deactivate your own account." };
    }
    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!existing) return { success: false, message: "User not found." };
    if (!existing.schoolId) {
      return { success: false, message: "Cannot deactivate a super_admin via this endpoint." };
    }
    if (await isLastActiveAdmin(userId, existing.schoolId)) {
      return {
        success: false,
        message: "Cannot deactivate: this is the last active admin in the school.",
      };
    }

    const [row] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    // Revoke all active sessions immediately
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));

    return { success: true, message: "User deactivated.", user: sanitize(row) };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to deactivate user." };
  }
};

// ================================================================
// 14. Bulk deactivate
// ================================================================
export const bulkDeactivateUsersService = async (
  userIds: string[],
  actorId: string
): Promise<UsersResponse> => {
  try {
    // Never deactivate self
    const safeIds = userIds.filter((id) => id !== actorId);
    if (safeIds.length === 0) {
      return { success: false, message: "No valid user IDs (cannot deactivate yourself)." };
    }

    // Exclude last active admins
    const valid: string[] = [];
    const issues: string[] = [];
    for (const id of safeIds) {
      const u = await db.query.users.findFirst({ where: eq(users.id, id) });
      if (!u) { issues.push(`${id}: not found`); continue; }
      if (!u.schoolId) { issues.push(`${u.email}: super_admin`); continue; }
      if (await isLastActiveAdmin(id, u.schoolId)) {
        issues.push(`${u.email}: last active admin`);
        continue;
      }
      valid.push(id);
    }

    if (valid.length === 0) {
      return {
        success: false,
        message: "No users could be deactivated.",
        issues,
      };
    }

    const rows = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(users.id, valid))
      .returning();

    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(inArray(userSessions.userId, valid), isNull(userSessions.revokedAt)));

    return {
      success: true,
      message: `Deactivated ${rows.length} user(s).${
        issues.length ? ` ${issues.length} skipped.` : ""
      }`,
      users: rows.map(sanitize),
      count: rows.length,
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk deactivate." };
  }
};

// ================================================================
// 15. Bulk activate
// ================================================================
export const bulkActivateUsersService = async (
  userIds: string[]
): Promise<UsersResponse> => {
  try {
    const rows = await db
      .update(users)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(inArray(users.id, userIds), isNull(users.deletedAt)))
      .returning();
    return {
      success: true,
      message: `Activated ${rows.length} user(s).`,
      users: rows.map(sanitize),
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to bulk activate." };
  }
};

// ================================================================
// 16. Reset password (admin sets new one)
// ================================================================
export const resetUserPasswordService = async (
  userId: string,
  newPassword: string,
  opts: { mustChangePassword: boolean; revokeSessions: boolean }
): Promise<UsersResponse> => {
  try {
    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!existing) return { success: false, message: "User not found." };

    const passwordHash = await hashPassword(newPassword);

    const [row] = await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: opts.mustChangePassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    let revokedCount = 0;
    if (opts.revokeSessions) {
      const revoked = await db
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
        .returning();
      revokedCount = revoked.length;
    }

    return {
      success: true,
      message: `Password reset.${opts.mustChangePassword ? " User must change it on next login." : ""}${
        revokedCount ? ` ${revokedCount} session(s) revoked.` : ""
      }`,
      user: sanitize(row),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reset password." };
  }
};

// ================================================================
// 17. Force password change on next login
// ================================================================
export const forcePasswordChangeService = async (
  userId: string
): Promise<UsersResponse> => {
  try {
    const [row] = await db
      .update(users)
      .set({ mustChangePassword: true, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();
    if (!row) return { success: false, message: "User not found." };
    return {
      success: true,
      message: "User will be required to change password on next login.",
      user: sanitize(row),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to force change." };
  }
};

// ================================================================
// 18. Clear the must-change flag
// ================================================================
export const clearMustChangePasswordService = async (
  userId: string
): Promise<UsersResponse> => {
  try {
    const [row] = await db
      .update(users)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();
    if (!row) return { success: false, message: "User not found." };
    return {
      success: true,
      message: "Password-change flag cleared.",
      user: sanitize(row),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to clear flag." };
  }
};

// ================================================================
// 19. Soft delete (reversible)
// ================================================================
export const softDeleteUserService = async (
  userId: string,
  actorId: string
): Promise<UsersResponse> => {
  try {
    if (userId === actorId) {
      return { success: false, message: "You cannot delete your own account." };
    }
    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!existing) return { success: false, message: "User not found." };
    if (existing.schoolId && (await isLastActiveAdmin(userId, existing.schoolId))) {
      return {
        success: false,
        message: "Cannot delete: this is the last active admin in the school.",
      };
    }

    // Guard: is this user still a class teacher?
    const teacherOf = await db.query.classes.findFirst({
      where: eq(classes.classTeacherId, userId),
    });
    if (teacherOf) {
      return {
        success: false,
        message: `User is still class teacher of ${teacherOf.stream}. Reassign first.`,
      };
    }

    const [row] = await db
      .update(users)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));

    return { success: true, message: "User soft-deleted.", user: sanitize(row) };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to delete user." };
  }
};

// ================================================================
// 20. Restore soft-deleted user
// ================================================================
export const restoreUserService = async (
  userId: string
): Promise<UsersResponse> => {
  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!existing) return { success: false, message: "User not found." };
    if (!existing.deletedAt) {
      return { success: true, message: "User is not deleted.", user: sanitize(existing) };
    }

    const [row] = await db
      .update(users)
      .set({ deletedAt: null, isActive: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return { success: true, message: "User restored.", user: sanitize(row) };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to restore user." };
  }
};

// ================================================================
// 21. List sessions for a user
// ================================================================
export const listUserSessionsService = async (
  userId: string,
  opts: { activeOnly: boolean; page: number; limit: number }
): Promise<UsersResponse> => {
  try {
    const filters: any[] = [eq(userSessions.userId, userId)];
    if (opts.activeOnly) filters.push(isNull(userSessions.revokedAt));

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.userSessions.findMany({
        where: and(...filters),
        orderBy: [desc(userSessions.lastUsedAt)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(userSessions).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} session(s) on this page.`,
      sessions: rows,
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit, activeOnly: opts.activeOnly },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list sessions." };
  }
};

// ================================================================
// 22. Revoke one session
// ================================================================
export const revokeUserSessionService = async (
  sessionId: string
): Promise<UsersResponse> => {
  try {
    const existing = await db.query.userSessions.findFirst({
      where: eq(userSessions.id, sessionId),
    });
    if (!existing) return { success: false, message: "Session not found." };
    if (existing.revokedAt) {
      return { success: true, message: "Session already revoked.", session: existing };
    }
    const [row] = await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.id, sessionId))
      .returning();
    return { success: true, message: "Session revoked.", session: row };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to revoke session." };
  }
};

// ================================================================
// 23. Revoke all sessions for a user
// ================================================================
export const revokeAllUserSessionsService = async (
  userId: string
): Promise<UsersResponse> => {
  try {
    const rows = await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
      .returning();
    return {
      success: true,
      message: `Revoked ${rows.length} session(s).`,
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to revoke sessions." };
  }
};

// ================================================================
// 24. Users stats
// ================================================================
export const getUsersStatsService = async (
  schoolId: string
): Promise<UsersResponse> => {
  try {
    const [total] = await db
      .select({ c: count() })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), isNull(users.deletedAt)));

    const [active] = await db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.schoolId, schoolId),
          eq(users.isActive, true),
          isNull(users.deletedAt)
        )
      );

    const [neverLoggedIn] = await db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.schoolId, schoolId),
          isNull(users.deletedAt),
          isNull(users.lastLoginAt)
        )
      );

    const [mustChange] = await db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.schoolId, schoolId),
          eq(users.mustChangePassword, true),
          isNull(users.deletedAt)
        )
      );

    const [deleted] = await db
      .select({ c: count() })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), isNotNull(users.deletedAt)));

    const byRole = await db
      .select({ role: users.role, c: count() })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), isNull(users.deletedAt)))
      .groupBy(users.role);

    return {
      success: true,
      message: `${total?.c ?? 0} user(s); ${active?.c ?? 0} active.`,
      stats: {
        total: Number(total?.c ?? 0),
        active: Number(active?.c ?? 0),
        inactive: Number(total?.c ?? 0) - Number(active?.c ?? 0),
        deleted: Number(deleted?.c ?? 0),
        neverLoggedIn: Number(neverLoggedIn?.c ?? 0),
        mustChangePassword: Number(mustChange?.c ?? 0),
        byRole: byRole.reduce<Record<string, number>>((acc, r) => {
          acc[r.role] = Number(r.c);
          return acc;
        }, {}),
      },
      count: Number(total?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute stats." };
  }
};

// ================================================================
// 25. Count by role (simple)
// ================================================================
export const countUsersByRoleService = async (
  schoolId: string,
  role: ListableRole
): Promise<UsersResponse> => {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(users)
      .where(
        and(
          eq(users.schoolId, schoolId),
          eq(users.role, role as any),
          isNull(users.deletedAt)
        )
      );
    return {
      success: true,
      message: `${row?.c ?? 0} ${role}(s).`,
      count: Number(row?.c ?? 0),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to count users." };
  }
};

// ================================================================
// 26. Recently active users
// ================================================================
export const getRecentlyActiveUsersService = async (
  schoolId: string,
  withinDays: number,
  limit: number
): Promise<UsersResponse> => {
  try {
    const cutoff = new Date(Date.now() - withinDays * 86_400_000);
    const rows = await db.query.users.findMany({
      where: and(
        eq(users.schoolId, schoolId),
        isNull(users.deletedAt),
        isNotNull(users.lastLoginAt),
        gte(users.lastLoginAt, cutoff)
      ),
      orderBy: [desc(users.lastLoginAt)],
      limit,
    });
    return {
      success: true,
      message: `${rows.length} user(s) active in the last ${withinDays} day(s).`,
      users: rows.map(sanitize),
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch recently active users." };
  }
};

// ================================================================
// 27. Never-logged-in users
// ================================================================
export const getNeverLoggedInUsersService = async (
  schoolId: string
): Promise<UsersResponse> => {
  try {
    const rows = await db.query.users.findMany({
      where: and(
        eq(users.schoolId, schoolId),
        isNull(users.deletedAt),
        isNull(users.lastLoginAt)
      ),
      orderBy: [asc(users.createdAt)],
    });
    return {
      success: true,
      message: `${rows.length} user(s) have never logged in.`,
      users: rows.map(sanitize),
      count: rows.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch users." };
  }
};

// ================================================================
// 28. Export users (JSON dump for backup / reconciliation)
// ================================================================
export const exportUsersService = async (
  schoolId: string
): Promise<UsersResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const rows = await db.query.users.findMany({
      where: and(eq(users.schoolId, schoolId), isNull(users.deletedAt)),
      orderBy: [asc(users.role), asc(users.name)],
    });

    const clean = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      nationalId: u.nationalId,
      tscNumber: u.tscNumber,
      role: u.role,
      roles: u.roles,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
      createdAt: new Date(u.createdAt).toISOString(),
    }));

    return {
      success: true,
      message: `Exported ${clean.length} user(s).`,
      stats: {
        school: { id: school.id, name: school.name },
        exportedAt: new Date().toISOString(),
        users: clean,
      },
      count: clean.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to export users." };
  }
};