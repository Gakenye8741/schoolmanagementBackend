import { eq, and, ne } from "drizzle-orm";
import { TInsertAcademicTerm, TInsertTermWindows, TSelectAcademicTerm, TSelectTermWindows } from "../../drizzle/types";
import { academicTerms, termWindows } from "../../drizzle/schema";
import db from "../../drizzle/db";

export interface AcademicTermResponse {
  success: boolean;
  message: string;
  term?: TSelectAcademicTerm;
  terms?: TSelectAcademicTerm[];
  window?: TSelectTermWindows;
  windows?: TSelectTermWindows[];
}

/**
 * Helper to check for overlapping term dates within the same school
 */
const checkTermOverlap = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  excludeTermId?: string
): Promise<boolean> => {
  const existingTerms = await db.select()
    .from(academicTerms)
    .where(eq(academicTerms.schoolId, schoolId));

  for (const term of existingTerms) {
    if (excludeTermId && term.id === excludeTermId) continue;

    if (startDate <= term.endDate && endDate >= term.startDate) {
      return true;
    }
  }

  return false;
};

/**
 * 1. Create a new academic term with overlap validation and lifecycle status
 */
export const createAcademicTermService = async (data: TInsertAcademicTerm): Promise<AcademicTermResponse> => {
  try {
    const formattedStartDate = new Date(data.startDate).toISOString().split("T")[0];
    const formattedEndDate = new Date(data.endDate).toISOString().split("T")[0];

    if (formattedStartDate > formattedEndDate) {
      return { success: false, message: "Start date cannot be later than end date." };
    }

    const hasOverlap = await checkTermOverlap(data.schoolId, formattedStartDate, formattedEndDate);
    if (hasOverlap) {
      return { success: false, message: "Term dates overlap with an existing academic term." };
    }

    const isCurrent = data.isCurrentTerm || data.status === "active";
    if (isCurrent) {
      await db.update(academicTerms)
        .set({ isCurrentTerm: false, status: "completed" })
        .where(eq(academicTerms.schoolId, data.schoolId));
    }

    const [newTerm] = await db.insert(academicTerms).values({
      ...data,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      status: data.status || (isCurrent ? "active" : "upcoming"),
      isCurrentTerm: isCurrent,
    }).returning();

    return {
      success: true,
      message: "Academic term created successfully.",
      term: newTerm,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create academic term." };
  }
};

/**
 * 2. Get academic term by ID
 */
export const getAcademicTermByIdService = async (id: string): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, id),
    });

    if (!term) {
      return { success: false, message: "Academic term not found." };
    }

    return {
      success: true,
      message: "Academic term retrieved successfully.",
      term,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch academic term." };
  }
};

/**
 * 3. List all academic terms for a specific school
 */
export const listAcademicTermsBySchoolService = async (schoolId: string): Promise<AcademicTermResponse> => {
  try {
    const terms = await db.select()
      .from(academicTerms)
      .where(eq(academicTerms.schoolId, schoolId));

    return {
      success: true,
      message: "Academic terms fetched successfully.",
      terms,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch academic terms." };
  }
};

/**
 * 4. Get the current active academic term for a school
 */
export const getCurrentAcademicTermService = async (schoolId: string): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: and(
        eq(academicTerms.schoolId, schoolId),
        eq(academicTerms.status, "active")
      ),
    });

    if (!term) {
      return { success: false, message: "No active academic term found for this school." };
    }

    return {
      success: true,
      message: "Current academic term retrieved successfully.",
      term,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch current academic term." };
  }
};

/**
 * 5. Update academic term details with overlap check & status handling
 */
