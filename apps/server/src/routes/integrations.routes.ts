import { Router } from "express";
import { INTEGRATION_CATALOG } from "@aurora/shared";
import { asyncHandler, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../config/entitlements.js";
import { prisma } from "../lib/prisma.js";
import {
  disconnectIntegration,
  envConfigured,
  listWorkspaceIntegrations,
  markIntegrationResult,
  runIntegrationAction,
  saveOAuthTokens,
  type IntegrationAction,
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

const PROVIDER_TO_OAUTH: Record<string, OAuthProvider | undefined> = {
  "google-calendar": "google",
  "google-drive": "google",
  "google-meet": "google",
  "outlook-calendar": "microsoft",
  teams: "microsoft",
  slack: "slack",
  hubspot: "hubspot",
  zoom: "zoom",
};

const OAUTH_TO_PROVIDERS: Record<OAuthProvider, string[]> = {
  google: ["google-calendar", "google-drive", "google-meet"],
  microsoft: ["outlook-calendar", "teams"],
  slack: ["slack"],
  hubspot: ["hubspot"],
  zoom: ["zoom"],
};

router.get(
  "/oauth/:provider/callback",
  asyncHandler(async (req, res) => {
    const provider = req.params.provider as OAuthProvider;
    const code = req.query.code as string | undefined;
    const stateParam = req.query.state as string | undefined;
    if (!code || !stateParam) throw badRequest("Missing OAuth code or state");
    const state = verifyOAuthState(stateParam);
    if (state.provider !== provider) throw badRequest("OAuth state provider mismatch");
    if (provider === "zoom") console.info("[zoom] callback received");
    const tokens = await exchangeOAuthCode(provider, code);
    if (provider === "zoom") console.info("[zoom] token exchange success");
    for (const integrationProvider of OAUTH_TO_PROVIDERS[provider]) {
      await saveOAuthTokens({
        workspaceId: state.workspaceId,
        provider: integrationProvider,
        tokens,
      });
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

router.post(
  "/:provider/connect",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    const entry = INTEGRATION_CATALOG.find((i) => i.provider === req.params.provider);
    if (!entry) throw badRequest("Unknown provider");
    const oauthProvider = PROVIDER_TO_OAUTH[entry.provider];
    if (entry.provider === "zoom" && envConfigured("zoom")) {
      console.info("[zoom] config present");
    }
    if (!envConfigured(entry.provider)) {
      return res.json({
        provider: entry.provider,
        state: "MOCK_MODE",
        mode: "mock",
        message: `${entry.name} is in mock mode because credentials are not configured.`,
      });
    }
    if (entry.provider === "hubspot" && env.HUBSPOT_ACCESS_TOKEN) {
      const result = "HubSpot private app token is configured.";
      await markIntegrationResult({
        workspaceId: req.auth!.workspaceId,
        provider: entry.provider,
        ok: true,
        result,
      });
      await writeAudit(req.auth!.workspaceId, req.auth!.userId, "integration_connected", {
        provider: entry.provider,
        method: "private_token",
      });
      return res.json({ provider: entry.provider, state: "CONNECTED", message: result });
    }
    if (entry.provider === "slack" && env.SLACK_BOT_TOKEN && !oauthConfigured("slack")) {
      const result = "Slack bot token is configured.";
      await markIntegrationResult({
        workspaceId: req.auth!.workspaceId,
        provider: entry.provider,
        ok: true,
        result,
      });
      await writeAudit(req.auth!.workspaceId, req.auth!.userId, "integration_connected", {
        provider: entry.provider,
        method: "bot_token",
      });
      return res.json({ provider: entry.provider, state: "CONNECTED", message: result });
    }
    if (!oauthProvider || !oauthConfigured(oauthProvider)) {
      return res.status(409).json({
        provider: entry.provider,
        state: "NEEDS_APPROVAL",
        message: `${entry.name} requires provider approval or a supported OAuth/private-token setup before live use.`,
      });
    }
    if (entry.provider === "zoom") console.info("[zoom] oauth start");
    const authUrl = buildOAuthUrl(oauthProvider, {
      provider: oauthProvider,
      workspaceId: req.auth!.workspaceId,
      userId: req.auth!.userId,
      returnTo: `${env.WEB_URL}/app/integrations`,
    });
    res.json({
      provider: entry.provider,
      state: "NEEDS_APPROVAL",
      authUrl,
      message: `Open the authorization URL to connect ${entry.name}.`,
    });
  })
);

router.post(
  "/:provider/disconnect",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    const entry = INTEGRATION_CATALOG.find((i) => i.provider === req.params.provider);
    if (!entry) throw badRequest("Unknown provider");
    await disconnectIntegration(req.auth!.workspaceId, entry.provider);
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "integration_disconnected", {
      provider: entry.provider,
    });
    res.json({ ok: true, provider: entry.provider, state: "DISCONNECTED" });
  })
);

router.post(
  "/:provider/actions/:action",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    const action = req.params.action as IntegrationAction;
    if (
      !["share-summary", "export", "sync-crm", "create-task", "import-sync"].includes(action)
    ) {
      throw badRequest("Unsupported integration action");
    }
    const meetingId = req.body?.meetingId as string | undefined;
    const meeting = meetingId
      ? await prisma.meeting.findFirst({
          where: { id: meetingId, workspaceId: req.auth!.workspaceId },
          include: {
            summary: true,
            segments: { orderBy: { startTime: "asc" } },
            actionItems: true,
          },
        })
      : null;
    if (meetingId && !meeting) throw badRequest("Meeting not found");
    const result = await runIntegrationAction({
      workspaceId: req.auth!.workspaceId,
      provider,
      action,
      meeting,
      format: req.body?.format,
      channelId: req.body?.channelId,
      transcriptUrl: req.body?.transcriptUrl,
    });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "integration_action_sent", {
      provider,
      action,
      mode: result.mode,
      meetingId,
      url: result.url,
    });
    res.json({ result });
  })
);

export default router;
