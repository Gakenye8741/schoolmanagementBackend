// src/services/subscriptions/subscriptions.controller.ts
import { Request, Response } from "express";
import {
  getPlanCatalogueService,
  getPlanDetailsService,
  getSchoolSubscriptionService,
  getSchoolSubscriptionWithPaymentsService,
  subscribeSchoolService,
  renewSubscriptionService,
  upgradeSubscriptionService,
  downgradeSubscriptionService,
  cancelSubscriptionService,
  suspendSchoolService,
  reactivateSchoolService,
  expireSchoolService,
  processExpiredSubscriptionsService,
  recordSubscriptionPaymentService,
  listSubscriptionPaymentsService,
  getSubscriptionPaymentByIdService,
  purchaseSmsCreditsService,
  getSmsCreditBalanceService,
  deductSmsCreditsService,
  listAllSubscriptionsService,
  getPlatformRevenueSummaryService,
  getExpiringSoonService,
  getPastDueSchoolsService,
} from "./subscriptions.service";
import {
  subscribeSchoolSchema,
  renewSubscriptionSchema,
  upgradeSubscriptionSchema,
  downgradeSubscriptionSchema,
  cancelSubscriptionSchema,
  suspendSchoolSchema,
  recordSubscriptionPaymentSchema,
  purchaseSmsCreditsSchema,
  deductSmsCreditsSchema,
  schoolIdParamSchema,
  paymentIdParamSchema,
  planParamSchema,
  listSubscriptionsQuerySchema,
  expiringSoonQuerySchema,
  paymentsQuerySchema,
  revenueQuerySchema,
} from "../../validators/subscriptions.validator";

// ================================================================
// Helpers
// ================================================================
const fail = (res: Response, status: number, message: string, issues?: any) =>
  res.status(status).json({ success: false, message, issues });

const ok = (res: Response, result: any, status = 200) =>
  res.status(status).json(result);

const handleZod = (res: Response, err: any) => {
  const first = err?.errors?.[0];
  const field = first?.path?.join(".") ?? "input";
  return fail(res, 400, `${field}: ${first?.message ?? "invalid value"}`, err?.errors);
};

const isZod = (e: any) => e?.name === "ZodError" || Array.isArray(e?.errors);

const actorId = (req: Request): string | null => (req as any).user?.id ?? null;

/** Returns null if allowed, or an error message. */
const assertSchoolAccess = (req: Request, targetSchoolId: string): string | null => {
  const user = (req as any).user;
  if (!user) return "No user in request.";
  if (user.role === "super_admin") return null;
  if (user.schoolId === targetSchoolId) return null;
  return "You can only access your own school's subscription.";
};

// ================================================================
// Catalogue (public — no auth needed for these)
// ================================================================
export const getPlanCatalogueController = async (_req: Request, res: Response) => {
  try {
    const result = await getPlanCatalogueService();
    return ok(res, result, 200);
  } catch (e: any) {
    return fail(res, 500, "Could not load plans.", e?.message);
  }
};

export const getPlanDetailsController = async (req: Request, res: Response) => {
  try {
    const { plan } = planParamSchema.parse(req.params);
    const result = await getPlanDetailsService(plan);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load plan.", e?.message);
  }
};

// ================================================================
// Read — school subscription
// ================================================================
export const getSchoolSubscriptionController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const result = await getSchoolSubscriptionService(schoolId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load subscription.", e?.message);
  }
};

export const getSchoolSubscriptionWithPaymentsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const result = await getSchoolSubscriptionWithPaymentsService(schoolId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load subscription.", e?.message);
  }
};

// ================================================================
// Subscribe / renew / upgrade / downgrade / cancel
// ================================================================
export const subscribeSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const body = subscribeSchoolSchema.parse(req.body);
    const result = await subscribeSchoolService(
      schoolId,
      body.plan,
      { paymentMethod: body.paymentMethod, referenceCode: body.referenceCode, amount: body.amount },
      actorId(req)
    );
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not subscribe.", e?.message);
  }
};

export const renewSubscriptionController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const body = renewSubscriptionSchema.parse(req.body);
    const result = await renewSubscriptionService(
      schoolId,
      { plan: body.plan, paymentMethod: body.paymentMethod, referenceCode: body.referenceCode, amount: body.amount },
      actorId(req)
    );
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not renew.", e?.message);
  }
};

export const upgradeSubscriptionController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const body = upgradeSubscriptionSchema.parse(req.body);
    const result = await upgradeSubscriptionService(
      schoolId,
      body.newPlan,
      { paymentMethod: body.paymentMethod, referenceCode: body.referenceCode, amount: body.amount },
      actorId(req)
    );
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not upgrade.", e?.message);
  }
};

