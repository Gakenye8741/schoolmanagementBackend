import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { userRoleEnum } from "../drizzle/schema";

dotenv.config();

// JWT payload type matching your school management roles
type DecodedToken = {
  id: string; // uuid string
  email: string;
  role: typeof userRoleEnum.enumValues[number]; // 'super_admin' | 'school_admin' | 'bursar' | 'teacher' | 'parent' | 'student'
  schoolId?: string | null;
  exp: number;
};

// Extend Express Request with user payload
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

// Token verification helper
export const verifyToken = async (
  token: string,
  secret: string
): Promise<DecodedToken | null> => {
  try {
    const decoded = jwt.verify(token, secret) as DecodedToken;
    return decoded;
  } catch (error) {
    return null;
  }
};

// Auth middleware factory supporting single role, array of roles, or "any"
export const authMiddleware = (
  requiredRoles: (typeof userRoleEnum.enumValues[number]) | (typeof userRoleEnum.enumValues[number])[] | "any"
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Extract token from HttpOnly cookie first, with fallback to Authorization header for testing
    const token = req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({ success: false, message: "Authentication token is missing" });
      return;
    }

    const decodedToken = await verifyToken(
      token,
      process.env.JWT_SECRET || "super-secret-key-change-me"
    );

    if (!decodedToken) {
      res.status(401).json({ success: false, message: "Invalid or expired token" });
      return;
    }

    const userRole = decodedToken.role;

    if (
      requiredRoles === "any" ||
      userRole === requiredRoles ||
      (Array.isArray(requiredRoles) && requiredRoles.includes(userRole))
    ) {
      req.user = decodedToken;
      next();
    } else {
      res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to access this resource",
      });
    }
  };
};

// Role-based middleware exports for School Management System
export const superAdminAuth = authMiddleware("super_admin");
export const schoolAdminAuth = authMiddleware("school_admin");
export const bursarAuth = authMiddleware("bursar");
export const teacherAuth = authMiddleware("teacher");
export const parentAuth = authMiddleware("parent");
export const studentAuth = authMiddleware("student");

// Combined administrative access helpers
export const adminAuth = authMiddleware(["super_admin", "school_admin", "bursar"]);
export const adminOrTeacherAuth = authMiddleware(["super_admin", "school_admin", "teacher", "bursar"]);

// Any authenticated user
export const anyAuthenticatedUser = authMiddleware("any");