// src/services/users/users.route.ts
import { Router } from "express";

import {
  createUserController,
  bulkCreateUsersController,
  getUserByIdController,
  listAllUsersController,
  listUsersForSchoolController,
  listUsersByRoleController,
  searchUsersController,
  updateUserController,
  updateUserRoleController,
  updateUserRolesController,
  addUserRoleController,
  removeUserRoleController,
  activateUserController,
  deactivateUserController,
  bulkDeactivateUsersController,
  bulkActivateUsersController,
  resetUserPasswordController,
  forcePasswordChangeController,
  clearMustChangePasswordController,
  softDeleteUserController,
  restoreUserController,
  listUserSessionsController,
  revokeUserSessionController,
  revokeAllUserSessionsController,
  getUsersStatsController,
  countUsersByRoleController,
  getRecentlyActiveUsersController,
  getNeverLoggedInUsersController,
  exportUsersController,
} from "./users.controller";
import {
  schoolManagementAuth,
  superAdminAuth,
} from "../../middleware/bearAuth";

const usersRouter = Router();

// ================================================================
// SUPER ADMIN — system-wide user list
// ================================================================
usersRouter.get("/admin/users", superAdminAuth, listAllUsersController);

// ================================================================
// SCHOOL-SCOPED — create users
// ================================================================
usersRouter.post(
  "/schools/:schoolId/users",
  schoolManagementAuth,
  createUserController
);
usersRouter.post(
  "/schools/:schoolId/users/bulk",
  schoolManagementAuth,
  bulkCreateUsersController
);

// ================================================================
// SCHOOL-SCOPED — read
// (static sub-paths BEFORE the parameterised /:schoolId/users)
// ================================================================
usersRouter.get(
  "/schools/:schoolId/users/stats",
  schoolManagementAuth,
  getUsersStatsController
);
usersRouter.get(
  "/schools/:schoolId/users/recently-active",
  schoolManagementAuth,
  getRecentlyActiveUsersController
);
usersRouter.get(
  "/schools/:schoolId/users/never-logged-in",
  schoolManagementAuth,
  getNeverLoggedInUsersController
);
usersRouter.get(
  "/schools/:schoolId/users/export",
  superAdminAuth,
  exportUsersController
);
usersRouter.get(
  "/schools/:schoolId/users/search",
  schoolManagementAuth,
  searchUsersController
);
usersRouter.get(
  "/schools/:schoolId/users/by-role/:role/count",
  schoolManagementAuth,
  countUsersByRoleController
);
usersRouter.get(
  "/schools/:schoolId/users/by-role/:role",
  schoolManagementAuth,
  listUsersByRoleController
);
usersRouter.get(
  "/schools/:schoolId/users",
  schoolManagementAuth,
  listUsersForSchoolController
);

// ================================================================
// SINGLE USER — read
// ================================================================
usersRouter.get(
  "/users/:userId",
  schoolManagementAuth,
  getUserByIdController
);

// ================================================================
// SINGLE USER — update profile
// ================================================================
usersRouter.patch(
  "/users/:userId",
  schoolManagementAuth,
  updateUserController
);

// ================================================================
// SINGLE USER — role management
// ================================================================
usersRouter.patch(
  "/users/:userId/role",
  schoolManagementAuth,
  updateUserRoleController
);
usersRouter.put(
  "/users/:userId/roles",
  schoolManagementAuth,
  updateUserRolesController
);
usersRouter.post(
  "/users/:userId/roles/add",
  schoolManagementAuth,
  addUserRoleController
);
usersRouter.post(
  "/users/:userId/roles/remove",
  schoolManagementAuth,
  removeUserRoleController
);

// ================================================================
// BULK ACTIONS — static paths, before any /:userId POST route
// ================================================================
usersRouter.post(
  "/users/bulk-deactivate",
  schoolManagementAuth,
  bulkDeactivateUsersController
);
usersRouter.post(
  "/users/bulk-activate",
  schoolManagementAuth,
  bulkActivateUsersController
);

// ================================================================
// SINGLE USER — status
// ================================================================
usersRouter.post(
  "/users/:userId/activate",
  schoolManagementAuth,
  activateUserController
);
usersRouter.post(
  "/users/:userId/deactivate",
  schoolManagementAuth,
  deactivateUserController
);

// ================================================================
// SINGLE USER — password
// ================================================================
usersRouter.post(
  "/users/:userId/reset-password",
  schoolManagementAuth,
  resetUserPasswordController
);
usersRouter.post(
  "/users/:userId/force-password-change",
  schoolManagementAuth,
  forcePasswordChangeController
);
usersRouter.post(
  "/users/:userId/clear-must-change-password",
  schoolManagementAuth,
  clearMustChangePasswordController
);

// ================================================================
// SINGLE USER — sessions
// ================================================================
usersRouter.get(
  "/users/:userId/sessions",
  schoolManagementAuth,
  listUserSessionsController
);
usersRouter.post(
  "/users/:userId/sessions/revoke-all",
  schoolManagementAuth,
  revokeAllUserSessionsController
);
usersRouter.delete(
  "/sessions/:sessionId",
  schoolManagementAuth,
  revokeUserSessionController
);

// ================================================================
// SINGLE USER — delete / restore
// ================================================================
usersRouter.delete(
  "/users/:userId",
  schoolManagementAuth,
  softDeleteUserController
);
usersRouter.post(
  "/users/:userId/restore",
  schoolManagementAuth,
  restoreUserController
);

export default usersRouter;