export const updateAcademicTermService = async (
  id: string,
  updates: Partial<TInsertAcademicTerm>
): Promise<AcademicTermResponse> => {
  try {
    const existingTerm = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, id),
    });

    if (!existingTerm) {
      return { success: false, message: "Academic term not found." };
    }

    const startDate = updates.startDate 
      ? new Date(updates.startDate).toISOString().split("T")[0] 
      : existingTerm.startDate;
    const endDate = updates.endDate 
      ? new Date(updates.endDate).toISOString().split("T")[0] 
      : existingTerm.endDate;

    if (startDate > endDate) {
      return { success: false, message: "Start date cannot be later than end date." };
    }

    if (updates.startDate || updates.endDate) {
      const hasOverlap = await checkTermOverlap(existingTerm.schoolId, startDate, endDate, id);
      if (hasOverlap) {
        return { success: false, message: "Updated term dates overlap with an existing academic term." };
      }
    }

    const shouldBeActive = updates.isCurrentTerm || updates.status === "active";
    if (shouldBeActive) {
      await db.update(academicTerms)
        .set({ isCurrentTerm: false, status: "completed" })
        .where(and(eq(academicTerms.schoolId, existingTerm.schoolId), ne(academicTerms.id, id)));
    }

    const formattedUpdates: any = { ...updates };
    if (updates.startDate) formattedUpdates.startDate = startDate;
    if (updates.endDate) formattedUpdates.endDate = endDate;
    if (shouldBeActive) {
      formattedUpdates.isCurrentTerm = true;
      formattedUpdates.status = "active";
    }

    const [updatedTerm] = await db.update(academicTerms)
      .set(formattedUpdates)
      .where(eq(academicTerms.id, id))
      .returning();

    return {
      success: true,
      message: "Academic term updated successfully.",
      term: updatedTerm,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to update academic term." };
  }
};

/**
 * 6. Delete academic term
 */
export const deleteAcademicTermService = async (id: string): Promise<AcademicTermResponse> => {
  try {
    const [deletedTerm] = await db.delete(academicTerms)
      .where(eq(academicTerms.id, id))
      .returning();

    if (!deletedTerm) {
      return { success: false, message: "Academic term not found." };
    }

    return {
      success: true,
      message: "Academic term deleted successfully.",
      term: deletedTerm,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete academic term." };
  }
};

/**
 * 7. Create Term Window (Exams, Mid-term breaks, etc.)
 */
export const createTermWindowService = async (data: TInsertTermWindows): Promise<AcademicTermResponse> => {
  try {
    const term = await db.query.academicTerms.findFirst({
      where: eq(academicTerms.id, data.termId),
    });

    if (!term) {
      return { success: false, message: "Parent academic term not found." };
    }

    const winStart = new Date(data.startDate).toISOString().split("T")[0];
    const winEnd = new Date(data.endDate).toISOString().split("T")[0];

    if (winStart > winEnd) {
      return { success: false, message: "Window start date cannot be later than end date." };
    }

    if (winStart < term.startDate || winEnd > term.endDate) {
      return { success: false, message: "Term window must fall within the parent academic term's start and end dates." };
    }

    const [newWindow] = await db.insert(termWindows).values({
      ...data,
      startDate: winStart,
      endDate: winEnd,
    }).returning();

    return {
      success: true,
      message: "Term window created successfully.",
      window: newWindow,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create term window." };
  }
};

/**
 * 8. List all windows for an academic term
 */
export const listTermWindowsByTermService = async (termId: string): Promise<AcademicTermResponse> => {
  try {
    const windows = await db.select()
      .from(termWindows)
      .where(eq(termWindows.termId, termId));

    return {
      success: true,
      message: "Term windows fetched successfully.",
      windows,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to fetch term windows." };
  }
};

/**
 * 9. Delete a term window
 */
export const deleteTermWindowService = async (id: string): Promise<AcademicTermResponse> => {
  try {
    const [deletedWindow] = await db.delete(termWindows)
      .where(eq(termWindows.id, id))
      .returning();

    if (!deletedWindow) {
      return { success: false, message: "Term window not found." };
    }

    return {
      success: true,
      message: "Term window deleted successfully.",
      window: deletedWindow,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to delete term window." };
  }
};