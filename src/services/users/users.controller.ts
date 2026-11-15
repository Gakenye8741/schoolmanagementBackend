// src/services/users/users.controller.ts
import { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { users } from "../../drizzle/schema";
import db from "../../drizzle/db";

import {
  createUserService,
  bulkCreateUsersService,
  getUserByIdService,
  listAllUsersService,
  listUsersForSchoolService,
  listUsersByRoleService,
  searchUsersService,
  updateUserService,
  updateUserRoleService,
  updateUserRolesService,
  addUserRoleService,
  removeUserRoleService,
  activateUserService,
  deactivateUserService,
  bulkDeactivateUsersService,
  bulkActivateUsersService,
  resetUserPasswordService,
  forcePasswordChangeService,
  clearMustChangePasswordService,
  softDeleteUserService,
  restoreUserService,
  listUserSessionsService,
  revokeUserSessionService,
  revokeAllUserSessionsService,
  getUsersStatsService,
  countUsersByRoleService,
  getRecentlyActiveUsersService,
  getNeverLoggedInUsersService,
  exportUsersService,
} from "./users.service";

import {
  createUserSchema,
  bulkCreateUsersSchema,
  updateUserSchema,
  updateUserRoleSchema,
  updateUserRolesSchema,
  addUserRoleSchema,
  removeUserRoleSchema,
  resetUserPasswordSchema,
  bulkUserActionSchema,
  listUsersQuerySchema,
  listAllUsersQuerySchema,       // ← ADDED (was missing)
  searchUsersQuerySchema,
  listSessionsQuerySchema,
  recentlyActiveQuerySchema,
  userIdParamSchema,
  sessionIdParamSchema,
  schoolIdParamSchema,
  roleParamSchema,
} from "../../validators/users.validator";

// ================================================================
// Response helpers
// ================================================================

const fail = (res: Response, status: number, message: string, issues?: any) =>
  res.status(status).json({ success: false, message, issues });

const ok = (res: Response, result: any, status = 200) =>
  res.status(status).json(result);

const handleZod = (res: Response, err: any) => {
  const first = err?.errors?.[0];
  const field = first?.path?.join(".") ?? "input";
  return fail(res, 400, `${field}: ${first?.message ?? "invalid value"}`, err?.errors);
};

const isZod = (e: any) => e?.name === "ZodError" || Array.isArray(e?.errors);

const actorId = (req: Request): string => (req as any).user?.id ?? "";

// ================================================================
// Access guards
// ================================================================

/**
 * Super admin bypasses. Otherwise the target school must be the actor's school.
 */
const assertSchoolAccess = (req: Request, targetSchoolId: string): string | null => {
  const user = (req as any).user;
  if (!user) return "No user in request.";
  if (user.role === "super_admin") return null;
  if (user.schoolId === targetSchoolId) return null;
  return "You can only manage users in your own school.";
};

/**
 * Super admin bypasses. Otherwise the target user must belong to the actor's school.
 */
const assertUserAccess = async (
  req: Request,
  userId: string
): Promise<string | null> => {
  const actor = (req as any).user;
  if (!actor) return "No user in request.";
  if (actor.role === "super_admin") return null;

  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { schoolId: true },
  });
  if (!target) return "User not found.";
  if (target.schoolId !== actor.schoolId) {
    return "You can only manage users in your own school.";
  }
  return null;
};

// ================================================================
// SUPER ADMIN — system-wide
// ================================================================

/**
 * GET /admin/users
 *
 * Lists users across every school in the system. **Super admin only**
 * (enforced by `superAdminAuth` middleware on the route).
 *
 * Filters:
 *   - schoolId   → restrict to one school
 *   - role       → restrict to one role (teacher, student, parent, …)
 *   - isActive   → true | false
 *   - search     → fuzzy match on name / email / phone
 *   - page,limit → pagination
 */
export const listAllUsersController = async (req: Request, res: Response) => {
  try {
    const q = listAllUsersQuerySchema.parse(req.query);
    const result = await listAllUsersService({
      schoolId: q.schoolId,
      role: q.role,
      isActive: q.isActive === undefined ? undefined : q.isActive === "true",
      search: q.search,
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list users across schools.", e?.message);
  }
};

// ================================================================
// SCHOOL-SCOPED — create
// ================================================================

export const createUserController = async (req: Request, res: Response) => {
  try {
    const body = createUserSchema.parse(req.body);
    const err = assertSchoolAccess(req, body.schoolId);
    if (err) return fail(res, 403, err);
    const result = await createUserService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not create user.", e?.message);
  }
};

export const bulkCreateUsersController = async (req: Request, res: Response) => {
  try {
    const body = bulkCreateUsersSchema.parse(req.body);
    const err = assertSchoolAccess(req, body.schoolId);
    if (err) return fail(res, 403, err);
    const result = await bulkCreateUsersService(body);
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk-create users.", e?.message);
  }
};

// ================================================================
// SCHOOL-SCOPED — read
// ================================================================

/**
 * GET /schools/:schoolId/users
 *
 * Lists every user in a school. This is the school admin's primary view —
 * it includes students, parents, and all staff.
 *
 * Filters:
 *   - role             → any role, including `student` and `parent`
 *   - isActive         → true | false
 *   - includeStudents  → when no role filter is set, decide whether students appear (default true)
 *   - page, limit      → pagination
 */
export const listUsersForSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);

    const q = listUsersQuerySchema.parse(req.query);
    const result = await listUsersForSchoolService(schoolId, {
      role: q.role,
      isActive: q.isActive === undefined ? undefined : q.isActive === "true",
      includeStudents: q.includeStudents === "true",
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list users.", e?.message);
  }
};

/**
 * GET /schools/:schoolId/users/by-role/:role
 *
 * Every user in a school with a specific role. Useful shortcut when you
 * want ALL students / ALL parents / ALL teachers without pagination:
 *   - `/schools/:id/users/by-role/student`
 *   - `/schools/:id/users/by-role/parent`
 *   - `/schools/:id/users/by-role/teacher`
 */
export const listUsersByRoleController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { role } = roleParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const result = await listUsersByRoleService(schoolId, role);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list users.", e?.message);
  }
};

