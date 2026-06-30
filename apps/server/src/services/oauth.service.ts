import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";

export type OAuthProvider = "google" | "microsoft" | "slack" | "hubspot" | "zoom";

export interface OAuthState {
  provider: OAuthProvider;
  workspaceId: string;
  userId: string;
  returnTo?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  tokenType?: string;
  scope?: string;
}

export interface StoredTokenEnvelope {
  encrypted: string;
  iv: string;
  tag: string;
}

interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  scopeSeparator?: " " | ",";
  extraAuthParams?: Record<string, string>;
  tenantId?: string;
}

function microsoftTenant() {
  return env.MICROSOFT_TENANT_ID || "common";
}

export function getOAuthConfig(provider: OAuthProvider): OAuthConfig {
  const configs: Record<OAuthProvider, OAuthConfig> = {
    google: {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
      scopes: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/drive.file",
      ],
      extraAuthParams: { access_type: "offline", prompt: "consent" },
    },
    microsoft: {
      authUrl: `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/token`,
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      redirectUri: env.MICROSOFT_REDIRECT_URI,
      scopes: ["offline_access", "Calendars.Read", "User.Read", "ChannelMessage.Send"],
      tenantId: microsoftTenant(),
    },
    slack: {
      authUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      clientId: env.SLACK_CLIENT_ID,
      clientSecret: env.SLACK_CLIENT_SECRET,
      redirectUri: env.SLACK_REDIRECT_URI,
      scopes: ["chat:write", "channels:read", "groups:read"],
      scopeSeparator: ",",
    },
    hubspot: {
      authUrl: "https://app.hubspot.com/oauth/authorize",
      tokenUrl: "https://api.hubapi.com/oauth/v1/token",
      clientId: env.HUBSPOT_CLIENT_ID,
      clientSecret: env.HUBSPOT_CLIENT_SECRET,
      redirectUri: env.HUBSPOT_REDIRECT_URI,
      scopes: ["crm.objects.contacts.write", "crm.objects.companies.write", "crm.objects.deals.write"],
    },
    zoom: {
      authUrl: "https://zoom.us/oauth/authorize",
      tokenUrl: "https://zoom.us/oauth/token",
      clientId: env.ZOOM_CLIENT_ID,
      clientSecret: env.ZOOM_CLIENT_SECRET,
      redirectUri: env.ZOOM_REDIRECT_URI,
      scopeSeparator: ",",
      scopes: [
        "meeting:read:search",
        "user:read:user",
        "cloud_recording:read:recording",
        "cloud_recording:read:list_recording_files",
        "cloud_recording:read:meeting_transcript",
        "zoomapp:inmeeting",
      ],
    },
  };
  return configs[provider];
}

export function oauthConfigured(provider: OAuthProvider) {
  const c = getOAuthConfig(provider);
  return Boolean(c.clientId && c.clientSecret && c.redirectUri);
}

export function signOAuthState(state: OAuthState) {
  return jwt.sign(state, env.JWT_SECRET, { expiresIn: "15m" });
}

export function verifyOAuthState(token: string): OAuthState {
  return jwt.verify(token, env.JWT_SECRET) as OAuthState;
}

export function buildOAuthUrl(provider: OAuthProvider, state: OAuthState) {
  const config = getOAuthConfig(provider);
  if (!oauthConfigured(provider)) {
    throw new HttpError(409, `${provider} OAuth is not configured.`);
  }
  const url = new URL(config.authUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  const scopeStr = config.scopes.join(config.scopeSeparator ?? " ");
  if (provider === "zoom") {
    console.info(`[zoom] scopes requested: ${scopeStr}`);
  }
  url.searchParams.set("scope", scopeStr);
  url.searchParams.set("state", signOAuthState(state));
  for (const [key, value] of Object.entries(config.extraAuthParams ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function exchangeOAuthCode(provider: OAuthProvider, code: string): Promise<OAuthTokens> {
  const config = getOAuthConfig(provider);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    throw new HttpError(502, `${provider} OAuth token exchange failed`, json);
  }
  return normalizeTokenResponse(json);
}

export async function refreshOAuthToken(provider: OAuthProvider, refreshToken: string): Promise<OAuthTokens> {
  const config = getOAuthConfig(provider);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    throw new HttpError(502, `${provider} OAuth token refresh failed`, json);
  }
  return normalizeTokenResponse(json, refreshToken);
}

function normalizeTokenResponse(json: Record<string, unknown>, fallbackRefreshToken?: string): OAuthTokens {
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : undefined;
  const accessToken = String(json.access_token ?? "");
  if (!accessToken) throw new HttpError(502, "OAuth response did not include an access token");
  return {
    accessToken,
    refreshToken: (json.refresh_token as string | undefined) ?? fallbackRefreshToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined,
    tokenType: (json.token_type as string | undefined) ?? "Bearer",
    scope: json.scope as string | undefined,
  };
}

function key() {
  return crypto.createHash("sha256").update(env.JWT_SECRET).digest();
}

export function encryptTokens(tokens: OAuthTokens): StoredTokenEnvelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final(),
  ]);
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptTokens(envelope: StoredTokenEnvelope): OAuthTokens {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(envelope.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.encrypted, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as OAuthTokens;
}

export function tokenExpired(tokens: OAuthTokens, skewMs = 60_000) {
  return Boolean(tokens.expiresAt && new Date(tokens.expiresAt).getTime() - skewMs <= Date.now());
}
