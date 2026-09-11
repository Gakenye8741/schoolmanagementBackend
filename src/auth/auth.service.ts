import { eq, or, and } from "drizzle-orm";
import { TInsertUser, TSelectUser } from "../drizzle/types";
import { users } from "../drizzle/schema";
import db from "../drizzle/db";

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: Omit<TSelectUser, "passwordHash">;
  rawUser?: TSelectUser; // Used internally by controllers to handle comparison/tokens
}

/**
 * 1. Register Super Admin (Platform level - no school required)
 */
export const registerSuperAdminService = async (data: TInsertUser): Promise<AuthResponse> => {
  try {
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (existingAdmin) {
      return { success: false, message: "An account with this email already exists." };
    }

    const [newUser] = await db.insert(users).values({
      ...data,
      schoolId: null as any,
      role: "super_admin",
    }).returning();

    const { passwordHash: _, ...userWithoutPassword } = newUser;

    return {
      success: true,
      message: "Super Admin registered successfully.",
      user: userWithoutPassword,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Super Admin registration failed." };
  }
};

/**
 * 2. Register School Admin (Created by Super Admin)
 */
export const registerSchoolAdminService = async (data: TInsertUser): Promise<AuthResponse> => {
  try {
    if (!data.schoolId) {
      return { success: false, message: "School ID is required to register a school administrator." };
    }

    const [newUser] = await db.insert(users).values({
      ...data,
      role: "school_admin",
    }).returning();

    const { passwordHash: _, ...userWithoutPassword } = newUser;

    return {
      success: true,
      message: "School Admin registered successfully.",
      user: userWithoutPassword,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "School Admin registration failed." };
  }
};

/**
 * 3. Register School Staff / Student / Parent
 */
export const registerSchoolMemberService = async (
  data: TInsertUser, 
  allowedRoles: ("teacher" | "bursar" | "student" | "parent")[]
): Promise<AuthResponse> => {
  try {
    if (!data.schoolId) {
      return { success: false, message: "School ID is required." };
    }

    if (!allowedRoles.includes(data.role as any)) {
      return { success: false, message: "Invalid role assignment for this registration channel." };
    }

    const existingUser = await db.query.users.findFirst({
      where: and(
        eq(users.schoolId, data.schoolId),
        eq(users.email, data.email)
      ),
    });

    if (existingUser) {
      return { success: false, message: "A user with this email already exists in this school." };
    }

    const [newUser] = await db.insert(users).values({
      ...data,
    }).returning();

    const { passwordHash: _, ...userWithoutPassword } = newUser;

    return {
      success: true,
      message: `${data.role} registered successfully.`,
      user: userWithoutPassword,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Registration failed." };
  }
};

/**
 * 4. User Login database lookup (Returns raw user including passwordHash for controller verification)
 */
export const loginService = async (identifier: string, schoolId?: string): Promise<{ success: boolean; message: string; rawUser?: TSelectUser }> => {
  try {
    const conditions = [
      eq(users.email, identifier),
      eq(users.phone, identifier),
      eq(users.admissionNumber, identifier),
      eq(users.tscNumber, identifier),
    ];

    const matchedUsers = await db.select().from(users).where(or(...conditions));

    if (matchedUsers.length === 0) {
      return { success: false, message: "Invalid credentials." };
    }

    let user: TSelectUser | undefined;

    if (schoolId) {
      user = matchedUsers.find((u) => u.schoolId === schoolId);
    } else if (matchedUsers.length === 1) {
      user = matchedUsers[0];
    } else {
      return { 
        success: false, 
        message: "Multiple accounts found with this identifier. Please provide a school context." 
      };
    }

    if (!user) {
      return { success: false, message: "User not found for the given school." };
    }

    if (!user.isActive) {
      return { success: false, message: "Account is inactive. Please contact administration." };
    }

    await db.update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return {
      success: true,
      message: "User located successfully.",
      rawUser: user,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Login failed." };
  }
};

export const forgotPasswordService = async (email: string): Promise<{ success: boolean; message: string; userId?: string }> => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return { success: true, message: "If the email exists, a password reset link has been sent." };
    }

    return {
      success: true,
      message: "User found for password reset.",
      userId: user.id,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Could not process password reset." };
  }
};

export const resetPasswordService = async (userId: string, passwordHash: string): Promise<AuthResponse> => {
  try {
    await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true, message: "Password has been reset successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to reset password." };
  }
};

export const changePasswordService = async (
  userId: string,
  passwordHash: string
): Promise<AuthResponse> => {
  try {
    await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true, message: "Password changed successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to change password." };
  }
};

export const getProfileService = async (userId: string): Promise<AuthResponse> => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, message: "User not found." };
    }

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      success: true,
      message: "Profile retrieved successfully.",
      user: userWithoutPassword,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch profile." };
  }
};

export const updateProfileService = async (
  userId: string,
  updates: Partial<Omit<TInsertUser, "passwordHash" | "schoolId">>
): Promise<AuthResponse> => {
  try {
    const [updatedUser] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return { success: false, message: "User not found." };
    }

    const { passwordHash: _, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      message: "Profile updated successfully.",
      user: userWithoutPassword,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update profile." };
  }
};

export const toggleUserStatusService = async (userId: string, isActive: boolean): Promise<AuthResponse> => {
  try {
    const [updatedUser] = await db.update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return { success: false, message: "User not found." };
    }

    const { passwordHash: _, ...userWithoutPassword } = updatedUser;

    return {
      success: true,
      message: `User account ${isActive ? "activated" : "deactivated"} successfully.`,
      user: userWithoutPassword,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update user status." };
  }
};

export const linkParentChildService = async (studentId: string, parentId: string): Promise<AuthResponse> => {
  try {
    const [updatedStudent] = await db.update(users)
      .set({ parentId, updatedAt: new Date() })
      .where(eq(users.id, studentId))
      .returning();

    if (!updatedStudent) {
      return { success: false, message: "Student user not found." };
    }

    const { passwordHash: _, ...userWithoutPassword } = updatedStudent;

    return {
      success: true,
      message: "Parent successfully linked to student.",
      user: userWithoutPassword,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to link parent and student." };
  }
};

export const listSchoolUsersService = async (schoolId: string, role?: string) => {
  try {
    const conditions = role 
      ? and(eq(users.schoolId, schoolId), eq(users.role, role as any))
      : eq(users.schoolId, schoolId);

    const schoolUsers = await db.select().from(users).where(conditions);

    const sanitizedUsers = schoolUsers.map(({ passwordHash, ...rest }) => rest);

    return {
      success: true,
      message: "School users fetched successfully.",
      users: sanitizedUsers,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch school users." };
  }
};