export type MeetingProvider = "zoom" | "google-meet" | "teams" | "unknown";

export interface CalendarEventInput {
  id?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string | Date;
  endsAt?: string | Date | null;
  attendees?: string[];
}

export interface DetectedMeetingLink {
  provider: MeetingProvider;
  url: string;
  meetingId?: string;
}

export interface CalendarMeeting {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  attendees: string[];
  meetingLink: DetectedMeetingLink | null;
  autoJoinEligible: boolean;
  consentRequired: boolean;
}

const LINK_PATTERNS: Array<{
  provider: MeetingProvider;
  pattern: RegExp;
  meetingId?: (url: string) => string | undefined;
}> = [
  {
    provider: "zoom",
    pattern: /https?:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/j\/[^\s<>"')]+/i,
    meetingId: (url) => url.match(/\/j\/(\d+)/)?.[1],
  },
  {
    provider: "google-meet",
    pattern: /https?:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:\?[^\s<>"')]+)?/i,
    meetingId: (url) => url.match(/meet\.google\.com\/([a-z-]+)/i)?.[1],
  },
  {
    provider: "teams",
    pattern: /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"')]+/i,
  },
];

function normalizeUrl(raw: string): string {
  return raw.replace(/[.,;:!?]+$/, "");
}

export function detectMeetingLink(text: string): DetectedMeetingLink | null {
  for (const entry of LINK_PATTERNS) {
    const match = text.match(entry.pattern);
    if (match?.[0]) {
      const url = normalizeUrl(match[0]);
      return {
        provider: entry.provider,
        url,
        meetingId: entry.meetingId?.(url),
      };
    }
  }
  return null;
}

export function detectEventMeetingLink(
  event: Pick<CalendarEventInput, "description" | "location" | "title">
): DetectedMeetingLink | null {
  return detectMeetingLink(
    [event.location, event.description, event.title].filter(Boolean).join("\n")
  );
}

export function buildMockCalendarEvents(now = new Date()): CalendarMeeting[] {
  const start = new Date(now.getTime() + 45 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const events: CalendarEventInput[] = [
    {
      id: "mock-cal-1",
      title: "Product launch sync",
      description: "Join with Zoom: https://zoom.us/j/123456789?pwd=aurora",
      startsAt: start,
      endsAt: end,
      attendees: ["Maya Chen", "Noah Patel", "Avery Brooks"],
    },
    {
      id: "mock-cal-2",
      title: "Customer success handoff",
      location: "https://meet.google.com/abc-defg-hij",
      startsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
      endsAt: new Date(end.getTime() + 2 * 60 * 60 * 1000),
      attendees: ["Jordan Lee", "Riley Stone"],
    },
    {
      id: "mock-cal-3",
      title: "Weekly planning",
      description:
        "Teams room: https://teams.microsoft.com/l/meetup-join/19%3ameeting_mock",
      startsAt: new Date(start.getTime() + 24 * 60 * 60 * 1000),
      endsAt: new Date(end.getTime() + 24 * 60 * 60 * 1000),
      attendees: ["Sam Rivera", "Taylor Morgan"],
    },
  ];

  return events.map((event) => toCalendarMeeting(event, true));
}

export function toCalendarMeeting(
  event: CalendarEventInput,
  consentRequired: boolean
): CalendarMeeting {
  const meetingLink = detectEventMeetingLink(event);
  const startsAt = new Date(event.startsAt).toISOString();
  const endsAt = event.endsAt ? new Date(event.endsAt).toISOString() : null;
  return {
    id: event.id ?? `event-${Buffer.from(`${event.title}-${startsAt}`).toString("hex").slice(0, 12)}`,
    title: event.title,
    startsAt,
    endsAt,
    attendees: event.attendees ?? [],
    meetingLink,
    autoJoinEligible: Boolean(meetingLink),
    consentRequired,
  };
}
