import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { userRoleEnum } from "../drizzle/schema";

dotenv.config();

// JWT payload type matching your school management roles.
// `role` is the primary/display role. `roles` is the full set used for
// permission checks. Old tokens (minted before the roles[] migration)
// will only have `role`, which the middleware falls back to.
type DecodedToken = {
  id: string; // uuid string
  email: string;
  role: (typeof userRoleEnum.enumValues)[number];
  roles?: (typeof userRoleEnum.enumValues)[number][];
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

/**
 * Auth middleware factory.
 * Accepts a single role, an array of roles, or the string "any" (any authenticated user).
 */
export const authMiddleware = (
  requiredRoles:
    | (typeof userRoleEnum.enumValues)[number]
    | (typeof userRoleEnum.enumValues)[number][]
    | "any"
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Extract token from HttpOnly cookie first, fallback to Authorization header for testing
    const token =
      req.cookies?.token ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({
        success: false,
        message: "You need to sign in to do that. No authentication token was provided.",
      });
      return;
    }

    const decodedToken = await verifyToken(
      token,
      process.env.JWT_SECRET || "super-secret-key-change-me"
    );

    if (!decodedToken) {
      res.status(401).json({
        success: false,
        message: "Your session has expired or the token is invalid. Please sign in again.",
      });
      return;
    }

    // Multi-role check: token carries `roles[]`, with a fallback to `[role]`
    // for tokens minted before the roles[] migration.
    const userRoles = decodedToken.roles?.length
      ? decodedToken.roles
      : [decodedToken.role];

    const allowed =
      requiredRoles === "any" ||
      (Array.isArray(requiredRoles)
        ? requiredRoles.some((r) => userRoles.includes(r))
        : userRoles.includes(requiredRoles));

    if (allowed) {
      req.user = decodedToken;
      next();
    } else {
      res.status(403).json({
        success: false,
        message:
          "You don't have permission to access this resource. If you think this is a mistake, contact your administrator.",
      });
    }
  };
};

// ---- Single-role middleware ------------------------------------------------

export const superAdminAuth = authMiddleware("super_admin");
export const principalAuth = authMiddleware("principal");
export const deputyPrincipalAuth = authMiddleware("deputy_principal");
export const schoolAdminAuth = authMiddleware("school_admin" as any); // legacy — see note in router
export const bursarAuth = authMiddleware("bursar");
export const registrarAuth = authMiddleware("registrar");
export const librarianAuth = authMiddleware("librarian");
export const teacherAuth = authMiddleware("teacher");
export const parentAuth = authMiddleware("parent");
export const studentAuth = authMiddleware("student");

// ---- Combined access helpers ----------------------------------------------

/**
 * Any authenticated user, regardless of role.
 */
export const anyAuthenticatedUser = authMiddleware("any");

/**
 * Platform-level admins — super_admin only.
 */
export const platformAdminAuth = authMiddleware("super_admin");

/**
 * School-level management — anyone who can manage school users.
 * Covers the old school_admin role, the new principal/deputy_principal roles,
 * and super_admin.
 */
export const schoolManagementAuth = authMiddleware([
  "super_admin",
  "school_admin",
  "principal",
  "deputy_principal",
]);

/**
 * Administrative access for financial / registry operations.
 */
export const adminAuth = authMiddleware([
  "super_admin",
  "school_admin",
  "principal",
  "deputy_principal",
  "bursar",
  "registrar",
]);

/**
 * School staff — anyone who can see user lists but not necessarily modify them.
 */
export const staffAuth = authMiddleware([
  "super_admin",
  "school_admin",
  "principal",
  "deputy_principal",
  "bursar",
  "registrar",
  "librarian",
  "teacher",
]);

/**
 * Admin or teaching staff — for endpoints that list users within a school.
 */
export const adminOrTeacherAuth = authMiddleware([
  "super_admin",
  "school_admin",
  "principal",
  "deputy_principal",
  "bursar",
  "registrar",
  "librarian",
  "teacher",
]);