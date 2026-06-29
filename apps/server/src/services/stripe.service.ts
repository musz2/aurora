import Stripe from "stripe";
import type { PlanId } from "@aurora/shared";
import { env, hasStripe } from "../config/env.js";

/**
 * Stripe billing service.
 *
 * Real Checkout / Customer Portal / webhooks are used ONLY when STRIPE_SECRET_KEY
 * is configured. Without it, billing runs in clearly-labelled demo mode (handled
 * in billing.routes) and NO real payment is ever taken. The pure helpers here
 * (price↔plan mapping, webhook event resolution) are unit-tested without network.
 */

let client: Stripe | null = null;

export function stripeClient(): Stripe | null {
  if (!hasStripe) return null;
  if (!client) client = new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

/** Paid-plan → configured Stripe Price ID (empty string when not configured). */
export function priceIdForPlan(plan: PlanId): string {
  if (plan === "PRO") return env.STRIPE_PRICE_PRO;
  if (plan === "BUSINESS") return env.STRIPE_PRICE_BUSINESS;
  return ""; // BASIC is free; ENTERPRISE is contact-sales.
}

/** Reverse map: Stripe Price ID → plan (for webhook subscription updates). */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId && priceId === env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId && priceId === env.STRIPE_PRICE_BUSINESS) return "BUSINESS";
  return null;
}

export interface ResolvedBillingChange {
  workspaceId: string;
  plan: PlanId;
  status: "ACTIVE" | "CANCELED";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

/**
 * Pure resolver: turn a Stripe webhook event into the billing change to apply,
 * or null if the event is irrelevant. Kept pure so we can test webhook handling
 * without hitting Stripe.
 */
export function resolveStripeEvent(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): ResolvedBillingChange | null {
  const obj = event.data.object;

  if (event.type === "checkout.session.completed") {
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    const plan = metadata.plan as PlanId | undefined;
    const workspaceId = metadata.workspaceId;
    if (!workspaceId || !plan) return null;
    return {
      workspaceId,
      plan,
      status: "ACTIVE",
      stripeCustomerId: typeof obj.customer === "string" ? obj.customer : undefined,
      stripeSubscriptionId:
        typeof obj.subscription === "string" ? obj.subscription : undefined,
    };
  }

  if (event.type === "customer.subscription.updated") {
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    const workspaceId = metadata.workspaceId;
    const priceId = extractPriceId(obj);
    const plan = planForPriceId(priceId);
    if (!workspaceId || !plan) return null;
    const cancelAtPeriodEnd = obj.cancel_at_period_end === true;
    return {
      workspaceId,
      plan,
      status: cancelAtPeriodEnd ? "CANCELED" : "ACTIVE",
      stripeCustomerId: typeof obj.customer === "string" ? obj.customer : undefined,
      stripeSubscriptionId: typeof obj.id === "string" ? obj.id : undefined,
    };
  }

  if (event.type === "customer.subscription.deleted") {
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    const workspaceId = metadata.workspaceId;
    if (!workspaceId) return null;
    // Subscription ended → downgrade to the free plan.
    return { workspaceId, plan: "BASIC", status: "CANCELED" };
  }

  return null;
}

function extractPriceId(subscription: Record<string, unknown>): string | null {
  const items = subscription.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  return items?.data?.[0]?.price?.id ?? null;
}
