import { z } from "zod";

/* ============================================================================
 * SHARED BUILDING BLOCKS
 * ========================================================================== */

const SCHOOL_TYPES = ["Primary", "Secondary", "HighSchool", "Mixed", "ECD", "Tertiary"] as const;
const CURRICULUM_TYPES = ["CBC", "8-4-4", "IGCSE", "British", "Other"] as const;
const SUBSCRIPTION_PLANS = ["Trial", "Basic", "Standard", "Premium", "Enterprise"] as const;
const SUBSCRIPTION_STATUSES = ["Active", "PastDue", "Suspended", "Cancelled", "Expired"] as const;
const GRADIENT_DIRECTIONS = ["to-t", "to-tr", "to-r", "to-br", "to-b", "to-bl", "to-l", "to-tl"] as const;

const RESERVED_SLUGS = [
  "www", "api", "app", "admin", "dashboard", "portal", "login", "register",
  "mail", "support", "help", "static", "assets", "cdn", "staging", "dev", "test",
];

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SLUG = /^[a-z0-9]([a-z0-9-]{1,98}[a-z0-9])$/;
const PHONE = /^\+?[0-9\s-]{7,20}$/;
const MODULE_KEY = /^[a-z][a-z0-9_]{0,49}$/;

const isValidTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const currentYear = new Date().getFullYear();

/** Lowercases + trims, then validates the slug format and reserved words. */
const slugField = z
  .string({ required_error: "Slug is required for URL routing." })
  .trim()
  .toLowerCase()
  .regex(
    SLUG,
    "Slug must be 3-100 characters: lowercase letters, numbers and hyphens only, and cannot start or end with a hyphen."
  )
  .refine((v) => !RESERVED_SLUGS.includes(v), "This slug is reserved. Please choose another.");

const hexColor = (label = "Color") => z.string().regex(HEX_COLOR, `${label} must be a valid hex color (e.g. #0F172A).`);
const urlField = z.string().url("Invalid URL format.");
const phoneField = z.string().trim().regex(PHONE, "Invalid phone number.");
const timezoneField = z.string().refine(isValidTimezone, "Invalid timezone.");
const currencyField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code (e.g. KES).");
const dateField = z
  .string()
  .datetime({ message: "Must be a valid ISO date-time string." })
  .transform((v) => new Date(v));

/** Boolean that also works for query strings ("true" / "false"). */
const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true");

/* ============================================================================
 * PARAMS / IDS
 * ========================================================================== */

export const schoolIdParamSchema = z.object({
  id: z.string().uuid("Invalid school ID."),
});

export const schoolSlugParamSchema = z.object({
  slug: slugField,
});

/* ============================================================================
 * CREATE & GENERAL UPDATE
 * ========================================================================== */

