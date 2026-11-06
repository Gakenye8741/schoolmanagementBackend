import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import db from "../drizzle/db";
import { schools, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  registerSuperAdminService,
  registerSchoolAdminService,
  registerSchoolMemberService,
  loginService,
  createSessionService,
  revokeSessionService,
  revokeAllUserSessionsService,
  listActiveUserSessionsService,
  forgotPasswordService,
  resetPasswordService,
  changePasswordService,
  getProfileService,
  updateProfileService,
  toggleUserStatusService,
  linkParentChildService,
  unlinkParentChildService,
  listGuardiansForStudentService,
  listSchoolUsersService,
} from "./auth.service";
import {
  registerSuperAdminSchema,
  registerSchoolAdminSchema,
  registerSchoolMemberSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  toggleUserStatusSchema,
  linkParentChildSchema,
  unlinkParentChildSchema,
  listGuardiansForStudentParamsSchema,
} from "../validators/auth.validator";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-me";
const SESSION_COOKIE = "token";

/** In-memory store; replace with a DB-backed table in production. */
const passwordResetTokens = new Map<string, { userId: string; expiresAt: Date }>();

const hasUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

/* -------------------------------------------------------------------------- */
/* 1. Registration                                                            */
/* -------------------------------------------------------------------------- */

export const registerSuperAdminController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = registerSuperAdminSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create your account. Some details are missing or invalid.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { password, ...userData } = validationResult.data;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await registerSuperAdminService({
      ...userData,
      email: userData.email.trim().toLowerCase(),
      passwordHash,
    } as any);

    if (!result.success) {
      res.status(409).json({
        success: false,
        message:
          result.message ??
          "This email is already registered. Try signing in instead.",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Super admin account created successfully. You can now sign in.",
      user: result.user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong on our side while creating the super admin. Please try again.",
    });
  }
};

export const registerSchoolAdminController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = registerSchoolAdminSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't create this school admin. Some details are missing or invalid.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { schoolId, password, ...userData } = validationResult.data;

    const schoolExists = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    });
    if (!schoolExists) {
      res.status(404).json({
        success: false,
        message: "We couldn't find a school with that ID. Please check and try again.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await registerSchoolAdminService({
      schoolId,
      ...userData,
      email: userData.email.trim().toLowerCase(),
      passwordHash,
    } as any);

    if (!result.success) {
      res.status(409).json({
        success: false,
        message:
          result.message ??
          "An account with this email already exists at this school.",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "School admin created successfully.",
      user: result.user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while creating the school admin. Please try again.",
    });
  }
};

export const registerSchoolMemberController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = registerSchoolMemberSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "We couldn't register this member. Some details are missing or invalid.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { schoolId, password, role, ...userData } = validationResult.data;

    const schoolExists = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    });
    if (!schoolExists) {
      res.status(404).json({
        success: false,
        message: "We couldn't find a school with that ID. Please check and try again.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await registerSchoolMemberService(
      {
        schoolId,
        ...userData,
        email: userData.email.trim().toLowerCase(),
        role,
        passwordHash,
      } as any,
      ["teacher", "bursar", "parent"]
    );

    if (!result.success) {
      res.status(409).json({
        success: false,
        message:
          result.message ??
          "This person already exists at this school, or the role isn't allowed here.",
      });
      return;
    }

    const successMessages: Record<string, string> = {
      teacher: "Teacher registered successfully.",
      bursar: "Bursar registered successfully.",
      parent: "Parent registered successfully.",
    };

    res.status(201).json({
      success: true,
      message: successMessages[role] ?? "Member registered successfully.",
      user: result.user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while registering the school member. Please try again.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* 2. Login / sessions                                                        */
/* -------------------------------------------------------------------------- */

export const loginController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please enter your identifier (email, phone, admission or TSC number) and password.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { identifier, password, schoolId } = validationResult.data;

    if (schoolId) {
      const schoolExists = await db.query.schools.findFirst({
        where: eq(schools.id, schoolId),
      });
      if (!schoolExists) {
        res.status(404).json({
          success: false,
          message: "That school doesn't exist. Please check the school context you selected.",
        });
        return;
      }
    }

    const serviceResult = await loginService(identifier, schoolId);
    if (!serviceResult.success || !serviceResult.rawUser) {
      res.status(401).json({
        success: false,
        message: "The credentials you entered are incorrect.",
      });
      return;
    }

    const user = serviceResult.rawUser;
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "The credentials you entered are incorrect.",
      });
      return;
    }

    if (user.mustChangePassword) {
      // Still allow login, but the client can route to "change password".
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
      schoolId: user.schoolId,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    const sessionResult = await createSessionService({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      tokenHash: sha256(token),
      userAgent: req.headers["user-agent"] ?? null,
      ipAddress: (req.ip ?? null) as any,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    if (!sessionResult.success) {
      res.status(500).json({
        success: false,
        message:
          "You signed in, but we couldn't record your session. Please try again in a moment.",
      });
      return;
    }

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: "Welcome back! You have been signed in successfully.",
      user: userWithoutPassword,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while signing you in. Please try again.",
    });
  }
};

