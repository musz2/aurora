/**
 * Speaker service.
 *
 * Speaker identity for transcripts: normalization for renames, plus deterministic
 * initials/colors so the same speaker always renders with the same avatar across
 * the live page, meeting detail, and shared viewer. Pure and unit-testable.
 */

const MAX_SPEAKER_NAME = 80;

/** Deterministic avatar palette (kept in sync with the web theme tokens). */
export const SPEAKER_PALETTE = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f43f5e", // rose
] as const;

export class SpeakerNameError extends Error {}

/** Trim, collapse internal whitespace, and clamp. Throws on empty input. */
export function normalizeSpeakerName(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned) throw new SpeakerNameError("Speaker name cannot be empty");
  return cleaned.slice(0, MAX_SPEAKER_NAME);
}

/** Stable hash so colors/initials never flicker between renders. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Up to two uppercase initials from a speaker name. */
export function speakerInitials(name: string): string {
  const parts = name.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic palette color for a speaker name. */
export function speakerColor(name: string): string {
  return SPEAKER_PALETTE[hashString(name) % SPEAKER_PALETTE.length];
}

/** Avatar descriptor for a speaker (initials + color). */
export function speakerAvatar(name: string): { initials: string; color: string } {
  return { initials: speakerInitials(name), color: speakerColor(name) };
}

/**
 * Validate a rename request. Returns the normalized {from, to}. Throws when the
 * names are empty or identical (no-op renames are rejected to avoid silent work).
 */
export function validateRename(from: string, to: string): {
  from: string;
  to: string;
} {
  const normalizedFrom = normalizeSpeakerName(from);
  const normalizedTo = normalizeSpeakerName(to);
  if (normalizedFrom === normalizedTo) {
    throw new SpeakerNameError("New speaker name must differ from the old one");
  }
  return { from: normalizedFrom, to: normalizedTo };
}
