export const ASSISTANT_MODES = [
  "Interview",
  "Sales Call",
  "Technical Meeting",
  "Client Call",
  "Daily Standup",
  "Recruiting",
] as const;

export type AssistantMode = (typeof ASSISTANT_MODES)[number];

export interface DetectedQuestion {
  question: string;
  confidence: number;
}

const MODE_GUIDANCE: Record<AssistantMode, string> = {
  Interview:
    "Answer with a concise STAR-style structure: context, action, outcome, and a clarifying follow-up if useful.",
  "Sales Call":
    "Acknowledge the business need, tie the answer to value, mention proof or next step, and avoid overpromising.",
  "Technical Meeting":
    "Lead with the technical answer, state tradeoffs, call out unknowns, and propose a concrete validation step.",
  "Client Call":
    "Be calm, specific, client-safe, and frame the next step with ownership and timing.",
  "Daily Standup":
    "Keep it short: yesterday, today, blocker, owner, and expected unblock path.",
  Recruiting:
    "Be warm and structured: answer directly, connect to role fit, and invite the next question.",
};

export function normalizeAssistantMode(mode?: string): AssistantMode {
  return ASSISTANT_MODES.find((m) => m === mode) ?? "Technical Meeting";
}

export function detectQuestions(text: string): DetectedQuestion[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const pieces = trimmed
    .split(/(?<=[?])\s+|(?<=\.)\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return pieces
    .filter((piece) => {
      const lower = piece.toLowerCase();
      return (
        piece.includes("?") ||
        /^(can|could|would|will|what|why|how|when|where|who|do|does|did|is|are|should)\b/.test(lower)
      );
    })
    .map((question) => ({
      question: question.endsWith("?") ? question : `${question}?`,
      confidence: question.includes("?") ? 0.95 : 0.72,
    }));
}

export function generateMockPrivateSuggestion(params: {
  mode: AssistantMode;
  question: string;
  transcriptContext?: string;
}) {
  const contextHint = params.transcriptContext
    ? ` Reference the recent context only if it helps: ${params.transcriptContext.slice(-180)}`
    : "";
  return `${MODE_GUIDANCE[params.mode]} Suggested answer: “Here is the short version: ${answerStem(
    params.question,
    params.mode
  )}. I can take the follow-up and confirm the owner/date after this call.”${contextHint ? ` ${contextHint}` : ""}`;
}

function answerStem(question: string, mode: AssistantMode) {
  const q = question.replace(/\?+$/, "").toLowerCase();
  if (mode === "Sales Call") return `we can support ${q} by starting with the highest-impact use case and proving value in a pilot`;
  if (mode === "Interview" || mode === "Recruiting") return `my approach would be to clarify the goal, choose the simplest reliable path, and communicate the tradeoffs early`;
  if (mode === "Daily Standup") return `the current status is on track, the main blocker should be named explicitly, and the next owner should be confirmed`;
  if (mode === "Client Call") return `we should confirm the expectation, give a realistic timeline, and send a written recap`;
  return `the safest technical path is to validate assumptions, isolate the dependency, and agree on a measurable next step`;
}
