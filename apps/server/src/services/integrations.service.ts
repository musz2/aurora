import type { Integration } from "@prisma/client";
import type { IntegrationCatalogEntry } from "@aurora/shared";
import { INTEGRATION_CATALOG } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";
import type { ExportFormat } from "./export.service.js";
import {
  decryptTokens,
  encryptTokens,
  oauthConfigured,
  refreshOAuthToken,
  tokenExpired,
  type OAuthProvider,
  type OAuthTokens,
  type StoredTokenEnvelope,
} from "./oauth.service.js";
import {
  postSlackSummary,
  pushHubSpotMeetingNote,
  uploadGoogleDriveExport,
  type MeetingWithContent,
} from "./provider-api.service.js";

export type ProviderConnectionState =
  | "connected"
  | "disconnected"
  | "mock"
  | "failed"
  | "needs_approval";

export type IntegrationAction =
  | "share-summary"
  | "export"
  | "sync-crm"
  | "create-task"
  | "import-sync";

export interface IntegrationActionResult {
  provider: string;
  action: IntegrationAction;
  mode: "live" | "mock";
  ok: true;
  message: string;
  externalId: string;
  url?: string;
  lastSyncResult?: string;
}

export interface IntegrationMetadata {
  connectionState?: ProviderConnectionState;
  tokenEnvelope?: StoredTokenEnvelope;
  tokenExpiresAt?: string;
  scopes?: string;
  connectedAt?: string;
  disconnectedAt?: string;
  lastSyncResult?: string;
  lastSyncAt?: string;
  lastError?: string;
  slackChannelId?: string;
}

const PROVIDER_ENV: Record<string, string[]> = {
  zoom: ["ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_REDIRECT_URI"],
  "google-calendar": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  "google-drive": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  "google-meet": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  "outlook-calendar": [
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "MICROSOFT_REDIRECT_URI",
    "MICROSOFT_TENANT_ID",
  ],
  teams: [
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "MICROSOFT_REDIRECT_URI",
    "MICROSOFT_TENANT_ID",
  ],
  slack: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_REDIRECT_URI"],
  hubspot: [],
  salesforce: ["SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"],
  notion: ["NOTION_API_KEY", "NOTION_DATABASE_ID"],
  jira: ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
  asana: ["ASANA_ACCESS_TOKEN", "ASANA_PROJECT_ID"],
};

const OAUTH_PROVIDER: Record<string, OAuthProvider | undefined> = {
  "google-calendar": "google",
  "google-drive": "google",
  "google-meet": "google",
  "outlook-calendar": "microsoft",
  teams: "microsoft",
  slack: "slack",
  hubspot: "hubspot",
  zoom: "zoom",
};

export function envConfigured(provider: string) {
  if (provider === "hubspot") {
    return Boolean(env.HUBSPOT_ACCESS_TOKEN) || oauthConfigured("hubspot");
  }
  if (provider === "slack") {
    return Boolean(env.SLACK_BOT_TOKEN) || oauthConfigured("slack");
  }
  const required = PROVIDER_ENV[provider] ?? [];
  return required.length > 0 && required.every((key) => Boolean(process.env[key]));
}

export function providerNeedsApproval(provider: string) {
  return ["google-meet", "teams"].includes(provider);
}

function metadataOf(integration: Pick<Integration, "metadata"> | null | undefined): IntegrationMetadata {
  return ((integration?.metadata ?? {}) as IntegrationMetadata) ?? {};
}

export async function listWorkspaceIntegrations(workspaceId: string) {
  const saved = await prisma.integration.findMany({ where: { workspaceId } });
  const byProvider = new Map(saved.map((i) => [i.provider, i]));
  return INTEGRATION_CATALOG.map((entry) => decorateIntegration(entry, byProvider.get(entry.provider)));
}

function decorateIntegration(entry: IntegrationCatalogEntry, saved?: Integration) {
  const meta = metadataOf(saved);
  const configured = envConfigured(entry.provider);
  const privateTokenConnected =
    (entry.provider === "hubspot" && Boolean(env.HUBSPOT_ACCESS_TOKEN)) ||
    (entry.provider === "slack" && Boolean(env.SLACK_BOT_TOKEN));
  const connected =
    privateTokenConnected ||
    (saved?.status === "CONNECTED" && Boolean(meta.tokenEnvelope));
  const connectionState: ProviderConnectionState =
    meta.connectionState ??
    (connected
      ? "connected"
      : configured
        ? providerNeedsApproval(entry.provider) || OAUTH_PROVIDER[entry.provider]
          ? "needs_approval"
          : "disconnected"
        : "mock");
  return {
    ...entry,
    state:
      connectionState === "connected"
        ? "CONNECTED"
        : connectionState === "failed"
          ? "FAILED"
          : connectionState === "needs_approval"
            ? "NEEDS_APPROVAL"
            : connectionState === "mock"
              ? "MOCK_MODE"
              : "DISCONNECTED",
    connectionState,
    configured,
    lastSyncResult: meta.lastSyncResult ?? null,
    lastSyncAt: meta.lastSyncAt ?? null,
    lastError: meta.lastError ?? null,
    mockMode: connectionState === "mock",
  };
}

