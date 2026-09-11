import { Router } from "express";
import {
  registerSuperAdminController,
  registerSchoolAdminController,
  registerSchoolMemberController,
  loginController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
  changePasswordController,
  getProfileController,
  updateProfileController,
  linkParentChildController,
  listSchoolUsersController,
  toggleUserStatusController,
} from "./auth.controller";
import {
  anyAuthenticatedUser,
  adminAuth,
  superAdminAuth,
  schoolAdminAuth,
  adminOrTeacherAuth,
} from "../middleware/bearAuth";

const router = Router();

// Registration Routes (Split by role hierarchy and access control)
router.post("/register/super-admin", registerSuperAdminController);
router.post("/register/school-admin", superAdminAuth, registerSchoolAdminController);
router.post("/register/member", schoolAdminAuth, registerSchoolMemberController);

// Public Authentication Routes
router.post("/login", loginController);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);

// Authenticated User / Profile Routes (Using explicit routes to maintain path-to-regexp v8 compatibility)
router.post("/logout", anyAuthenticatedUser, logoutController);
router.post("/change-password", anyAuthenticatedUser, changePasswordController);
router.get("/profile", anyAuthenticatedUser, getProfileController);
router.get("/profile/:userId", anyAuthenticatedUser, getProfileController);
router.put("/profile", anyAuthenticatedUser, updateProfileController);
router.put("/profile/:userId", anyAuthenticatedUser, updateProfileController);

// Administrative / Management Routes
router.post("/link-parent", adminAuth, linkParentChildController);
router.get("/schools/:schoolId/users", adminOrTeacherAuth, listSchoolUsersController);
router.patch("/users/:userId/status", adminAuth, toggleUserStatusController);

export default router;