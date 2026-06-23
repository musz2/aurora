/**
 * Honest integration catalog. No OAuth flows are implemented yet, so every
 * provider reports an accurate state — never a fake "Connected".
 *
 * - NOT_CONFIGURED: supported, but requires OAuth credentials / env setup.
 * - COMING_SOON: planned, not yet available.
 * - CONNECTED is only ever set when a real OAuth connection exists (none yet).
 */
export type IntegrationState =
  | "CONNECTED"
  | "NOT_CONFIGURED"
  | "COMING_SOON";

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

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    provider: "zoom",
    name: "Zoom",
    category: "Meetings",
    color: "#2D8CFF",
    state: "NOT_CONFIGURED",
    description: "Auto-join and capture Zoom meetings you host.",
    setupNote: "Requires Zoom OAuth app credentials (ZOOM_CLIENT_ID/SECRET).",
  },
  {
    provider: "google-meet",
    name: "Google Meet",
    category: "Meetings",
    color: "#00897B",
    state: "NOT_CONFIGURED",
    description: "Capture Google Meet calls from your calendar.",
    setupNote: "Requires Google OAuth credentials and Meet API access.",
  },
  {
    provider: "teams",
    name: "Microsoft Teams",
    category: "Meetings",
    color: "#5059C9",
    state: "COMING_SOON",
    description: "Capture Microsoft Teams meetings.",
  },
  {
    provider: "google-calendar",
    name: "Google Calendar",
    category: "Calendar",
    color: "#4285F4",
    state: "NOT_CONFIGURED",
    description: "Sync upcoming meetings and enable auto-record.",
    setupNote: "Requires Google OAuth (GOOGLE_CLIENT_ID/SECRET).",
  },
  {
    provider: "outlook-calendar",
    name: "Outlook Calendar",
    category: "Calendar",
    color: "#0078D4",
    state: "NOT_CONFIGURED",
    description: "Sync Outlook calendar events.",
    setupNote: "Requires Microsoft OAuth credentials.",
  },
  {
    provider: "slack",
    name: "Slack",
    category: "Collaboration",
    color: "#4A154B",
    state: "NOT_CONFIGURED",
    description: "Post summaries and action items to channels.",
    setupNote: "Requires a Slack app + bot token (SLACK_BOT_TOKEN).",
  },
  {
    provider: "notion",
    name: "Notion",
    category: "Docs",
    color: "#111111",
    state: "NOT_CONFIGURED",
    description: "Export meeting notes to a Notion database.",
    setupNote: "Requires a Notion integration token.",
  },
  {
    provider: "google-drive",
    name: "Google Drive",
    category: "Storage",
    color: "#1FA463",
    state: "COMING_SOON",
    description: "Save recordings and transcripts to Drive.",
  },
  {
    provider: "dropbox",
    name: "Dropbox",
    category: "Storage",
    color: "#0061FF",
    state: "COMING_SOON",
    description: "Save recordings and transcripts to Dropbox.",
  },
  {
    provider: "hubspot",
    name: "HubSpot",
    category: "CRM",
    color: "#FF7A59",
    state: "NOT_CONFIGURED",
    description: "Log call notes and tasks to HubSpot contacts.",
    setupNote: "Requires a HubSpot private app token.",
  },
  {
    provider: "salesforce",
    name: "Salesforce",
    category: "CRM",
    color: "#00A1E0",
    state: "NOT_CONFIGURED",
    description: "Sync meeting outcomes to Salesforce opportunities.",
    setupNote: "Requires a Salesforce connected app.",
  },
  {
    provider: "zapier",
    name: "Zapier / Webhooks",
    category: "Automation",
    color: "#FF4A00",
    state: "COMING_SOON",
    description: "Trigger any workflow when a meeting ends.",
  },
];
