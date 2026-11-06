// validators/fees.validator.ts
import { z } from "zod";

// ================================================================
// Reusable primitives
// ================================================================
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

const boardingStatus = z.enum(["Day", "Boarding"], {
  errorMap: () => ({ message: 'Boarding status must be "Day" or "Boarding".' }),
});

const paymentMethod = z.enum(["M-Pesa", "Bank", "Cash", "Cheque"], {
  errorMap: () => ({ message: 'Payment method must be one of: "M-Pesa", "Bank", "Cash", "Cheque".' }),
});

const invoiceStatus = z.enum(
  ["Unpaid", "Partial", "Paid", "Overdue", "Waived", "Cancelled"],
  { errorMap: () => ({ message: "Invalid invoice status." }) }
);

/** Non-negative decimal, string or number, up to 2dp. */
const money = (field: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      message: `${field} must be a valid amount (up to 2 decimals).`,
    })
    .refine((v) => Number(v) >= 0, { message: `${field} cannot be negative.` });

/** Strictly positive decimal (payments, etc.). */
const positiveMoney = (field: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
      message: `${field} must be a valid amount (up to 2 decimals).`,
    })
    .refine((v) => Number(v) > 0, { message: `${field} must be greater than zero.` });

// ================================================================
// 1–10. FEE ITEMS
// ================================================================
const feeItemObjectSchema = z.object({
  schoolId: uuid("school ID"),
  name: z.string().trim().min(2, "Fee item name must be at least 2 characters.").max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  isOptional: z.boolean().optional().default(false),
});

export const createFeeItemSchema = feeItemObjectSchema;

export const updateFeeItemSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    isOptional: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const bulkCreateFeeItemsSchema = z.object({
  schoolId: uuid("school ID"),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(100),
        description: z.string().trim().max(1000).optional().nullable(),
        isOptional: z.boolean().optional().default(false),
      })
    )
    .min(1, "At least one fee item is required.")
    .max(100, "Cannot create more than 100 fee items at once.")
    .refine(
      (items) => new Set(items.map((i) => i.name.toLowerCase())).size === items.length,
      { message: "Duplicate fee item names are not allowed in the same bulk request." }
    ),
});

export const searchFeeItemsSchema = z.object({
  query: z.string().trim().min(1, "Provide a search query.").max(100),
});

// ================================================================
// 11–22. FEE STRUCTURES
// ================================================================
const feeStructureObjectSchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
  feeItemId: uuid("fee item ID"),
  boardingStatus: boardingStatus,
  gradeLevelId: uuid("grade level ID").optional().nullable(),
  classId: uuid("class ID").optional().nullable(),
  amount: money("amount"),
});

export const createFeeStructureSchema = feeStructureObjectSchema
  // If classId is set, gradeLevelId must also be set — a class lives inside a grade
  .refine(
    (d) => !d.classId || !!d.gradeLevelId,
    { message: "gradeLevelId is required when classId is provided.", path: ["gradeLevelId"] }
  );

export const updateFeeStructureSchema = z.object({
  amount: money("amount"),
});

export const bulkUpsertFeeStructureSchema = z
  .object({
    schoolId: uuid("school ID"),
    termId: uuid("term ID"),
    boardingStatus: boardingStatus,
    gradeLevelId: uuid("grade level ID").optional().nullable(),
    classId: uuid("class ID").optional().nullable(),
    items: z
      .array(
        z.object({
          feeItemId: uuid("fee item ID"),
          amount: money("amount"),
        })
      )
      .min(1, "At least one fee item is required.")
      .max(200, "Cannot upsert more than 200 items at once.")
      .refine(
        (items) => new Set(items.map((i) => i.feeItemId)).size === items.length,
        { message: "Duplicate feeItemId in items — each fee item may appear once." }
      ),
  })
  .refine(
    (d) => !d.classId || !!d.gradeLevelId,
    { message: "gradeLevelId is required when classId is provided.", path: ["gradeLevelId"] }
  );

export const copyFeeStructureSchema = z
  .object({
    schoolId: uuid("school ID"),
    fromTermId: uuid("source term ID"),
    toTermId: uuid("target term ID"),
  })
  .refine((d) => d.fromTermId !== d.toTermId, {
    message: "Source and target terms must be different.",
    path: ["toTermId"],
  });

export const listFeeStructuresByBoardingStatusSchema = z.object({
  boardingStatus: boardingStatus,
});

export const listFeeStructuresByGradeSchema = z.object({
  gradeLevelId: uuid("grade level ID"),
  boardingStatus: boardingStatus,
});

export const resolveFeesForClassSchema = z.object({
  classId: uuid("class ID"),
  boardingStatus: boardingStatus,
});

export const getClassTotalFeeSchema = z.object({
  classId: uuid("class ID"),
  boardingStatus: boardingStatus,
});

// ================================================================
// 23–36. INVOICES
// ================================================================
export const generateInvoiceForStudentSchema = z.object({
  schoolId: uuid("school ID"),
  studentId: uuid("student ID"),
  termId: uuid("term ID"),
  dueDate: isoDate.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  includeOptionalFeeItems: z.boolean().optional().default(false),
  optionalFeeItemIds: z.array(uuid("fee item ID")).optional().default([]),
});

export const generateInvoicesForClassSchema = z.object({
  schoolId: uuid("school ID"),
  classId: uuid("class ID"),
  termId: uuid("term ID"),
  dueDate: isoDate.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  includeOptionalFeeItems: z.boolean().optional().default(false),
});

export const generateInvoicesForGradeLevelSchema = z.object({
  schoolId: uuid("school ID"),
  gradeLevelId: uuid("grade level ID"),
  termId: uuid("term ID"),
  dueDate: isoDate.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  includeOptionalFeeItems: z.boolean().optional().default(false),
});

