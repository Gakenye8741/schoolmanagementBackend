import { eq } from "drizzle-orm";
import { TInsertSchool, TSelectSchool } from "../../drizzle/types";
import db from "../../drizzle/db";
import { schools } from "../../drizzle/schema";

export interface SchoolResponse {
  success: boolean;
  message: string;
  school?: TSelectSchool;
  schools?: TSelectSchool[];
}

/**
 * 1. Create a new school (Super Admin level)
 */
export const createSchoolService = async (data: TInsertSchool): Promise<SchoolResponse> => {
  try {
    const existingSlug = await db.query.schools.findFirst({
      where: eq(schools.slug, data.slug),
    });

    if (existingSlug) {
      return { success: false, message: "A school with this slug already exists." };
    }

    if (data.registrationNumber) {
      const existingReg = await db.query.schools.findFirst({
        where: eq(schools.registrationNumber, data.registrationNumber),
      });
      if (existingReg) {
        return { success: false, message: "A school with this registration number already exists." };
      }
    }

    const [newSchool] = await db.insert(schools).values(data).returning();

    return {
      success: true,
      message: "School registered successfully.",
      school: newSchool,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create school." };
  }
};

/**
 * 2. Get school by ID
 */
export const getSchoolByIdService = async (id: string): Promise<SchoolResponse> => {
  try {
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, id),
    });

    if (!school) {
      return { success: false, message: "School not found." };
    }

    return {
      success: true,
      message: "School retrieved successfully.",
      school,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch school." };
  }
};

/**
 * 3. Get school by slug (for subdomain / portal resolution)
 */
export const getSchoolBySlugService = async (slug: string): Promise<SchoolResponse> => {
  try {
    const school = await db.query.schools.findFirst({
      where: eq(schools.slug, slug),
    });

    if (!school) {
      return { success: false, message: "School not found." };
    }

    return {
      success: true,
      message: "School retrieved successfully.",
      school,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch school by slug." };
  }
};

/**
 * 4. List all schools (Super Admin view)
 */
export const listSchoolsService = async (): Promise<SchoolResponse> => {
  try {
    const allSchools = await db.select().from(schools);

    return {
      success: true,
      message: "Schools fetched successfully.",
      schools: allSchools,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch schools." };
  }
};

/**
 * 5. Update school details (General)
 */
export const updateSchoolService = async (
  id: string,
  updates: Partial<TInsertSchool>
): Promise<SchoolResponse> => {
  try {
    const [updatedSchool] = await db.update(schools)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schools.id, id))
      .returning();

    if (!updatedSchool) {
      return { success: false, message: "School not found." };
    }

    return {
      success: true,
      message: "School updated successfully.",
      school: updatedSchool,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update school." };
  }
};

/**
 * 6. Toggle school active status
 */
export const toggleSchoolStatusService = async (id: string, isActive: boolean): Promise<SchoolResponse> => {
  try {
    const [updatedSchool] = await db.update(schools)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(schools.id, id))
      .returning();

    if (!updatedSchool) {
      return { success: false, message: "School not found." };
    }

    return {
      success: true,
      message: `School ${isActive ? "activated" : "deactivated"} successfully.`,
      school: updatedSchool,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to toggle school status." };
  }
};

/**
 * 7. Update Branding & Theming Service
 */
export const updateSchoolBrandingService = async (
  id: string,
  branding: {
    logoUrl?: string;
    faviconUrl?: string;
    coverImageUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    gradientFrom?: string;
    gradientTo?: string;
    gradientDirection?: string;
  }
): Promise<SchoolResponse> => {
  try {
    const [updatedSchool] = await db.update(schools)
      .set({ ...branding, updatedAt: new Date() })
      .where(eq(schools.id, id))
      .returning();

    if (!updatedSchool) {
      return { success: false, message: "School not found." };
    }

    return {
      success: true,
      message: "School branding updated successfully.",
      school: updatedSchool,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update school branding." };
  }
};

/**
 * 8. Subscription & Billing Service
 */
export const updateSchoolSubscriptionService = async (
  id: string,
  subscription: {
    subscriptionPlan?: "Trial" | "Basic" | "Standard" | "Premium" | "Enterprise";
    subscriptionStatus?: "Active" | "Suspended" | "Expired" | "Cancelled";
    subscriptionExpiresAt?: Date | null;
  }
): Promise<SchoolResponse> => {
  try {
    const [updatedSchool] = await db.update(schools)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(schools.id, id))
      .returning();

    if (!updatedSchool) {
      return { success: false, message: "School not found." };
    }

    return {
      success: true,
      message: "School subscription updated successfully.",
      school: updatedSchool,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update school subscription." };
  }
};

/**
 * 9. School Settings & Localization Service
 */
export const updateSchoolSettingsService = async (
  id: string,
  settings: {
    name?: string;
    shortName?: string;
    motto?: string;
    registrationNumber?: string;
    knecCode?: string;
    establishedYear?: number;
    timezone?: string;
    currency?: string;
    principalName?: string;
  }
): Promise<SchoolResponse> => {
  try {
    const [updatedSchool] = await db.update(schools)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(schools.id, id))
      .returning();

    if (!updatedSchool) {
      return { success: false, message: "School not found." };
    }

    return {
      success: true,
      message: "School settings updated successfully.",
      school: updatedSchool,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update school settings." };
  }
};

/**
 * 10. Contact & Location Service
 */
export const updateSchoolContactService = async (
  id: string,
  contactInfo: {
    address?: string;
    county?: string;
    subCounty?: string;
    phone?: string;
    alternativePhone?: string;
    email?: string;
    website?: string;
  }
): Promise<SchoolResponse> => {
  try {
    const [updatedSchool] = await db.update(schools)
      .set({ ...contactInfo, updatedAt: new Date() })
      .where(eq(schools.id, id))
      .returning();

    if (!updatedSchool) {
      return { success: false, message: "School not found." };
    }

    return {
      success: true,
      message: "School contact and location updated successfully.",
      school: updatedSchool,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update school contact info." };
  }
};