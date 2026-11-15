// src/services/subscriptions/subscriptions.service.ts
import {
  eq, and, ne, asc, desc, count, sql, isNull, inArray, gte, lte, lt, gt, or,
} from "drizzle-orm";
import { randomUUID } from "crypto";

import {
  schools,
  subscriptionPayments,
  users,
  auditLogs,
  TSelectSchool,
  TSelectSubscriptionPayment,
} from "../../drizzle/schema";
import db from "../../drizzle/db";

// ================================================================
// Types & constants
// ================================================================
export type SubscriptionPlan = "Trial" | "Basic" | "Standard" | "Premium" | "Enterprise";
export type SubscriptionStatus = "Active" | "PastDue" | "Suspended" | "Cancelled" | "Expired";
export type PaymentMethod = "M-Pesa" | "Bank" | "Cash" | "Cheque";

/**
 * SINGLE SOURCE OF TRUTH for plan pricing and limits.
 * Edit this object to change amounts, features, or limits — no migration needed.
 * Prices are in KES. `amountKes: null` means "custom / quote required" (Enterprise).
 */
export const PLAN_PRICING: Record<
  SubscriptionPlan,
  {
    label: string;
    amountKes: number | null;
    periodDays: number;
    maxStudents: number | null; // null = unlimited
    smsCreditsIncluded: number;
    features: string[];
  }
> = {
  Trial: {
    label: "Free Trial",
    amountKes: 0,
    periodDays: 30,
    maxStudents: 50,
    smsCreditsIncluded: 100,
    features: [
      "All core modules",
      "Up to 50 students",
      "100 SMS credits",
      "30-day trial",
    ],
  },
  Basic: {
    label: "Basic",
    amountKes: 5000,
    periodDays: 30,
    maxStudents: 200,
    smsCreditsIncluded: 500,
    features: [
      "All core modules",
      "Up to 200 students",
      "500 SMS credits / month",
      "Email support",
    ],
  },
  Standard: {
    label: "Standard",
    amountKes: 15000,
    periodDays: 30,
    maxStudents: 500,
    smsCreditsIncluded: 1500,
    features: [
      "All core modules",
      "Up to 500 students",
      "1,500 SMS credits / month",
      "Priority email support",
      "Report cards + bulk PDF",
    ],
  },
  Premium: {
    label: "Premium",
    amountKes: 30000,
    periodDays: 30,
    maxStudents: 1500,
    smsCreditsIncluded: 5000,
    features: [
      "All modules + premium",
      "Up to 1,500 students",
      "5,000 SMS credits / month",
      "Priority phone + email",
      "Custom branding",
      "Scheduled reports",
    ],
  },
  Enterprise: {
    label: "Enterprise",
    amountKes: null,
    periodDays: 30,
    maxStudents: null,
    smsCreditsIncluded: 20000,
    features: [
      "Unlimited students",
      "Unlimited SMS credits",
      "Dedicated account manager",
      "Custom integrations",
      "SLA + on-site training",
    ],
  },
};

/** Grace periods after expiry before suspension / cancellation. */
export const GRACE_PAST_DUE_DAYS = 0;      // expiry day → PastDue immediately
export const GRACE_SUSPENDED_DAYS = 7;     // 7 days past → Suspended
export const GRACE_EXPIRED_DAYS = 37;      // 7 + 30 days past → Expired

// ================================================================
// Response envelope
// ================================================================
export interface SubscriptionResponse {
  success: boolean;
  message: string;
  school?: {
    id: string;
    name: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    expiresAt: string | null;
    maxStudents: number | null;
    smsCredits: number;
    currency: string;
    daysUntilExpiry: number | null;
  };
  payment?: TSelectSubscriptionPayment;
  payments?: TSelectSubscriptionPayment[];
  plans?: Array<{
    plan: SubscriptionPlan;
    label: string;
    amountKes: number | null;
    periodDays: number;
    maxStudents: number | null;
    smsCreditsIncluded: number;
    features: string[];
  }>;
  schools?: Array<any>;
  stats?: Record<string, any>;
  count?: number;
  issues?: string[];
}

// ================================================================
// Helpers
// ================================================================
const now = () => new Date();
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

const genRefCode = () => `SUB-${randomUUID()}`;

const assertSchoolExists = async (schoolId: string) =>
  await db.query.schools.findFirst({ where: eq(schools.id, schoolId) });

