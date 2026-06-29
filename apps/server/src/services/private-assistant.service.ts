/**
 * Private assistant service (host-only copilot).
 *
 * Pure logic for Aurora's Cluely-style live assistant: meeting modes, trigger
 * intents, and a STRUCTURED suggestion (direct answer + talking points + follow-up
 * question + risk + next step + confidence). Everything here is host-only; nothing
 * produced here is ever exposed to the shared viewer (see shared-viewer.service).
 *
 * This module is deliberately consent-first and non-stealth: it never suggests
 * hiding the recording, disabling indicators, or evading participants.
 */

export const ASSISTANT_MODES = [
  "Interview",
  "Sales Call",
  "Technical Meeting",
  "Client Call",
  "Daily Standup",
  "Recruiting",
  "General Meeting",
] as const;

export type AssistantMode = (typeof ASSISTANT_MODES)[number];

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/** Trigger intents the host can invoke (manual, keyboard, or auto-detected). */
export type AssistantIntent =
  | "answer" // default Q&A
  | "answer_now" // "give me the answer now"
  | "summarize_recent" // "summarize the last 2 minutes"
  | "next_step"; // "what should I say next?"

export interface DetectedQuestion {
  question: string;
  confidence: number;
}

export interface AssistantContext {
  meetingTitle?: string;
  speakerNames?: string[];
  recentTranscript?: string;
  privateNotes?: string[];
  vocabulary?: string[];
  priorContext?: string;
}

export interface StructuredSuggestion {
  mode: AssistantMode;
  intent: AssistantIntent;
  question: string;
  /** One-line direct answer the host can say. */
  answer: string;
  /** 2-4 short talking points. */
  talkingPoints: string[];
  /** A useful follow-up question to ask. */
  followUpQuestion: string;
  /** A risk / caution to keep in mind. */
  risk: string;
  /** Concrete suggested next step. */
  nextStep: string;
  confidence: Confidence;
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
  "General Meeting":
    "Be clear and concise: answer directly, keep the group aligned, and confirm the next action and owner.",
};

const MODE_TALKING_POINTS: Record<AssistantMode, string[]> = {
  Interview: [
    "State the situation and your specific role briefly.",
    "Describe the action you took and why.",
    "Close with the measurable outcome.",
  ],
  "Sales Call": [
    "Reflect the customer's stated need back to them.",
    "Connect the answer to concrete business value.",
    "Offer proof (case study / pilot) and a next step.",
  ],
  "Technical Meeting": [
    "Give the direct technical answer first.",
    "Name the main tradeoff and any unknown.",
    "Propose a measurable validation or spike.",
  ],
  "Client Call": [
    "Confirm the expectation in plain language.",
    "Give a realistic timeline with an owner.",
    "Commit to a written recap after the call.",
  ],
  "Daily Standup": [
    "Yesterday's progress in one line.",
    "Today's focus in one line.",
    "Name the blocker and who can unblock it.",
  ],
  Recruiting: [
    "Answer the candidate's question directly.",
    "Tie it back to the role and team.",
    "Invite their next question to keep it a conversation.",
  ],
  "General Meeting": [
    "Give a clear, direct answer.",
    "Keep the group aligned on the goal.",
    "Confirm the next action and its owner.",
  ],
};

const MODE_RISK: Record<AssistantMode, string> = {
  Interview: "Avoid rambling — keep the answer structured and time-boxed.",
  "Sales Call": "Don't overpromise capabilities or timelines you can't back up.",
  "Technical Meeting": "Flag assumptions explicitly so they aren't treated as facts.",
  "Client Call": "Avoid committing to dates or scope without confirming internally.",
  "Daily Standup": "Don't let a blocker pass without naming an owner.",
  Recruiting: "Stay compliant — avoid questions/claims that aren't role-relevant.",
  "General Meeting": "Make sure a decision has a clear owner before moving on.",
};

export function normalizeAssistantMode(mode?: string): AssistantMode {
  return ASSISTANT_MODES.find((m) => m === mode) ?? "Technical Meeting";
}

/**
 * Map a host's raw ask to a trigger intent. Recognizes the special commands
 * ("summarize the last 2 minutes", "what should I say next", "give me the answer
 * now") and otherwise treats it as a normal question.
 */
