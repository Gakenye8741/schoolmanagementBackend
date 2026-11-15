// src/validators/users.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

/**
 * Roles assignable through this module.
 * - `super_admin` — platform-level, not creatable here
 * - `student` — must go through POST /students (creates users + students atomically)
 */
const assignableRole = z.enum([
  "school_admin",
  "principal",
  "deputy_principal",
  "bursar",
  "registrar",
  "librarian",
  "teacher",
  "parent",
]);

/**
 * Roles you can FILTER BY when listing. Includes every possible role —
 * `super_admin` and `student` are readable but not assignable via this module.
 */
export const listableRole = z.enum([
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

const phone = z.string().trim().regex(/^\+?[0-9]{7,20}$/, "Invalid phone number.");

// ================================================================
// CREATE
// ================================================================
export const createUserSchema = z
  .object({
    schoolId: uuid("school ID"),
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(255),
    email: z.string().trim().toLowerCase().email("Invalid email."),
    phone: phone.optional().nullable(),
    nationalId: z.string().trim().max(20).optional().nullable(),
    tscNumber: z.string().trim().max(50).optional().nullable(),
    role: assignableRole,
    extraRoles: z.array(assignableRole).optional().default([]),
    password: z.string().min(8, "Password must be at least 8 characters."),
    mustChangePassword: z.boolean().optional().default(true),
    avatarUrl: z.string().url().optional().nullable(),
  })
  .refine((d) => !d.extraRoles.includes(d.role as any), {
    message: "extraRoles must not include the primary role (it is added automatically).",
  });

export const bulkCreateUsersSchema = z.object({
  schoolId: uuid("school ID"),
  users: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(255),
        email: z.string().trim().toLowerCase().email(),
        phone: phone.optional().nullable(),
        nationalId: z.string().trim().max(20).optional().nullable(),
        tscNumber: z.string().trim().max(50).optional().nullable(),
        role: assignableRole,
        extraRoles: z.array(assignableRole).optional().default([]),
        mustChangePassword: z.boolean().optional().default(true),
      })
    )
    .min(1, "At least one user is required.")
    .max(50, "Cannot create more than 50 users at once.")
    .refine(
      (arr) =>
        new Set(arr.map((u) => u.email.toLowerCase())).size === arr.length,
      { message: "Duplicate emails in the same request." }
    ),
});

// ================================================================
// UPDATE
// ================================================================
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    phone: phone.optional().nullable(),
    nationalId: z.string().trim().max(20).optional().nullable(),
    tscNumber: z.string().trim().max(50).optional().nullable(),
    avatarUrl: z.string().url().optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const updateUserRoleSchema = z.object({
  role: assignableRole,
});

export const updateUserRolesSchema = z
  .object({
    roles: z.array(assignableRole).min(1, "At least one role is required."),
    primaryRole: assignableRole.optional(),
  })
  .refine(
    (d) => !d.primaryRole || d.roles.includes(d.primaryRole),
    { message: "primaryRole must be included in roles." }
  );

export const addUserRoleSchema = z.object({ role: assignableRole });
export const removeUserRoleSchema = z.object({ role: assignableRole });

// ================================================================
// PASSWORD
// ================================================================
export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  mustChangePassword: z.boolean().optional().default(true),
  revokeSessions: z.boolean().optional().default(true),
});

// ================================================================
// BULK ACTIONS
// ================================================================
export const bulkUserActionSchema = z.object({
  userIds: z
    .array(uuid("user ID"))
    .min(1, "At least one user ID required.")
    .max(100, "Cannot process more than 100 users at once."),
});

// ================================================================
// QUERIES — school-scoped
// ================================================================
export const listUsersQuerySchema = z.object({
  role: listableRole.optional(),
  isActive: z.enum(["true", "false"]).optional(),
  includeStudents: z.enum(["true", "false"]).optional().default("true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchUsersQuerySchema = z.object({
  q: z.string().trim().min(1, "Search query is required.").max(255),
  role: listableRole.optional(),
  includeStudents: z.enum(["true", "false"]).optional().default("true"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listSessionsQuerySchema = z.object({
  activeOnly: z.enum(["true", "false"]).optional().default("true"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const recentlyActiveQuerySchema = z.object({
  withinDays: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ================================================================
// QUERIES — super admin (system-wide)
// ================================================================
export const listAllUsersQuerySchema = z.object({
  schoolId: z.string().uuid("Invalid school ID.").optional(),
  role: listableRole.optional(),
  isActive: z.enum(["true", "false"]).optional(),
  search: z.string().trim().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ================================================================
// PARAMS
// ================================================================
export const userIdParamSchema = z.object({ userId: uuid("user ID") });
export const sessionIdParamSchema = z.object({ sessionId: uuid("session ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });
export const roleParamSchema = z.object({ role: listableRole });

// ================================================================
// Inferred types
// ================================================================
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type BulkCreateUsersInput = z.infer<typeof bulkCreateUsersSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;