export const generateInvoicesForSchoolSchema = z.object({
  schoolId: uuid("school ID"),
  termId: uuid("term ID"),
  dueDate: isoDate.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  includeOptionalFeeItems: z.boolean().optional().default(false),
});

export const updateInvoiceStatusSchema = z.object({
  status: invoiceStatus,
});

export const waiveInvoiceSchema = z.object({
  reason: z.string().trim().min(3, "Provide a waiver reason.").max(500),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(3, "Provide a cancellation reason.").max(500),
});

export const applyDiscountToInvoiceSchema = z.object({
  discount: money("discount"),
});

export const listInvoicesByStatusSchema = z.object({
  status: invoiceStatus,
  termId: uuid("term ID").optional(),
});

// ================================================================
// 37–48. PAYMENTS
// ================================================================
const recordPaymentObjectSchema = z.object({
  schoolId: uuid("school ID"),
  studentId: uuid("student ID"),
  termId: uuid("term ID"),
  invoiceId: uuid("invoice ID").optional().nullable(),
  amountPaid: positiveMoney("amountPaid"),
  paymentMethod: paymentMethod,
  referenceCode: z.string().trim().min(1, "Reference code is required.").max(100),
  payerName: z.string().trim().max(150).optional().nullable(),
  payerPhone: z.string().trim().max(20).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  mpesaCheckoutRequestId: z.string().trim().max(100).optional().nullable(),
});

export const recordPaymentSchema = recordPaymentObjectSchema.refine(
  (d) =>
    d.paymentMethod !== "M-Pesa" || !!d.mpesaCheckoutRequestId || !!d.referenceCode,
  {
    message: "M-Pesa payments should provide a referenceCode or mpesaCheckoutRequestId.",
    path: ["referenceCode"],
  }
);

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(3, "Provide a reversal reason.").max(500),
});

export const listTransactionsForTermSchema = z.object({
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
});

export const listTransactionsByMethodSchema = z.object({
  method: paymentMethod,
});

export const listDefaultersSchema = z.object({
  minBalance: z.coerce.number().min(0).optional().default(1),
});

export const findPaymentByMpesaCheckoutSchema = z.object({
  checkoutRequestId: z.string().trim().min(1, "checkoutRequestId is required.").max(100),
});

// ================================================================
// 49–60. ANALYTICS
// ================================================================
export const getDailyCollectionsSchema = z.object({
  date: isoDate,
});

export const getCollectionTrendSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// ================================================================
// ROUTE PARAMS
// ================================================================
export const feeItemIdParamSchema = z.object({ feeItemId: uuid("fee item ID") });
export const feeStructureIdParamSchema = z.object({ feeStructureId: uuid("fee structure ID") });
export const invoiceIdParamSchema = z.object({ invoiceId: uuid("invoice ID") });
export const transactionIdParamSchema = z.object({ transactionId: uuid("transaction ID") });
export const termIdParamSchema = z.object({ termId: uuid("term ID") });
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });
export const studentIdParamSchema = z.object({ studentId: uuid("student ID") });
export const classIdParamSchema = z.object({ classId: uuid("class ID") });
export const gradeLevelIdParamSchema = z.object({ gradeLevelId: uuid("grade level ID") });

// ================================================================
// Inferred types
// ================================================================
export type CreateFeeItemInput = z.infer<typeof createFeeItemSchema>;
export type UpdateFeeItemInput = z.infer<typeof updateFeeItemSchema>;
export type BulkCreateFeeItemsInput = z.infer<typeof bulkCreateFeeItemsSchema>;
export type SearchFeeItemsInput = z.infer<typeof searchFeeItemsSchema>;

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;
export type BulkUpsertFeeStructureInput = z.infer<typeof bulkUpsertFeeStructureSchema>;
export type CopyFeeStructureInput = z.infer<typeof copyFeeStructureSchema>;
export type ListFeeStructuresByBoardingStatusInput = z.infer<typeof listFeeStructuresByBoardingStatusSchema>;
export type ListFeeStructuresByGradeInput = z.infer<typeof listFeeStructuresByGradeSchema>;
export type ResolveFeesForClassInput = z.infer<typeof resolveFeesForClassSchema>;
export type GetClassTotalFeeInput = z.infer<typeof getClassTotalFeeSchema>;

export type GenerateInvoiceForStudentInput = z.infer<typeof generateInvoiceForStudentSchema>;
export type GenerateInvoicesForClassInput = z.infer<typeof generateInvoicesForClassSchema>;
export type GenerateInvoicesForGradeLevelInput = z.infer<typeof generateInvoicesForGradeLevelSchema>;
export type GenerateInvoicesForSchoolInput = z.infer<typeof generateInvoicesForSchoolSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
export type WaiveInvoiceInput = z.infer<typeof waiveInvoiceSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
export type ApplyDiscountToInvoiceInput = z.infer<typeof applyDiscountToInvoiceSchema>;
export type ListInvoicesByStatusInput = z.infer<typeof listInvoicesByStatusSchema>;

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
export type ListTransactionsForTermInput = z.infer<typeof listTransactionsForTermSchema>;
export type ListTransactionsByMethodInput = z.infer<typeof listTransactionsByMethodSchema>;
export type ListDefaultersInput = z.infer<typeof listDefaultersSchema>;
export type FindPaymentByMpesaCheckoutInput = z.infer<typeof findPaymentByMpesaCheckoutSchema>;

export type GetDailyCollectionsInput = z.infer<typeof getDailyCollectionsSchema>;
export type GetCollectionTrendInput = z.infer<typeof getCollectionTrendSchema>;