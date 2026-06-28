import { hasOpenAI } from "../config/env.js";
import {
  extractActionItems,
  generateMeetingSummary,
  type ExtractedActionItem,
  type SummaryResult,
  type TranscriptLine,
} from "./ai.service.js";

/**
 * Meeting finalization service.
 *
 * Centralizes the "stop -> review -> save" generation step. When a real AI key
 * is configured we use it; otherwise, for explicitly demo/mock meetings, we fall
 * back to clearly-labeled sample output. We never fabricate "real AI" results —
 * the `source` field tells the UI exactly what it is looking at.
 */

export type FinalizationSource = "ai" | "mock" | "unavailable";

export interface SpeakerSummary {
  speakerName: string;
  segmentCount: number;
  share: number; // 0..1 portion of total segments
}

export interface FinalizationResult {
  source: FinalizationSource;
  mock: boolean;
  /** Human-readable label the UI can show verbatim. */
  label: string;
  summary: SummaryResult;
  actionItems: ExtractedActionItem[];
  speakerSummaries: SpeakerSummary[];
  questions: string[];
  durationSeconds: number;
}

/**
 * Decide which generation path applies. Pure + exported so the UI and tests can
 * reason about it without invoking the model.
 */
export function finalizationSource(opts: {
  hasAI: boolean;
  demoMode: boolean;
}): FinalizationSource {
  if (opts.hasAI) return "ai";
  if (opts.demoMode) return "mock";
  return "unavailable";
}

export function finalizationLabel(source: FinalizationSource): string {
  switch (source) {
    case "ai":
      return "Generated with Aurora AI";
    case "mock":
      return "Demo / mock output — not real AI. Configure OPENAI_API_KEY for live analysis.";
    case "unavailable":
      return "AI not configured. Connect OPENAI_API_KEY to finalize this real meeting.";
  }
}

/** Per-speaker segment counts, sorted by participation. Pure. */
export function summarizeSpeakers(
  transcript: TranscriptLine[]
): SpeakerSummary[] {
  const total = transcript.length;
  const counts = new Map<string, number>();
  for (const line of transcript) {
    counts.set(line.speakerName, (counts.get(line.speakerName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([speakerName, segmentCount]) => ({
      speakerName,
      segmentCount,
      share: total > 0 ? segmentCount / total : 0,
    }))
    .sort((a, b) => b.segmentCount - a.segmentCount);
}

/** Questions asked during the meeting (lines ending in '?'). Pure. */
export function extractTranscriptQuestions(
  transcript: TranscriptLine[]
): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];
  for (const line of transcript) {
    for (const sentence of line.text.split(/(?<=[?])\s+/)) {
      const trimmed = sentence.trim();
      if (trimmed.endsWith("?") && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        questions.push(trimmed);
      }
    }
  }
  return questions.slice(0, 12);
}

/**
 * Run the full finalization. Throws (via ai.service) for real meetings when AI
 * is not configured, so callers can surface an honest error instead of faking it.
 */
export async function finalizeMeeting(params: {
  title: string;
  transcript: TranscriptLine[];
  vocabulary?: string[];
  demoMode: boolean;
  durationSeconds?: number;
}): Promise<FinalizationResult> {
  const source = finalizationSource({ hasAI: hasOpenAI, demoMode: params.demoMode });
  const options = { demoMode: params.demoMode };

  const [summary, actionItems] = await Promise.all([
    generateMeetingSummary(
      params.title,
      params.transcript,
      params.vocabulary ?? [],
      options
    ),
    extractActionItems(params.transcript, options),
  ]);

  return {
    source,
    mock: source === "mock",
    label: finalizationLabel(source),
    summary,
    actionItems,
    speakerSummaries: summarizeSpeakers(params.transcript),
    questions: extractTranscriptQuestions(params.transcript),
    durationSeconds: params.durationSeconds ?? 0,
  };
}
