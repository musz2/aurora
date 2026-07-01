import type { Integration } from "@prisma/client";
import type { IntegrationCatalogEntry } from "@aurora/shared";
import { INTEGRATION_CATALOG, INTEGRATION_ENV_VARS, isSupportedIntegration } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import {
  decryptTokens,
  encryptTokens,
  refreshOAuthToken,
  tokenExpired,
  type OAuthProvider,
  type OAuthTokens,
  type StoredTokenEnvelope,
} from "./oauth.service.js";

/**
 * Integration state for the five supported providers only (Zoom, Google Meet,
 * Microsoft Teams, Google Calendar, Outlook Calendar). All connections are
 * OAuth-based; tokens are encrypted at rest. No passwords are ever stored.
 */

export type ProviderConnectionState =
  | "connected"
  | "disconnected"
  | "not_configured"
  | "needs_approval"
  | "expired"
  | "failed";

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
}

/** Which OAuth provider backs each supported integration. */
export const OAUTH_PROVIDER: Record<string, OAuthProvider> = {
  "google-calendar": "google",
  "google-meet": "google",
  "outlook-calendar": "microsoft",
  teams: "microsoft",
  zoom: "zoom",
};

/** True when the provider's OAuth env vars are all set. */
export function envConfigured(provider: string): boolean {
  if (!isSupportedIntegration(provider)) return false;
  const required = INTEGRATION_ENV_VARS[provider] ?? [];
  return required.length > 0 && required.every((key) => Boolean(process.env[key]));
}

/** Calendar providers that additionally need workspace OAuth (needs_approval). */
export function providerNeedsApproval(provider: string): boolean {
  return isSupportedIntegration(provider) && Boolean(OAUTH_PROVIDER[provider]);
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
  const connected = saved?.status === "CONNECTED" && Boolean(meta.tokenEnvelope);
  const connectionState: ProviderConnectionState =
    meta.connectionState ??
    (connected ? "connected" : configured ? "needs_approval" : "not_configured");
  const state =
    connectionState === "connected"
      ? "CONNECTED"
      : connectionState === "failed"
        ? "FAILED"
        : connectionState === "needs_approval"
          ? "NEEDS_APPROVAL"
          : "NOT_CONFIGURED";
  return {
    ...entry,
    state,
    connectionState,
    configured,
    connected,
    lastSyncResult: meta.lastSyncResult ?? null,
    lastSyncAt: meta.lastSyncAt ?? null,
    lastError: meta.lastError ?? null,
    tokenExpiresAt: meta.tokenExpiresAt ?? null,
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
    where: { workspaceId_provider: { workspaceId: params.workspaceId, provider: params.provider } },
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
  const meta: IntegrationMetadata = {
    connectionState: envConfigured(provider) ? "disconnected" : "not_configured",
    disconnectedAt: new Date().toISOString(),
    lastSyncResult: "Disconnected",
    lastSyncAt: new Date().toISOString(),
  };
  return prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    create: { workspaceId, provider, status: "DISCONNECTED", metadata: meta as object },
    update: { status: "DISCONNECTED", metadata: meta as object },
  });
}

/** Resolve stored OAuth tokens for a provider, refreshing them if expired. */
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
  const connectionState: ProviderConnectionState = params.ok
    ? existing?.status === "CONNECTED"
      ? "connected"
      : envConfigured(params.provider)
        ? "needs_approval"
        : "not_configured"
    : "failed";
  await prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId: params.workspaceId, provider: params.provider } },
    create: {
      workspaceId: params.workspaceId,
      provider: params.provider,
      status: existing?.status ?? "DISCONNECTED",
      metadata: {
        connectionState,
        lastSyncResult: params.result,
        lastSyncAt: new Date().toISOString(),
        lastError: params.ok ? undefined : params.result,
      } as object,
    },
    update: {
      status: existing?.status ?? "DISCONNECTED",
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