const logAudit = async (opts: {
  schoolId: string | null;
  userId: string | null;
  action: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await db.insert(auditLogs).values({
      schoolId: opts.schoolId,
      userId: opts.userId,
      action: opts.action,
      entityType: opts.schoolId ? "school" : "subscription",
      entityId: opts.entityId ?? opts.schoolId ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch {
    // Never let audit-logging failure break a subscription action
  }
};

const toSchoolResponse = (school: TSelectSchool): NonNullable<SubscriptionResponse["school"]> => {
  const expiry = school.subscriptionExpiresAt ?? null;
  const daysUntilExpiry = expiry ? daysBetween(now(), new Date(expiry)) : null;
  return {
    id: school.id,
    name: school.name,
    plan: school.subscriptionPlan as SubscriptionPlan,
    status: school.subscriptionStatus as SubscriptionStatus,
    expiresAt: expiry ? new Date(expiry).toISOString() : null,
    maxStudents: school.maxStudents,
    smsCredits: school.smsCredits,
    currency: school.currency,
    daysUntilExpiry,
  };
};

// ================================================================
// 1. Get plan catalogue (static — no DB)
// ================================================================
export const getPlanCatalogueService = async (): Promise<SubscriptionResponse> => {
  try {
    const plans = (Object.keys(PLAN_PRICING) as SubscriptionPlan[]).map((plan) => ({
      plan,
      ...PLAN_PRICING[plan],
    }));
    return {
      success: true,
      message: `${plans.length} plan(s) available.`,
      plans,
      count: plans.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load plan catalogue." };
  }
};

// ================================================================
// 2. Get plan details
// ================================================================
export const getPlanDetailsService = async (
  plan: SubscriptionPlan
): Promise<SubscriptionResponse> => {
  try {
    const config = PLAN_PRICING[plan];
    if (!config) return { success: false, message: `Unknown plan: ${plan}` };
    return {
      success: true,
      message: `Plan "${config.label}" retrieved.`,
      plans: [{ plan, ...config }],
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load plan." };
  }
};

// ================================================================
// 3. Get a school's current subscription
// ================================================================
export const getSchoolSubscriptionService = async (
  schoolId: string
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };
    return {
      success: true,
      message: `${school.name} — ${school.subscriptionPlan} (${school.subscriptionStatus}).`,
      school: toSchoolResponse(school),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load subscription." };
  }
};

// ================================================================
// 4. Current subscription + payment history
// ================================================================
export const getSchoolSubscriptionWithPaymentsService = async (
  schoolId: string
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const payments = await db.query.subscriptionPayments.findMany({
      where: eq(subscriptionPayments.schoolId, schoolId),
      orderBy: [desc(subscriptionPayments.paidAt)],
    });

    return {
      success: true,
      message: `${school.name} — ${payments.length} payment(s).`,
      school: toSchoolResponse(school),
      payments,
      count: payments.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load subscription." };
  }
};

// ================================================================
// 5. Subscribe (first time — Trial or paid)
// ================================================================
export const subscribeSchoolService = async (
  schoolId: string,
  plan: SubscriptionPlan,
  options: { paymentMethod?: PaymentMethod; referenceCode?: string; amount?: number } = {},
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const config = PLAN_PRICING[plan];
    if (!config) return { success: false, message: `Unknown plan: ${plan}` };

    const isTrial = plan === "Trial";
    const price = options.amount ?? config.amountKes ?? 0;

    if (!isTrial && price <= 0) {
      return {
        success: false,
        message: "This plan requires a payment. Provide `amount` explicitly.",
      };
    }
    if (!isTrial && !options.paymentMethod) {
      return { success: false, message: "Payment method is required for paid plans." };
    }

    // Extend from current expiry if still active; else start from now
    const base =
      school.subscriptionStatus === "Active" &&
      school.subscriptionExpiresAt &&
      new Date(school.subscriptionExpiresAt) > now()
        ? new Date(school.subscriptionExpiresAt)
        : now();
    const newExpiry = addDays(base, config.periodDays);
    const periodStart = isoDate(base);
    const periodEnd = isoDate(newExpiry);

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schools)
        .set({
          subscriptionPlan: plan,
          subscriptionStatus: "Active",
          subscriptionExpiresAt: newExpiry,
          maxStudents: config.maxStudents,
          smsCredits: sql`${schools.smsCredits} + ${config.smsCreditsIncluded}`,
          updatedAt: now(),
        })
        .where(eq(schools.id, schoolId))
        .returning();

      let payment: TSelectSubscriptionPayment | undefined;
      if (!isTrial) {
        const [p] = await tx
          .insert(subscriptionPayments)
          .values({
            schoolId,
            plan,
            amount: price.toFixed(2),
            currency: school.currency,
            paymentMethod: options.paymentMethod!,
            referenceCode: options.referenceCode?.trim() || genRefCode(),
            periodStart,
            periodEnd,
          })
          .returning();
        payment = p;
      }

      return { updated, payment };
    });

    await logAudit({
      schoolId,
      userId: actorId,
      action: isTrial ? "subscription.trial_started" : "subscription.subscribed",
      metadata: { plan, price, expiresAt: newExpiry.toISOString() },
    });

    return {
      success: true,
      message: isTrial
        ? `Trial started until ${periodEnd}.`
        : `Subscribed to ${plan} until ${periodEnd}.`,
      school: toSchoolResponse(result.updated),
      payment: result.payment,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return { success: false, message: "Reference code already used — please use a different one." };
    }
    return { success: false, message: e?.message || "Failed to subscribe." };
  }
};

