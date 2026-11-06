import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, lt, lte, gte, or, sql, SQL } from "drizzle-orm";
import { TInsertSchool, TSelectSchool } from "../../drizzle/types";
import db from "../../drizzle/db";
import { schools, students, users } from "../../drizzle/schema";

/* ============================================================================
 * TYPES
 * ========================================================================== */

export type SubscriptionPlan = "Trial" | "Basic" | "Standard" | "Premium" | "Enterprise";
export type SubscriptionStatus = "Active" | "PastDue" | "Suspended" | "Cancelled" | "Expired";
export type SchoolType = TSelectSchool["schoolType"];
export type CurriculumType = TSelectSchool["curriculumType"];

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SchoolResponse<T = unknown> {
  success: boolean;
  message: string;
  school?: TSelectSchool;
  schools?: TSelectSchool[];
  pagination?: Pagination;
  data?: T;
}

export interface ListSchoolsParams {
  page?: number;
  limit?: number;
  search?: string;
  schoolType?: SchoolType;
  curriculumType?: CurriculumType;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  county?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: "name" | "createdAt" | "subscriptionExpiresAt" | "county";
  sortOrder?: "asc" | "desc";
}

/** Fields that can never be changed through the general update service. */
type ProtectedFields =
  | "id"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "smsCredits"
  | "subscriptionPlan"
  | "subscriptionStatus"
  | "subscriptionExpiresAt";

/* ============================================================================
 * CONSTANTS & HELPERS
 * ========================================================================== */

/** Default student caps per plan (null = unlimited). Adjust to your pricing. */
const PLAN_STUDENT_LIMITS: Record<SubscriptionPlan, number | null> = {
  Trial: 100,
  Basic: 300,
  Standard: 1000,
  Premium: 3000,
  Enterprise: null,
};

const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "dashboard", "portal", "login", "register",
  "mail", "support", "help", "static", "assets", "cdn", "staging", "dev", "test",
]);

const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]{1,98}[a-z0-9])$/;
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const MODULE_KEY_REGEX = /^[a-z][a-z0-9_]{0,49}$/;
const GRADIENT_DIRECTIONS = [
  "to-t", "to-tr", "to-r", "to-br", "to-b", "to-bl", "to-l", "to-tl",
];

const ok = <T = unknown>(message: string, extra: Partial<SchoolResponse<T>> = {}): SchoolResponse<T> => ({
  success: true,
  message,
  ...extra,
});

const fail = <T = unknown>(message: string): SchoolResponse<T> => ({ success: false, message });

const normalizeSlug = (slug: string) => slug.trim().toLowerCase();

const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const validateSlug = (slug: string): string | null => {
  if (!SLUG_REGEX.test(slug)) {
    return "Slug must be 3-100 characters: lowercase letters, numbers and hyphens only, and cannot start or end with a hyphen.";
  }
  if (RESERVED_SLUGS.has(slug)) return `The slug "${slug}" is reserved. Please choose another.`;
  return null;
};

const validateColors = (values: Record<string, string | undefined | null>): string | null => {
  for (const [key, value] of Object.entries(values)) {
    if (value && !HEX_COLOR_REGEX.test(value)) {
      return `${key} must be a valid hex color (e.g. #0F172A).`;
    }
  }
  return null;
};

/** Converts thrown errors (including Postgres unique violations) to a friendly response. */
const handleError = <T = unknown>(error: any, fallback: string): SchoolResponse<T> => {
  if (error?.code === "23505" || error?.cause?.code === "23505") {
    const detail: string = error?.detail || error?.cause?.detail || "";
    if (detail.includes("slug")) return fail("A school with this slug already exists.");
    if (detail.includes("registration_number")) return fail("A school with this registration number already exists.");
    if (detail.includes("knec_code")) return fail("A school with this KNEC code already exists.");
    return fail("A school with these unique details already exists.");
  }
  console.error(`[SchoolService] ${fallback}`, error);
  return fail(error?.message || fallback);
};

/** Returns an error message if slug / registration number / KNEC code is taken by another school. */
const findUniqueConflict = async (
  fields: { slug?: string | null; registrationNumber?: string | null; knecCode?: string | null },
  excludeId?: string
): Promise<string | null> => {
  const conditions: SQL[] = [];
  if (fields.slug) conditions.push(eq(schools.slug, fields.slug));
  if (fields.registrationNumber) conditions.push(eq(schools.registrationNumber, fields.registrationNumber));
  if (fields.knecCode) conditions.push(eq(schools.knecCode, fields.knecCode));
  if (conditions.length === 0) return null;

  const rows = await db
    .select({
      id: schools.id,
      slug: schools.slug,
      registrationNumber: schools.registrationNumber,
      knecCode: schools.knecCode,
    })
    .from(schools)
    .where(or(...conditions));

  const conflict = rows.find((r) => r.id !== excludeId);
  if (!conflict) return null;

  if (fields.slug && conflict.slug === fields.slug) return "A school with this slug already exists.";
  if (fields.registrationNumber && conflict.registrationNumber === fields.registrationNumber)
    return "A school with this registration number already exists.";
  if (fields.knecCode && conflict.knecCode === fields.knecCode)
    return "A school with this KNEC code already exists.";
  return "A school with these details already exists.";
};

