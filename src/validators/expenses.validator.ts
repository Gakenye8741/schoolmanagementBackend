// src/services/expenses/expenses.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    },
    { message: "Invalid calendar date." }
  );

const isoDateTime = z
  .string()
  .datetime({ message: "Must be a valid ISO 8601 datetime (e.g. 2026-11-06T14:30:00Z)." });

/** Positive decimal with up to 2dp — for expense amounts. */
const positiveDecimal = (field: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      message: `${field} must be a valid number (up to 2 decimals).`,
    })
    .refine((v) => Number(v) > 0, {
      message: `${field} must be greater than zero.`,
    });

const expenseCategory = z.enum(
  ["Salary", "Utilities", "Maintenance", "Supplies", "Transport"],
  {
    errorMap: () => ({
      message: 'Category must be one of: "Salary", "Utilities", "Maintenance", "Supplies", "Transport".',
    }),
  }
);

const paymentMethod = z.enum(["M-Pesa", "Bank", "Cash", "Cheque"], {
  errorMap: () => ({
    message: 'Payment method must be one of: "M-Pesa", "Bank", "Cash", "Cheque".',
  }),
});

// ================================================================
// CREATE EXPENSE
// ================================================================
const expenseObjectSchema = z.object({
  schoolId: uuid("school ID"),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(150),
  category: expenseCategory,
  amount: positiveDecimal("amount"),
  paymentMethod: paymentMethod,
  referenceCode: z.string().trim().max(100).optional().nullable(),
  receiptUrl: z.string().url("Receipt URL must be a valid URL.").optional().nullable(),
  expenseDate: isoDate,
});

export const createExpenseSchema = expenseObjectSchema.refine(
  (d) => {
    const dt = new Date(d.expenseDate);
    return dt <= new Date();
  },
  { message: "expenseDate cannot be in the future.", path: ["expenseDate"] }
);

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ================================================================
// BULK CREATE EXPENSES
// ================================================================
const bulkExpenseItemSchema = z.object({
  title: z.string().trim().min(2).max(150),
  category: expenseCategory,
  amount: positiveDecimal("amount"),
  paymentMethod: paymentMethod,
  referenceCode: z.string().trim().max(100).optional().nullable(),
  receiptUrl: z.string().url("Receipt URL must be a valid URL.").optional().nullable(),
  expenseDate: isoDate,
});

export const bulkCreateExpensesSchema = z.object({
  schoolId: uuid("school ID"),
  expenses: z
    .array(bulkExpenseItemSchema)
    .min(1, "At least one expense is required.")
    .max(100, "Cannot record more than 100 expenses at once."),
});

export type BulkCreateExpensesInput = z.infer<typeof bulkCreateExpensesSchema>;

// ================================================================
// UPDATE EXPENSE
// ================================================================
export const updateExpenseSchema = z
  .object({
    title: z.string().trim().min(2).max(150).optional(),
    category: expenseCategory.optional(),
    amount: positiveDecimal("amount").optional(),
    paymentMethod: paymentMethod.optional(),
    referenceCode: z.string().trim().max(100).optional().nullable(),
    receiptUrl: z.string().url("Receipt URL must be a valid URL.").optional().nullable(),
    expenseDate: isoDate.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

// ================================================================
// LIST QUERIES
// ================================================================
export const listExpensesForSchoolSchema = z.object({
  category: expenseCategory.optional(),
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
  pendingApprovalOnly: z.coerce.boolean().optional(),
  approved: z.coerce.boolean().optional(),
});

export type ListExpensesForSchoolInput = z.infer<typeof listExpensesForSchoolSchema>;

export const listExpensesByDateRangeSchema = z
  .object({
    fromDate: isoDate,
    toDate: isoDate,
  })
  .refine((d) => d.toDate >= d.fromDate, {
    message: "toDate must be on or after fromDate.",
    path: ["toDate"],
  });

export type ListExpensesByDateRangeInput = z.infer<typeof listExpensesByDateRangeSchema>;

// ================================================================
// ANALYTICS QUERIES
// ================================================================
export const expenseSummaryQuerySchema = z.object({
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
});

export type ExpenseSummaryQueryInput = z.infer<typeof expenseSummaryQuerySchema>;

export const monthlyExpensesQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});

export type MonthlyExpensesQueryInput = z.infer<typeof monthlyExpensesQuerySchema>;

export const topCategoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export type TopCategoriesQueryInput = z.infer<typeof topCategoriesQuerySchema>;

// ================================================================
// ROUTE PARAMS
// ================================================================
export const expenseIdParamSchema = z.object({
  expenseId: uuid("expense ID"),
});

export const schoolIdParamSchema = z.object({
  schoolId: uuid("school ID"),
});

export const categoryParamSchema = z.object({
  category: expenseCategory,
});