// ================================================================
// 6. Renew (payment + extend + reset status)
// ================================================================
export const renewSubscriptionService = async (
  schoolId: string,
  options: {
    plan?: SubscriptionPlan;
    paymentMethod?: PaymentMethod;
    referenceCode?: string;
    amount?: number;
  } = {},
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const plan = options.plan ?? (school.subscriptionPlan as SubscriptionPlan);
    const config = PLAN_PRICING[plan];
    if (!config) return { success: false, message: `Unknown plan: ${plan}` };

    const price = options.amount ?? config.amountKes ?? 0;
    const isTrial = plan === "Trial";

    if (!isTrial && price <= 0) {
      return { success: false, message: "Provide an amount for the payment." };
    }
    if (!isTrial && !options.paymentMethod) {
      return { success: false, message: "Payment method is required." };
    }

    const base =
      school.subscriptionExpiresAt && new Date(school.subscriptionExpiresAt) > now()
        ? new Date(school.subscriptionExpiresAt)
        : now();
    const newExpiry = addDays(base, config.periodDays);
    const periodStart = isoDate(base);
    const periodEnd = isoDate(newExpiry);

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schools)
        .set({
          subscriptionPlan: plan,
          subscriptionStatus: "Active",
          subscriptionExpiresAt: newExpiry,
          maxStudents: config.maxStudents,
          smsCredits: sql`${schools.smsCredits} + ${config.smsCreditsIncluded}`,
          updatedAt: now(),
        })
        .where(eq(schools.id, schoolId))
        .returning();

      let payment: TSelectSubscriptionPayment | undefined;
      if (!isTrial) {
        const [p] = await tx
          .insert(subscriptionPayments)
          .values({
            schoolId,
            plan,
            amount: price.toFixed(2),
            currency: school.currency,
            paymentMethod: options.paymentMethod!,
            referenceCode: options.referenceCode?.trim() || genRefCode(),
            periodStart,
            periodEnd,
          })
          .returning();
        payment = p;
      }

      return { updated, payment };
    });

    await logAudit({
      schoolId,
      userId: actorId,
      action: "subscription.renewed",
      metadata: { plan, price, expiresAt: newExpiry.toISOString() },
    });

    return {
      success: true,
      message: `Renewed until ${periodEnd}.`,
      school: toSchoolResponse(result.updated),
      payment: result.payment,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return { success: false, message: "Reference code already used — please use a different one." };
    }
    return { success: false, message: e?.message || "Failed to renew." };
  }
};