export const logoutController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSessionId = req.body?.sessionId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

    if (sessionId && hasUuid(sessionId)) {
      await revokeSessionService(sessionId);
    }

    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({
      success: true,
      message: "You have been signed out. See you soon!",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "We couldn't sign you out cleanly. Please clear your cookies and try again.",
    });
  }
};

export const logoutAllSessionsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "You need to be signed in to do that.",
      });
      return;
    }

    const result = await revokeAllUserSessionsService(userId);
    if (!result.success) {
      res.status(400).json({ success: false, message: result.message });
      return;
    }

    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({
      success: true,
      message: `Signed out of ${result.revokedCount ?? 0} session(s). You've been logged out on all devices.`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while signing you out everywhere. Please try again.",
    });
  }
};

export const listMySessionsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "You need to be signed in to see your sessions.",
      });
      return;
    }

    const result = await listActiveUserSessionsService(userId);
    if (!result.success) {
      res.status(400).json({ success: false, message: result.message });
      return;
    }

    res.status(200).json({
      success: true,
      message: `You're currently signed in on ${result.sessions?.length ?? 0} device(s).`,
      sessions: result.sessions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "We couldn't load your active sessions. Please try again.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* 3. Password / profile                                                      */
/* -------------------------------------------------------------------------- */

export const forgotPasswordController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = forgotPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { email } = validationResult.data;
    const result = await forgotPasswordService(email);

    if (!result.userId) {
      res.status(200).json({
        success: true,
        message: "If that email is registered, you'll receive a reset link shortly.",
      });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    passwordResetTokens.set(resetToken, { userId: result.userId, expiresAt });

    res.status(200).json({
      success: true,
      message: "If that email is registered, you'll receive a reset link shortly.",
      resetToken,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "We couldn't process the password reset. Please try again.",
    });
  }
};

export const resetPasswordController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid reset token and a new password.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { resetToken, newPassword } = validationResult.data;
    const tokenData = passwordResetTokens.get(resetToken);

    if (!tokenData || tokenData.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        message: "This reset link has expired or is invalid. Please request a new one.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = await resetPasswordService(tokenData.userId, passwordHash);

    passwordResetTokens.delete(resetToken);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message ?? "We couldn't reset your password. Please try again.",
      });
      return;
    }

    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({
      success: true,
      message: "Your password has been reset. Please sign in with your new password.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while resetting your password. Please try again.",
    });
  }
};

export const changePasswordController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = changePasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please provide your current password and a new password.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawUserId = req.params.userId;
    const paramUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const userId = paramUserId || (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "You need to be signed in to change your password.",
      });
      return;
    }

    const userProfile = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!userProfile) {
      res.status(404).json({
        success: false,
        message: "We couldn't find your account. Please sign in again.",
      });
      return;
    }

    const { oldPassword, newPassword } = validationResult.data;
    const isMatch = await bcrypt.compare(oldPassword, userProfile.passwordHash);
    if (!isMatch) {
      res.status(400).json({
        success: false,
        message: "Your current password is incorrect.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = await changePasswordService(userId, passwordHash);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message ?? "We couldn't change your password. Please try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Password changed successfully. Use your new password next time.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while changing your password. Please try again.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* 4. Profile                                                                 */
/* -------------------------------------------------------------------------- */

export const getProfileController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawUserId = req.params.userId;
    const paramUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const userId = paramUserId || (req as any).user?.id;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: "We couldn't tell which profile to load. Please sign in again.",
      });
      return;
    }

    const result = await getProfileService(userId);
    if (!result.success) {
      res.status(404).json({
        success: false,
        message: "That user profile doesn't exist.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile loaded successfully.",
      user: result.user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "We couldn't load that profile right now. Please try again.",
    });
  }
};

