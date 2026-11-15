// src/validators/subscriptions.validator.ts
import { z } from "zod";

const uuid = (field: string) => z.string().uuid(`Invalid ${field} format.`);

export const planEnum = z.enum(["Trial", "Basic", "Standard", "Premium", "Enterprise"]);
export const paymentMethodEnum = z.enum(["M-Pesa", "Bank", "Cash", "Cheque"]);

// ================================================================
// Subscriptions
// ================================================================
export const subscribeSchoolSchema = z.object({
  plan: planEnum,
  paymentMethod: paymentMethodEnum.optional(),
  referenceCode: z.string().trim().max(100).optional(),
  amount: z.coerce.number().min(0).optional(),
});

export const renewSubscriptionSchema = z.object({
  plan: planEnum.optional(),
  paymentMethod: paymentMethodEnum.optional(),
  referenceCode: z.string().trim().max(100).optional(),
  amount: z.coerce.number().min(0).optional(),
});

export const upgradeSubscriptionSchema = z.object({
  newPlan: planEnum,
  paymentMethod: paymentMethodEnum.optional(),
  referenceCode: z.string().trim().max(100).optional(),
  amount: z.coerce.number().min(0).optional(),
});

export const downgradeSubscriptionSchema = z.object({
  newPlan: planEnum,
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const suspendSchoolSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// ================================================================
// Payments
// ================================================================
export const recordSubscriptionPaymentSchema = z
  .object({
    plan: planEnum,
    amount: z.coerce.number().positive(),
    paymentMethod: paymentMethodEnum,
    referenceCode: z.string().trim().max(100).optional(),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  })
  .refine((d) => d.periodEnd >= d.periodStart, {
    message: "periodEnd must be on or after periodStart.",
  });

// ================================================================
// SMS credits
// ================================================================
export const purchaseSmsCreditsSchema = z.object({
  credits: z.coerce.number().int().positive().max(100000),
  amount: z.coerce.number().min(0).optional(),
  paymentMethod: paymentMethodEnum.optional(),
  referenceCode: z.string().trim().max(100).optional(),
});

export const deductSmsCreditsSchema = z.object({
  credits: z.coerce.number().int().positive(),
});

// ================================================================
// Params & queries
// ================================================================
export const schoolIdParamSchema = z.object({ schoolId: uuid("school ID") });
export const paymentIdParamSchema = z.object({ paymentId: uuid("payment ID") });
export const planParamSchema = z.object({ plan: planEnum });

export const listSubscriptionsQuerySchema = z.object({
  plan: planEnum.optional(),
  status: z
    .enum(["Active", "PastDue", "Suspended", "Cancelled", "Expired"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const expiringSoonQuerySchema = z.object({
  withinDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const paymentsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const revenueQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ================================================================
// Inferred types
// ================================================================
export type SubscribeSchoolInput = z.infer<typeof subscribeSchoolSchema>;
export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
export type UpgradeSubscriptionInput = z.infer<typeof upgradeSubscriptionSchema>;
export type RecordSubscriptionPaymentInput = z.infer<typeof recordSubscriptionPaymentSchema>;
export type PurchaseSmsCreditsInput = z.infer<typeof purchaseSmsCreditsSchema>;