export const createSchoolSchema = z.object({
  // Identity
  name: z.string().trim().min(2, "School name is required and must be at least 2 characters.").max(255),
  shortName: z.string().trim().max(50).optional(),
  slug: slugField,
  motto: z.string().trim().max(255).optional(),
  registrationNumber: z.string().trim().max(100).optional(),
  knecCode: z.string().trim().max(50).optional(),
  schoolType: z.enum(SCHOOL_TYPES, { errorMap: () => ({ message: "Invalid school type." }) }),
  curriculumType: z.enum(CURRICULUM_TYPES, { errorMap: () => ({ message: "Invalid curriculum type." }) }).default("CBC"),
  establishedYear: z.number().int().min(1800).max(currentYear).optional(),

  // Branding
  logoUrl: urlField.optional(),
  faviconUrl: urlField.optional(),
  coverImageUrl: urlField.optional(),
  primaryColor: hexColor("Primary color").default("#0F172A"),
  secondaryColor: hexColor("Secondary color").default("#64748B"),
  accentColor: hexColor("Accent color").optional(),
  gradientFrom: hexColor("Gradient start").optional(),
  gradientTo: hexColor("Gradient end").optional(),
  gradientDirection: z.enum(GRADIENT_DIRECTIONS).default("to-r"),

  // Contact & location
  address: z.string().trim().optional(),
  county: z.string().trim().max(100).optional(),
  subCounty: z.string().trim().max(100).optional(),
  phone: phoneField.optional(),
  alternativePhone: phoneField.optional(),
  email: z.string().trim().email("Invalid email format.").max(255).optional(),
  website: urlField.optional(),

  // Localization / operations
  timezone: timezoneField.default("Africa/Nairobi"),
  currency: currencyField.default("KES"),
  principalName: z.string().trim().max(150).optional(),

  // Subscription / limits (Super Admin only)
  subscriptionPlan: z.enum(SUBSCRIPTION_PLANS).default("Trial"),
  subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES).default("Active"),
  subscriptionExpiresAt: dateField.optional().nullable(),
  maxStudents: z.number().int().min(0).nullable().optional(), // omit = plan default, null = unlimited
  smsCredits: z.number().int().min(0).optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * General update: every field optional. Billing fields, smsCredits and settings are
 * excluded because they have dedicated, safer endpoints (matches the service's ProtectedFields).
 * Nullable so a client can clear an optional value.
 */
export const updateSchoolSchema = createSchoolSchema
  .omit({
    subscriptionPlan: true,
    subscriptionStatus: true,
    subscriptionExpiresAt: true,
    smsCredits: true,
    settings: true,
    maxStudents: true,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");

export const updateSchoolSlugSchema = z.object({
  slug: slugField,
});

/* ============================================================================
 * STATUS
 * ========================================================================== */

export const toggleSchoolStatusSchema = z.object({
  isActive: z.boolean({ required_error: "isActive boolean field is required." }),
});

export const bulkToggleSchoolStatusSchema = z.object({
  ids: z.array(z.string().uuid("Invalid school ID.")).min(1, "Provide at least one school ID.").max(100),
  isActive: z.boolean({ required_error: "isActive boolean field is required." }),
});

/* ============================================================================
 * BRANDING
 * ========================================================================== */

export const updateSchoolBrandingSchema = z
  .object({
    logoUrl: urlField.nullable().optional(),
    faviconUrl: urlField.nullable().optional(),
    coverImageUrl: urlField.nullable().optional(),
    primaryColor: hexColor("Primary color").optional(),
    secondaryColor: hexColor("Secondary color").optional(),
    accentColor: hexColor("Accent color").nullable().optional(),
    gradientFrom: hexColor("Gradient start").nullable().optional(),
    gradientTo: hexColor("Gradient end").nullable().optional(),
    gradientDirection: z.enum(GRADIENT_DIRECTIONS).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide at least one branding field.");

export const updateSchoolLogoSchema = z.object({
  logoUrl: urlField.nullable(),
});

/* ============================================================================
 * IDENTITY, CONTACT, LOCALIZATION, CURRICULUM
 * ========================================================================== */

/** Identity details (service #21). Timezone/currency now live in the localization schema. */
export const updateSchoolSettingsSchema = z
  .object({
    name: z.string().trim().min(2, "School name must be at least 2 characters.").max(255).optional(),
    shortName: z.string().trim().max(50).nullable().optional(),
    motto: z.string().trim().max(255).nullable().optional(),
    registrationNumber: z.string().trim().max(100).nullable().optional(),
    knecCode: z.string().trim().max(50).nullable().optional(),
    establishedYear: z.number().int().min(1800).max(currentYear).nullable().optional(),
    principalName: z.string().trim().max(150).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update.");

export const updateSchoolContactSchema = z
  .object({
    address: z.string().trim().nullable().optional(),
    county: z.string().trim().max(100).nullable().optional(),
    subCounty: z.string().trim().max(100).nullable().optional(),
    phone: phoneField.nullable().optional(),
    alternativePhone: phoneField.nullable().optional(),
    email: z.string().trim().email("Invalid email format.").max(255).nullable().optional(),
    website: urlField.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide at least one contact field.");

export const updateSchoolLocalizationSchema = z
  .object({
    timezone: timezoneField.optional(),
    currency: currencyField.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide a timezone or currency.");

export const updateSchoolCurriculumSchema = z
  .object({
    schoolType: z.enum(SCHOOL_TYPES, { errorMap: () => ({ message: "Invalid school type." }) }).optional(),
    curriculumType: z.enum(CURRICULUM_TYPES, { errorMap: () => ({ message: "Invalid curriculum type." }) }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide a school type or curriculum type.");

export const updateSchoolPrincipalSchema = z.object({
  principalName: z.string().trim().min(2, "Principal name must be at least 2 characters.").max(150).nullable(),
});

/* ============================================================================
 * SETTINGS JSON & MODULES
 * ========================================================================== */

export const mergeSchoolSettingsJsonSchema = z.object({
  settings: z
    .record(z.unknown())
    .refine((v) => Object.keys(v).length > 0, "Provide at least one setting."),
});

export const toggleSchoolModuleSchema = z.object({
  moduleKey: z
    .string()
    .regex(MODULE_KEY, "Module key must be lowercase letters, numbers or underscores (e.g. library)."),
  enabled: z.boolean({ required_error: "enabled boolean field is required." }),
});

export const schoolModuleParamSchema = z.object({
  id: z.string().uuid("Invalid school ID."),
  moduleKey: z.string().regex(MODULE_KEY, "Invalid module key."),
});

/* ============================================================================
 * SUBSCRIPTION & BILLING
 * ========================================================================== */

export const updateSchoolSubscriptionSchema = z
  .object({
    subscriptionPlan: z.enum(SUBSCRIPTION_PLANS).optional(),
    subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES).optional(),
    subscriptionExpiresAt: dateField.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide at least one subscription field.");

export const changeSchoolPlanSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS, { errorMap: () => ({ message: "Invalid subscription plan." }) }),
  maxStudents: z.number().int().min(0).nullable().optional(),
  keepExistingLimit: z.boolean().optional(),
});

export const extendSchoolSubscriptionSchema = z.object({
  days: z.number().int("Days must be a whole number.").min(1, "Minimum is 1 day.").max(3650, "Maximum is 3650 days."),
});

export const suspendSchoolSubscriptionSchema = z.object({
  deactivate: z.boolean().optional(),
});

export const expiringSchoolsQuerySchema = z.object({
  withinDays: z.coerce.number().int().min(1).max(365).default(14),
});

export const subscriptionLifecycleSchema = z.object({
  graceDays: z.number().int().min(0).max(90).default(7),
});

/* ============================================================================
 * LIMITS & SMS CREDITS
 * ========================================================================== */

export const setMaxStudentsSchema = z.object({
  maxStudents: z
    .number({ invalid_type_error: "maxStudents must be a number or null." })
    .int("Must be a whole number.")
    .min(0, "Cannot be negative.")
    .nullable(),
});

export const checkStudentLimitQuerySchema = z.object({
  toAdd: z.coerce.number().int().min(1).max(10000).default(1),
});

export const smsCreditsSchema = z.object({
  amount: z.number().int("Amount must be a whole number.").positive("Amount must be greater than zero."),
});

/* ============================================================================
 * QUERIES (lists, availability checks)
 * ========================================================================== */

export const listSchoolsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  schoolType: z.enum(SCHOOL_TYPES).optional(),
  curriculumType: z.enum(CURRICULUM_TYPES).optional(),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLANS).optional(),
  subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES).optional(),
  county: z.string().trim().optional(),
  isActive: queryBoolean.optional(),
  includeDeleted: queryBoolean.optional(),
  sortBy: z.enum(["name", "createdAt", "subscriptionExpiresAt", "county"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const checkSlugQuerySchema = z.object({
  slug: z.string().trim().min(1, "Slug is required."),
  excludeSchoolId: z.string().uuid().optional(),
});

export const checkRegistrationNumberQuerySchema = z.object({
  registrationNumber: z.string().trim().min(1, "Registration number is required."),
  excludeSchoolId: z.string().uuid().optional(),
});

/* ============================================================================
 * INFERRED TYPES
 * ========================================================================== */

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
export type UpdateSchoolBrandingInput = z.infer<typeof updateSchoolBrandingSchema>;
export type UpdateSchoolSettingsInput = z.infer<typeof updateSchoolSettingsSchema>;
export type UpdateSchoolContactInput = z.infer<typeof updateSchoolContactSchema>;
export type UpdateSchoolLocalizationInput = z.infer<typeof updateSchoolLocalizationSchema>;
export type UpdateSchoolCurriculumInput = z.infer<typeof updateSchoolCurriculumSchema>;
export type UpdateSchoolSubscriptionInput = z.infer<typeof updateSchoolSubscriptionSchema>;
export type ChangeSchoolPlanInput = z.infer<typeof changeSchoolPlanSchema>;
export type ListSchoolsQuery = z.infer<typeof listSchoolsQuerySchema>;