/** Generic "update one school by id" used by most services. Skips soft-deleted schools. */
const updateSchoolById = async (
  id: string,
  values: Partial<TInsertSchool>,
  successMessage: string,
  failureMessage: string
): Promise<SchoolResponse> => {
  try {
    const [updated] = await db
      .update(schools)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(schools.id, id), isNull(schools.deletedAt)))
      .returning();

    if (!updated) return fail("School not found.");
    return ok(successMessage, { school: updated });
  } catch (error) {
    return handleError(error, failureMessage);
  }
};

/** Removes keys whose value is undefined so partial updates never overwrite with undefined. */
const clean = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

/* ============================================================================
 * 1. CORE CRUD
 * ========================================================================== */

/** 1. Create a new school (Super Admin). */
export const createSchoolService = async (data: TInsertSchool): Promise<SchoolResponse> => {
  try {
    const slug = normalizeSlug(data.slug);
    const slugError = validateSlug(slug);
    if (slugError) return fail(slugError);

    if (!data.name?.trim()) return fail("School name is required.");

    const colorError = validateColors({
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      accentColor: data.accentColor,
      gradientFrom: data.gradientFrom,
      gradientTo: data.gradientTo,
    });
    if (colorError) return fail(colorError);

    if (data.timezone && !isValidTimezone(data.timezone)) return fail("Invalid timezone.");

    const conflict = await findUniqueConflict({
      slug,
      registrationNumber: data.registrationNumber,
      knecCode: data.knecCode,
    });
    if (conflict) return fail(conflict);

    const plan = (data.subscriptionPlan ?? "Trial") as SubscriptionPlan;

    const [newSchool] = await db
      .insert(schools)
      .values({
        ...data,
        name: data.name.trim(),
        slug,
        maxStudents: data.maxStudents !== undefined ? data.maxStudents : PLAN_STUDENT_LIMITS[plan],
      })
      .returning();

    return ok("School registered successfully.", { school: newSchool });
  } catch (error) {
    return handleError(error, "Failed to create school.");
  }
};

/** 2. Get a school by ID. */
export const getSchoolByIdService = async (
  id: string,
  options: { includeDeleted?: boolean } = {}
): Promise<SchoolResponse> => {
  try {
    const school = await db.query.schools.findFirst({
      where: options.includeDeleted
        ? eq(schools.id, id)
        : and(eq(schools.id, id), isNull(schools.deletedAt)),
    });
    if (!school) return fail("School not found.");
    return ok("School retrieved successfully.", { school });
  } catch (error) {
    return handleError(error, "Failed to fetch school.");
  }
};

/** 3. Get a school by slug (subdomain / portal resolution). Only active, non-deleted schools. */
export const getSchoolBySlugService = async (slug: string): Promise<SchoolResponse> => {
  try {
    const school = await db.query.schools.findFirst({
      where: and(eq(schools.slug, normalizeSlug(slug)), isNull(schools.deletedAt)),
    });
    if (!school) return fail("School not found.");
    return ok("School retrieved successfully.", { school });
  } catch (error) {
    return handleError(error, "Failed to fetch school by slug.");
  }
};

/** 4. Get a school by registration number. */
export const getSchoolByRegistrationNumberService = async (registrationNumber: string): Promise<SchoolResponse> => {
  try {
    const school = await db.query.schools.findFirst({
      where: and(eq(schools.registrationNumber, registrationNumber.trim()), isNull(schools.deletedAt)),
    });
    if (!school) return fail("School not found.");
    return ok("School retrieved successfully.", { school });
  } catch (error) {
    return handleError(error, "Failed to fetch school by registration number.");
  }
};

/** 5. Get a school by KNEC code. */
export const getSchoolByKnecCodeService = async (knecCode: string): Promise<SchoolResponse> => {
  try {
    const school = await db.query.schools.findFirst({
      where: and(eq(schools.knecCode, knecCode.trim()), isNull(schools.deletedAt)),
    });
    if (!school) return fail("School not found.");
    return ok("School retrieved successfully.", { school });
  } catch (error) {
    return handleError(error, "Failed to fetch school by KNEC code.");
  }
};

/** 6. List schools with search, filters, sorting and pagination (Super Admin). */
export const listSchoolsService = async (params: ListSchoolsParams = {}): Promise<SchoolResponse> => {
  try {
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit ?? 20)));
    const offset = (page - 1) * limit;

    const conditions: (SQL | undefined)[] = [];

    if (!params.includeDeleted) conditions.push(isNull(schools.deletedAt));
    if (params.schoolType) conditions.push(eq(schools.schoolType, params.schoolType));
    if (params.curriculumType) conditions.push(eq(schools.curriculumType, params.curriculumType));
    if (params.subscriptionPlan) conditions.push(eq(schools.subscriptionPlan, params.subscriptionPlan));
    if (params.subscriptionStatus) conditions.push(eq(schools.subscriptionStatus, params.subscriptionStatus));
    if (params.county) conditions.push(ilike(schools.county, params.county.trim()));
    if (params.isActive !== undefined) conditions.push(eq(schools.isActive, params.isActive));

    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(schools.name, term),
          ilike(schools.shortName, term),
          ilike(schools.slug, term),
          ilike(schools.registrationNumber, term),
          ilike(schools.knecCode, term),
          ilike(schools.email, term)
        )
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const sortColumns = {
      name: schools.name,
      createdAt: schools.createdAt,
      subscriptionExpiresAt: schools.subscriptionExpiresAt,
      county: schools.county,
    } as const;
    const sortColumn = sortColumns[params.sortBy ?? "createdAt"];
    const orderBy = params.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(schools).where(where).orderBy(orderBy).limit(limit).offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(schools).where(where),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return ok("Schools fetched successfully.", {
      schools: rows,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    return handleError(error, "Failed to fetch schools.");
  }
};

