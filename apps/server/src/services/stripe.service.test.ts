import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planForPriceId,
  priceIdForPlan,
  resolveStripeEvent,
} from "./stripe.service.js";

test("priceIdForPlan returns empty for free/custom plans", () => {
  assert.equal(priceIdForPlan("BASIC"), "");
  assert.equal(priceIdForPlan("ENTERPRISE"), "");
});

test("planForPriceId returns null for unknown/empty price ids", () => {
  assert.equal(planForPriceId(null), null);
  assert.equal(planForPriceId(""), null);
  assert.equal(planForPriceId("price_not_configured"), null);
});

test("resolveStripeEvent applies a completed checkout from metadata", () => {
  const change = resolveStripeEvent({
    type: "checkout.session.completed",
    data: {
      object: {
        metadata: { workspaceId: "ws-1", plan: "PRO" },
        customer: "cus_123",
        subscription: "sub_123",
      },
    },
  });
  assert.deepEqual(change, {
    workspaceId: "ws-1",
    plan: "PRO",
    status: "ACTIVE",
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
  });
});

test("resolveStripeEvent ignores a checkout missing metadata", () => {
  const change = resolveStripeEvent({
    type: "checkout.session.completed",
    data: { object: { metadata: {} } },
  });
  assert.equal(change, null);
});

test("resolveStripeEvent downgrades to BASIC on subscription deletion", () => {
  const change = resolveStripeEvent({
    type: "customer.subscription.deleted",
    data: { object: { metadata: { workspaceId: "ws-9" } } },
  });
  assert.deepEqual(change, { workspaceId: "ws-9", plan: "BASIC", status: "CANCELED" });
});

test("resolveStripeEvent ignores unrelated events", () => {
  assert.equal(
    resolveStripeEvent({ type: "invoice.created", data: { object: {} } }),
    null
  );
});