export const updateProfileController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateProfileSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Some profile details are invalid. Please check and try again.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawUserId = req.params.userId;
    const paramUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const userId = paramUserId || (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "You need to be signed in to update your profile.",
      });
      return;
    }

    const result = await updateProfileService(userId, validationResult.data);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message ?? "We couldn't save your profile changes. Please try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Your profile has been updated successfully.",
      user: result.user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while updating your profile. Please try again.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* 5. Admin actions                                                           */
/* -------------------------------------------------------------------------- */

export const listSchoolUsersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({
        success: false,
        message: "We need a school ID to list its users.",
      });
      return;
    }

    const schoolExists = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    });
    if (!schoolExists) {
      res.status(404).json({
        success: false,
        message: "We couldn't find that school. Please check the ID and try again.",
      });
      return;
    }

    const rawRole = req.query.role;
    const role = typeof rawRole === "string" ? rawRole : undefined;

    const result = await listSchoolUsersService(schoolId, role as any);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message ?? "We couldn't load users for that school. Please try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message:
        (result.users?.length ?? 0) === 0
          ? "No users found for that filter."
          : "School users loaded successfully.",
      users: result.users,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while loading school users. Please try again.",
    });
  }
};

export const toggleUserStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = toggleUserStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please specify whether the account should be active.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawUserId = req.params.userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: "We need a user ID to update their status.",
      });
      return;
    }

    const { isActive } = validationResult.data;
    const result = await toggleUserStatusService(userId, isActive);

    if (!result.success) {
      res.status(404).json({
        success: false,
        message: result.message ?? "We couldn't find that user.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: isActive
        ? "Account has been reactivated successfully."
        : "Account has been deactivated successfully.",
      user: result.user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while updating the user status. Please try again.",
    });
  }
};

/* -------------------------------------------------------------------------- */
/* 6. Guardian ↔ Student links                                                */
/* -------------------------------------------------------------------------- */

export const linkParentChildController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = linkParentChildSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please choose a student and a guardian to link.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { studentId, guardianUserId, relationship, isPrimary, isFeePayer, canPickup } =
      validationResult.data;

    const result = await linkParentChildService(studentId, guardianUserId, {
      relationship,
      isPrimary,
      isFeePayer,
      canPickup,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        message:
          result.message ??
          "We couldn't link that guardian to the student. Please check the IDs and try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: result.message ?? "Guardian has been linked to the student successfully.",
      user: result.user,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while linking the guardian. Please try again.",
    });
  }
};

export const unlinkParentChildController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = unlinkParentChildSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please provide both a student ID and a guardian ID to unlink.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { studentId, guardianUserId } = validationResult.data;
    const result = await unlinkParentChildService(studentId, guardianUserId);

    if (!result.success) {
      res.status(404).json({
        success: false,
        message: "That guardian is not currently linked to the student.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Guardian has been unlinked from the student.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while unlinking the guardian. Please try again.",
    });
  }
};

export const listGuardiansForStudentController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validationResult = listGuardiansForStudentParamsSchema.safeParse(req.params);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid student ID.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { studentId } = validationResult.data;
    const result = await listGuardiansForStudentService(studentId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message ?? "We couldn't load guardians for that student.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message:
        (result.guardians?.length ?? 0) === 0
          ? "This student has no guardians linked yet."
          : "Guardians loaded successfully.",
      guardians: result.guardians,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message:
        error?.message ??
        "Something went wrong while loading guardians. Please try again.",
    });
  }
};