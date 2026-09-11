import { z } from "zod";

/**
 * Zod validation schema for creating a school expense
 */
export const createSchoolExpenseSchema = z.object({
  schoolId: z.string().uuid({ message: "Invalid school ID format." }),
  title: z.string().min(1, { message: "Expense title is required." }).max(150, { message: "Title cannot exceed 150 characters." }),
  category: z.enum([
    "Utilities", 
    "Supplies", 
    "Maintenance", 
    "Transport", 
    "Salary"
  ], { message: "Invalid expense category." }),
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)),
  paymentMethod: z.enum(["M-Pesa", "Cash", "Bank"], { message: "Invalid payment method." }),
  referenceCode: z.string().min(1, { message: "Reference code is required." }).max(100, { message: "Reference code cannot exceed 100 characters." }).optional(),
  recordedBy: z.string().uuid({ message: "Invalid user ID format for recorder." }),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Expense date must be in YYYY-MM-DD format." }),
});

/**
 * Zod validation schema for updating a school expense
 */
export const updateSchoolExpenseSchema = z.object({
  schoolId: z.string().uuid({ message: "Invalid school ID format." }).optional(),
  title: z.string().min(1, { message: "Expense title is required." }).max(150, { message: "Title cannot exceed 150 characters." }).optional(),
  category: z.enum([
    "Utilities", 
    "Supplies", 
    "Maintenance", 
    "Transport", 
    "Salary"
  ], { message: "Invalid expense category." }).optional(),
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
  paymentMethod: z.enum(["M-Pesa", "Cash", "Bank"], { message: "Invalid payment method." }).optional(),
  referenceCode: z.string().min(1, { message: "Reference code is required." }).max(100, { message: "Reference code cannot exceed 100 characters." }).optional(),
  recordedBy: z.string().uuid({ message: "Invalid user ID format for recorder." }).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Expense date must be in YYYY-MM-DD format." }).optional(),
});