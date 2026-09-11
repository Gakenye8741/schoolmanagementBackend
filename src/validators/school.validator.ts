import { z } from "zod";

export const createSchoolSchema = z.object({
  name: z.string().min(2, "School name is required and must be at least 2 characters."),
  shortName: z.string().optional(),
  slug: z.string().min(2, "Slug is required for URL routing."),
  motto: z.string().optional(),
  registrationNumber: z.string().optional(),
  knecCode: z.string().optional(),
  schoolType: z.enum(["Primary", "Secondary", "HighSchool", "Mixed", "ECD", "Tertiary"], {
    errorMap: () => ({ message: "Invalid school type." }),
  }),
  curriculumType: z.enum(["CBC", "8-4-4", "IGCSE", "British"]).default("CBC"),
  establishedYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  
  // Branding
  logoUrl: z.string().url("Invalid URL format.").optional(),
  faviconUrl: z.string().url("Invalid URL format.").optional(),
  coverImageUrl: z.string().url("Invalid URL format.").optional(),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format.").default("#0F172A"),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format.").default("#64748B"),
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format.").optional(),
  gradientFrom: z.string().optional(),
  gradientTo: z.string().optional(),
  gradientDirection: z.string().default("to-r"),

  // Contact & Location
  address: z.string().optional(),
  county: z.string().optional(),
  subCounty: z.string().optional(),
  phone: z.string().optional(),
  alternativePhone: z.string().optional(),
  email: z.string().email("Invalid email format.").optional(),
  website: z.string().url("Invalid website URL.").optional(),

  // Localization / operations
  timezone: z.string().default("Africa/Nairobi"),
  currency: z.string().default("KES"),
  principalName: z.string().optional(),

  // Subscription
  subscriptionPlan: z.enum(["Trial", "Basic", "Standard", "Premium", "Enterprise"]).default("Trial"),
  subscriptionStatus: z.enum(["Active", "Suspended", "Expired", "Cancelled"]).default("Active"),
  subscriptionExpiresAt: z.string().datetime().optional().nullable(),
});

export const updateSchoolSchema = createSchoolSchema.partial();

export const updateSchoolBrandingSchema = z.object({
  logoUrl: z.string().url("Invalid URL format.").optional(),
  faviconUrl: z.string().url("Invalid URL format.").optional(),
  coverImageUrl: z.string().url("Invalid URL format.").optional(),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color.").optional(),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color.").optional(),
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color.").optional(),
  gradientFrom: z.string().optional(),
  gradientTo: z.string().optional(),
  gradientDirection: z.string().optional(),
});

export const updateSchoolSubscriptionSchema = z.object({
  subscriptionPlan: z.enum(["Trial", "Basic", "Standard", "Premium", "Enterprise"]).optional(),
  subscriptionStatus: z.enum(["Active", "Suspended", "Expired", "Cancelled"]).optional(),
  subscriptionExpiresAt: z.string().datetime().optional().nullable(),
});

export const updateSchoolSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  shortName: z.string().optional(),
  motto: z.string().optional(),
  registrationNumber: z.string().optional(),
  knecCode: z.string().optional(),
  establishedYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  principalName: z.string().optional(),
});

export const updateSchoolContactSchema = z.object({
  address: z.string().optional(),
  county: z.string().optional(),
  subCounty: z.string().optional(),
  phone: z.string().optional(),
  alternativePhone: z.string().optional(),
  email: z.string().email("Invalid email format.").optional(),
  website: z.string().url("Invalid website URL.").optional(),
});

export const toggleSchoolStatusSchema = z.object({
  isActive: z.boolean({ required_error: "isActive boolean field is required." }),
});