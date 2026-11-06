import { Router } from "express";
import {
  registerSuperAdminController,
  registerSchoolAdminController,
  registerSchoolMemberController,
  loginController,
  logoutController,
  logoutAllSessionsController,
  listMySessionsController,
  forgotPasswordController,
  resetPasswordController,
  changePasswordController,
  getProfileController,
  updateProfileController,
  linkParentChildController,
  unlinkParentChildController,
  listGuardiansForStudentController,
  listSchoolUsersController,
  toggleUserStatusController,
} from "./auth.controller";
import {
  anyAuthenticatedUser,
  adminAuth,
  superAdminAuth,
  schoolManagementAuth,
  adminOrTeacherAuth,
} from "../middleware/bearAuth";

const router = Router();

/* -------------------------------------------------------------------------- */
/* Registration                                                               */
/* -------------------------------------------------------------------------- */

// Bootstrap endpoint — only usable while no super_admin exists (enforce in controller if needed).
router.post("/register/super-admin", registerSuperAdminController);

// School admin creation — only platform admins can do this.
router.post("/register/school-admin", superAdminAuth, registerSchoolAdminController);

// Member creation — school-level management (super_admin / school_admin / principal / deputy_principal).
router.post("/register/member", schoolManagementAuth, registerSchoolMemberController);

/* -------------------------------------------------------------------------- */
/* Public auth                                                                */
/* -------------------------------------------------------------------------- */

router.post("/login", loginController);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);

/* -------------------------------------------------------------------------- */
/* Authenticated user / profile                                               */
/* -------------------------------------------------------------------------- */

router.post("/logout", anyAuthenticatedUser, logoutController);
router.post("/logout-all", anyAuthenticatedUser, logoutAllSessionsController);
router.get("/sessions", anyAuthenticatedUser, listMySessionsController);

router.post("/change-password", anyAuthenticatedUser, changePasswordController);

router.get("/profile", anyAuthenticatedUser, getProfileController);
router.get("/profile/:userId", anyAuthenticatedUser, getProfileController);
router.put("/profile", anyAuthenticatedUser, updateProfileController);
router.put("/profile/:userId", anyAuthenticatedUser, updateProfileController);

/* -------------------------------------------------------------------------- */
/* Guardian ↔ Student links                                                   */
/* -------------------------------------------------------------------------- */

router.post("/guardian-links", adminAuth, linkParentChildController);
router.delete("/guardian-links", adminAuth, unlinkParentChildController);
router.get(
  "/students/:studentId/guardians",
  adminOrTeacherAuth,
  listGuardiansForStudentController
);

/* -------------------------------------------------------------------------- */
/* Administrative / management                                                */
/* -------------------------------------------------------------------------- */

router.get("/schools/:schoolId/users", adminOrTeacherAuth, listSchoolUsersController);
router.patch("/users/:userId/status", adminAuth, toggleUserStatusController);

export default router;