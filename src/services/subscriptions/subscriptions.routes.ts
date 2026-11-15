// src/routes/subscriptions.routes.ts
import { Router } from "express";
import {
  getPlanCatalogueController,
  getPlanDetailsController,
  getSchoolSubscriptionController,
  getSchoolSubscriptionWithPaymentsController,
  subscribeSchoolController,
  renewSubscriptionController,
  upgradeSubscriptionController,
  downgradeSubscriptionController,
  cancelSubscriptionController,
  suspendSchoolController,
  reactivateSchoolController,
  expireSchoolController,
  processExpiredSubscriptionsController,
  recordSubscriptionPaymentController,
  listSubscriptionPaymentsController,
  getSubscriptionPaymentByIdController,
  purchaseSmsCreditsController,
  getSmsCreditBalanceController,
  deductSmsCreditsController,
  listAllSubscriptionsController,
  getPlatformRevenueSummaryController,
  getExpiringSoonController,
  getPastDueSchoolsController,
} from "./subscriptions.controller";
import {
  anyAuthenticatedUser,
  schoolManagementAuth,
  superAdminAuth,
} from "../../middleware/bearAuth";

const subscriptionsRouter = Router();

// ================================================================
// PUBLIC — plan catalogue
// ================================================================
subscriptionsRouter.get("/plans", getPlanCatalogueController);
subscriptionsRouter.get("/plans/:plan", getPlanDetailsController);

// ================================================================
// SCHOOL-SIDE — own subscription (school admin)
// The controller enforces school scoping: only super_admin can touch other schools.
// ================================================================
subscriptionsRouter.get(
  "/schools/:schoolId",
  schoolManagementAuth,
  getSchoolSubscriptionController
);
subscriptionsRouter.get(
  "/schools/:schoolId/payments",
  schoolManagementAuth,
  listSubscriptionPaymentsController
);
subscriptionsRouter.get(
  "/schools/:schoolId/sms-credits",
  schoolManagementAuth,
  getSmsCreditBalanceController
);
subscriptionsRouter.post(
  "/schools/:schoolId/sms-credits/purchase",
  schoolManagementAuth,
  purchaseSmsCreditsController
);
subscriptionsRouter.get(
  "/schools/:schoolId/with-payments",
  schoolManagementAuth,
  getSchoolSubscriptionWithPaymentsController
);

// ================================================================
// PLATFORM — subscription lifecycle (super admin only)
// ================================================================
subscriptionsRouter.get(
  "/admin/schools",
  superAdminAuth,
  listAllSubscriptionsController
);
subscriptionsRouter.post(
  "/admin/schools/:schoolId/subscribe",
  superAdminAuth,
  subscribeSchoolController
);
subscriptionsRouter.post(
  "/admin/schools/:schoolId/renew",
  superAdminAuth,
  renewSubscriptionController
);
subscriptionsRouter.post(
  "/admin/schools/:schoolId/upgrade",
  superAdminAuth,
  upgradeSubscriptionController
);
subscriptionsRouter.post(
  "/admin/schools/:schoolId/downgrade",
  superAdminAuth,
  downgradeSubscriptionController
);
subscriptionsRouter.post(
  "/admin/schools/:schoolId/cancel",
  superAdminAuth,
  cancelSubscriptionController
);
subscriptionsRouter.post(
  "/admin/schools/:schoolId/suspend",
  superAdminAuth,
  suspendSchoolController
);
subscriptionsRouter.post(
  "/admin/schools/:schoolId/reactivate",
  superAdminAuth,
  reactivateSchoolController
);
subscriptionsRouter.post(
  "/admin/schools/:schoolId/expire",
  superAdminAuth,
  expireSchoolController
);

// ================================================================
// PLATFORM — payments
// ================================================================
subscriptionsRouter.post(
  "/admin/schools/:schoolId/payments",
  superAdminAuth,
  recordSubscriptionPaymentController
);
subscriptionsRouter.get(
  "/admin/payments/:paymentId",
  superAdminAuth,
  getSubscriptionPaymentByIdController
);

// ================================================================
// PLATFORM — SMS credits on behalf of a school
// ================================================================
subscriptionsRouter.post(
  "/admin/schools/:schoolId/sms-credits/purchase",
  superAdminAuth,
  purchaseSmsCreditsController
);
subscriptionsRouter.post(
  "/admin/schools/:schoolId/sms-credits/deduct",
  superAdminAuth,
  deductSmsCreditsController
);

// ================================================================
// PLATFORM — dashboards
// ================================================================
subscriptionsRouter.get(
  "/admin/dashboard/revenue",
  superAdminAuth,
  getPlatformRevenueSummaryController
);
subscriptionsRouter.get(
  "/admin/dashboard/expiring",
  superAdminAuth,
  getExpiringSoonController
);
subscriptionsRouter.get(
  "/admin/dashboard/past-due",
  superAdminAuth,
  getPastDueSchoolsController
);

// ================================================================
// PLATFORM — cron helpers
// ================================================================
subscriptionsRouter.post(
  "/admin/process-expired",
  superAdminAuth,
  processExpiredSubscriptionsController
);

// ================================================================
// Internal — notifications module calls deductSmsCreditsService
// directly; exposed here for cron and for admin manual deduction.
// ================================================================
subscriptionsRouter.post(
  "/admin/schools/:schoolId/sms-credits/deduct",
  superAdminAuth,
  deductSmsCreditsController
);

export default subscriptionsRouter;