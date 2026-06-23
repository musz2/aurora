import { Router } from "express";
import { PLANS, type PlanId } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { getUsageSummary } from "../services/usage.service.js";
import { hasStripe } from "../config/env.js";
import { writeAudit } from "../services/audit.service.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const ws = await prisma.workspace.findUnique({
      where: { id: req.auth!.workspaceId },
      include: { subscription: true },
    });
    const usage = await getUsageSummary(req.auth!.workspaceId);
    res.json({
      plan: ws?.plan ?? "BASIC",
      subscription: ws?.subscription ?? null,
      usage,
      // Placeholder invoice history.
      invoices: [
        { id: "in_demo_3", date: "2026-06-01", amount: 0, status: "paid" },
        { id: "in_demo_2", date: "2026-05-01", amount: 0, status: "paid" },
        { id: "in_demo_1", date: "2026-04-01", amount: 0, status: "paid" },
      ],
      stripeEnabled: hasStripe,
    });
  })
);

router.post(
  "/checkout",
  asyncHandler(async (req, res) => {
    const { plan } = req.body as { plan?: PlanId };
    if (!plan || !PLANS[plan]) throw badRequest("Invalid plan");

    // Stripe placeholder — in production this returns a Checkout Session URL.
    // For the demo we update the workspace plan directly so the UI reflects it.
    await prisma.workspace.update({
      where: { id: req.auth!.workspaceId },
      data: { plan },
    });
    await prisma.billingSubscription.upsert({
      where: { workspaceId: req.auth!.workspaceId },
      create: { workspaceId: req.auth!.workspaceId, plan, status: "ACTIVE" },
      update: { plan, status: "ACTIVE" },
    });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "billing.plan_change", {
      plan,
    });

    res.json({
      ok: true,
      plan,
      checkoutUrl: hasStripe ? "https://checkout.stripe.com/placeholder" : null,
      message: hasStripe
        ? "Redirect to Stripe Checkout (placeholder)."
        : "Demo mode: plan updated without payment.",
    });
  })
);

router.post(
  "/portal",
  asyncHandler(async (_req, res) => {
    res.json({
      url: hasStripe ? "https://billing.stripe.com/placeholder" : null,
      message: hasStripe
        ? "Redirect to Stripe billing portal (placeholder)."
        : "Demo mode: billing portal not configured.",
    });
  })
);

export default router;
