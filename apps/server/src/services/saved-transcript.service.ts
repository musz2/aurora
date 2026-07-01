import { cleanText } from "./transcript-cleanup.service.js";

/**
 * Saved transcript artifact builder.
 *
 * Assembles a clean, structured, professional record of a meeting/interview from
 * already-persisted data ONLY: transcript segments, the public summary, action
 * items, and host-published answers. It never reads private copilot drafts,
 * prompts, or notes — so this artifact is safe for host export and (with the
 * public subset) for the shared viewer. Pure + unit-tested.
 */

export interface SavedSegmentInput {
  speakerName: string;
  text: string;
  cleanText?: string | null;
  startTime: number;
}

export interface SavedTranscriptInput {
  title: string;
  source: string;
  durationSeconds: number;
  dateISO: string;
  segments: SavedSegmentInput[];
  summary?: {
    overview: string;
    keyPoints: string[];
    decisions: string[];
  } | null;
  actionItems?: { task: string; assigneeName?: string | null; dueDate?: string | null }[];
  publishedAnswers?: { text: string; publishedBy: string; createdAt: string }[];
}

export interface SavedLine {
  speakerName: string;
  timestamp: string;
  text: string;
}

export interface SavedQnA {
  question: string;
  answer: string;
  timestamp: string;
}

export interface SavedTranscript {
  title: string;
  source: string;
  dateISO: string;
  durationSeconds: number;
  durationLabel: string;
  speakers: string[];
  rawTranscript: SavedLine[];
  cleanTranscript: SavedLine[];
  summary: string | null;
  keyPoints: string[];
  qna: SavedQnA[];
  decisions: string[];
  actionItems: { task: string; assignee: string | null; due: string | null }[];
  publishedAnswers: { text: string; publishedBy: string; createdAt: string }[];
}

/** mm:ss (or hh:mm:ss past an hour) timestamp from seconds. */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(h > 0 ? m : m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

function durationLabel(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} seconds`;
  const mins = Math.round(seconds / 60);
  return `${mins} minute${mins === 1 ? "" : "s"}`;
}

const isQuestion = (t: string) => t.trim().endsWith("?");

/**
 * Deterministic Q&A pairing: each question segment is paired with the next
 * segment (from a different speaker when possible) as its answer. Never invents
 * an answer — if nothing follows, the pair is skipped.
 */
function deriveQnA(clean: SavedLine[]): SavedQnA[] {
  const qna: SavedQnA[] = [];
  for (let i = 0; i < clean.length && qna.length < 10; i++) {
    const line = clean[i];
    if (!isQuestion(line.text)) continue;
    // Prefer the next line from a different speaker as the answer.
    let answer: SavedLine | undefined;
    for (let j = i + 1; j < clean.length; j++) {
      if (clean[j].speakerName !== line.speakerName) {
        answer = clean[j];
        break;
      }
    }
    answer = answer ?? clean[i + 1];
    if (!answer) continue;
    qna.push({ question: line.text, answer: answer.text, timestamp: line.timestamp });
  }
  return qna;
}

export function buildSavedTranscript(input: SavedTranscriptInput): SavedTranscript {
  const raw: SavedLine[] = input.segments.map((s) => ({
    speakerName: s.speakerName,
    timestamp: formatTimestamp(s.startTime),
    text: s.text,
  }));
  const clean: SavedLine[] = input.segments.map((s) => ({
    speakerName: s.speakerName,
    timestamp: formatTimestamp(s.startTime),
    text: (s.cleanText && s.cleanText.trim()) || cleanText(s.text),
  }));

  const speakers: string[] = [];
  for (const s of input.segments) {
    if (!speakers.includes(s.speakerName)) speakers.push(s.speakerName);
  }

  return {
    title: input.title,
    source: input.source,
    dateISO: input.dateISO,
    durationSeconds: input.durationSeconds,
    durationLabel: durationLabel(input.durationSeconds),
    speakers,
    rawTranscript: raw,
    cleanTranscript: clean,
    summary: input.summary?.overview ?? null,
    keyPoints: input.summary?.keyPoints ?? [],
    qna: deriveQnA(clean),
    decisions: input.summary?.decisions ?? [],
    actionItems: (input.actionItems ?? []).map((a) => ({
      task: a.task,
      assignee: a.assigneeName ?? null,
      due: a.dueDate ? String(a.dueDate).slice(0, 10) : null,
    })),
    publishedAnswers: (input.publishedAnswers ?? []).map((p) => ({
      text: p.text,
      publishedBy: p.publishedBy,
      createdAt: p.createdAt,
    })),
  };
}

/** Render the saved transcript to a polished Markdown document. */
export function renderSavedTranscriptMarkdown(t: SavedTranscript): string {
  const date = (() => {
    const d = new Date(t.dateISO);
    return Number.isNaN(d.getTime())
      ? t.dateISO
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  })();

  const lines: string[] = [];
  lines.push(`# Meeting Transcript`, "");
  lines.push(`**Meeting:** ${t.title}  `);
  lines.push(`**Date:** ${date}  `);
  lines.push(`**Duration:** ${t.durationLabel}  `);
  lines.push(`**Source:** ${t.source}  `, "");

  lines.push(`## Summary`);
  lines.push(t.summary ?? "_No summary available. Configure an AI provider to generate one._", "");

  if (t.speakers.length) {
    lines.push(`## Speakers`);
    for (const s of t.speakers) lines.push(`- ${s}`);
    lines.push("");
  }

  lines.push(`## Clean Transcript`);
  if (t.cleanTranscript.length === 0) {
    lines.push("_No transcript captured._", "");
  } else {
    for (const l of t.cleanTranscript) {
      lines.push(`**${l.speakerName} · ${l.timestamp}**  `, l.text, "");
    }
  }

  if (t.qna.length) {
    lines.push(`## Key Questions & Answers`);
    t.qna.forEach((q, i) => {
      lines.push(`**Q${i + 1}. ${q.question}**  `);
      lines.push(`**Answer:** ${q.answer}  `);
      lines.push(`**Timestamp:** ${q.timestamp}`, "");
    });
  }

  if (t.decisions.length) {
    lines.push(`## Decisions / Outcome`);
    for (const d of t.decisions) lines.push(`- ${d}`);
    lines.push("");
  }

  if (t.actionItems.length) {
    lines.push(`## Action Items`);
    for (const a of t.actionItems) {
      const meta = [a.assignee ? `(${a.assignee})` : "", a.due ? `due ${a.due}` : ""]
        .filter(Boolean)
        .join(" ");
      lines.push(`- ${a.task}${meta ? ` ${meta}` : ""}`);
    }
    lines.push("");
  }

  if (t.publishedAnswers.length) {
    lines.push(`## Host Shared Answers`);
    for (const p of t.publishedAnswers) lines.push(`- ${p.text} — _${p.publishedBy}_`);
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
