import { Router } from "express";
import { INTEGRATION_CATALOG } from "@aurora/shared";
import { asyncHandler, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/**
 * Honest integrations. No OAuth flows are wired yet, so we report each
 * provider's real state from the catalog. We never fake a "Connected" status.
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ integrations: INTEGRATION_CATALOG });
  })
);

/**
 * Connect is intentionally a no-op that returns the honest setup state instead
 * of flipping a fake "connected" flag. When real OAuth is added, this becomes
 * the redirect-to-consent endpoint.
 */
router.post(
  "/:provider/connect",
  asyncHandler(async (req, res) => {
    const entry = INTEGRATION_CATALOG.find(
      (i) => i.provider === req.params.provider
    );
    if (!entry) throw badRequest("Unknown provider");
    res.status(409).json({
      provider: entry.provider,
      state: entry.state,
      message:
        entry.state === "COMING_SOON"
          ? `${entry.name} integration is coming soon.`
          : `${entry.name} is not configured. ${entry.setupNote ?? "Requires OAuth setup."}`,
    });
  })
);

router.post(
  "/:provider/disconnect",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true });
  })
);

export default router;
