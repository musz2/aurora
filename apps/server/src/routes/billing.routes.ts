import { Router, type Request, type Response } from "express";
import { PLANS, type PlanId } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, badRequest, HttpError } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { getUsageSummary } from "../services/usage.service.js";
import { env, hasStripe } from "../config/env.js";
import { writeAudit } from "../services/audit.service.js";
import {
  priceIdForPlan,
  resolveStripeEvent,
  stripeClient,
  type ResolvedBillingChange,
} from "../services/stripe.service.js";

const router = Router();

/** Apply a resolved billing change (used by the webhook and demo checkout). */
async function applyBillingChange(change: ResolvedBillingChange): Promise<void> {
  const planExists = Boolean(PLANS[change.plan]);
  if (!planExists) return;
  await prisma.workspace.update({
    where: { id: change.workspaceId },
    data: { plan: change.plan },
  });
  await prisma.billingSubscription.upsert({
    where: { workspaceId: change.workspaceId },
    create: {
      workspaceId: change.workspaceId,
      plan: change.plan,
      status: change.status,
      stripeCustomerId: change.stripeCustomerId,
      stripeSubscriptionId: change.stripeSubscriptionId,
    },
    update: {
      plan: change.plan,
      status: change.status,
      ...(change.stripeCustomerId
        ? { stripeCustomerId: change.stripeCustomerId }
        : {}),
      ...(change.stripeSubscriptionId
        ? { stripeSubscriptionId: change.stripeSubscriptionId }
        : {}),
    },
  });
}

/**
 * Stripe webhook. Mounted with a raw body parser in app.ts (BEFORE express.json)
 * so the signature can be verified. Returns 503 honestly if Stripe/webhook secret
 * is not configured rather than pretending to process events.
 */
export const billingWebhookHandler = asyncHandler(async (req: Request, res: Response) => {
  const stripe = stripeClient();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Stripe webhook is not configured." });
  }
  const signature = req.headers["stripe-signature"];
  if (!signature) return res.status(400).json({ error: "Missing Stripe signature." });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res
      .status(400)
      .json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
  }

  const change = resolveStripeEvent(event as unknown as {
    type: string;
    data: { object: Record<string, unknown> };
  });
  if (change) {
    await applyBillingChange(change);
    await writeAudit(change.workspaceId, null, "billing.plan_change", {
      plan: change.plan,
      status: change.status,
      via: "stripe_webhook",
      eventType: event.type,
    });
  }
  res.json({ received: true });
});

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
      // Invoice history is shown from Stripe in live mode (via the portal); these
      // labelled demo rows only appear when Stripe is not configured.
      invoices: hasStripe
        ? []
        : [
            { id: "demo_invoice_3", date: "2026-06-01", amount: 0, status: "demo" },
            { id: "demo_invoice_2", date: "2026-05-01", amount: 0, status: "demo" },
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

    // ---- Live Stripe Checkout (only when configured) -----------------------
    if (hasStripe) {
      const stripe = stripeClient()!;
      if (plan === "BASIC" || plan === "ENTERPRISE") {
        throw badRequest(
          plan === "BASIC"
            ? "Downgrade to Basic from the Stripe billing portal."
            : "Enterprise is custom-priced — contact sales."
        );
      }
      const price = priceIdForPlan(plan);
      if (!price) {
        throw new HttpError(
          503,
          `Stripe is configured but no price ID is set for ${plan}. Set STRIPE_PRICE_${plan} on the server.`
        );
      }
      // Reuse an existing Stripe customer if we have one.
      const sub = await prisma.billingSubscription.findUnique({
        where: { workspaceId: req.auth!.workspaceId },
      });
      let customerId = sub?.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          metadata: { workspaceId: req.auth!.workspaceId },
        });
        customerId = customer.id;
        await prisma.billingSubscription.upsert({
          where: { workspaceId: req.auth!.workspaceId },
          create: {
            workspaceId: req.auth!.workspaceId,
            stripeCustomerId: customerId,
          },
          update: { stripeCustomerId: customerId },
        });
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price, quantity: 1 }],
        success_url: `${env.WEB_URL}/app/billing?status=success`,
        cancel_url: `${env.WEB_URL}/app/billing?status=cancel`,
        // metadata is echoed back on the webhook event so we know what to apply.
        metadata: { workspaceId: req.auth!.workspaceId, plan },
        subscription_data: {
          metadata: { workspaceId: req.auth!.workspaceId, plan },
        },
      });
      // IMPORTANT: do NOT change the plan here. It is applied by the webhook only
      // after Stripe confirms payment — no faked plan change.
      return res.json({
        ok: true,
        mode: "live",
        checkoutUrl: session.url,
        message: "Redirecting to secure Stripe Checkout.",
      });
    }

    // ---- Demo mode (no Stripe): switch plan directly, clearly labelled ------
    await applyBillingChange({ workspaceId: req.auth!.workspaceId, plan, status: "ACTIVE" });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "billing.plan_change", {
      plan,
      via: "demo",
    });
    res.json({
      ok: true,
      mode: "demo",
      plan,
      checkoutUrl: null,
      message: "Demo mode: plan updated without payment (Stripe not configured).",
    });
  })
);

router.post(
  "/portal",
  asyncHandler(async (req, res) => {
    if (hasStripe) {
      const stripe = stripeClient()!;
      const sub = await prisma.billingSubscription.findUnique({
        where: { workspaceId: req.auth!.workspaceId },
      });
      if (!sub?.stripeCustomerId) {
        throw new HttpError(409, "No Stripe customer yet — start a checkout first.");
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${env.WEB_URL}/app/billing`,
      });
      return res.json({ mode: "live", url: session.url, message: "Opening Stripe billing portal." });
    }
    res.json({
      mode: "demo",
      url: null,
      message: "Demo mode: billing portal is unavailable until Stripe is configured.",
    });
  })
);

export default router;