/** 7. General update (identity/contact/branding/etc). Protected & billing fields are ignored. */
export const updateSchoolService = async (
  id: string,
  updates: Partial<Omit<TInsertSchool, ProtectedFields>>
): Promise<SchoolResponse> => {
  try {
    const values = clean(updates) as Partial<TInsertSchool>;
    if (Object.keys(values).length === 0) return fail("No valid fields provided to update.");

    if (values.slug) {
      values.slug = normalizeSlug(values.slug);
      const slugError = validateSlug(values.slug);
      if (slugError) return fail(slugError);
    }

    const colorError = validateColors({
      primaryColor: values.primaryColor,
      secondaryColor: values.secondaryColor,
      accentColor: values.accentColor,
      gradientFrom: values.gradientFrom,
      gradientTo: values.gradientTo,
    });
    if (colorError) return fail(colorError);

    if (values.timezone && !isValidTimezone(values.timezone)) return fail("Invalid timezone.");

    const conflict = await findUniqueConflict(
      { slug: values.slug, registrationNumber: values.registrationNumber, knecCode: values.knecCode },
      id
    );
    if (conflict) return fail(conflict);

    return updateSchoolById(id, values, "School updated successfully.", "Failed to update school.");
  } catch (error) {
    return handleError(error, "Failed to update school.");
  }
};

/** 8. Soft delete a school (keeps all data, hides it and deactivates it). */
export const softDeleteSchoolService = async (id: string): Promise<SchoolResponse> => {
  try {
    const [deleted] = await db
      .update(schools)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(and(eq(schools.id, id), isNull(schools.deletedAt)))
      .returning();

    if (!deleted) return fail("School not found or already deleted.");
    return ok("School deleted successfully.", { school: deleted });
  } catch (error) {
    return handleError(error, "Failed to delete school.");
  }
};

/** 9. Restore a soft-deleted school. */
export const restoreSchoolService = async (id: string): Promise<SchoolResponse> => {
  try {
    const [restored] = await db
      .update(schools)
      .set({ deletedAt: null, isActive: true, updatedAt: new Date() })
      .where(and(eq(schools.id, id), isNotNull(schools.deletedAt)))
      .returning();

    if (!restored) return fail("Deleted school not found.");
    return ok("School restored successfully.", { school: restored });
  } catch (error) {
    return handleError(error, "Failed to restore school.");
  }
};

/** 10. Permanently delete a school. Only allowed if it was soft-deleted first (cascades may apply). */
export const permanentlyDeleteSchoolService = async (id: string): Promise<SchoolResponse> => {
  try {
    const [removed] = await db
      .delete(schools)
      .where(and(eq(schools.id, id), isNotNull(schools.deletedAt)))
      .returning();

    if (!removed) return fail("School must be soft-deleted before it can be permanently removed.");
    return ok("School permanently deleted.", { school: removed });
  } catch (error) {
    return handleError(error, "Failed to permanently delete school.");
  }
};

/** 11. List soft-deleted schools (trash view). */
export const listDeletedSchoolsService = async (): Promise<SchoolResponse> => {
  try {
    const rows = await db
      .select()
      .from(schools)
      .where(isNotNull(schools.deletedAt))
      .orderBy(desc(schools.deletedAt));
    return ok("Deleted schools fetched successfully.", { schools: rows });
  } catch (error) {
    return handleError(error, "Failed to fetch deleted schools.");
  }
};

/* ============================================================================
 * 2. AVAILABILITY CHECKS & SLUG MANAGEMENT
 * ========================================================================== */

/** 12. Check whether a slug is free and valid (use for live form validation). */
export const checkSlugAvailabilityService = async (
  slug: string,
  excludeSchoolId?: string
): Promise<SchoolResponse<{ available: boolean }>> => {
  try {
    const normalized = normalizeSlug(slug);
    const slugError = validateSlug(normalized);
    if (slugError) return { success: true, message: slugError, data: { available: false } };

    const conflict = await findUniqueConflict({ slug: normalized }, excludeSchoolId);
    return {
      success: true,
      message: conflict ? conflict : "Slug is available.",
      data: { available: !conflict },
    };
  } catch (error) {
    return handleError(error, "Failed to check slug availability.");
  }
};

/** 13. Check whether a registration number is free. */
export const checkRegistrationNumberAvailabilityService = async (
  registrationNumber: string,
  excludeSchoolId?: string
): Promise<SchoolResponse<{ available: boolean }>> => {
  try {
    const conflict = await findUniqueConflict({ registrationNumber: registrationNumber.trim() }, excludeSchoolId);
    return {
      success: true,
      message: conflict ? conflict : "Registration number is available.",
      data: { available: !conflict },
    };
  } catch (error) {
    return handleError(error, "Failed to check registration number availability.");
  }
};

/** 14. Change a school's slug (affects its subdomain / URL, so it's a separate, explicit action). */
export const updateSchoolSlugService = async (id: string, newSlug: string): Promise<SchoolResponse> => {
  try {
    const slug = normalizeSlug(newSlug);
    const slugError = validateSlug(slug);
    if (slugError) return fail(slugError);

    const conflict = await findUniqueConflict({ slug }, id);
    if (conflict) return fail(conflict);

    return updateSchoolById(id, { slug }, "School slug updated successfully.", "Failed to update school slug.");
  } catch (error) {
    return handleError(error, "Failed to update school slug.");
  }
};

