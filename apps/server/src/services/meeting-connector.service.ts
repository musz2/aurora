import type { DetectedMeetingLink, MeetingProvider } from "./calendar.service.js";

export type CaptureMode = "bot" | "desktop";

export interface JoinRequest {
  meetingId: string;
  title: string;
  link: DetectedMeetingLink;
  captureMode: CaptureMode;
  participantIdentity?: string;
}

export interface JoinResult {
  provider: MeetingProvider;
  mode: "live" | "mock";
  captureMode: CaptureMode;
  status:
    | "pending_credentials"
    | "ready_to_join"
    | "joining"
    | "joined_visible"
    | "failed"
    | "requires_desktop_capture";
  participantIdentity: string;
  recordingIndicator: "visible";
  participantNotification: string;
  message: string;
}

const PROVIDER_ENV: Record<MeetingProvider, string[]> = {
  zoom: ["ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET"],
  "google-meet": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  teams: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
  unknown: [],
};

export function connectorConfigured(provider: MeetingProvider) {
  return PROVIDER_ENV[provider].every((key) => Boolean(process.env[key]));
}

export function buildParticipantIdentity(workspaceName = "Aurora") {
  return `${workspaceName} Aurora Assistant`;
}

export function autoJoinMeeting(request: JoinRequest): JoinResult {
  const participantIdentity =
    request.participantIdentity ?? buildParticipantIdentity();
  if (request.captureMode === "desktop") {
    return {
      provider: request.link.provider,
      mode: "mock",
      captureMode: "desktop",
      status: "requires_desktop_capture",
      participantIdentity,
      recordingIndicator: "visible",
      participantNotification:
        "Aurora records only after the host starts local desktop/browser capture and confirms participant consent.",
      message:
        "No-bot capture mode is ready. Start browser or desktop audio capture from the Aurora desktop app.",
    };
  }

  const configured = connectorConfigured(request.link.provider);
  return {
    provider: request.link.provider,
    mode: configured ? "live" : "mock",
    captureMode: "bot",
    status:
      request.link.provider === "unknown"
        ? "failed"
        : configured
          ? "ready_to_join"
          : "pending_credentials",
    participantIdentity,
    recordingIndicator: "visible",
    participantNotification: `${participantIdentity} will appear as a visible participant and announce that transcription is active.`,
    message: configured
      ? `Bot join preparation is ready for ${request.title}. Aurora will join only as a visible participant after consent confirmation.`
      : `Bot join preparation is pending credentials. Configure provider OAuth credentials and approval to enable live joining.`,
  };
}