export async function saveOAuthTokens(params: {
  workspaceId: string;
  provider: string;
  tokens: OAuthTokens;
}) {
  const meta: IntegrationMetadata = {
    connectionState: "connected",
    tokenEnvelope: encryptTokens(params.tokens),
    tokenExpiresAt: params.tokens.expiresAt,
    scopes: params.tokens.scope,
    connectedAt: new Date().toISOString(),
    lastSyncResult: "Connected",
    lastSyncAt: new Date().toISOString(),
  };
  return prisma.integration.upsert({
    where: {
      workspaceId_provider: {
        workspaceId: params.workspaceId,
        provider: params.provider,
      },
    },
    create: {
      workspaceId: params.workspaceId,
      provider: params.provider,
      status: "CONNECTED",
      metadata: meta as object,
    },
    update: { status: "CONNECTED", metadata: meta as object },
  });
}

export async function disconnectIntegration(workspaceId: string, provider: string) {
  return prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    create: {
      workspaceId,
      provider,
      status: "DISCONNECTED",
      metadata: {
        connectionState: envConfigured(provider) ? "disconnected" : "mock",
        disconnectedAt: new Date().toISOString(),
        lastSyncResult: "Disconnected",
        lastSyncAt: new Date().toISOString(),
      } as object,
    },
    update: {
      status: "DISCONNECTED",
      metadata: {
        connectionState: envConfigured(provider) ? "disconnected" : "mock",
        disconnectedAt: new Date().toISOString(),
        lastSyncResult: "Disconnected",
        lastSyncAt: new Date().toISOString(),
      } as object,
    },
  });
}

export async function getProviderTokens(workspaceId: string, provider: string): Promise<OAuthTokens | null> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  const meta = metadataOf(integration);
  if (!integration || integration.status !== "CONNECTED" || !meta.tokenEnvelope) return null;
  let tokens = decryptTokens(meta.tokenEnvelope);
  const oauthProvider = OAUTH_PROVIDER[provider];
  if (oauthProvider && tokens.refreshToken && tokenExpired(tokens)) {
    tokens = await refreshOAuthToken(oauthProvider, tokens.refreshToken);
    await saveOAuthTokens({ workspaceId, provider, tokens });
  }
  return tokens;
}

export async function markIntegrationResult(params: {
  workspaceId: string;
  provider: string;
  ok: boolean;
  result: string;
}) {
  const existing = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId: params.workspaceId, provider: params.provider } },
  });
  const meta = metadataOf(existing);
  const configured = envConfigured(params.provider);
  const privateTokenConnected =
    (params.provider === "hubspot" && Boolean(env.HUBSPOT_ACCESS_TOKEN)) ||
    (params.provider === "slack" && Boolean(env.SLACK_BOT_TOKEN));
  const status = params.ok && (existing?.status === "CONNECTED" || privateTokenConnected)
    ? "CONNECTED"
    : "DISCONNECTED";
  const connectionState: ProviderConnectionState = params.ok
      ? privateTokenConnected || existing?.status === "CONNECTED"
        ? "connected"
        : configured
        ? providerNeedsApproval(params.provider) || OAUTH_PROVIDER[params.provider]
          ? "needs_approval"
          : "disconnected"
        : "mock"
    : "failed";
  await prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId: params.workspaceId, provider: params.provider } },
    create: {
      workspaceId: params.workspaceId,
      provider: params.provider,
      status,
      metadata: {
        connectionState,
        lastSyncResult: params.result,
        lastSyncAt: new Date().toISOString(),
        lastError: params.ok ? undefined : params.result,
      } as object,
    },
    update: {
      status,
      metadata: {
        ...meta,
        connectionState,
        lastSyncResult: params.result,
        lastSyncAt: new Date().toISOString(),
        lastError: params.ok ? undefined : params.result,
      } as object,
    },
  });
}