/* ============================================================================
 * 3. STATUS
 * ========================================================================== */

/** 15. Activate / deactivate a school. */
export const toggleSchoolStatusService = async (id: string, isActive: boolean): Promise<SchoolResponse> =>
  updateSchoolById(
    id,
    { isActive },
    `School ${isActive ? "activated" : "deactivated"} successfully.`,
    "Failed to toggle school status."
  );

/** 16. Bulk activate / deactivate schools. */
export const bulkToggleSchoolStatusService = async (
  ids: string[],
  isActive: boolean
): Promise<SchoolResponse<{ affected: number }>> => {
  try {
    if (!ids.length) return fail("No school IDs provided.");

    const updated = await db
      .update(schools)
      .set({ isActive, updatedAt: new Date() })
      .where(and(inArray(schools.id, ids), isNull(schools.deletedAt)))
      .returning({ id: schools.id });

    return ok(`${updated.length} school(s) ${isActive ? "activated" : "deactivated"}.`, {
      data: { affected: updated.length },
    });
  } catch (error) {
    return handleError(error, "Failed to update schools.");
  }
};

/* ============================================================================
 * 4. BRANDING & THEMING
 * ========================================================================== */

export interface BrandingInput {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  coverImageUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string | null;
  gradientFrom?: string | null;
  gradientTo?: string | null;
  gradientDirection?: string;
}

/** 17. Update branding & theming. */
export const updateSchoolBrandingService = async (id: string, branding: BrandingInput): Promise<SchoolResponse> => {
  const values = clean(branding as Record<string, unknown>) as Partial<TInsertSchool>;
  if (Object.keys(values).length === 0) return fail("No branding fields provided.");

  const colorError = validateColors({
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    gradientFrom: branding.gradientFrom,
    gradientTo: branding.gradientTo,
  });
  if (colorError) return fail(colorError);

  if (branding.gradientDirection && !GRADIENT_DIRECTIONS.includes(branding.gradientDirection)) {
    return fail(`gradientDirection must be one of: ${GRADIENT_DIRECTIONS.join(", ")}.`);
  }

  return updateSchoolById(id, values, "School branding updated successfully.", "Failed to update school branding.");
};

/** 18. Update only the logo. */
export const updateSchoolLogoService = async (id: string, logoUrl: string | null): Promise<SchoolResponse> =>
  updateSchoolById(id, { logoUrl }, "School logo updated successfully.", "Failed to update school logo.");

/** 19. Reset branding back to platform defaults. */
export const resetSchoolBrandingService = async (id: string): Promise<SchoolResponse> =>
  updateSchoolById(
    id,
    {
      logoUrl: null,
      faviconUrl: null,
      coverImageUrl: null,
      primaryColor: "#0F172A",
      secondaryColor: "#64748B",
      accentColor: null,
      gradientFrom: null,
      gradientTo: null,
      gradientDirection: "to-r",
    },
    "School branding reset to defaults.",
    "Failed to reset school branding."
  );

/** 20. Get just the public branding for a school by slug (safe for login / portal pages). */
export const getPublicSchoolBrandingService = async (
  slug: string
): Promise<SchoolResponse<Pick<TSelectSchool, "name" | "shortName" | "motto" | "logoUrl" | "faviconUrl" | "coverImageUrl" | "primaryColor" | "secondaryColor" | "accentColor" | "gradientFrom" | "gradientTo" | "gradientDirection">>> => {
  try {
    const [row] = await db
      .select({
        name: schools.name,
        shortName: schools.shortName,
        motto: schools.motto,
        logoUrl: schools.logoUrl,
        faviconUrl: schools.faviconUrl,
        coverImageUrl: schools.coverImageUrl,
        primaryColor: schools.primaryColor,
        secondaryColor: schools.secondaryColor,
        accentColor: schools.accentColor,
        gradientFrom: schools.gradientFrom,
        gradientTo: schools.gradientTo,
        gradientDirection: schools.gradientDirection,
      })
      .from(schools)
      .where(and(eq(schools.slug, normalizeSlug(slug)), eq(schools.isActive, true), isNull(schools.deletedAt)))
      .limit(1);

    if (!row) return fail("School not found.");
    return ok("School branding retrieved successfully.", { data: row });
  } catch (error) {
    return handleError(error, "Failed to fetch school branding.");
  }
};

/* ============================================================================
 * 5. IDENTITY, CONTACT, LOCALIZATION & CURRICULUM
 * ========================================================================== */

/** 21. Update identity details (name, motto, registration, KNEC code...). */
export const updateSchoolSettingsService = async (
  id: string,
  settings: {
    name?: string;
    shortName?: string | null;
    motto?: string | null;
    registrationNumber?: string | null;
    knecCode?: string | null;
    establishedYear?: number | null;
    principalName?: string | null;
  }
): Promise<SchoolResponse> => {
  try {
    const values = clean(settings) as Partial<TInsertSchool>;
    if (Object.keys(values).length === 0) return fail("No fields provided.");

    if (values.name !== undefined && !values.name.trim()) return fail("School name cannot be empty.");

    if (values.establishedYear != null) {
      const year = new Date().getFullYear();
      if (values.establishedYear < 1800 || values.establishedYear > year) {
        return fail(`Established year must be between 1800 and ${year}.`);
      }
    }

    const conflict = await findUniqueConflict(
      { registrationNumber: values.registrationNumber, knecCode: values.knecCode },
      id
    );
    if (conflict) return fail(conflict);

    return updateSchoolById(id, values, "School settings updated successfully.", "Failed to update school settings.");
  } catch (error) {
    return handleError(error, "Failed to update school settings.");
  }
};