export function parseAssistantIntent(raw: string): AssistantIntent {
  const t = raw.toLowerCase();
  if (/summari[sz]e.*(last|past).*(min|minute|2|two)/.test(t) || /recap.*(last|past)/.test(t)) {
    return "summarize_recent";
  }
  if (/what.*(should|do).*(i|we).*say|say next|what.*next/.test(t)) {
    return "next_step";
  }
  if (/(answer|tell me).*(now|right now|immediately)|give me.*(answer|response)/.test(t)) {
    return "answer_now";
  }
  return "answer";
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

function answerStem(question: string, mode: AssistantMode) {
  const q = question.replace(/\?+$/, "").toLowerCase();
  if (mode === "Sales Call")
    return `we can support ${q} by starting with the highest-impact use case and proving value in a pilot`;
  if (mode === "Interview" || mode === "Recruiting")
    return `my approach is to clarify the goal, choose the simplest reliable path, and communicate the tradeoffs early`;
  if (mode === "Daily Standup")
    return `the status is on track; name the main blocker explicitly and confirm the next owner`;
  if (mode === "Client Call")
    return `let's confirm the expectation, give a realistic timeline, and send a written recap`;
  if (mode === "General Meeting")
    return `here's the short answer, and let's confirm the owner and next step before we move on`;
  return `the safest path is to validate assumptions, isolate the dependency, and agree on a measurable next step`;
}

/** Confidence from how much grounding context we have + question explicitness. */
function deriveConfidence(question: string, context?: AssistantContext): Confidence {
  const hasContext = Boolean(context?.recentTranscript?.trim());
  const explicit = question.trim().endsWith("?");
  if (hasContext && explicit) return "high";
  if (hasContext || explicit) return "medium";
  return "low";
}

function recentLines(context?: AssistantContext): string[] {
  return (context?.recentTranscript ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-4);
}

/**
 * Build a fully structured suggestion deterministically (no model). Used directly
 * in demo / no-key mode and as the fallback for the real generator. Honest: this
 * is labelled mock output by the caller.
 */
export function buildStructuredSuggestion(params: {
  mode: AssistantMode;
  question: string;
  intent?: AssistantIntent;
  context?: AssistantContext;
}): StructuredSuggestion {
  const mode = params.mode;
  const intent = params.intent ?? "answer";
  const context = params.context;
  const question = params.question.trim() || "(no question)";

  if (intent === "summarize_recent") {
    const lines = recentLines(context);
    return {
      mode,
      intent,
      question: "Summarize the last few minutes",
      answer: lines.length
        ? `Recent recap: ${lines.join(" ").slice(0, 240)}`
        : "There isn't enough recent transcript yet to summarize.",
      talkingPoints: lines.length ? lines : ["Waiting for more conversation to summarize."],
      followUpQuestion: "Did I capture the main points correctly?",
      risk: "This recap covers only the most recent audio, not the whole meeting.",
      nextStep: "Confirm the recap, then move to the next agenda item.",
      confidence: lines.length ? "medium" : "low",
    };
  }

  if (intent === "next_step") {
    return {
      mode,
      intent,
      question: "What should I say next?",
      answer: `Suggested next move: ${answerStem(question, mode)}.`,
      talkingPoints: MODE_TALKING_POINTS[mode],
      followUpQuestion: "Does that direction work for everyone?",
      risk: MODE_RISK[mode],
      nextStep: "State the next action and confirm who owns it.",
      confidence: deriveConfidence(question, context),
    };
  }

  // answer / answer_now
  return {
    mode,
    intent,
    answer: `${answerStem(question, mode)}.`,
    question,
    talkingPoints: MODE_TALKING_POINTS[mode],
    followUpQuestion:
      mode === "Interview" || mode === "Recruiting"
        ? "Would it help if I walked through a specific example?"
        : "Want me to confirm the owner and timing for this?",
    risk: MODE_RISK[mode],
    nextStep: "Confirm the owner and a date for the follow-up.",
    confidence:
      intent === "answer_now"
        ? "high"
        : deriveConfidence(question, context),
  };
}

/** Render a structured suggestion to a readable, copy-pasteable string. */
export function renderSuggestionText(s: StructuredSuggestion): string {
  const points = s.talkingPoints.map((p) => `  • ${p}`).join("\n");
  return [
    `Answer: ${s.answer}`,
    `Talking points:\n${points}`,
    `Follow-up: ${s.followUpQuestion}`,
    `Risk: ${s.risk}`,
    `Next step: ${s.nextStep}`,
    `Confidence: ${s.confidence}`,
  ].join("\n");
}

/**
 * Backwards-compatible mock suggestion: returns a readable string built from the
 * structured generator, including the mode guidance for context.
 */
export function generateMockPrivateSuggestion(params: {
  mode: AssistantMode;
  question: string;
  transcriptContext?: string;
  intent?: AssistantIntent;
}): string {
  const structured = buildStructuredSuggestion({
    mode: params.mode,
    question: params.question,
    intent: params.intent,
    context: { recentTranscript: params.transcriptContext },
  });
  return `${MODE_GUIDANCE[params.mode]}\n${renderSuggestionText(structured)}`;
}
