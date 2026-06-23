/**
 * DEMO-ONLY sample transcript generator. This is used solely for the explicit
 * "demo mode" of the live console and for seeded sample history — it is NEVER
 * used during a real recording session. Real sessions use Deepgram live STT.
 */

export const DEMO_SPEAKERS = [
  "Justin Carter",
  "Pat Reynolds",
  "Emily Brooks",
  "Rachel Morgan",
];

const LINES: [string, string][] = [
  ["Justin Carter", "Alright, thanks everyone for joining. Let's start with a quick status update."],
  ["Pat Reynolds", "On my side, the live transcription pipeline is stable and streaming cleanly."],
  ["Emily Brooks", "Great. What's the status on the AI summary generation?"],
  ["Rachel Morgan", "Summaries are working with the mock fallback, and OpenAI connects when the key is configured."],
  ["Justin Carter", "We should confirm the action items are being assigned to the right owners."],
  ["Pat Reynolds", "Agreed. Let's make sure each task has a due date and a priority."],
  ["Emily Brooks", "What about the Kubernetes deployment for the recording workers?"],
  ["Rachel Morgan", "The Terraform config is ready; I'll run the Jenkins pipeline after this call."],
  ["Justin Carter", "Can we get the Salesforce integration card working on the dashboard?"],
  ["Pat Reynolds", "Yes, it's a placeholder connect flow for now, but the UI is fully wired."],
  ["Emily Brooks", "Let's circle back on the consent modal — it must always be visible before recording."],
  ["Rachel Morgan", "Correct, consent-first is non-negotiable. The recording indicator stays on at all times."],
];

export interface SimulatedSegment {
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export class TranscriptSimulator {
  private index = 0;
  private elapsed = 0;

  next(): SimulatedSegment {
    const [speakerName, text] = LINES[this.index % LINES.length];
    const dur = 4 + Math.random() * 4;
    const seg: SimulatedSegment = {
      speakerName,
      text,
      startTime: this.elapsed,
      endTime: this.elapsed + dur,
      confidence: 0.9 + Math.random() * 0.09,
    };
    this.elapsed += dur;
    this.index += 1;
    return seg;
  }

  hasMore(): boolean {
    return this.index < LINES.length;
  }
}