// ================================================================
// 7. Upgrade (payment + plan change + extend)
// ================================================================
export const upgradeSubscriptionService = async (
  schoolId: string,
  newPlan: SubscriptionPlan,
  options: { paymentMethod?: PaymentMethod; referenceCode?: string; amount?: number } = {},
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const oldPlan = school.subscriptionPlan as SubscriptionPlan;
    const oldIndex = Object.keys(PLAN_PRICING).indexOf(oldPlan);
    const newIndex = Object.keys(PLAN_PRICING).indexOf(newPlan);

    if (newIndex <= oldIndex) {
      return {
        success: false,
        message: `"${newPlan}" is not an upgrade from "${oldPlan}". Use downgrade instead.`,
      };
    }

    const config = PLAN_PRICING[newPlan];
    const price = options.amount ?? config.amountKes ?? 0;
    if (price <= 0) {
      return { success: false, message: "Provide the amount charged for this upgrade." };
    }
    if (!options.paymentMethod) {
      return { success: false, message: "Payment method is required." };
    }

    const base = now();
    const newExpiry = addDays(base, config.periodDays);
    const periodStart = isoDate(base);
    const periodEnd = isoDate(newExpiry);

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schools)
        .set({
          subscriptionPlan: newPlan,
          subscriptionStatus: "Active",
          subscriptionExpiresAt: newExpiry,
          maxStudents: config.maxStudents,
          smsCredits: sql`${schools.smsCredits} + ${config.smsCreditsIncluded}`,
          updatedAt: now(),
        })
        .where(eq(schools.id, schoolId))
        .returning();

      const [payment] = await tx
        .insert(subscriptionPayments)
        .values({
          schoolId,
          plan: newPlan,
          amount: price.toFixed(2),
          currency: school.currency,
          paymentMethod: options.paymentMethod!,
          referenceCode: options.referenceCode?.trim() || genRefCode(),
          periodStart,
          periodEnd,
        })
        .returning();

      return { updated, payment };
    });

    await logAudit({
      schoolId,
      userId: actorId,
      action: "subscription.upgraded",
      metadata: { from: oldPlan, to: newPlan, price },
    });

    return {
      success: true,
      message: `Upgraded from ${oldPlan} to ${newPlan} until ${periodEnd}.`,
      school: toSchoolResponse(result.updated),
      payment: result.payment,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return { success: false, message: "Reference code already used." };
    }
    return { success: false, message: e?.message || "Failed to upgrade." };
  }
};

// ================================================================
// 8. Downgrade (immediate, no charge — next renewal charges new rate)
// ================================================================
export const downgradeSubscriptionService = async (
  schoolId: string,
  newPlan: SubscriptionPlan,
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const oldPlan = school.subscriptionPlan as SubscriptionPlan;
    const oldIndex = Object.keys(PLAN_PRICING).indexOf(oldPlan);
    const newIndex = Object.keys(PLAN_PRICING).indexOf(newPlan);

    if (newIndex >= oldIndex) {
      return {
        success: false,
        message: `"${newPlan}" is not a downgrade from "${oldPlan}". Use upgrade instead.`,
      };
    }

    const config = PLAN_PRICING[newPlan];
    const issues: string[] = [];

    // Warn if the school currently exceeds the new plan's student cap
    if (config.maxStudents !== null) {
      const [row] = await db
        .select({ c: count() })
        .from(sql`students`)
        .where(
          sql`school_id = ${schoolId} AND is_enrolled = true AND deleted_at IS NULL`
        );
      const enrolled = Number(row?.c ?? 0);
      if (enrolled > config.maxStudents) {
        issues.push(
          `School has ${enrolled} enrolled students, exceeding the ${config.maxStudents}-student limit of ${newPlan}.`
        );
      }
    }

    const [updated] = await db
      .update(schools)
      .set({
        subscriptionPlan: newPlan,
        maxStudents: config.maxStudents,
        updatedAt: now(),
      })
      .where(eq(schools.id, schoolId))
      .returning();

    await logAudit({
      schoolId,
      userId: actorId,
      action: "subscription.downgraded",
      metadata: { from: oldPlan, to: newPlan },
    });

    return {
      success: true,
      message: `Downgraded from ${oldPlan} to ${newPlan}. Next renewal will be billed at ${newPlan} rates.${
        issues.length ? " Note: " + issues.join(" ") : ""
      }`,
      school: toSchoolResponse(updated),
      issues: issues.length ? issues : undefined,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to downgrade." };
  }
};

// ================================================================
// 9. Cancel
// ================================================================
export const cancelSubscriptionService = async (
  schoolId: string,
  reason: string | undefined,
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };
    if (school.subscriptionStatus === "Cancelled") {
      return { success: true, message: "Subscription is already cancelled.", school: toSchoolResponse(school) };
    }

    const [updated] = await db
      .update(schools)
      .set({ subscriptionStatus: "Cancelled", updatedAt: now() })
      .where(eq(schools.id, schoolId))
      .returning();

    await logAudit({
      schoolId,
      userId: actorId,
      action: "subscription.cancelled",
      metadata: { reason: reason ?? null },
    });

    return {
      success: true,
      message: `Subscription cancelled. Service continues until ${school.subscriptionExpiresAt ? isoDate(new Date(school.subscriptionExpiresAt)) : "the end of the current period"}.`,
      school: toSchoolResponse(updated),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to cancel." };
  }
};