export async function runIntegrationAction(params: {
  workspaceId: string;
  provider: string;
  action: IntegrationAction;
  meeting?: MeetingWithContent | null;
  format?: ExportFormat;
  channelId?: string;
  transcriptUrl?: string;
}): Promise<IntegrationActionResult> {
  const configured = envConfigured(params.provider);
  const externalId = `mock_${params.provider}_${Date.now()}`;
  if (!configured) {
    const result = `${params.provider} ${params.action} ran in mock mode because credentials are not configured.`;
    await markIntegrationResult({
      workspaceId: params.workspaceId,
      provider: params.provider,
      ok: true,
      result,
    });
    return {
      provider: params.provider,
      action: params.action,
      mode: "mock",
      ok: true,
      externalId,
      message: result,
      lastSyncResult: result,
    };
  }

  try {
    if (!params.meeting && ["slack", "google-drive", "hubspot"].includes(params.provider)) {
      const tokens = await getProviderTokens(params.workspaceId, params.provider);
      const privateTokenReady = params.provider === "slack"
        ? Boolean(env.SLACK_BOT_TOKEN)
        : params.provider === "hubspot"
          ? Boolean(env.HUBSPOT_ACCESS_TOKEN)
          : false;
      if (!tokens && !privateTokenReady) {
        throw new HttpError(409, `${params.provider} needs approval before live actions can run.`);
      }
      const result = `${params.provider} live connection is ready.`;
      await markIntegrationResult({ workspaceId: params.workspaceId, provider: params.provider, ok: true, result });
      return {
        provider: params.provider,
        action: params.action,
        mode: "live",
        ok: true,
        externalId: `live_${params.provider}_${Date.now()}`,
        message: result,
        lastSyncResult: result,
      };
    }

    if (params.provider === "google-drive" && params.action === "export") {
      if (!params.meeting) throw new HttpError(400, "meetingId is required for Drive export");
      const tokens = await getProviderTokens(params.workspaceId, "google-drive");
      if (!tokens) throw new HttpError(409, "Google Drive needs approval before export.");
      const uploaded = await uploadGoogleDriveExport({
        tokens,
        meeting: params.meeting,
        format: params.format ?? "pdf",
      });
      const result = `Exported to Google Drive: ${uploaded.url}`;
      await markIntegrationResult({ workspaceId: params.workspaceId, provider: params.provider, ok: true, result });
      return {
        provider: params.provider,
        action: params.action,
        mode: "live",
        ok: true,
        externalId: uploaded.fileId,
        url: uploaded.url,
        message: result,
        lastSyncResult: result,
      };
    }

    if (params.provider === "slack" && params.action === "share-summary") {
      if (!params.meeting) throw new HttpError(400, "meetingId is required for Slack sharing");
      const tokens = await getProviderTokens(params.workspaceId, "slack");
      const channelId = params.channelId || env.SLACK_DEFAULT_CHANNEL_ID;
      if (!channelId) throw new HttpError(409, "Slack channel ID is required.");
      const posted = await postSlackSummary({
        tokens: tokens ?? undefined,
        botToken: env.SLACK_BOT_TOKEN,
        channelId,
        meeting: params.meeting,
        transcriptUrl: params.transcriptUrl,
      });
      const result = `Sent summary to Slack channel ${channelId}`;
      await markIntegrationResult({ workspaceId: params.workspaceId, provider: params.provider, ok: true, result });
      return {
        provider: params.provider,
        action: params.action,
        mode: "live",
        ok: true,
        externalId: posted.messageId,
        message: result,
        lastSyncResult: result,
      };
    }

    if (params.provider === "hubspot" && params.action === "sync-crm") {
      if (!params.meeting) throw new HttpError(400, "meetingId is required for HubSpot sync");
      const tokens = await getProviderTokens(params.workspaceId, "hubspot");
      const note = await pushHubSpotMeetingNote({
        tokens: tokens ?? undefined,
        accessToken: env.HUBSPOT_ACCESS_TOKEN,
        meeting: params.meeting,
      });
      const result = `Created HubSpot meeting note ${note.noteId}`;
      await markIntegrationResult({ workspaceId: params.workspaceId, provider: params.provider, ok: true, result });
      return {
        provider: params.provider,
        action: params.action,
        mode: "live",
        ok: true,
        externalId: note.noteId,
        message: result,
        lastSyncResult: result,
      };
    }

    throw new HttpError(409, `${params.provider} live action is not implemented yet or needs provider approval.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Integration action failed";
    await markIntegrationResult({
      workspaceId: params.workspaceId,
      provider: params.provider,
      ok: false,
      result: message,
    });
    throw err;
  }
}
