import type { Request, Response, NextFunction } from "express";
import type { FeatureKey, PlanId } from "@aurora/shared";
import { hasFeature, requiredPlanFor } from "@aurora/shared";
import { paymentRequired, asyncHandler } from "../utils/http.js";

/**
 * Parse the DEVELOPER_BYPASS_EMAILS env var into a Set of lowercase emails.
 * Re-reads on every call so env overrides (e.g. test-time) take effect without
 * a process restart.
 */
function getBypassEmails(): Set<string> {
  return new Set(
    (process.env.DEVELOPER_BYPASS_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Check whether `email` is in the developer-bypass allowlist. The allowlist is
 * configured server-side via DEVELOPER_BYPASS_EMAILS (comma-separated) and is
 * never exposed to the frontend bundle. Email comparison is exact + lowercase.
 */
export function isDeveloperBypassUser(email: string): boolean {
  return getBypassEmails().has(email.toLowerCase());
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
    if (isDeveloperBypassUser(email)) {
      console.info(`[auth] developer bypass granted for ${email}`);
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

    if (isDeveloperBypassUser(email)) {
      console.info(`[auth] developer bypass granted for ${email}`);
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