// ================================================================
// 10. Suspend (manual)
// ================================================================
export const suspendSchoolService = async (
  schoolId: string,
  reason: string | undefined,
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };
    if (school.subscriptionStatus === "Suspended") {
      return { success: true, message: "School is already suspended.", school: toSchoolResponse(school) };
    }

    const [updated] = await db
      .update(schools)
      .set({ subscriptionStatus: "Suspended", updatedAt: now() })
      .where(eq(schools.id, schoolId))
      .returning();

    await logAudit({
      schoolId,
      userId: actorId,
      action: "subscription.suspended",
      metadata: { reason: reason ?? null },
    });

    return {
      success: true,
      message: `${school.name} suspended.`,
      school: toSchoolResponse(updated),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to suspend." };
  }
};

// ================================================================
// 11. Reactivate (manual — does NOT change expiry)
// ================================================================
export const reactivateSchoolService = async (
  schoolId: string,
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };
    if (school.subscriptionStatus === "Active") {
      return { success: true, message: "School is already active.", school: toSchoolResponse(school) };
    }

    const [updated] = await db
      .update(schools)
      .set({ subscriptionStatus: "Active", updatedAt: now() })
      .where(eq(schools.id, schoolId))
      .returning();

    await logAudit({
      schoolId,
      userId: actorId,
      action: "subscription.reactivated",
    });

    return {
      success: true,
      message: `${school.name} reactivated.`,
      school: toSchoolResponse(updated),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to reactivate." };
  }
};

// ================================================================
// 12. Expire (manual)
// ================================================================
export const expireSchoolService = async (
  schoolId: string,
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };
    if (school.subscriptionStatus === "Expired") {
      return { success: true, message: "School is already expired.", school: toSchoolResponse(school) };
    }

    const [updated] = await db
      .update(schools)
      .set({ subscriptionStatus: "Expired", updatedAt: now() })
      .where(eq(schools.id, schoolId))
      .returning();

    await logAudit({
      schoolId,
      userId: actorId,
      action: "subscription.expired",
    });

    return {
      success: true,
      message: `${school.name} expired.`,
      school: toSchoolResponse(updated),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to expire." };
  }
};

// ================================================================
// 13. Process expired subscriptions (cron)
// ================================================================
export const processExpiredSubscriptionsService = async (
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const currentTime = now();

    const candidates = await db.query.schools.findMany({
      where: and(
        inArray(schools.subscriptionStatus, ["Active", "PastDue", "Suspended"]),
        isNull(schools.deletedAt),
        lt(schools.subscriptionExpiresAt, currentTime)
      ),
    });

    const movedToPastDue: string[] = [];
    const movedToSuspended: string[] = [];
    const movedToExpired: string[] = [];

    for (const school of candidates) {
      if (!school.subscriptionExpiresAt) continue;
      const expiry = new Date(school.subscriptionExpiresAt);
      const daysPast = daysBetween(expiry, currentTime);

      let newStatus: SubscriptionStatus | null = null;
      if (daysPast > GRACE_EXPIRED_DAYS) newStatus = "Expired";
      else if (daysPast > GRACE_SUSPENDED_DAYS) newStatus = "Suspended";
      else if (daysPast > GRACE_PAST_DUE_DAYS) newStatus = "PastDue";

      if (!newStatus || newStatus === school.subscriptionStatus) continue;

      await db
        .update(schools)
        .set({ subscriptionStatus: newStatus, updatedAt: currentTime })
        .where(eq(schools.id, school.id));

      if (newStatus === "PastDue") movedToPastDue.push(school.id);
      else if (newStatus === "Suspended") movedToSuspended.push(school.id);
      else movedToExpired.push(school.id);

      await logAudit({
        schoolId: school.id,
        userId: actorId,
        action: `subscription.auto_${newStatus.toLowerCase()}`,
        metadata: { daysPast, expiry: expiry.toISOString() },
      });
    }

    return {
      success: true,
      message: `Processed ${candidates.length} school(s). ${movedToPastDue.length} → PastDue, ${movedToSuspended.length} → Suspended, ${movedToExpired.length} → Expired.`,
      stats: {
        scanned: candidates.length,
        movedToPastDue: movedToPastDue.length,
        movedToSuspended: movedToSuspended.length,
        movedToExpired: movedToExpired.length,
        schoolIds: { pastDue: movedToPastDue, suspended: movedToSuspended, expired: movedToExpired },
      },
      count: candidates.length,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to process expirations." };
  }
};

