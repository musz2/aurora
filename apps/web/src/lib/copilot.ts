/**
 * Private Copilot shared types + helpers.
 *
 * The copilot is HOST-ONLY and private by default. Nothing here is ever sent to
 * the shared viewer; "Publish to Transcript" is an explicit, confirmed host
 * action. Tone transforms below are honest LOCAL text formatting (not AI) so the
 * UI can offer quick rewrites without faking a model call.
 */

export type Confidence = "low" | "medium" | "high";

export type CopilotIntent = "answer" | "answer_now" | "summarize_recent" | "next_step";

/** Structured suggestion as emitted by the server socket (`ai:suggestion`). */
export interface CopilotSuggestion {
  id: string;
  question: string;
  configured: boolean;
  mode?: string;
  intent?: CopilotIntent;
  confidence?: Confidence;
  /** Readable fallback string (always present). */
  suggestion: string;
  /** Rich structured payload (present for Loop 3+ server). */
  structured?: {
    answer: string;
    talkingPoints: string[];
    followUpQuestion: string;
    risk: string;
    nextStep: string;
    confidence: Confidence;
  };
}

/** UI-facing copilot modes → server assistant modes. */
export const COPILOT_MODES = [
  "Meeting",
  "Interview Practice",
  "Sales Call",
  "Tech Q&A",
  "Custom",
] as const;
export type CopilotMode = (typeof COPILOT_MODES)[number];

export function toAssistantMode(mode: CopilotMode): string {
  switch (mode) {
    case "Interview Practice":
      return "Interview";
    case "Sales Call":
      return "Sales Call";
    case "Tech Q&A":
      return "Technical Meeting";
    case "Meeting":
    case "Custom":
    default:
      return "General Meeting";
  }
}

/** Answer depth derived from a structured suggestion. */
export function quickReply(s: CopilotSuggestion): string {
  return s.structured?.answer ?? firstSentence(s.suggestion);
}

export function strongAnswer(s: CopilotSuggestion): string {
  if (!s.structured) return s.suggestion;
  const points = s.structured.talkingPoints.map((p) => `• ${p}`).join("\n");
  return `${s.structured.answer}\n${points}`;
}

export function deepAnswer(s: CopilotSuggestion): string {
  if (!s.structured) return s.suggestion;
  const st = s.structured;
  const points = st.talkingPoints.map((p) => `• ${p}`).join("\n");
  return [
    st.answer,
    "",
    "Talking points:",
    points,
    "",
    `Follow-up: ${st.followUpQuestion}`,
    `Watch out: ${st.risk}`,
    `Next step: ${st.nextStep}`,
  ].join("\n");
}

function firstSentence(text: string): string {
  const match = text.split(/(?<=[.!?])\s/)[0];
  return match || text;
}

/* ----------------------------- tone transforms ----------------------------- */
/* Local, deterministic formatting helpers (clearly not AI). */

export function shorten(text: string): string {
  const firstLine = text.split("\n").find((l) => l.trim()) ?? text;
  return firstSentence(firstLine.replace(/^•\s*/, "").trim());
}

export function makeProfessional(text: string): string {
  const body = text.split("\n").filter((l) => l.trim() && !l.endsWith(":"));
  const core = body[0]?.replace(/^•\s*/, "").trim() ?? text;
  return `Thank you — to make sure I address this clearly: ${lowerFirst(core)} I'm happy to follow up with any detail you need.`;
}

export function explainSimply(text: string): string {
  const core = (text.split("\n").find((l) => l.trim()) ?? text)
    .replace(/^•\s*/, "")
    .trim();
  return `In simple terms: ${lowerFirst(core)}`;
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export const TONE_TRANSFORMS: { label: string; fn: (t: string) => string }[] = [
  { label: "Shorten", fn: shorten },
  { label: "Make Professional", fn: makeProfessional },
  { label: "Explain Simply", fn: explainSimply },
];
