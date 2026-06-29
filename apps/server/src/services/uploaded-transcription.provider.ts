import fs from "node:fs";
import OpenAI from "openai";
import { env, hasDeepgram, hasOpenAI } from "../config/env.js";
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

/** Shape of OpenAI's `verbose_json` transcription response (segments + duration). */
interface WhisperVerboseJson {
  duration?: number;
  segments?: Array<{ start: number; end: number; text: string }>;
  text?: string;
}

class OpenAIUploadedTranscriptionProvider implements UploadedTranscriptionProvider {
  name = "openai" as const;

  async transcribe(
    input: UploadedTranscriptionInput
  ): Promise<UploadedTranscriptionResult> {
    if (!hasOpenAI) {
      throw new HttpError(
        503,
        "Upload transcription is not configured. Set OPENAI_API_KEY or use demo mode for sample output."
      );
    }
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    let result: WhisperVerboseJson;
    try {
      // Real batch transcription via Whisper. `verbose_json` yields timestamped
      // segments. Whisper does NOT diarize, so we honestly label a single speaker
      // rather than fabricating speaker turns.
      result = (await client.audio.transcriptions.create({
        file: fs.createReadStream(input.filePath),
        model: "whisper-1",
        response_format: "verbose_json",
      })) as unknown as WhisperVerboseJson;
    } catch (err) {
      throw new HttpError(
        502,
        `Upload transcription failed via OpenAI Whisper: ${
          err instanceof Error ? err.message : "unknown error"
        }. No simulated transcript was generated.`
      );
    }

    const rawSegments = result.segments ?? [];
    const segments: UploadedTranscriptSegment[] = rawSegments.length
      ? rawSegments.map((s) => ({
          speakerName: "Speaker 1",
          text: s.text.trim(),
          startTime: s.start,
          endTime: s.end,
          confidence: null,
        }))
      : result.text
        ? [
            {
              speakerName: "Speaker 1",
              text: result.text.trim(),
              startTime: 0,
              endTime: result.duration ?? 0,
              confidence: null,
            },
          ]
        : [];

    if (segments.length === 0) {
      throw new HttpError(
        502,
        "OpenAI Whisper returned no transcript for this file. No simulated transcript was generated."
      );
    }

    return {
      segments,
      durationSeconds: Math.max(
        1,
        Math.ceil(result.duration ?? segments.at(-1)?.endTime ?? 1)
      ),
    };
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