// ================================================================
// 14. Record a subscription payment (bookkeeping only)
// ================================================================
export const recordSubscriptionPaymentService = async (
  schoolId: string,
  data: {
    plan: SubscriptionPlan;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceCode?: string;
    periodStart: string;
    periodEnd: string;
  },
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const [payment] = await db
      .insert(subscriptionPayments)
      .values({
        schoolId,
        plan: data.plan,
        amount: data.amount.toFixed(2),
        currency: school.currency,
        paymentMethod: data.paymentMethod,
        referenceCode: data.referenceCode?.trim() || genRefCode(),
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      })
      .returning();

    await logAudit({
      schoolId,
      userId: actorId,
      action: "subscription.payment_recorded",
      entityId: payment.id,
      metadata: { plan: data.plan, amount: data.amount, periodStart: data.periodStart, periodEnd: data.periodEnd },
    });

    return {
      success: true,
      message: `Payment of ${data.amount} ${school.currency} recorded.`,
      payment,
    };
  } catch (e: any) {
    if (String(e?.code) === "23505") {
      return { success: false, message: "Reference code already used — please use a different one." };
    }
    return { success: false, message: e?.message || "Failed to record payment." };
  }
};

// ================================================================
// 15. List payments for a school
// ================================================================
export const listSubscriptionPaymentsService = async (
  schoolId: string,
  opts: { from?: string; to?: string; page: number; limit: number }
): Promise<SubscriptionResponse> => {
  try {
    const filters: any[] = [eq(subscriptionPayments.schoolId, schoolId)];
    if (opts.from) filters.push(gte(subscriptionPayments.periodStart, opts.from));
    if (opts.to) filters.push(lte(subscriptionPayments.periodEnd, opts.to));

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.subscriptionPayments.findMany({
        where: and(...filters),
        orderBy: [desc(subscriptionPayments.paidAt)],
        limit: opts.limit,
        offset,
      }),
      db
        .select({
          c: count(),
          total: sql<string>`COALESCE(SUM(${subscriptionPayments.amount}), 0)`,
        })
        .from(subscriptionPayments)
        .where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} payment(s) on this page.`,
      payments: rows,
      count: Number(totals?.c ?? 0),
      stats: { total: totals?.total ?? "0.00", page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list payments." };
  }
};

// ================================================================
// 16. Get payment by ID
// ================================================================
export const getSubscriptionPaymentByIdService = async (
  paymentId: string
): Promise<SubscriptionResponse> => {
  try {
    const row = await db.query.subscriptionPayments.findFirst({
      where: eq(subscriptionPayments.id, paymentId),
      with: { school: { columns: { id: true, name: true, currency: true } } },
    });
    if (!row) return { success: false, message: "Payment not found." };
    return { success: true, message: "Payment retrieved.", payment: row as any };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load payment." };
  }
};

// ================================================================
// 17. Purchase SMS credits
// ================================================================
export const purchaseSmsCreditsService = async (
  schoolId: string,
  credits: number,
  opts: { amount?: number; paymentMethod?: PaymentMethod; referenceCode?: string } = {},
  actorId: string | null = null
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };

    const [updated] = await db
      .update(schools)
      .set({
        smsCredits: sql`${schools.smsCredits} + ${credits}`,
        updatedAt: now(),
      })
      .where(eq(schools.id, schoolId))
      .returning();

    await logAudit({
      schoolId,
      userId: actorId,
      action: "subscription.sms_credits.purchased",
      metadata: {
        credits,
        amount: opts.amount ?? null,
        paymentMethod: opts.paymentMethod ?? null,
        referenceCode: opts.referenceCode ?? null,
      },
    });

    return {
      success: true,
      message: `Purchased ${credits} SMS credit(s). New balance: ${updated.smsCredits}.`,
      school: toSchoolResponse(updated),
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to purchase SMS credits." };
  }
};

// ================================================================
// 18. Get SMS credit balance
// ================================================================
export const getSmsCreditBalanceService = async (
  schoolId: string
): Promise<SubscriptionResponse> => {
  try {
    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };
    return {
      success: true,
      message: `${school.smsCredits} SMS credit(s) remaining.`,
      school: toSchoolResponse(school),
      count: school.smsCredits,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to fetch SMS balance." };
  }
};

// ================================================================
// 19. Deduct SMS credits (internal — used by notifications)
// ================================================================
export const deductSmsCreditsService = async (
  schoolId: string,
  credits: number
): Promise<{ success: boolean; message: string; remaining?: number }> => {
  try {
    if (credits <= 0) return { success: false, message: "Credits must be positive." };

    const school = await assertSchoolExists(schoolId);
    if (!school) return { success: false, message: "School not found." };
    if (school.smsCredits < credits) {
      return {
        success: false,
        message: `Insufficient SMS credits. Have ${school.smsCredits}, need ${credits}.`,
        remaining: school.smsCredits,
      };
    }

    const [updated] = await db
      .update(schools)
      .set({
        smsCredits: sql`${schools.smsCredits} - ${credits}`,
        updatedAt: now(),
      })
      .where(
        and(
          eq(schools.id, schoolId),
          gte(schools.smsCredits, credits) // atomic guard against concurrent overdraw
        )
      )
      .returning();

    if (!updated) {
      return { success: false, message: "Insufficient SMS credits (concurrent deduction)." };
    }

    return { success: true, message: `Deducted ${credits} credit(s).`, remaining: updated.smsCredits };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to deduct SMS credits." };
  }
};

// ================================================================
// 20. List all subscriptions (super admin)
// ================================================================
export const listAllSubscriptionsService = async (opts: {
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  page: number;
  limit: number;
}): Promise<SubscriptionResponse> => {
  try {
    const filters: any[] = [isNull(schools.deletedAt)];
    if (opts.plan) filters.push(eq(schools.subscriptionPlan, opts.plan));
    if (opts.status) filters.push(eq(schools.subscriptionStatus, opts.status));

    const offset = (opts.page - 1) * opts.limit;

    const [rows, [totals]] = await Promise.all([
      db.query.schools.findMany({
        where: and(...filters),
        orderBy: [asc(schools.subscriptionExpiresAt), asc(schools.name)],
        limit: opts.limit,
        offset,
      }),
      db.select({ c: count() }).from(schools).where(and(...filters)),
    ]);

    return {
      success: true,
      message: `${rows.length} school(s) on this page.`,
      schools: rows.map((s) => ({
        id: s.id,
        name: s.name,
        shortName: s.shortName,
        plan: s.subscriptionPlan,
        status: s.subscriptionStatus,
        expiresAt: s.subscriptionExpiresAt,
        maxStudents: s.maxStudents,
        smsCredits: s.smsCredits,
        daysUntilExpiry: s.subscriptionExpiresAt
          ? daysBetween(now(), new Date(s.subscriptionExpiresAt))
          : null,
      })),
      count: Number(totals?.c ?? 0),
      stats: { page: opts.page, limit: opts.limit },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to list subscriptions." };
  }
};

// ================================================================
// 21. Platform revenue summary
// ================================================================
export const getPlatformRevenueSummaryService = async (opts: {
  from?: string;
  to?: string;
}): Promise<SubscriptionResponse> => {
  try {
    const filters: any[] = [];
    if (opts.from) filters.push(gte(subscriptionPayments.periodStart, opts.from));
    if (opts.to) filters.push(lte(subscriptionPayments.periodEnd, opts.to));
    const where = filters.length ? and(...filters) : undefined;

    const [summaryRow] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${subscriptionPayments.amount}), 0)`,
        count: count(),
      })
      .from(subscriptionPayments)
      .where(where);

    const byPlan = await db
      .select({
        plan: subscriptionPayments.plan,
        total: sql<string>`COALESCE(SUM(${subscriptionPayments.amount}), 0)`,
        count: count(),
      })
      .from(subscriptionPayments)
      .where(where)
      .groupBy(subscriptionPayments.plan);

    const byMethod = await db
      .select({
        method: subscriptionPayments.paymentMethod,
        total: sql<string>`COALESCE(SUM(${subscriptionPayments.amount}), 0)`,
        count: count(),
      })
      .from(subscriptionPayments)
      .where(where)
      .groupBy(subscriptionPayments.paymentMethod);

    const monthlyTrend = await db
      .select({
        month: sql<string>`TO_CHAR(${subscriptionPayments.paidAt}, 'YYYY-MM')`,
        total: sql<string>`COALESCE(SUM(${subscriptionPayments.amount}), 0)`,
      })
      .from(subscriptionPayments)
      .where(where)
      .groupBy(sql`TO_CHAR(${subscriptionPayments.paidAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${subscriptionPayments.paidAt}, 'YYYY-MM')`);

    const byStatus = await db
      .select({
        status: schools.subscriptionStatus,
        c: count(),
      })
      .from(schools)
      .where(isNull(schools.deletedAt))
      .groupBy(schools.subscriptionStatus);

    return {
      success: true,
      message: `Total revenue: ${summaryRow?.total ?? "0.00"} KES across ${summaryRow?.count ?? 0} payment(s).`,
      stats: {
        totalRevenue: summaryRow?.total ?? "0.00",
        totalPayments: Number(summaryRow?.count ?? 0),
        byPlan: byPlan.reduce<Record<string, any>>((acc, r) => {
          acc[r.plan] = { total: r.total, count: Number(r.count) };
          return acc;
        }, {}),
        byMethod: byMethod.reduce<Record<string, any>>((acc, r) => {
          acc[r.method] = { total: r.total, count: Number(r.count) };
          return acc;
        }, {}),
        monthlyTrend: monthlyTrend.map((r) => ({ month: r.month, amount: r.total })),
        byStatus: byStatus.reduce<Record<string, number>>((acc, r) => {
          acc[r.status] = Number(r.c);
          return acc;
        }, {}),
        from: opts.from ?? null,
        to: opts.to ?? null,
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to compute revenue summary." };
  }
};

