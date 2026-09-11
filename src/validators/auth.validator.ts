import { z } from "zod";

export const registerSuperAdminSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(255),
  email: z.string().email("Invalid email address."),
  phone: z.string().max(20, "Phone number is too long.").optional().nullable(),
  nationalId: z.string().max(20, "National ID is too long.").optional().nullable(),
  avatarUrl: z.string().url("Invalid avatar URL.").optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters long."),
});

export const registerSchoolAdminSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID format."),
  name: z.string().min(2, "Name must be at least 2 characters.").max(255),
  email: z.string().email("Invalid email address."),
  phone: z.string().max(20, "Phone number is too long.").optional().nullable(),
  nationalId: z.string().max(20, "National ID is too long.").optional().nullable(),
  tscNumber: z.string().max(50, "TSC number is too long.").optional().nullable(),
  avatarUrl: z.string().url("Invalid avatar URL.").optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters long."),
});

export const registerSchoolMemberSchema = z.object({
  schoolId: z.string().uuid("Invalid school ID format."),
  name: z.string().min(2, "Name must be at least 2 characters.").max(255),
  email: z.string().email("Invalid email address."),
  phone: z.string().max(20, "Phone number is too long.").optional().nullable(),
  nationalId: z.string().max(20, "National ID is too long.").optional().nullable(),
  tscNumber: z.string().max(50, "TSC number is too long.").optional().nullable(),
  admissionNumber: z.string().max(50, "Admission number is too long.").optional().nullable(),
  parentId: z.string().uuid("Invalid parent ID format.").optional().nullable(),
  avatarUrl: z.string().url("Invalid avatar URL.").optional().nullable(),
  role: z.enum(["teacher", "bursar", "student", "parent"], {
    errorMap: () => ({ message: "Invalid role specified for school member registration." }),
  }),
  password: z.string().min(6, "Password must be at least 6 characters long."),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Identifier (email, phone, admission, or TSC number) is required."),
  password: z.string().min(1, "Password is required."),
  schoolId: z.string().uuid("Invalid school ID format.").optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address."),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required."),
  newPassword: z.string().min(6, "New password must be at least 6 characters long."),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(6, "New password must be at least 6 characters long."),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(255).optional(),
  phone: z.string().max(20).optional().nullable(),
  nationalId: z.string().max(20).optional().nullable(),
  tscNumber: z.string().max(50).optional().nullable(),
  admissionNumber: z.string().max(50).optional().nullable(),
  avatarUrl: z.string().url("Invalid avatar URL.").optional().nullable(),
  parentId: z.string().uuid("Invalid parent ID format.").optional().nullable(),
});

export const toggleUserStatusSchema = z.object({
  isActive: z.boolean({ required_error: "isActive status is required." }),
});

export const linkParentChildSchema = z.object({
  studentId: z.string().uuid("Invalid student ID format."),
  parentId: z.string().uuid("Invalid parent ID format."),
});

export type RegisterSuperAdminInput = z.infer<typeof registerSuperAdminSchema>;
export type RegisterSchoolAdminInput = z.infer<typeof registerSchoolAdminSchema>;
export type RegisterSchoolMemberInput = z.infer<typeof registerSchoolMemberSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;
export type LinkParentChildInput = z.infer<typeof linkParentChildSchema>;