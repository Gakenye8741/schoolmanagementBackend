import { eq, and, desc, between } from "drizzle-orm";
import db from "../../drizzle/db";
import { schoolExpenses } from "../../drizzle/schema";
import { 
  TInsertSchoolExpense, 
  TSelectSchoolExpense 
} from "../../drizzle/types";

/**
 * Create a new school expense record
 */
export const createSchoolExpenseService = async (data: TInsertSchoolExpense) => {
  try {
    const [newExpense] = await db.insert(schoolExpenses).values(data).returning();
    return {
      success: true,
      message: "School expense created successfully.",
      expense: newExpense,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message?.includes("expense_school_ref_idx")
        ? "Duplicate reference code for this school's expenses."
        : (error.message || "Failed to create school expense."),
    };
  }
};

/**
 * Get a single school expense by ID with relations
 */
export const getSchoolExpenseByIdService = async (expenseId: string) => {
  try {
    const expense = await db.query.schoolExpenses.findFirst({
      where: eq(schoolExpenses.id, expenseId),
      with: {
        school: true,
        recordedByUser: true,
      },
    });

    if (!expense) {
      return { success: false, message: "School expense not found." };
    }

    return { success: true, expense };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all school expenses configured for a specific school
 */
export const getSchoolExpensesBySchoolService = async (schoolId: string) => {
  try {
    const expenses = await db.query.schoolExpenses.findMany({
      where: eq(schoolExpenses.schoolId, schoolId),
      with: {
        recordedByUser: true,
      },
      orderBy: [desc(schoolExpenses.expenseDate)],
    });

    return { success: true, expenses };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Update an existing school expense record
 */
export const updateSchoolExpenseService = async (expenseId: string, data: Partial<TInsertSchoolExpense>) => {
  try {
    const [updatedExpense] = await db
      .update(schoolExpenses)
      .set(data)
      .where(eq(schoolExpenses.id, expenseId))
      .returning();

    if (!updatedExpense) {
      return { success: false, message: "School expense not found or update failed." };
    }

    return { success: true, message: "School expense updated successfully.", expense: updatedExpense };
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message?.includes("expense_school_ref_idx")
        ? "Duplicate reference code for this school's expenses."
        : (error.message || "Internal server error.") 
    };
  }
};

/**
 * Delete a school expense record
 */
export const deleteSchoolExpenseService = async (expenseId: string) => {
  try {
    const [deletedExpense] = await db
      .delete(schoolExpenses)
      .where(eq(schoolExpenses.id, expenseId))
      .returning();

    if (!deletedExpense) {
      return { success: false, message: "School expense not found." };
    }

    return { success: true, message: "School expense deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get school expenses filtered by category
 */
export const getSchoolExpensesByCategoryService = async (schoolId: string, category: string) => {
  try {
    const expenses = await db.query.schoolExpenses.findMany({
      where: and(
        eq(schoolExpenses.schoolId, schoolId),
        eq(schoolExpenses.category, category as any)
      ),
      with: {
        recordedByUser: true,
      },
      orderBy: [desc(schoolExpenses.expenseDate)],
    });

    return { success: true, expenses };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get school expenses within a specific date range (e.g., for termly/monthly auditing)
 */
export const getSchoolExpensesByDateRangeService = async (schoolId: string, startDate: string, endDate: string) => {
  try {
    const expenses = await db.query.schoolExpenses.findMany({
      where: and(
        eq(schoolExpenses.schoolId, schoolId),
        between(schoolExpenses.expenseDate, startDate, endDate)
      ),
      with: {
        recordedByUser: true,
      },
      orderBy: [desc(schoolExpenses.expenseDate)],
    });

    const totalAmount = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    return { 
      success: true, 
      summary: {
        startDate,
        endDate,
        totalExpensesCount: expenses.length,
        totalAmountSpent: totalAmount,
      },
      expenses 
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get total expense summary grouped by category for a school within an optional date range
 */
export const getSchoolExpenseCategorySummaryService = async (schoolId: string, startDate?: string, endDate?: string) => {
  try {
    const conditions = [eq(schoolExpenses.schoolId, schoolId)];
    
    if (startDate && endDate) {
      conditions.push(between(schoolExpenses.expenseDate, startDate, endDate));
    }

    const expenses = await db.query.schoolExpenses.findMany({
      where: and(...conditions),
    });

    const categoryTotals: Record<string, { count: number; totalAmount: number }> = {};
    let grandTotal = 0;

    for (const exp of expenses) {
      const cat = exp.category;
      const amt = Number(exp.amount);

      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { count: 0, totalAmount: 0 };
      }

      categoryTotals[cat].count += 1;
      categoryTotals[cat].totalAmount += amt;
      grandTotal += amt;
    }

    return {
      success: true,
      summary: {
        grandTotal,
        categories: categoryTotals,
      },
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};