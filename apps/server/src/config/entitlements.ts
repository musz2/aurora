import type { Request, Response, NextFunction } from "express";
import type { FeatureKey, PlanId } from "@aurora/shared";
import { hasFeature, requiredPlanFor } from "@aurora/shared";
import { paymentRequired, asyncHandler } from "../utils/http.js";

function parseEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Authorized OWNER/ADMIN allowlist. This is NOT a security/auth/OAuth bypass:
 * the user must still log in normally and present a valid token. It only marks
 * specific operator accounts (e.g. the project owner) so they can reach admin /
 * demo surfaces during local development and staging.
 *
 * Configured server-side (never exposed to the frontend bundle) via:
 *   - OWNER_ADMIN_EMAIL        (single or comma-separated; the documented var)
 *   - DEVELOPER_BYPASS_EMAILS  (legacy alias, still honored)
 * Re-read on every call so env overrides (e.g. tests) take effect without restart.
 */
function getOwnerAdminEmails(): Set<string> {
  const merged = new Set<string>([
    ...parseEmails(process.env.OWNER_ADMIN_EMAIL),
    ...parseEmails(process.env.DEVELOPER_BYPASS_EMAILS),
  ]);
  return merged;
}

/** Whether `email` is on the authorized owner/admin allowlist (exact, lowercase). */
export function isOwnerAdmin(email: string): boolean {
  return getOwnerAdminEmails().has(email.toLowerCase());
}

/** Backward-compatible alias for the previous name. */
export function isDeveloperBypassUser(email: string): boolean {
  return isOwnerAdmin(email);
}

/**
 * Whether the owner/admin BILLING override is active for this email. Requires
 * BOTH, deliberately opted into:
 *   1. The email is on the owner/admin allowlist, AND
 *   2. ENABLE_OWNER_BILLING_OVERRIDE === "true" — the single documented gate.
 *
 * The override is therefore OFF by default: configuring the allowlist alone
 * (via either OWNER_ADMIN_EMAIL or the legacy DEVELOPER_BYPASS_EMAILS) grants
 * admin surfaces but NOT free paid features. In production, leave
 * ENABLE_OWNER_BILLING_OVERRIDE unset so billing relies on real subscription
 * status. This never bypasses authentication — only the plan/feature gate for
 * an authorized operator account.
 */
export function ownerBillingOverrideActive(email: string): boolean {
  if (!isOwnerAdmin(email)) return false;
  return process.env.ENABLE_OWNER_BILLING_OVERRIDE === "true";
}

/**
 * Express middleware factory. Requires `requireAuth` to have run first (sets
 * `req.auth` with `email` and `plan`). Checks:
 *   1. Developer bypass → allow (logs `[auth] developer bypass granted for <email>`)
 *   2. Workspace plan meets feature minimum → allow (logs `[billing] subscription active for user=<email>`)
 *   3. Otherwise → HTTP 402 (logs `[billing] subscription required for user=<email>`)
 */
export function requireFeature(featureKey: FeatureKey) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const { email, plan } = req.auth ?? {};

    if (!email || !plan) {
      console.warn("[entitlements] requireFeature called without auth — rejecting");
      return next(paymentRequired("Authentication required for this feature."));
    }

    // Developer bypass: full access regardless of plan.
    if (ownerBillingOverrideActive(email)) {
      console.info(`[auth] owner/admin billing override granted for ${email}`);
      return next();
    }

    // Plan-based feature check.
    if (hasFeature(plan as PlanId, featureKey)) {
      console.info(`[billing] subscription active for user=<${email}>`);
      return next();
    }

    const required = requiredPlanFor(featureKey);
    console.info(`[billing] subscription required for user=<${email}>`);
    return next(paymentRequired(`Upgrade to ${required} to use this feature.`));
  });
}

/**
 * Express middleware factory. Like `requireFeature`, but checks against a
 * specific minimum plan tier directly.
 */
export function requirePlan(minPlan: PlanId) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const { email, plan } = req.auth ?? {};

    if (!email || !plan) {
      console.warn("[entitlements] requirePlan called without auth — rejecting");
      return next(paymentRequired("Authentication required for this feature."));
    }

    if (ownerBillingOverrideActive(email)) {
      console.info(`[auth] owner/admin billing override granted for ${email}`);
      return next();
    }

    const ORDER: PlanId[] = ["BASIC", "PRO", "BUSINESS", "ENTERPRISE"];
    if (ORDER.indexOf(plan as PlanId) >= ORDER.indexOf(minPlan)) {
      console.info(`[billing] subscription active for user=<${email}>`);
      return next();
    }

    console.info(`[billing] subscription required for user=<${email}>`);
    return next(paymentRequired(`Upgrade to ${minPlan} to access this feature.`));
  });
}
