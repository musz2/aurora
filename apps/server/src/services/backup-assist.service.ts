import {
  COMMON_QA,
  getJobPack,
  packEntries,
  JOB_PACKS,
  type QAEntry,
} from "@aurora/shared";

/**
 * Backup Assist service.
 *
 * Reliability/preparation support for the PUBLIC shared session. It uses only
 * public shared content, manually entered viewer context, and built-in role
 * guidance. It never touches host private copilot data, private prompts, or
 * private notes, and it never publishes. When an AI provider is unavailable it
 * falls back to the offline knowledge packs. Pure helpers here are unit-tested.
 */

export interface BackupAssistResult {
  answer: string;
  talkingPoints: string[];
  followUpQuestion: string;
  confidence: "low" | "medium" | "high";
  providerStatus: "ai" | "offline";
  createdAt: string;
}

/** Map a free-text job type (title or id) to a knowledge pack id, if any. */
export function resolveJobPackId(jobType: string | undefined): string | undefined {
  const t = (jobType ?? "").trim().toLowerCase();
  if (!t) return undefined;
  const byId = JOB_PACKS.find((p) => p.id === t);
  if (byId) return byId.id;
  const byTitle = JOB_PACKS.find(
    (p) => p.title.toLowerCase() === t || p.title.toLowerCase().includes(t) || t.includes(p.title.toLowerCase())
  );
  return byTitle?.id;
}

const STOP = new Set([
  "the","a","an","of","to","and","or","in","on","for","with","how","what","why","is","are",
  "do","you","your","i","we","it","this","that","can","could","would","should","me","my","about",
]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Find the best-matching offline Q&A entry for the viewer's context, scored by
 * keyword overlap with each entry's question. Falls back to a common entry.
 */
export function findOfflineEntry(jobType: string | undefined, context: string): QAEntry | null {
  const packId = resolveJobPackId(jobType);
  const pack = packId ? getJobPack(packId) : undefined;
  const entries = pack ? packEntries(pack) : COMMON_QA;
  const ctx = new Set(tokens(context));
  if (ctx.size === 0) {
    // No context: return the pack's most representative technical entry, else first.
    return entries.find((e) => e.category === "Technical") ?? entries[0] ?? null;
  }
  let best: QAEntry | null = null;
  let bestScore = 0;
  for (const e of entries) {
    const qt = tokens(e.question);
    let score = 0;
    for (const w of qt) if (ctx.has(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best ?? entries[0] ?? null;
}

/**
 * Deterministic offline Backup Assist answer from the knowledge packs. Used when
 * no AI provider is configured, so the feature always works.
 */
export function buildOfflineBackup(params: {
  jobType?: string;
  experienceLevel?: string;
  manualContext: string;
  actionType?: string;
  now?: Date;
}): BackupAssistResult {
  const entry = findOfflineEntry(params.jobType, params.manualContext);
  const level = (params.experienceLevel ?? "10+ years").trim();
  const answer =
    entry?.answer ??
    "Frame your response around your senior experience: state the situation, the action you owned, and the measurable outcome.";
  const talkingPoints =
    entry?.keyPoints && entry.keyPoints.length
      ? entry.keyPoints
      : [
          `Answer from a ${level} perspective — lead with ownership and outcomes.`,
          "Give a concrete example with a measurable result.",
          "State the tradeoff or risk you weighed.",
        ];
  return {
    answer,
    talkingPoints,
    followUpQuestion:
      entry?.category === "Behavioral"
        ? "Would a specific example from a past project help illustrate this?"
        : "Want me to go deeper on the technical tradeoffs here?",
    confidence: entry ? "medium" : "low",
    providerStatus: "offline",
    createdAt: (params.now ?? new Date()).toISOString(),
  };
}

/** Resolve the question text to send to the AI path from action + context. */
export function backupQuestion(actionType: string | undefined, manualContext: string): string {
  const ctx = manualContext.trim();
  switch (actionType) {
    case "talking_points":
      return `Give senior-level talking points for: ${ctx}`;
    case "simplify":
      return `Explain this simply for the listener: ${ctx}`;
    case "follow_up":
      return `Draft a strong follow-up question for: ${ctx}`;
    case "summarize":
      return `Summarize this context concisely: ${ctx}`;
    case "action_items":
      return `Extract clear action items from: ${ctx}`;
    case "interview_answer":
      return `Give a confident, senior interview-style answer to: ${ctx}`;
    case "answer":
    default:
      return ctx || "Give a helpful senior-level response.";
  }
}
