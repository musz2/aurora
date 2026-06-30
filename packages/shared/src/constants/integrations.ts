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
    state: "MOCK_MODE",
    description: "Auto-join Teams meetings or post summaries to a channel.",
    setupNote: "Requires Microsoft OAuth credentials for live Graph API access.",
  },
  {
    provider: "google-calendar",
    name: "Google Calendar",
    category: "Calendar",
    color: "#4285F4",
    state: "NOT_CONFIGURED",
    description: "Sync upcoming meetings and enable auto-record.",
    setupNote: "Requires Google OAuth and GOOGLE_REDIRECT_URI.",
  },
  {
    provider: "outlook-calendar",
    name: "Outlook Calendar",
    category: "Calendar",
    color: "#0078D4",
    state: "NOT_CONFIGURED",
    description: "Sync Outlook calendar events.",
    setupNote: "Requires Microsoft OAuth credentials and MICROSOFT_REDIRECT_URI.",
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
    state: "MOCK_MODE",
    description: "Save recordings and transcripts to Drive.",
    setupNote: "Requires Google OAuth credentials and a Drive folder.",
  },
  {
    provider: "dropbox",
    name: "Dropbox",
    category: "Storage",
    color: "#0061FF",
    state: "MOCK_MODE",
    description: "Save recordings and transcripts to Dropbox.",
    setupNote: "Requires Dropbox OAuth credentials.",
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
    provider: "jira",
    name: "Jira",
    category: "Tasks",
    color: "#0052CC",
    state: "MOCK_MODE",
    description: "Create issues from action items.",
    setupNote: "Requires Jira base URL, email, and API token.",
  },
  {
    provider: "asana",
    name: "Asana",
    category: "Tasks",
    color: "#F06A6A",
    state: "MOCK_MODE",
    description: "Create project tasks from action items.",
    setupNote: "Requires an Asana personal access token and project ID.",
  },
  {
    provider: "zapier",
    name: "Zapier / Webhooks",
    category: "Automation",
    color: "#FF4A00",
    state: "NOT_CONFIGURED",
    description: "Trigger any workflow when a meeting ends.",
    setupNote: "Set ZAPIER_WEBHOOK_URL to POST meeting events to your Zap.",
  },
  {
    provider: "email-export",
    name: "Email export",
    category: "Automation",
    color: "#4f46e5",
    state: "NOT_CONFIGURED",
    description: "Email summaries and action items after each meeting.",
    setupNote: "Requires SMTP credentials (SMTP_HOST/SMTP_USER/SMTP_PASS).",
  },
];

/** Maps an integration provider to the env vars that enable it. */
export const INTEGRATION_ENV_VARS: Record<string, string[]> = {
  zoom: ["ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_REDIRECT_URI"],
  "google-meet": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  "google-calendar": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  "outlook-calendar": ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"],
  teams: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"],
  "microsoft-teams": ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
  slack: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_REDIRECT_URI"],
  notion: ["NOTION_API_KEY", "NOTION_DATABASE_ID"],
  "google-drive": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  dropbox: ["DROPBOX_CLIENT_ID", "DROPBOX_CLIENT_SECRET"],
  hubspot: ["HUBSPOT_ACCESS_TOKEN"],
  salesforce: ["SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"],
  jira: ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
  asana: ["ASANA_ACCESS_TOKEN", "ASANA_PROJECT_ID"],
  zapier: ["ZAPIER_WEBHOOK_URL"],
  "email-export": ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],
};