export const getUserByIdController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const result = await getUserByIdService(userId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load user.", e?.message);
  }
};

export const searchUsersController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const q = searchUsersQuerySchema.parse(req.query);
    const result = await searchUsersService(schoolId, q.q, {
      role: q.role,
      includeStudents: q.includeStudents === "true",
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not search users.", e?.message);
  }
};

// ================================================================
// SCHOOL-SCOPED — update profile
// ================================================================

export const updateUserController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const body = updateUserSchema.parse(req.body);
    const result = await updateUserService(userId, body);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update user.", e?.message);
  }
};

// ================================================================
// SCHOOL-SCOPED — role management
// ================================================================

export const updateUserRoleController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const { role } = updateUserRoleSchema.parse(req.body);
    const result = await updateUserRoleService(userId, role);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update role.", e?.message);
  }
};

export const updateUserRolesController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const { roles, primaryRole } = updateUserRolesSchema.parse(req.body);
    const result = await updateUserRolesService(userId, roles, primaryRole);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not update roles.", e?.message);
  }
};

export const addUserRoleController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const { role } = addUserRoleSchema.parse(req.body);
    const result = await addUserRoleService(userId, role);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not add role.", e?.message);
  }
};

export const removeUserRoleController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const { role } = removeUserRoleSchema.parse(req.body);
    const result = await removeUserRoleService(userId, role);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not remove role.", e?.message);
  }
};

// ================================================================
// SCHOOL-SCOPED — status
// ================================================================

export const activateUserController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const result = await activateUserService(userId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not activate user.", e?.message);
  }
};

export const deactivateUserController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const result = await deactivateUserService(userId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not deactivate user.", e?.message);
  }
};

export const bulkDeactivateUsersController = async (req: Request, res: Response) => {
  try {
    const { userIds } = bulkUserActionSchema.parse(req.body);
    for (const id of userIds) {
      const err = await assertUserAccess(req, id);
      if (err) return fail(res, 403, `${id}: ${err}`);
    }
    const result = await bulkDeactivateUsersService(userIds, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk deactivate.", e?.message);
  }
};

export const bulkActivateUsersController = async (req: Request, res: Response) => {
  try {
    const { userIds } = bulkUserActionSchema.parse(req.body);
    for (const id of userIds) {
      const err = await assertUserAccess(req, id);
      if (err) return fail(res, 403, `${id}: ${err}`);
    }
    const result = await bulkActivateUsersService(userIds);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not bulk activate.", e?.message);
  }
};

// ================================================================
// SCHOOL-SCOPED — password
// ================================================================

export const resetUserPasswordController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const body = resetUserPasswordSchema.parse(req.body);
    const result = await resetUserPasswordService(userId, body.newPassword, {
      mustChangePassword: body.mustChangePassword,
      revokeSessions: body.revokeSessions,
    });
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not reset password.", e?.message);
  }
};

export const forcePasswordChangeController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const result = await forcePasswordChangeService(userId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not force change.", e?.message);
  }
};

export const clearMustChangePasswordController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const result = await clearMustChangePasswordService(userId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not clear flag.", e?.message);
  }
};

// ================================================================
// SCHOOL-SCOPED — delete / restore
// ================================================================

export const softDeleteUserController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const result = await softDeleteUserService(userId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not delete user.", e?.message);
  }
};

export const restoreUserController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const result = await restoreUserService(userId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not restore user.", e?.message);
  }
};

// ================================================================
// SCHOOL-SCOPED — sessions
// ================================================================

export const listUserSessionsController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const q = listSessionsQuerySchema.parse(req.query);
    const result = await listUserSessionsService(userId, {
      activeOnly: q.activeOnly === "true",
      page: q.page,
      limit: q.limit,
    });
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list sessions.", e?.message);
  }
};

export const revokeUserSessionController = async (req: Request, res: Response) => {
  try {
    const { sessionId } = sessionIdParamSchema.parse(req.params);
    const result = await revokeUserSessionService(sessionId);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not revoke session.", e?.message);
  }
};

export const revokeAllUserSessionsController = async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamSchema.parse(req.params);
    const err = await assertUserAccess(req, userId);
    if (err) return fail(res, 403, err);
    const result = await revokeAllUserSessionsService(userId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not revoke sessions.", e?.message);
  }
};

// ================================================================
// SCHOOL-SCOPED — stats
// ================================================================

export const getUsersStatsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const result = await getUsersStatsService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute stats.", e?.message);
  }
};

export const countUsersByRoleController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const { role } = roleParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const result = await countUsersByRoleService(schoolId, role);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not count users.", e?.message);
  }
};

export const getRecentlyActiveUsersController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const q = recentlyActiveQuerySchema.parse(req.query);
    const result = await getRecentlyActiveUsersService(schoolId, q.withinDays, q.limit);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list recently active users.", e?.message);
  }
};

export const getNeverLoggedInUsersController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const result = await getNeverLoggedInUsersService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not fetch users.", e?.message);
  }
};

export const exportUsersController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const result = await exportUsersService(schoolId);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not export users.", e?.message);
  }
};