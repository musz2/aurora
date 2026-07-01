/**
 * Honest integration catalog. Runtime routes decorate these base entries with
 * workspace-aware live, mock, approval, failed, and connection states.
 *
 * - NOT_CONFIGURED: supported, but requires OAuth credentials / env setup.
 * - MOCK_MODE: local-development flow is available without credentials.
 * - NEEDS_APPROVAL: provider credentials exist, but workspace/user OAuth or
 *   provider marketplace approval is still required.
 * - FAILED: last live action failed.
 * - COMING_SOON: planned, not yet available.
 * - CONNECTED is only ever set when a real OAuth/private-token connection exists.
 */
export type IntegrationState =
  | "CONNECTED"
  | "DISCONNECTED"
  | "NOT_CONFIGURED"
  | "COMING_SOON"
  | "MOCK_MODE"
  | "NEEDS_APPROVAL"
  | "FAILED";

export interface IntegrationCatalogEntry {
  provider: string;
  name: string;
  category: string;
  color: string;
  state: IntegrationState;
  /** What the integration does, shown on the card. */
  description: string;
  /** Setup note shown when NOT_CONFIGURED. */
  setupNote?: string;
}

/**
 * Aurora supports EXACTLY these five integrations, all via provider OAuth:
 * Zoom, Google Meet, Microsoft Teams (meeting platforms) and Google Calendar,
 * Outlook Calendar (calendars). No other providers are offered. Email passwords
 * are never used, stored, or requested — connections are OAuth-only.
 */
export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    provider: "zoom",
    name: "Zoom",
    category: "Meeting Platforms",
    color: "#2D8CFF",
    state: "NOT_CONFIGURED",
    description: "Connect Zoom to import your meetings and capture their links.",
    setupNote: "Requires Zoom OAuth app credentials (ZOOM_CLIENT_ID / SECRET / REDIRECT_URI).",
  },
  {
    provider: "google-meet",
    name: "Google Meet",
    category: "Meeting Platforms",
    color: "#00897B",
    state: "NOT_CONFIGURED",
    description: "Detect and import Google Meet meetings from your Google Calendar.",
    setupNote: "Requires Google OAuth credentials (uses your Google Calendar connection).",
  },
  {
    provider: "teams",
    name: "Microsoft Teams",
    category: "Meeting Platforms",
    color: "#5059C9",
    state: "NOT_CONFIGURED",
    description: "Detect and import Microsoft Teams meetings from your Outlook Calendar.",
    setupNote: "Requires Microsoft OAuth credentials (uses your Outlook Calendar connection).",
  },
  {
    provider: "google-calendar",
    name: "Google Calendar",
    category: "Calendars",
    color: "#4285F4",
    state: "NOT_CONFIGURED",
    description: "Sync upcoming Google Calendar events and import meetings into Aurora.",
    setupNote: "Requires Google OAuth (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI).",
  },
  {
    provider: "outlook-calendar",
    name: "Outlook Calendar",
    category: "Calendars",
    color: "#0078D4",
    state: "NOT_CONFIGURED",
    description: "Sync upcoming Outlook Calendar events and import meetings into Aurora.",
    setupNote: "Requires Microsoft OAuth (MICROSOFT_CLIENT_ID / SECRET / REDIRECT_URI).",
  },
];

/** The only providers Aurora supports. Anything else is rejected. */
export const SUPPORTED_INTEGRATIONS = [
  "zoom",
  "google-meet",
  "teams",
  "google-calendar",
  "outlook-calendar",
] as const;
export type SupportedIntegration = (typeof SUPPORTED_INTEGRATIONS)[number];

export function isSupportedIntegration(provider: string): provider is SupportedIntegration {
  return (SUPPORTED_INTEGRATIONS as readonly string[]).includes(provider);
}

/** Maps an integration provider to the env vars that enable it (OAuth only). */
export const INTEGRATION_ENV_VARS: Record<SupportedIntegration, string[]> = {
  zoom: ["ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_REDIRECT_URI"],
  "google-meet": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  "google-calendar": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  "outlook-calendar": ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"],
  teams: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"],
};