// ================================================================
// 22. Schools expiring soon (uses school_expiring_idx)
// ================================================================
export const getExpiringSoonService = async (
  withinDays: number
): Promise<SubscriptionResponse> => {
  try {
    const currentTime = now();
    const cutoff = addDays(currentTime, withinDays);

    const rows = await db.query.schools.findMany({
      where: and(
        isNull(schools.deletedAt),
        inArray(schools.subscriptionStatus, ["Active", "PastDue"]),
        gte(schools.subscriptionExpiresAt, currentTime),
        lte(schools.subscriptionExpiresAt, cutoff)
      ),
      orderBy: [asc(schools.subscriptionExpiresAt)],
    });

    return {
      success: true,
      message: `${rows.length} school(s) expiring within ${withinDays} day(s).`,
      schools: rows.map((s) => ({
        id: s.id,
        name: s.name,
        plan: s.subscriptionPlan,
        status: s.subscriptionStatus,
        expiresAt: s.subscriptionExpiresAt,
        daysUntilExpiry: s.subscriptionExpiresAt
          ? daysBetween(currentTime, new Date(s.subscriptionExpiresAt))
          : null,
        email: s.email,
      })),
      count: rows.length,
      stats: { withinDays },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load expiring schools." };
  }
};

// ================================================================
// 23. Past-due / suspended / expired schools
// ================================================================
export const getPastDueSchoolsService = async (): Promise<SubscriptionResponse> => {
  try {
    const rows = await db.query.schools.findMany({
      where: and(
        isNull(schools.deletedAt),
        inArray(schools.subscriptionStatus, ["PastDue", "Suspended", "Expired"])
      ),
      orderBy: [asc(schools.subscriptionExpiresAt)],
    });

    const grouped = rows.reduce<Record<string, typeof rows>>((acc, s) => {
      const key = s.subscriptionStatus;
      (acc[key] ??= []).push(s);
      return acc;
    }, {});

    return {
      success: true,
      message: `${rows.length} school(s) past due, suspended, or expired.`,
      schools: rows.map((s) => ({
        id: s.id,
        name: s.name,
        plan: s.subscriptionPlan,
        status: s.subscriptionStatus,
        expiresAt: s.subscriptionExpiresAt,
        daysPastExpiry: s.subscriptionExpiresAt
          ? daysBetween(new Date(s.subscriptionExpiresAt), now())
          : null,
      })),
      count: rows.length,
      stats: {
        byStatus: {
          PastDue: grouped.PastDue?.length ?? 0,
          Suspended: grouped.Suspended?.length ?? 0,
          Expired: grouped.Expired?.length ?? 0,
        },
      },
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Failed to load past-due schools." };
  }
};