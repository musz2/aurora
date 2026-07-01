import type { CalendarEventInput, CalendarMeeting } from "./calendar.service.js";
import { detectEventMeetingLink, toCalendarMeeting } from "./calendar.service.js";
import type { OAuthTokens } from "./oauth.service.js";
import { HttpError } from "../utils/http.js";

/**
 * Provider read APIs for the supported integrations. Aurora only reads calendar
 * events (Google Calendar / Outlook Calendar) to detect and import Google Meet,
 * Microsoft Teams, and Zoom meeting links. OAuth access tokens only — no
 * passwords, ever.
 */

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
      // Google puts the Meet link in hangoutLink / conferenceData too.
      const hangoutLink = asString(item.hangoutLink);
      const event: CalendarEventInput = {
        id: asString(item.id),
        title: asString(item.summary) || "Untitled Google Calendar event",
        description: [asString(item.description), hangoutLink].filter(Boolean).join("\n"),
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
    const onlineMeeting = item.onlineMeeting as { joinUrl?: string } | undefined;
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
      // Teams join URL lives in onlineMeeting.joinUrl; include it for detection.
      description: [body?.content ?? "", asString(onlineMeeting?.joinUrl)].filter(Boolean).join("\n"),
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
