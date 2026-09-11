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
  forgotPasswordService,
  resetPasswordService,
  changePasswordService,
  getProfileService,
  updateProfileService,
  toggleUserStatusService,
  linkParentChildService,
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
} from "../validators/auth.validator";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-me";

const passwordResetTokens = new Map<string, { userId: string; expiresAt: Date }>();

export const registerSuperAdminController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = registerSuperAdminSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { password, ...userData } = validationResult.data;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await registerSuperAdminService({ ...userData, passwordHash } as any);

    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during super admin registration.",
    });
  }
};

export const registerSchoolAdminController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = registerSchoolAdminSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
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
        message: "School not found.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await registerSchoolAdminService({ schoolId, ...userData, passwordHash } as any);

    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during school admin registration.",
    });
  }
};

export const registerSchoolMemberController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = registerSchoolMemberSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
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
        message: "School not found.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await registerSchoolMemberService(
      { schoolId, ...userData, role, passwordHash } as any,
      ["teacher", "bursar", "student", "parent"]
    );

    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during school member registration.",
    });
  }
};
export const loginController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = loginSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
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
          message: "School not found.",
        });
        return;
      }
    }

    const serviceResult = await loginService(identifier, schoolId);

    if (!serviceResult.success || !serviceResult.rawUser) {
      res.status(401).json({
        success: false,
        message: serviceResult.message || "Invalid credentials.",
      });
      return;
    }

    const user = serviceResult.rawUser;

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
      return;
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    // Set the token securely inside an HttpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // false on localhost, true in production
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: "Login successful.",
      user: userWithoutPassword,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during login.",
    });
  }
};

export const logoutController = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred during logout.",
    });
  }
};
export const forgotPasswordController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = forgotPasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { email } = validationResult.data;
    const result = await forgotPasswordService(email);

    if (!result.userId) {
      res.status(200).json({ success: true, message: result.message });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000);

    passwordResetTokens.set(resetToken, { userId: result.userId, expiresAt });

    res.status(200).json({
      success: true,
      message: "Password reset token generated successfully.",
      resetToken,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred processing password reset.",
    });
  }
};

export const resetPasswordController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { resetToken, newPassword } = validationResult.data;
    const tokenData = passwordResetTokens.get(resetToken);

    if (!tokenData || tokenData.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired password reset token.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = await resetPasswordService(tokenData.userId, passwordHash);

    passwordResetTokens.delete(resetToken);

    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred resetting password.",
    });
  }
};

export const changePasswordController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = changePasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const userId = (req as any).user?.id || req.params.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized: User context missing." });
      return;
    }

    const userProfile = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userProfile) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    const { oldPassword, newPassword } = validationResult.data;
    const isMatch = await bcrypt.compare(oldPassword, userProfile.passwordHash);

    if (!isMatch) {
      res.status(400).json({ success: false, message: "Incorrect current password." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = await changePasswordService(userId, passwordHash);

    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred changing password.",
    });
  }
};

export const getProfileController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawUserId = req.params.userId;
    const paramUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const userId = paramUserId || (req as any).user?.id;

    if (!userId) {
      res.status(400).json({ success: false, message: "User ID parameter is required." });
      return;
    }

    const result = await getProfileService(userId);
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred fetching profile.",
    });
  }
};

export const updateProfileController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = updateProfileSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawUserId = req.params.userId;
    const paramUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const userId = paramUserId || (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized: User context missing." });
      return;
    }

    const result = await updateProfileService(userId, validationResult.data);
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred updating profile.",
    });
  }
};

export const linkParentChildController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = linkParentChildSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const { studentId, parentId } = validationResult.data;
    const result = await linkParentChildService(studentId, parentId);

    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred linking parent and child.",
    });
  }
};

export const listSchoolUsersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSchoolId = req.params.schoolId;
    const schoolId = Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId;

    if (!schoolId) {
      res.status(400).json({ success: false, message: "School ID parameter is required." });
      return;
    }

    const schoolExists = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    });

    if (!schoolExists) {
      res.status(404).json({
        success: false,
        message: "School not found.",
      });
      return;
    }

    const rawRole = req.query.role;
    const role = typeof rawRole === "string" ? rawRole : undefined;

    const result = await listSchoolUsersService(schoolId, role);

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred fetching school users.",
    });
  }
};

export const toggleUserStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = toggleUserStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: validationResult.error.format(),
      });
      return;
    }

    const rawUserId = req.params.userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!userId) {
      res.status(400).json({ success: false, message: "Target user ID parameter is required." });
      return;
    }

    const { isActive } = validationResult.data;
    const result = await toggleUserStatusService(userId, isActive);

    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred toggling user status.",
    });
  }
};