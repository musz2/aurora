/**
 * Realistic meeting-line generator used when no speech API key is configured.
 * Deepgram/Whisper can be swapped in behind the same interface (a stream of
 * { speakerName, text } segments).
 */

const SPEAKERS = ["Mustafa Ali", "Shaibaz Ansari", "Ruknuddin Asrari", "Haseebuddin"];

const LINES = [
  "Alright, thanks everyone for joining. Let's start with a quick status update.",
  "On my side, the live transcription pipeline is stable and streaming cleanly.",
  "Great. What's the status on the AI summary generation?",
  "Summaries are working with the mock fallback, and OpenAI plugs in when the key is set.",
  "We should confirm the action items are being assigned to the right owners.",
  "Agreed. Let's make sure each task has a due date and a priority.",
  "What about the Kubernetes deployment for the recording workers?",
  "The Terraform config is ready; I'll run the Jenkins pipeline after this call.",
  "Can we get the Salesforce integration card working on the dashboard?",
  "Yes, it's a placeholder connect flow for now, but the UI is fully wired.",
  "Let's circle back on the consent modal — it must always be visible before recording.",
  "Correct, consent-first is non-negotiable. The recording indicator stays on at all times.",
  "For The Career Insights demo, we want cross-meeting search to feel instant.",
  "Search hits transcripts, summaries, and action items already.",
  "Perfect. Let's also draft the follow-up email automatically after each meeting.",
  "Done — Aurora generates it from the summary and the extracted action items.",
  "Any blockers before we wrap up?",
  "None from me. I'll share notes right after we end the recording.",
  "Same here. Let's reconvene at the next standup.",
  "Sounds good. Thanks everyone — ending the recording now.",
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
    const text = LINES[this.index % LINES.length];
    const speakerName = SPEAKERS[this.index % SPEAKERS.length];
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
