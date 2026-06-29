/**
 * Search helpers.
 *
 * Pure utilities for transcript/meeting search: build a readable snippet centered
 * on the matched query, and assemble citation-like "references" so Aurora can show
 * exactly where an answer came from (meeting + speaker + quoted snippet). Kept pure
 * for unit testing; the route does the Prisma I/O.
 */

export interface SearchReference {
  type: "segment" | "summary";
  meetingId: string;
  meetingTitle: string;
  speakerName?: string;
  snippet: string;
}

/** Case-insensitive index of `query` in `text`, or -1. */
export function matchIndex(text: string, query: string): number {
  if (!query) return -1;
  return text.toLowerCase().indexOf(query.toLowerCase());
}

/**
 * Build a snippet around the first match of `query`, with ellipses when the
 * surrounding text is truncated. Falls back to the head of the text when there is
 * no match (e.g. a summary matched on a different field).
 */
export function buildSnippet(text: string, query: string, radius = 64): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const idx = matchIndex(clean, query);
  if (idx === -1) {
    return clean.length > radius * 2
      ? `${clean.slice(0, radius * 2).trimEnd()}…`
      : clean;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(clean.length, idx + query.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end).trim()}${suffix}`;
}

/**
 * Assemble references from transcript-segment and summary hits. Segment hits are
 * preferred (they carry a speaker + exact quote); summary hits add meeting-level
 * context. De-duplicated by meeting+snippet and capped.
 */
export function buildReferences(
  query: string,
  segments: Array<{
    meetingId: string;
    speakerName: string;
    text: string;
    meeting: { title: string };
  }>,
  summaries: Array<{
    meetingId: string;
    overview: string;
    meeting: { title: string };
  }>,
  limit = 8
): SearchReference[] {
  const refs: SearchReference[] = [];
  const seen = new Set<string>();
  const push = (ref: SearchReference) => {
    const key = `${ref.meetingId}:${ref.snippet}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  for (const s of segments) {
    push({
      type: "segment",
      meetingId: s.meetingId,
      meetingTitle: s.meeting.title,
      speakerName: s.speakerName,
      snippet: buildSnippet(s.text, query),
    });
  }
  for (const sum of summaries) {
    push({
      type: "summary",
      meetingId: sum.meetingId,
      meetingTitle: sum.meeting.title,
      snippet: buildSnippet(sum.overview, query),
    });
  }
  return refs.slice(0, limit);
}
