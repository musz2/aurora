import { hasDeepgram, hasOpenAI } from "../config/env.js";
import { HttpError } from "../utils/http.js";
import { TranscriptSimulator } from "./transcript.simulator.js";

export interface UploadedTranscriptSegment {
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number | null;
}

export interface UploadedTranscriptionResult {
  segments: UploadedTranscriptSegment[];
  durationSeconds: number;
}

export interface UploadedTranscriptionInput {
  filePath: string;
  mimeType: string;
  originalName: string;
}

export interface UploadedTranscriptionProvider {
  name: "demo" | "deepgram" | "openai";
  transcribe(input: UploadedTranscriptionInput): Promise<UploadedTranscriptionResult>;
}

class DemoUploadedTranscriptionProvider implements UploadedTranscriptionProvider {
  name = "demo" as const;

  async transcribe(): Promise<UploadedTranscriptionResult> {
    const sim = new TranscriptSimulator();
    const segments: UploadedTranscriptSegment[] = [];
    while (sim.hasMore()) {
      const seg = sim.next();
      segments.push({
        speakerName: seg.speakerName,
        text: seg.text,
        startTime: seg.startTime,
        endTime: seg.endTime,
        confidence: seg.confidence,
      });
    }

    return {
      segments,
      durationSeconds: Math.max(1, Math.ceil(segments.at(-1)?.endTime ?? 1)),
    };
  }
}

class DeepgramUploadedTranscriptionProvider implements UploadedTranscriptionProvider {
  name = "deepgram" as const;

  async transcribe(_input: UploadedTranscriptionInput): Promise<UploadedTranscriptionResult> {
    if (!hasDeepgram) {
      throw new HttpError(
        503,
        "Upload transcription is not configured. Set DEEPGRAM_API_KEY or use demo mode for sample output."
      );
    }
    throw new HttpError(
      501,
      "Deepgram upload transcription provider is not implemented yet. No simulated transcript was generated."
    );
  }
}

class OpenAIUploadedTranscriptionProvider implements UploadedTranscriptionProvider {
  name = "openai" as const;

  async transcribe(_input: UploadedTranscriptionInput): Promise<UploadedTranscriptionResult> {
    if (!hasOpenAI) {
      throw new HttpError(
        503,
        "Upload transcription is not configured. Set OPENAI_API_KEY or use demo mode for sample output."
      );
    }
    throw new HttpError(
      501,
      "OpenAI upload transcription provider is not implemented yet. No simulated transcript was generated."
    );
  }
}

export function createUploadedTranscriptionProvider(
  mode: "real" | "demo",
  preferredProvider: "deepgram" | "openai" = "deepgram"
): UploadedTranscriptionProvider {
  if (mode === "demo") return new DemoUploadedTranscriptionProvider();
  if (preferredProvider === "openai") return new OpenAIUploadedTranscriptionProvider();
  return new DeepgramUploadedTranscriptionProvider();
}