/** 22. Update contact & location. */
export const updateSchoolContactService = async (
  id: string,
  contactInfo: {
    address?: string | null;
    county?: string | null;
    subCounty?: string | null;
    phone?: string | null;
    alternativePhone?: string | null;
    email?: string | null;
    website?: string | null;
  }
): Promise<SchoolResponse> => {
  const values = clean(contactInfo) as Partial<TInsertSchool>;
  if (Object.keys(values).length === 0) return fail("No contact fields provided.");

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return fail("Invalid email address.");

  for (const key of ["phone", "alternativePhone"] as const) {
    const value = values[key];
    if (value && !/^\+?[0-9\s-]{7,20}$/.test(value)) return fail(`Invalid ${key === "phone" ? "phone" : "alternative phone"} number.`);
  }

  return updateSchoolById(id, values, "School contact and location updated successfully.", "Failed to update school contact info.");
};

/** 23. Update localization (timezone & currency). */
export const updateSchoolLocalizationService = async (
  id: string,
  localization: { timezone?: string; currency?: string }
): Promise<SchoolResponse> => {
  const values: Partial<TInsertSchool> = {};

  if (localization.timezone !== undefined) {
    if (!isValidTimezone(localization.timezone)) return fail("Invalid timezone.");
    values.timezone = localization.timezone;
  }
  if (localization.currency !== undefined) {
    const currency = localization.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return fail("Currency must be a 3-letter ISO code (e.g. KES).");
    values.currency = currency;
  }
  if (Object.keys(values).length === 0) return fail("No localization fields provided.");

  return updateSchoolById(id, values, "School localization updated successfully.", "Failed to update school localization.");
};

/** 24. Update school type & curriculum. */
export const updateSchoolCurriculumService = async (
  id: string,
  data: { schoolType?: SchoolType; curriculumType?: CurriculumType }
): Promise<SchoolResponse> => {
  const values = clean(data) as Partial<TInsertSchool>;
  if (Object.keys(values).length === 0) return fail("No fields provided.");
  return updateSchoolById(id, values, "School type and curriculum updated successfully.", "Failed to update school curriculum.");
};

/** 25. Update principal name. */
export const updateSchoolPrincipalService = async (id: string, principalName: string | null): Promise<SchoolResponse> =>
  updateSchoolById(id, { principalName }, "Principal updated successfully.", "Failed to update principal.");

/* ============================================================================
 * 6. PER-SCHOOL SETTINGS JSON & MODULE TOGGLES
 * ========================================================================== */

/** 26. Get the raw settings JSON. */
export const getSchoolSettingsJsonService = async (id: string): Promise<SchoolResponse<Record<string, unknown>>> => {
  try {
    const [row] = await db
      .select({ settings: schools.settings })
      .from(schools)
      .where(and(eq(schools.id, id), isNull(schools.deletedAt)))
      .limit(1);

    if (!row) return fail("School not found.");
    return ok("School settings retrieved successfully.", { data: row.settings ?? {} });
  } catch (error) {
    return handleError(error, "Failed to fetch school settings.");
  }
};

