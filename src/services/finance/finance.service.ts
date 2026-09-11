import { eq, and, desc, sql, sum } from "drizzle-orm";
import db from "../../drizzle/db";
import { feeItems, classFeeStructures, feeTransactions, students } from "../../drizzle/schema";
import { 
  TInsertFeeItem, 
  TSelectFeeItem, 
  TInsertClassFeeStructure, 
  TSelectClassFeeStructure, 
  TInsertFeeTransaction, 
  TSelectFeeTransaction 
} from "../../drizzle/types";

/**
 * Create a new fee item definition for a school (e.g., Tuition, Activity, Lunch)
 */
export const createFeeItemService = async (data: TInsertFeeItem) => {
  try {
    const [newItem] = await db.insert(feeItems).values(data).returning();
    return {
      success: true,
      message: "Fee item created successfully.",
      feeItem: newItem,
    };
  } catch (error: any) {
    return {
      success: false,
      message: "Failed to create fee item.",
      error: error.message,
    };
  }
};

/**
 * Get a single fee item by ID with relations
 */
export const getFeeItemByIdService = async (feeItemId: string) => {
  try {
    const item = await db.query.feeItems.findFirst({
      where: eq(feeItems.id, feeItemId),
      with: {
        school: true,
        classFeeStructures: true,
      },
    });

    if (!item) {
      return { success: false, message: "Fee item not found." };
    }

    return { success: true, feeItem: item };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all fee items configured for a specific school
 */
export const getFeeItemsBySchoolService = async (schoolId: string) => {
  try {
    const items = await db.query.feeItems.findMany({
      where: eq(feeItems.schoolId, schoolId),
      with: {
        classFeeStructures: true,
      },
    });

    return { success: true, feeItems: items };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Update an existing fee item
 */
export const updateFeeItemService = async (feeItemId: string, data: Partial<TInsertFeeItem>) => {
  try {
    const [updatedItem] = await db
      .update(feeItems)
      .set(data)
      .where(eq(feeItems.id, feeItemId))
      .returning();

    if (!updatedItem) {
      return { success: false, message: "Fee item not found or update failed." };
    }

    return { success: true, message: "Fee item updated successfully.", feeItem: updatedItem };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Delete a fee item definition
 */
export const deleteFeeItemService = async (feeItemId: string) => {
  try {
    const [deletedItem] = await db
      .delete(feeItems)
      .where(eq(feeItems.id, feeItemId))
      .returning();

    if (!deletedItem) {
      return { success: false, message: "Fee item not found." };
    }

    return { success: true, message: "Fee item deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Set up or assign a fee amount for a specific grade level within an academic term
 */
export const createClassFeeStructureService = async (data: TInsertClassFeeStructure) => {
  try {
    const [structure] = await db.insert(classFeeStructures).values(data).returning();
    return {
      success: true,
      message: "Class fee structure configured successfully.",
      classFeeStructure: structure,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get fee structures mapped by term and grade level
 */
export const getClassFeeStructuresService = async (termId: string, gradeLevel: string) => {
  try {
    const structures = await db.query.classFeeStructures.findMany({
      where: and(
        eq(classFeeStructures.termId, termId),
        eq(classFeeStructures.gradeLevel, gradeLevel)
      ),
      with: {
        feeItem: true,
        term: true,
      },
    });

    return { success: true, classFeeStructures: structures };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Update an existing class fee structure amount
 */
export const updateClassFeeStructureService = async (structureId: string, data: Partial<TInsertClassFeeStructure>) => {
  try {
    const [updated] = await db
      .update(classFeeStructures)
      .set(data)
      .where(eq(classFeeStructures.id, structureId))
      .returning();

    if (!updated) {
      return { success: false, message: "Fee structure not found or update failed." };
    }

    return { success: true, message: "Fee structure updated successfully.", classFeeStructure: updated };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Delete a class fee structure item
 */
export const deleteClassFeeStructureService = async (structureId: string) => {
  try {
    const [deleted] = await db
      .delete(classFeeStructures)
      .where(eq(classFeeStructures.id, structureId))
      .returning();

    if (!deleted) {
      return { success: false, message: "Fee structure record not found." };
    }

    return { success: true, message: "Fee structure record deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Record a student fee payment transaction and calculate remaining balance
 */
export const recordFeeTransactionService = async (data: TInsertFeeTransaction) => {
  try {
    const [newTransaction] = await db.insert(feeTransactions).values(data).returning();

    return {
      success: true,
      message: "Fee transaction recorded successfully.",
      transaction: newTransaction,
    };
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message?.includes("fee_school_ref_idx") 
        ? "Duplicate payment reference code for this school." 
        : (error.message || "Internal server error.") 
    };
  }
};

/**
 * Update a fee transaction record
 */
export const updateFeeTransactionService = async (transactionId: string, data: Partial<TInsertFeeTransaction>) => {
  try {
    const [updated] = await db
      .update(feeTransactions)
      .set(data)
      .where(eq(feeTransactions.id, transactionId))
      .returning();

    if (!updated) {
      return { success: false, message: "Transaction not found or update failed." };
    }

    return { success: true, message: "Fee transaction updated successfully.", transaction: updated };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Delete a fee transaction record
 */
export const deleteFeeTransactionService = async (transactionId: string) => {
  try {
    const [deleted] = await db
      .delete(feeTransactions)
      .where(eq(feeTransactions.id, transactionId))
      .returning();

    if (!deleted) {
      return { success: false, message: "Transaction not found." };
    }

    return { success: true, message: "Fee transaction deleted successfully." };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get all payment transactions made by a specific student
 */
export const getStudentFeeTransactionsService = async (studentId: string) => {
  try {
    const transactions = await db.query.feeTransactions.findMany({
      where: eq(feeTransactions.studentId, studentId),
      with: {
        term: true,
        recordedByUser: true,
      },
      orderBy: [desc(feeTransactions.transactionDate)],
    });

    return { success: true, transactions };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get school-wide fee transactions with complete relations
 */
export const getSchoolFeeTransactionsService = async (schoolId: string) => {
  try {
    const transactions = await db.query.feeTransactions.findMany({
      where: eq(feeTransactions.schoolId, schoolId),
      with: {
        student: true,
        term: true,
        recordedByUser: true,
      },
      orderBy: [desc(feeTransactions.transactionDate)],
    });

    return { success: true, transactions };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Generate student fee statement summary (total expected fee vs total paid vs remaining balance for a term)
 */
export const getStudentFeeStatementService = async (studentId: string, termId: string, gradeLevel: string) => {
  try {
    // 1. Get all fee items required for this grade and term
    const structures = await db.query.classFeeStructures.findMany({
      where: and(
        eq(classFeeStructures.termId, termId),
        eq(classFeeStructures.gradeLevel, gradeLevel)
      ),
      with: {
        feeItem: true,
      },
    });

    const totalExpectedFee = structures.reduce((sum, item) => sum + Number(item.amount), 0);

    // 2. Get all payments made by this student for the specified term
    const payments = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.studentId, studentId),
        eq(feeTransactions.termId, termId)
      ),
    });

    const totalPaid = payments.reduce((sum, tx) => sum + Number(tx.amountPaid), 0);
    const balanceRemaining = totalExpectedFee - totalPaid;

    return {
      success: true,
      statement: {
        studentId,
        termId,
        gradeLevel,
        totalExpectedFee,
        totalPaid,
        balanceRemaining: balanceRemaining > 0 ? balanceRemaining : 0,
        feeStructures: structures,
        transactions: payments,
      },
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};

/**
 * Get school financial collection metrics for a specific term
 */
export const getSchoolTermCollectionSummaryService = async (schoolId: string, termId: string) => {
  try {
    const transactions = await db.query.feeTransactions.findMany({
      where: and(
        eq(feeTransactions.schoolId, schoolId),
        eq(feeTransactions.termId, termId)
      ),
    });

    const totalCollected = transactions.reduce((sum, tx) => sum + Number(tx.amountPaid), 0);
    const transactionCount = transactions.length;

    return {
      success: true,
      summary: {
        termId,
        totalCollected,
        transactionCount,
      },
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Internal server error." };
  }
};