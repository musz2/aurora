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