/** 27. Shallow-merge a patch into the settings JSON (atomic, done in SQL). */
export const mergeSchoolSettingsJsonService = async (
  id: string,
  patch: Record<string, unknown>
): Promise<SchoolResponse> => {
  try {
    if (!patch || Object.keys(patch).length === 0) return fail("No settings provided.");

    const [updated] = await db
      .update(schools)
      .set({
        settings: sql`${schools.settings} || ${JSON.stringify(patch)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(and(eq(schools.id, id), isNull(schools.deletedAt)))
      .returning();

    if (!updated) return fail("School not found.");
    return ok("School settings merged successfully.", { school: updated });
  } catch (error) {
    return handleError(error, "Failed to merge school settings.");
  }
};

/** 28. Enable / disable a module (library, transport, boarding...) under settings.modules. */
export const toggleSchoolModuleService = async (
  id: string,
  moduleKey: string,
  enabled: boolean
): Promise<SchoolResponse> => {
  try {
    if (!MODULE_KEY_REGEX.test(moduleKey)) {
      return fail("Module key must be lowercase letters, numbers or underscores (e.g. library).");
    }

    const patch = JSON.stringify({ [moduleKey]: enabled });

    const [updated] = await db
      .update(schools)
      .set({
        settings: sql`${schools.settings} || jsonb_build_object(
          'modules',
          COALESCE(${schools.settings} -> 'modules', '{}'::jsonb) || ${patch}::jsonb
        )`,
        updatedAt: new Date(),
      })
      .where(and(eq(schools.id, id), isNull(schools.deletedAt)))
      .returning();

    if (!updated) return fail("School not found.");
    return ok(`Module "${moduleKey}" ${enabled ? "enabled" : "disabled"} successfully.`, { school: updated });
  } catch (error) {
    return handleError(error, "Failed to toggle school module.");
  }
};

/** 29. Get all module flags for a school. */
export const getSchoolModulesService = async (id: string): Promise<SchoolResponse<Record<string, boolean>>> => {
  const result = await getSchoolSettingsJsonService(id);
  if (!result.success) return fail(result.message);
  const modules = (result.data?.modules ?? {}) as Record<string, boolean>;
  return ok("School modules retrieved successfully.", { data: modules });
};

/** 30. Check whether one module is enabled. */
export const isSchoolModuleEnabledService = async (
  id: string,
  moduleKey: string
): Promise<SchoolResponse<{ enabled: boolean }>> => {
  const result = await getSchoolModulesService(id);
  if (!result.success) return fail(result.message);
  return ok("Module status retrieved.", { data: { enabled: result.data?.[moduleKey] === true } });
};

/* ============================================================================
 * 7. SUBSCRIPTION & BILLING
 * ========================================================================== */

/** 31. Directly update subscription fields (Super Admin override). */
export const updateSchoolSubscriptionService = async (
  id: string,
  subscription: {
    subscriptionPlan?: SubscriptionPlan;
    subscriptionStatus?: SubscriptionStatus;
    subscriptionExpiresAt?: Date | null;
  }
): Promise<SchoolResponse> => {
  const values = clean(subscription) as Partial<TInsertSchool>;
  if (Object.keys(values).length === 0) return fail("No subscription fields provided.");
  return updateSchoolById(id, values, "School subscription updated successfully.", "Failed to update school subscription.");
};

/** 32. Change plan and apply that plan's default student limit (optionally override it). */
export const changeSchoolPlanService = async (
  id: string,
  plan: SubscriptionPlan,
  options: { maxStudents?: number | null; keepExistingLimit?: boolean } = {}
): Promise<SchoolResponse> => {
  try {
    const school = await db.query.schools.findFirst({
      where: and(eq(schools.id, id), isNull(schools.deletedAt)),
    });
    if (!school) return fail("School not found.");

    const newLimit =
      options.maxStudents !== undefined
        ? options.maxStudents
        : options.keepExistingLimit
        ? school.maxStudents
        : PLAN_STUDENT_LIMITS[plan];

    if (newLimit !== null && newLimit !== undefined) {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(students)
        .where(eq(students.schoolId, id));

      if (total > newLimit) {
        return fail(
          `Cannot switch to ${plan}: the school has ${total} students but the plan allows ${newLimit}.`
        );
      }
    }

    return updateSchoolById(
      id,
      { subscriptionPlan: plan, maxStudents: newLimit },
      `School plan changed to ${plan}.`,
      "Failed to change school plan."
    );
  } catch (error) {
    return handleError(error, "Failed to change school plan.");
  }
};

/** 33. Extend a subscription by N days (counts from today if already expired). Reactivates it. */
export const extendSchoolSubscriptionService = async (id: string, days: number): Promise<SchoolResponse> => {
  try {
    if (!Number.isInteger(days) || days <= 0 || days > 3650) {
      return fail("Days must be a whole number between 1 and 3650.");
    }

    const [updated] = await db
      .update(schools)
      .set({
        subscriptionExpiresAt: sql`GREATEST(COALESCE(${schools.subscriptionExpiresAt}, now()), now()) + (${days} * interval '1 day')`,
        subscriptionStatus: "Active",
        updatedAt: new Date(),
      })
      .where(and(eq(schools.id, id), isNull(schools.deletedAt)))
      .returning();

    if (!updated) return fail("School not found.");
    return ok(`Subscription extended by ${days} day(s).`, { school: updated });
  } catch (error) {
    return handleError(error, "Failed to extend subscription.");
  }
};

/** 34. Suspend a school's subscription (and optionally deactivate access). */
export const suspendSchoolSubscriptionService = async (
  id: string,
  options: { deactivate?: boolean } = {}
): Promise<SchoolResponse> =>
  updateSchoolById(
    id,
    { subscriptionStatus: "Suspended", ...(options.deactivate ? { isActive: false } : {}) },
    "School subscription suspended.",
    "Failed to suspend subscription."
  );

/** 35. Reactivate a school's subscription and access. */
export const reactivateSchoolSubscriptionService = async (id: string): Promise<SchoolResponse> => {
  try {
    const school = await db.query.schools.findFirst({
      where: and(eq(schools.id, id), isNull(schools.deletedAt)),
    });
    if (!school) return fail("School not found.");

    if (school.subscriptionExpiresAt && school.subscriptionExpiresAt < new Date()) {
      return fail("Subscription has expired. Extend the subscription to reactivate it.");
    }

    return updateSchoolById(
      id,
      { subscriptionStatus: "Active", isActive: true },
      "School subscription reactivated.",
      "Failed to reactivate subscription."
    );
  } catch (error) {
    return handleError(error, "Failed to reactivate subscription.");
  }
};

/** 36. Cancel a subscription. */
export const cancelSchoolSubscriptionService = async (id: string): Promise<SchoolResponse> =>
  updateSchoolById(id, { subscriptionStatus: "Cancelled" }, "School subscription cancelled.", "Failed to cancel subscription.");

/** 37. Schools whose subscription expires within N days (billing reminders). Uses the expiring partial index. */
export const getExpiringSchoolsService = async (withinDays = 14): Promise<SchoolResponse> => {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const rows = await db
      .select()
      .from(schools)
      .where(
        and(
          isNull(schools.deletedAt),
          inArray(schools.subscriptionStatus, ["Active", "PastDue"]),
          isNotNull(schools.subscriptionExpiresAt),
          gte(schools.subscriptionExpiresAt, now),
          lte(schools.subscriptionExpiresAt, cutoff)
        )
      )
      .orderBy(asc(schools.subscriptionExpiresAt));

    return ok(`${rows.length} school(s) expiring within ${withinDays} day(s).`, { schools: rows });
  } catch (error) {
    return handleError(error, "Failed to fetch expiring schools.");
  }
};

/**
 * 38. Subscription lifecycle job (run daily via cron):
 *  - Active schools past their expiry date -> PastDue
 *  - PastDue schools past the grace period -> Expired
 */
export const runSubscriptionLifecycleService = async (
  graceDays = 7
): Promise<SchoolResponse<{ markedPastDue: number; markedExpired: number }>> => {
  try {
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);

    const expired = await db
      .update(schools)
      .set({ subscriptionStatus: "Expired", updatedAt: now })
      .where(
        and(
          isNull(schools.deletedAt),
          inArray(schools.subscriptionStatus, ["Active", "PastDue"]),
          isNotNull(schools.subscriptionExpiresAt),
          lt(schools.subscriptionExpiresAt, graceCutoff)
        )
      )
      .returning({ id: schools.id });

    const pastDue = await db
      .update(schools)
      .set({ subscriptionStatus: "PastDue", updatedAt: now })
      .where(
        and(
          isNull(schools.deletedAt),
          eq(schools.subscriptionStatus, "Active"),
          isNotNull(schools.subscriptionExpiresAt),
          lt(schools.subscriptionExpiresAt, now)
        )
      )
      .returning({ id: schools.id });

    return ok(`Lifecycle run complete: ${pastDue.length} past due, ${expired.length} expired.`, {
      data: { markedPastDue: pastDue.length, markedExpired: expired.length },
    });
  } catch (error) {
    return handleError(error, "Failed to run subscription lifecycle.");
  }
};

/** 39. Is the school allowed to use the platform right now? (use in auth/middleware) */
export const checkSchoolAccessService = async (
  id: string
): Promise<SchoolResponse<{ allowed: boolean; reason?: string }>> => {
  try {
    const school = await db.query.schools.findFirst({
      where: and(eq(schools.id, id), isNull(schools.deletedAt)),
    });
    if (!school) return fail("School not found.");

    let allowed = true;
    let reason: string | undefined;

    if (!school.isActive) {
      allowed = false;
      reason = "This school account is deactivated.";
    } else if (["Suspended", "Cancelled", "Expired"].includes(school.subscriptionStatus)) {
      allowed = false;
      reason = `Subscription is ${school.subscriptionStatus.toLowerCase()}.`;
    }

    return ok(allowed ? "Access allowed." : reason!, { data: { allowed, reason } });
  } catch (error) {
    return handleError(error, "Failed to check school access.");
  }
};

/* ============================================================================
 * 8. STUDENT LIMITS
 * ========================================================================== */

/** 40. Set a custom student limit (null = unlimited). */
export const setMaxStudentsService = async (id: string, maxStudents: number | null): Promise<SchoolResponse> => {
  if (maxStudents !== null && (!Number.isInteger(maxStudents) || maxStudents < 0)) {
    return fail("Max students must be a non-negative whole number or null for unlimited.");
  }
  return updateSchoolById(id, { maxStudents }, "Student limit updated successfully.", "Failed to update student limit.");
};

/** 41. Check capacity before enrolling students. */
export const checkStudentLimitService = async (
  id: string,
  toAdd = 1
): Promise<SchoolResponse<{ allowed: boolean; current: number; limit: number | null; remaining: number | null }>> => {
  try {
    const school = await db.query.schools.findFirst({
      where: and(eq(schools.id, id), isNull(schools.deletedAt)),
    });
    if (!school) return fail("School not found.");

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(students)
      .where(eq(students.schoolId, id));

    const limit = school.maxStudents;
    const remaining = limit === null ? null : Math.max(0, limit - total);
    const allowed = limit === null || total + toAdd <= limit;

    return ok(
      allowed ? "Within student limit." : `Student limit reached (${total}/${limit}). Upgrade the plan to add more.`,
      { data: { allowed, current: total, limit, remaining } }
    );
  } catch (error) {
    return handleError(error, "Failed to check student limit.");
  }
};

/* ============================================================================
 * 9. SMS CREDITS
 * ========================================================================== */

/** 42. Get remaining SMS credits. */
export const getSmsCreditsService = async (id: string): Promise<SchoolResponse<{ smsCredits: number }>> => {
  try {
    const [row] = await db
      .select({ smsCredits: schools.smsCredits })
      .from(schools)
      .where(and(eq(schools.id, id), isNull(schools.deletedAt)))
      .limit(1);

    if (!row) return fail("School not found.");
    return ok("SMS credits retrieved successfully.", { data: { smsCredits: row.smsCredits } });
  } catch (error) {
    return handleError(error, "Failed to fetch SMS credits.");
  }
};

/** 43. Top up SMS credits (atomic increment). */
export const addSmsCreditsService = async (id: string, amount: number): Promise<SchoolResponse> => {
  try {
    if (!Number.isInteger(amount) || amount <= 0) return fail("Amount must be a positive whole number.");

    const [updated] = await db
      .update(schools)
      .set({ smsCredits: sql`${schools.smsCredits} + ${amount}`, updatedAt: new Date() })
      .where(and(eq(schools.id, id), isNull(schools.deletedAt)))
      .returning();

    if (!updated) return fail("School not found.");
    return ok(`${amount} SMS credit(s) added. New balance: ${updated.smsCredits}.`, { school: updated });
  } catch (error) {
    return handleError(error, "Failed to add SMS credits.");
  }
};

/** 44. Deduct SMS credits atomically — fails safely (never goes negative) if the balance is too low. */
export const deductSmsCreditsService = async (id: string, amount: number): Promise<SchoolResponse> => {
  try {
    if (!Number.isInteger(amount) || amount <= 0) return fail("Amount must be a positive whole number.");

    const [updated] = await db
      .update(schools)
      .set({ smsCredits: sql`${schools.smsCredits} - ${amount}`, updatedAt: new Date() })
      .where(and(eq(schools.id, id), isNull(schools.deletedAt), gte(schools.smsCredits, amount)))
      .returning();

    if (!updated) {
      const exists = await db.query.schools.findFirst({
        where: and(eq(schools.id, id), isNull(schools.deletedAt)),
        columns: { id: true },
      });
      return fail(exists ? "Insufficient SMS credits." : "School not found.");
    }

    return ok(`${amount} SMS credit(s) deducted. Remaining: ${updated.smsCredits}.`, { school: updated });
  } catch (error) {
    return handleError(error, "Failed to deduct SMS credits.");
  }
};

/* ============================================================================
 * 10. STATS & REPORTING
 * ========================================================================== */

/** 45. Stats for a single school (students, users, limits, subscription). */
export const getSchoolStatsService = async (
  id: string
): Promise<
  SchoolResponse<{
    totalStudents: number;
    totalUsers: number;
    maxStudents: number | null;
    studentCapacityUsedPercent: number | null;
    smsCredits: number;
    subscriptionPlan: string;
    subscriptionStatus: string;
    daysUntilExpiry: number | null;
  }>
> => {
  try {
    const school = await db.query.schools.findFirst({
      where: and(eq(schools.id, id), isNull(schools.deletedAt)),
    });
    if (!school) return fail("School not found.");

    const [[studentRow], [userRow]] = await Promise.all([
      db.select({ total: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, id)),
      db.select({ total: sql<number>`count(*)::int` }).from(users).where(eq(users.schoolId, id)),
    ]);

    const daysUntilExpiry = school.subscriptionExpiresAt
      ? Math.ceil((school.subscriptionExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

    return ok("School stats retrieved successfully.", {
      school,
      data: {
        totalStudents: studentRow.total,
        totalUsers: userRow.total,
        maxStudents: school.maxStudents,
        studentCapacityUsedPercent: school.maxStudents
          ? Math.round((studentRow.total / school.maxStudents) * 100)
          : null,
        smsCredits: school.smsCredits,
        subscriptionPlan: school.subscriptionPlan,
        subscriptionStatus: school.subscriptionStatus,
        daysUntilExpiry,
      },
    });
  } catch (error) {
    return handleError(error, "Failed to fetch school stats.");
  }
};

/** 46. Platform-wide overview for the Super Admin dashboard. */
export const getPlatformStatsService = async (): Promise<
  SchoolResponse<{
    totalSchools: number;
    activeSchools: number;
    inactiveSchools: number;
    deletedSchools: number;
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byCurriculum: Record<string, number>;
  }>
> => {
  try {
    const notDeleted = isNull(schools.deletedAt);

    const [[totals], byPlan, byStatus, byType, byCurriculum] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*) FILTER (WHERE ${schools.deletedAt} IS NULL)::int`,
          active: sql<number>`count(*) FILTER (WHERE ${schools.deletedAt} IS NULL AND ${schools.isActive} = true)::int`,
          inactive: sql<number>`count(*) FILTER (WHERE ${schools.deletedAt} IS NULL AND ${schools.isActive} = false)::int`,
          deleted: sql<number>`count(*) FILTER (WHERE ${schools.deletedAt} IS NOT NULL)::int`,
        })
        .from(schools),
      db.select({ key: schools.subscriptionPlan, count: sql<number>`count(*)::int` }).from(schools).where(notDeleted).groupBy(schools.subscriptionPlan),
      db.select({ key: schools.subscriptionStatus, count: sql<number>`count(*)::int` }).from(schools).where(notDeleted).groupBy(schools.subscriptionStatus),
      db.select({ key: schools.schoolType, count: sql<number>`count(*)::int` }).from(schools).where(notDeleted).groupBy(schools.schoolType),
      db.select({ key: schools.curriculumType, count: sql<number>`count(*)::int` }).from(schools).where(notDeleted).groupBy(schools.curriculumType),
    ]);

    const toMap = (rows: { key: string; count: number }[]) =>
      Object.fromEntries(rows.map((r) => [r.key, r.count]));

    return ok("Platform stats retrieved successfully.", {
      data: {
        totalSchools: totals.total,
        activeSchools: totals.active,
        inactiveSchools: totals.inactive,
        deletedSchools: totals.deleted,
        byPlan: toMap(byPlan),
        byStatus: toMap(byStatus),
        byType: toMap(byType),
        byCurriculum: toMap(byCurriculum),
      },
    });
  } catch (error) {
    return handleError(error, "Failed to fetch platform stats.");
  }
};

/** 47. Count schools per county (for maps / regional reports). */
export const getSchoolsByCountyService = async (): Promise<SchoolResponse<{ county: string | null; count: number }[]>> => {
  try {
    const rows = await db
      .select({ county: schools.county, count: sql<number>`count(*)::int` })
      .from(schools)
      .where(isNull(schools.deletedAt))
      .groupBy(schools.county)
      .orderBy(desc(sql`count(*)`));

    return ok("Schools by county retrieved successfully.", { data: rows });
  } catch (error) {
    return handleError(error, "Failed to fetch schools by county.");
  }
};