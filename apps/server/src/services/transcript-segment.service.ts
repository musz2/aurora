/**
 * Transcript segment service.
 *
 * Pure helpers for the host "transcript segment actions" UI: validating and
 * building the partial update for a segment (edit text, highlight, mark as
 * decision / action item). Keeping the merge logic pure makes it unit-testable
 * and keeps the route thin.
 */

export interface SegmentPatchInput {
  text?: unknown;
  highlighted?: unknown;
  isDecision?: unknown;
  isActionItem?: unknown;
}

export interface SegmentUpdate {
  text?: string;
  edited?: boolean;
  highlighted?: boolean;
  isDecision?: boolean;
  isActionItem?: boolean;
}

export class SegmentPatchError extends Error {}

const MAX_SEGMENT_TEXT = 5000;

/**
 * Validate and normalize a segment patch. Returns only the fields that should be
 * written. Editing the text automatically sets `edited: true`. Throws when no
 * recognized field is present or when a value has the wrong type.
 */
export function buildSegmentUpdate(patch: SegmentPatchInput): SegmentUpdate {
  const update: SegmentUpdate = {};

  if (patch.text !== undefined) {
    if (typeof patch.text !== "string") {
      throw new SegmentPatchError("text must be a string");
    }
    const trimmed = patch.text.trim();
    if (!trimmed) throw new SegmentPatchError("text cannot be empty");
    update.text = trimmed.slice(0, MAX_SEGMENT_TEXT);
    update.edited = true;
  }

  for (const key of ["highlighted", "isDecision", "isActionItem"] as const) {
    const value = patch[key];
    if (value !== undefined) {
      if (typeof value !== "boolean") {
        throw new SegmentPatchError(`${key} must be a boolean`);
      }
      update[key] = value;
    }
  }

  if (Object.keys(update).length === 0) {
    throw new SegmentPatchError(
      "No updatable fields provided (text, highlighted, isDecision, isActionItem)"
    );
  }
  return update;
}

/* -------------------------------------------------------------------------- */
/* Final transcript-segment deduplication                                      */
/*                                                                             */
/* Live STT (and reconnects) can emit the same finalized utterance more than   */
/* once: Deepgram occasionally re-sends a final, and a socket reconnect can     */
/* replay the tail of a turn. Without a guard we would persist + broadcast      */
/* duplicate segments. These helpers are pure so the socket layer can keep a    */
/* small in-memory window of recent finals and skip exact/near duplicates.     */
/* -------------------------------------------------------------------------- */

export interface FinalSegmentKey {
  speakerName: string;
  text: string;
  startTime: number;
}

/** Collapse whitespace + lowercase so trivial spacing/case differences match. */
export function normalizeSegmentText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * True when `candidate` duplicates one of `recent` finals: same speaker and
 * same normalized text within `windowSeconds`. Empty/whitespace-only text is
 * always treated as a duplicate (nothing to persist).
 */
export function isDuplicateFinalSegment(
  candidate: FinalSegmentKey,
  recent: FinalSegmentKey[],
  windowSeconds = 12
): boolean {
  const normalized = normalizeSegmentText(candidate.text);
  if (!normalized) return true;
  return recent.some(
    (r) =>
      r.speakerName === candidate.speakerName &&
      normalizeSegmentText(r.text) === normalized &&
      Math.abs(r.startTime - candidate.startTime) <= windowSeconds
  );
}

/**
 * Bounded rolling window of recently persisted finals, used by the live socket
 * to dedupe without unbounded memory growth. Not persistent — one per session.
 */
export class FinalSegmentWindow {
  private items: FinalSegmentKey[] = [];
  constructor(private readonly max = 40, private readonly windowSeconds = 12) {}

  /** Returns false (and records) for a new segment, true if it is a duplicate. */
  isDuplicate(candidate: FinalSegmentKey): boolean {
    if (isDuplicateFinalSegment(candidate, this.items, this.windowSeconds)) {
      return true;
    }
    this.items.push(candidate);
    if (this.items.length > this.max) this.items.shift();
    return false;
  }

  reset(): void {
    this.items = [];
  }
}
