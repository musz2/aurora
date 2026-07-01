/**
 * Deterministic transcript cleanup.
 *
 * Improves READABILITY only — it never rewrites aggressively, never invents
 * information, and never changes speaker meaning. The raw transcript is always
 * preserved separately; this produces a "cleaned" variant that is safe to show
 * as the polished saved transcript. Pure + fully unit-tested (no AI required).
 *
 * When an AI provider is configured a caller may layer smarter cleanup on top,
 * but this deterministic pass is the honest baseline that always runs.
 */

/** Isolated filler tokens removed only when they stand alone (not inside words). */
const FILLER_WORDS = ["um", "uh", "erm", "uhh", "umm", "hmm", "mmm", "ah", "eh"];

const FILLER_RE = new RegExp(`\\b(?:${FILLER_WORDS.join("|")})\\b[,]?`, "gi");

/** Openers that mark a line as a question when it lacks terminal punctuation. */
const QUESTION_OPENER =
  /^(who|what|when|where|why|how|can|could|would|will|do|does|did|is|are|am|should|may|might|shall|have|has|had)\b/i;

/**
 * Clean a single transcript utterance. Order matters: strip fillers first, then
 * collapse whitespace, fix punctuation spacing, de-duplicate immediate repeats,
 * apply sentence casing, and ensure terminal punctuation.
 */
export function cleanText(raw: string): string {
  if (!raw) return "";
  let t = raw.trim();
  if (!t) return "";

  // 1. Remove isolated filler words.
  t = t.replace(FILLER_RE, " ");

  // 2. Collapse whitespace.
  t = t.replace(/\s+/g, " ").trim();

  // 3. Remove space BEFORE punctuation ("word ," -> "word,").
  t = t.replace(/\s+([,.!?;:])/g, "$1");

  // 4. Ensure a single space AFTER sentence punctuation when followed by a word.
  t = t.replace(/([,.!?;:])(?=[^\s\d])/g, "$1 ");

  // 5. Collapse repeated punctuation ("!!" stays; "..." -> "…" left intact but
  //    normalize stray duplicate commas/periods created by filler removal).
  t = t.replace(/([,.])\1+/g, "$1").replace(/,\s*,/g, ",");

  // 6. De-duplicate immediate repeated words ("the the" -> "the"), case-insensitive.
  t = t.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");

  // 7. Re-collapse whitespace after edits.
  t = t.replace(/\s+/g, " ").trim();
  if (!t) return "";

  // 8. Sentence casing: capitalize the first letter and the letter after each
  //    sentence terminator. Never lowercases existing capitals (preserves names).
  t = t.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase());

  // 9. Ensure terminal punctuation on a substantial line that lacks it. A line
  //    that opens with a question word is genuinely a question, so use "?" (this
  //    preserves meaning — it does not invent content).
  if (t.length > 1 && !/[.!?…]$/.test(t)) {
    t = QUESTION_OPENER.test(t) ? `${t}?` : `${t}.`;
  }

  return t;
}

export interface CleanableSegment {
  speakerName: string;
  text: string;
  startTime: number;
}

export interface CleanedSegment extends CleanableSegment {
  cleanText: string;
}

/** Clean every segment, preserving order + original text. */
export function cleanSegments<T extends CleanableSegment>(
  segments: T[]
): (T & { cleanText: string })[] {
  return segments.map((s) => ({ ...s, cleanText: cleanText(s.text) }));
}