export const downgradeSubscriptionController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const body = downgradeSubscriptionSchema.parse(req.body);
    const result = await downgradeSubscriptionService(schoolId, body.newPlan, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not downgrade.", e?.message);
  }
};

export const cancelSubscriptionController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const body = cancelSubscriptionSchema.parse(req.body ?? {});
    const result = await cancelSubscriptionService(schoolId, body.reason, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not cancel.", e?.message);
  }
};

// ================================================================
// Suspend / reactivate / expire (manual)
// ================================================================
export const suspendSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const body = suspendSchoolSchema.parse(req.body ?? {});
    const result = await suspendSchoolService(schoolId, body.reason, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not suspend.", e?.message);
  }
};

export const reactivateSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await reactivateSchoolService(schoolId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not reactivate.", e?.message);
  }
};

export const expireSchoolController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const result = await expireSchoolService(schoolId, actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not expire.", e?.message);
  }
};

export const processExpiredSubscriptionsController = async (req: Request, res: Response) => {
  try {
    const result = await processExpiredSubscriptionsService(actorId(req));
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    return fail(res, 500, "Could not process expirations.", e?.message);
  }
};

// ================================================================
// Payments
// ================================================================
export const recordSubscriptionPaymentController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const body = recordSubscriptionPaymentSchema.parse(req.body);
    const result = await recordSubscriptionPaymentService(
      schoolId,
      {
        plan: body.plan,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        referenceCode: body.referenceCode,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      },
      actorId(req)
    );
    return ok(res, result, result.success ? 201 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not record payment.", e?.message);
  }
};

export const listSubscriptionPaymentsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const q = paymentsQuerySchema.parse(req.query);
    const result = await listSubscriptionPaymentsService(schoolId, q);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list payments.", e?.message);
  }
};

export const getSubscriptionPaymentByIdController = async (req: Request, res: Response) => {
  try {
    const { paymentId } = paymentIdParamSchema.parse(req.params);
    const result = await getSubscriptionPaymentByIdService(paymentId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load payment.", e?.message);
  }
};

// ================================================================
// SMS credits
// ================================================================
export const purchaseSmsCreditsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const body = purchaseSmsCreditsSchema.parse(req.body);
    const result = await purchaseSmsCreditsService(
      schoolId,
      body.credits,
      { amount: body.amount, paymentMethod: body.paymentMethod, referenceCode: body.referenceCode },
      actorId(req)
    );
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not purchase SMS credits.", e?.message);
  }
};

export const getSmsCreditBalanceController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const err = assertSchoolAccess(req, schoolId);
    if (err) return fail(res, 403, err);
    const result = await getSmsCreditBalanceService(schoolId);
    return ok(res, result, result.success ? 200 : 404);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load SMS balance.", e?.message);
  }
};

export const deductSmsCreditsController = async (req: Request, res: Response) => {
  try {
    const { schoolId } = schoolIdParamSchema.parse(req.params);
    const body = deductSmsCreditsSchema.parse(req.body);
    const result = await deductSmsCreditsService(schoolId, body.credits);
    return ok(res, result, result.success ? 200 : 400);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not deduct SMS credits.", e?.message);
  }
};

// ================================================================
// Platform admin
// ================================================================
export const listAllSubscriptionsController = async (req: Request, res: Response) => {
  try {
    const q = listSubscriptionsQuerySchema.parse(req.query);
    const result = await listAllSubscriptionsService(q);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not list subscriptions.", e?.message);
  }
};

export const getPlatformRevenueSummaryController = async (req: Request, res: Response) => {
  try {
    const q = revenueQuerySchema.parse(req.query);
    const result = await getPlatformRevenueSummaryService(q);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not compute revenue.", e?.message);
  }
};

export const getExpiringSoonController = async (req: Request, res: Response) => {
  try {
    const q = expiringSoonQuerySchema.parse(req.query);
    const result = await getExpiringSoonService(q.withinDays);
    return ok(res, result, 200);
  } catch (e: any) {
    if (isZod(e)) return handleZod(res, e);
    return fail(res, 500, "Could not load expiring schools.", e?.message);
  }
};

export const getPastDueSchoolsController = async (_req: Request, res: Response) => {
  try {
    const result = await getPastDueSchoolsService();
    return ok(res, result, 200);
  } catch (e: any) {
    return fail(res, 500, "Could not load past-due schools.", e?.message);
  }
};