export * from "./plans.js";
export * from "./features.js";
export * from "./integrations.js";

export const MEETING_STATUSES = [
  "SCHEDULED",
  "RECORDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const ACTION_ITEM_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

export const ACTION_ITEM_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type ActionItemPriority = (typeof ACTION_ITEM_PRIORITIES)[number];

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const MEETING_SOURCES = [
  "LIVE",
  "UPLOAD",
  "ZOOM",
  "MEET",
  "TEAMS",
] as const;
export type MeetingSource = (typeof MEETING_SOURCES)[number];

export const INTEGRATION_PROVIDERS = [
  "zoom",
  "meet",
  "teams",
  "google-calendar",
  "outlook-calendar",
  "slack",
  "salesforce",
  "hubspot",
  "clickup",
  "asana",
  "jira",
  "notion",
  "google-drive",
  "dropbox",
  "zapier",
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const SUPPORTED_UPLOAD_FORMATS = ["mp3", "wav", "m4a", "mp4"] as const;

export const SOCKET_EVENTS = {
  // client -> server
  MEETING_START: "meeting:start",
  MEETING_STOP: "meeting:stop",
  TRANSCRIPT_AUDIO_CHUNK: "transcript:audio-chunk",
  AI_ASK_LIVE: "ai:ask-live",
  // server -> client
  MEETING_STATUS: "meeting:status",
  TRANSCRIPT_SEGMENT: "transcript:segment",
  TRANSCRIPT_PARTIAL: "transcript:partial",
  TRANSCRIPT_ERROR: "transcript:error",
  AUDIO_ACK: "audio:ack",
  DG_STATUS: "deepgram:status",
  AI_SUGGESTION: "ai:suggestion",
  AI_ERROR: "ai:error",
  RECORDING_WARNING: "recording:warning",
} as const;

/** Live session capture mode. "real" = mic+Deepgram, "demo" = sample only. */
export const SESSION_MODES = ["real", "demo"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];
