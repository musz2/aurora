import type {
  PublicSessionDto,
  SharedSessionSummaryDto,
  SharedTranscriptSegmentDto,
} from "@aurora/shared";

/**
 * Shared viewer sanitization service.
 *
 * The public viewer (no auth) must NEVER receive private assistant suggestions,
 * private notes, host controls, raw recording URLs, integration metadata, or any
 * field that is not explicitly shared. This service is the single chokepoint that
 * builds the public payload via an allow-list, so a careless `include` elsewhere
 * cannot leak private data to viewers.
 */

/** Loose shape of a meeting row as loaded from Prisma (only fields we read). */
export interface MeetingForSharing {
  id: string;
  title: string;
  status: string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  shared?: boolean;
  participants?: string[];
  publishedNotes?: string[];
  segments?: Array<{
    id: string;
    speakerName: string;
    text: string;
    startTime: number;
  }>;
  summary?: {
    overview: string;
    keyPoints: string[];
    decisions: string[];
  } | null;
}

/** Keys that must never appear in a shared payload. Used to assert in tests. */
export const FORBIDDEN_SHARED_KEYS = [
  "privateAssistSuggestions",
  "privateNotes",
  "recordingUrl",
  "createdById",
  "workspaceId",
  "followUpEmail",
  "integrations",
  "shareId",
] as const;

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Whether a share link should currently grant viewer access. A link is active
 * only when sharing is enabled AND it has not passed its optional expiry. Pure
 * so the viewer route and tests can reason about revoke/expiry without a DB.
 */
export function isShareActive(
  meeting: { shared?: boolean; shareExpiresAt?: Date | string | null },
  now: Date = new Date()
): boolean {
  if (!meeting.shared) return false;
  if (!meeting.shareExpiresAt) return true;
  const expires =
    meeting.shareExpiresAt instanceof Date
      ? meeting.shareExpiresAt
      : new Date(meeting.shareExpiresAt);
  return expires.getTime() > now.getTime();
}

function sanitizeSegments(
  segments: MeetingForSharing["segments"]
): SharedTranscriptSegmentDto[] {
  return (segments ?? []).map((s) => ({
    id: s.id,
    speakerName: s.speakerName,
    text: s.text,
    startTime: s.startTime,
  }));
}

function sanitizeSummary(
  summary: MeetingForSharing["summary"],
  live: boolean
): SharedSessionSummaryDto | null {
  // While live, the summary is not yet final — never expose it.
  if (live || !summary) return null;
  return {
    overview: summary.overview,
    keyPoints: summary.keyPoints,
    decisions: summary.decisions,
  };
}

/**
 * Build the public session payload from a meeting row. Allow-list only: any field
 * not explicitly copied here is dropped, including the entire follow-up email and
 * all private assistant output.
 */
export function sanitizePublicSession(
  meeting: MeetingForSharing,
  shareId: string
): PublicSessionDto {
  const live = meeting.status === "RECORDING";
  const ended = meeting.status === "COMPLETED" || meeting.status === "FAILED";
  return {
    id: shareId,
    title: meeting.title,
    status: meeting.status as PublicSessionDto["status"],
    live,
    ended,
    startedAt: toIso(meeting.startedAt),
    endedAt: toIso(meeting.endedAt),
    participants: meeting.participants ?? [],
    publishedNotes: meeting.publishedNotes ?? [],
    segments: sanitizeSegments(meeting.segments),
    summary: sanitizeSummary(meeting.summary, live),
  };
}

/**
 * Defensive guard for tests/dev: asserts no forbidden key is present on an object
 * that is about to be serialized to a public viewer.
 */
export function assertNoPrivateLeak(payload: Record<string, unknown>): void {
  for (const key of FORBIDDEN_SHARED_KEYS) {
    if (key in payload) {
      throw new Error(`Shared payload leaked private field: ${key}`);
    }
  }
}
