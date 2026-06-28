import type { ActionItem, Meeting, MeetingSummary, TranscriptSegment } from "@prisma/client";
import type { CalendarEventInput, CalendarMeeting } from "./calendar.service.js";
import { detectEventMeetingLink, toCalendarMeeting } from "./calendar.service.js";
import { exportMeeting, type ExportFormat } from "./export.service.js";
import type { OAuthTokens } from "./oauth.service.js";
import { HttpError } from "../utils/http.js";
import { env } from "../config/env.js";

export type MeetingWithContent = Meeting & {
  summary: MeetingSummary | null;
  segments: TranscriptSegment[];
  actionItems: ActionItem[];
};

function auth(tokens: OAuthTokens) {
  return { Authorization: `Bearer ${tokens.accessToken}` };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function fetchGoogleCalendarEvents(tokens: OAuthTokens): Promise<CalendarMeeting[]> {
  const timeMin = new Date().toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("maxResults", "20");
  const res = await fetch(url, { headers: auth(tokens) });
  const json = (await res.json()) as { items?: Array<Record<string, unknown>>; error?: unknown };
  if (!res.ok) throw new HttpError(502, "Google Calendar fetch failed", json);
  return (json.items ?? [])
    .filter((item) => item.status !== "cancelled")
    .map((item) => {
      const start = item.start as { dateTime?: string; date?: string } | undefined;
      const end = item.end as { dateTime?: string; date?: string } | undefined;
      const attendees = Array.isArray(item.attendees)
        ? item.attendees.map((a) => asString((a as Record<string, unknown>).email)).filter(Boolean)
        : [];
      const event: CalendarEventInput = {
        id: asString(item.id),
        title: asString(item.summary) || "Untitled Google Calendar event",
        description: asString(item.description),
        location: asString(item.location),
        startsAt: start?.dateTime ?? start?.date ?? new Date().toISOString(),
        endsAt: end?.dateTime ?? end?.date ?? null,
        attendees,
      };
      return toCalendarMeeting(event, true);
    });
}

export async function fetchMicrosoftCalendarEvents(tokens: OAuthTokens): Promise<CalendarMeeting[]> {
  const startDateTime = new Date().toISOString();
  const endDateTime = new Date(Date.now() + 14 * 86400000).toISOString();
  const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  url.searchParams.set("startDateTime", startDateTime);
  url.searchParams.set("endDateTime", endDateTime);
  url.searchParams.set("$top", "20");
  url.searchParams.set("$orderby", "start/dateTime");
  const res = await fetch(url, { headers: auth(tokens) });
  const json = (await res.json()) as { value?: Array<Record<string, unknown>> };
  if (!res.ok) throw new HttpError(502, "Outlook Calendar fetch failed", json);
  return (json.value ?? []).map((item) => {
    const body = item.body as { content?: string } | undefined;
    const location = item.location as { displayName?: string } | undefined;
    const start = item.start as { dateTime?: string } | undefined;
    const end = item.end as { dateTime?: string } | undefined;
    const attendees = Array.isArray(item.attendees)
      ? item.attendees
          .map((a) => asString(((a as Record<string, unknown>).emailAddress as Record<string, unknown> | undefined)?.address))
          .filter(Boolean)
      : [];
    const event: CalendarEventInput = {
      id: asString(item.id),
      title: asString(item.subject) || "Untitled Outlook event",
      description: body?.content ?? "",
      location: location?.displayName ?? "",
      startsAt: start?.dateTime ?? new Date().toISOString(),
      endsAt: end?.dateTime ?? null,
      attendees,
    };
    return {
      ...toCalendarMeeting(event, true),
      meetingLink: detectEventMeetingLink(event),
    };
  });
}

export async function uploadGoogleDriveExport(params: {
  tokens: OAuthTokens;
  meeting: MeetingWithContent;
  format: ExportFormat;
}): Promise<{ fileId: string; url: string }> {
  const exported = exportMeeting(params.meeting, params.format);
  const boundary = `aurora-${Date.now()}`;
  const filename = `${params.meeting.title.replace(/[^a-z0-9]+/gi, "-") || "meeting"}.${exported.extension}`;
  const metadata = {
    name: filename,
    mimeType: exported.contentType,
    ...(env.GOOGLE_DRIVE_FOLDER_ID ? { parents: [env.GOOGLE_DRIVE_FOLDER_ID] } : {}),
  };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${exported.contentType}\r\n\r\n`),
    exported.buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: {
      ...auth(params.tokens),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const json = (await res.json()) as { id?: string; webViewLink?: string };
  if (!res.ok || !json.id) throw new HttpError(502, "Google Drive export failed", json);
  return {
    fileId: json.id,
    url: json.webViewLink ?? `https://drive.google.com/file/d/${json.id}/view`,
  };
}

export async function postSlackSummary(params: {
  tokens?: OAuthTokens;
  botToken?: string;
  channelId: string;
  meeting: MeetingWithContent;
  transcriptUrl?: string;
}) {
  const token = params.tokens?.accessToken ?? params.botToken;
  if (!token) throw new HttpError(409, "Slack is not connected");
  const summary = params.meeting.summary?.overview ?? "No summary generated yet.";
  const actions = params.meeting.actionItems
    .slice(0, 8)
    .map((a) => `- ${a.task}${a.assigneeName ? ` (${a.assigneeName})` : ""}`)
    .join("\n");
  const text = [
    `Aurora summary: ${params.meeting.title}`,
    summary,
    actions ? `Action items:\n${actions}` : "",
    params.transcriptUrl ? `Transcript: ${params.transcriptUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: params.channelId, text }),
  });
  const json = (await res.json()) as { ok?: boolean; ts?: string; error?: string };
  if (!json.ok) throw new HttpError(502, `Slack post failed: ${json.error ?? "unknown"}`, json);
  return { messageId: json.ts ?? "" };
}

export async function pushHubSpotMeetingNote(params: {
  tokens?: OAuthTokens;
  accessToken?: string;
  meeting: MeetingWithContent;
  objectId?: string;
}) {
  const token = params.tokens?.accessToken ?? params.accessToken;
  if (!token) throw new HttpError(409, "HubSpot is not connected");
  const body = [
    params.meeting.summary?.overview ?? "Aurora meeting note",
    "",
    "Action items:",
    ...params.meeting.actionItems.map((a) => `- ${a.task}${a.assigneeName ? ` (${a.assigneeName})` : ""}`),
  ].join("\n");
  const payload: Record<string, unknown> = {
    properties: {
      hs_timestamp: new Date().toISOString(),
      hs_note_body: body,
    },
  };
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { id?: string };
  if (!res.ok || !json.id) throw new HttpError(502, "HubSpot note sync failed", json);
  return { noteId: json.id };
}
