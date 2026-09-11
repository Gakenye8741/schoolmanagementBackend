import { z } from "zod";

/**
 * Zod validation schema for creating a fee item
 */
export const createFeeItemSchema = z.object({
  schoolId: z.string().uuid({ message: "Invalid school ID format." }),
  name: z.string().min(1, { message: "Fee item name is required." }).max(100, { message: "Name cannot exceed 100 characters." }),
  description: z.string().optional(),
  isOptional: z.boolean().default(false),
});

/**
 * Zod validation schema for updating a fee item
 */
export const updateFeeItemSchema = createFeeItemSchema.partial();

/**
 * Zod validation schema for configuring a class fee structure
 */
export const createClassFeeStructureSchema = z.object({
  termId: z.string().uuid({ message: "Invalid academic term ID format." }),
  gradeLevel: z.string().min(1, { message: "Grade level is required." }).max(50, { message: "Grade level cannot exceed 50 characters." }),
  feeItemId: z.string().uuid({ message: "Invalid fee item ID format." }),
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)),
});

/**
 * Zod validation schema for updating a class fee structure
 */
export const updateClassFeeStructureSchema = z.object({
  termId: z.string().uuid({ message: "Invalid academic term ID format." }).optional(),
  gradeLevel: z.string().min(1, { message: "Grade level is required." }).max(50, { message: "Grade level cannot exceed 50 characters." }).optional(),
  feeItemId: z.string().uuid({ message: "Invalid fee item ID format." }).optional(),
  amount: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
});

/**
 * Zod validation schema for recording a fee transaction payment
 */
export const createFeeTransactionSchema = z.object({
  schoolId: z.string().uuid({ message: "Invalid school ID format." }),
  studentId: z.string().uuid({ message: "Invalid student ID format." }),
  amountPaid: z.union([z.string(), z.number()]).transform((val) => String(val)),
  balanceRemaining: z.union([z.string(), z.number()]).transform((val) => String(val)),
  paymentMethod: z.enum(["M-Pesa", "Cash", "Bank"], { message: "Invalid payment method." }),
  referenceCode: z.string().min(1, { message: "Payment reference code is required." }).max(100, { message: "Reference code cannot exceed 100 characters." }),
  termId: z.string().uuid({ message: "Invalid academic term ID format." }),
  recordedBy: z.string().uuid({ message: "Invalid user ID format." }).nullable().optional(),
});

/**
 * Zod validation schema for updating a fee transaction
 */
export const updateFeeTransactionSchema = z.object({
  schoolId: z.string().uuid({ message: "Invalid school ID format." }).optional(),
  studentId: z.string().uuid({ message: "Invalid student ID format." }).optional(),
  amountPaid: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
  balanceRemaining: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
  paymentMethod: z.enum(["M-Pesa", "Cash", "Bank"], { message: "Invalid payment method." }).optional(),
  referenceCode: z.string().min(1, { message: "Payment reference code is required." }).max(100, { message: "Reference code cannot exceed 100 characters." }).optional(),
  termId: z.string().uuid({ message: "Invalid academic term ID format." }).optional(),
  recordedBy: z.string().uuid({ message: "Invalid user ID format." }).nullable().optional(),
});