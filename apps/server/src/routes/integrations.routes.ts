import { Router } from "express";
import { INTEGRATION_CATALOG, isSupportedIntegration } from "@aurora/shared";
import { asyncHandler, badRequest, notFound } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../config/entitlements.js";
import {
  disconnectIntegration,
  envConfigured,
  getProviderTokens,
  listWorkspaceIntegrations,
  markIntegrationResult,
  saveOAuthTokens,
  OAUTH_PROVIDER,
} from "../services/integrations.service.js";
import {
  buildOAuthUrl,
  exchangeOAuthCode,
  oauthConfigured,
  verifyOAuthState,
  type OAuthProvider,
} from "../services/oauth.service.js";
import { writeAudit } from "../services/audit.service.js";
import { env } from "../config/env.js";

const router = Router();

/** Which supported integrations each OAuth provider connects. */
const OAUTH_TO_PROVIDERS: Record<OAuthProvider, string[]> = {
  google: ["google-calendar", "google-meet"],
  microsoft: ["outlook-calendar", "teams"],
  zoom: ["zoom"],
};

/** OAuth callback (public — provider redirects here). */
router.get(
  "/oauth/:provider/callback",
  asyncHandler(async (req, res) => {
    const provider = req.params.provider as OAuthProvider;
    if (!OAUTH_TO_PROVIDERS[provider]) throw notFound("Unsupported OAuth provider");
    const code = req.query.code as string | undefined;
    const stateParam = req.query.state as string | undefined;
    if (!code || !stateParam) throw badRequest("Missing OAuth code or state");
    const state = verifyOAuthState(stateParam);
    if (state.provider !== provider) throw badRequest("OAuth state provider mismatch");
    const tokens = await exchangeOAuthCode(provider, code);
    for (const integrationProvider of OAUTH_TO_PROVIDERS[provider]) {
      await saveOAuthTokens({ workspaceId: state.workspaceId, provider: integrationProvider, tokens });
    }
    await writeAudit(state.workspaceId, state.userId, "integration_connected", {
      provider,
      integrations: OAUTH_TO_PROVIDERS[provider],
    });
    const redirect = new URL(state.returnTo || `${env.WEB_URL}/app/integrations`);
    redirect.searchParams.set("integration", provider);
    redirect.searchParams.set("status", "connected");
    res.redirect(redirect.toString());
  })
);

router.use(requireAuth);

router.get(
  "/",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    res.json({ integrations: await listWorkspaceIntegrations(req.auth!.workspaceId) });
  })
);

/** Begin an OAuth connect for a supported provider. */
router.post(
  "/:provider/connect",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    if (!isSupportedIntegration(provider)) throw notFound("Unsupported integration");
    const entry = INTEGRATION_CATALOG.find((i) => i.provider === provider)!;
    const oauthProvider = OAUTH_PROVIDER[provider];

    if (!envConfigured(provider) || !oauthConfigured(oauthProvider)) {
      return res.status(409).json({
        provider,
        state: "NOT_CONFIGURED",
        message: `${entry.name} is not configured. Set its OAuth credentials on the server, then reconnect. Aurora uses OAuth only — never email passwords.`,
      });
    }

    const authUrl = buildOAuthUrl(oauthProvider, {
      provider: oauthProvider,
      workspaceId: req.auth!.workspaceId,
      userId: req.auth!.userId,
      returnTo: `${env.WEB_URL}/app/integrations`,
    });
    res.json({
      provider,
      state: "NEEDS_APPROVAL",
      authUrl,
      message: `Open the authorization URL to connect ${entry.name} via OAuth.`,
    });
  })
);

router.post(
  "/:provider/disconnect",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    if (!isSupportedIntegration(provider)) throw notFound("Unsupported integration");
    await disconnectIntegration(req.auth!.workspaceId, provider);
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "integration_disconnected", { provider });
    res.json({ ok: true, provider, state: "DISCONNECTED" });
  })
);

/** Test / refresh a connection — verifies stored OAuth tokens are usable. */
router.post(
  "/:provider/test",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    if (!isSupportedIntegration(provider)) throw notFound("Unsupported integration");
    const tokens = await getProviderTokens(req.auth!.workspaceId, provider).catch(() => null);
    if (!tokens) {
      return res.status(409).json({ provider, ok: false, state: "NEEDS_APPROVAL", message: "Not connected. Connect via OAuth first." });
    }
    await markIntegrationResult({
      workspaceId: req.auth!.workspaceId,
      provider,
      ok: true,
      result: "Connection verified (OAuth token present/refreshed).",
    });
    res.json({ provider, ok: true, state: "CONNECTED", message: "Connection is active." });
  })
);

export default router;
