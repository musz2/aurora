import {
  createClient,
  LiveTranscriptionEvents,
  type LiveClient,
} from "@deepgram/sdk";
import { env, hasDeepgram } from "../config/env.js";

export interface DeepgramTranscriptEvent {
  text: string;
  isFinal: boolean;
  speaker: string | null;
  start: number;
}

export interface DeepgramHandlers {
  onOpen: () => void;
  onTranscript: (e: DeepgramTranscriptEvent) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export interface LiveSttConnection {
  send: (chunk: Buffer) => void;
  finish: () => void;
  isOpen: () => boolean;
}

/**
 * Opens a Deepgram live transcription stream. Audio is sent as the browser's
 * MediaRecorder container (WebM/Opus) — Deepgram auto-detects the container, so
 * we intentionally do NOT pin encoding/sample_rate. Returns null when no key is
 * configured (caller must surface an honest "not configured" error — never fall
 * back to demo transcript during a real recording).
 */
export function createLiveTranscription(
  handlers: DeepgramHandlers
): LiveSttConnection | null {
  if (!hasDeepgram) return null;

  const deepgram = createClient(env.DEEPGRAM_API_KEY);
  let open = false;

  const connection: LiveClient = deepgram.listen.live({
    model: "nova-2",
    language: "en",
    smart_format: true,
    punctuate: true,
    interim_results: true,
    endpointing: 300,
    diarize: true,
    // No encoding/sample_rate/channels: the browser sends a WebM/Opus
    // container (from MediaRecorder), which Deepgram auto-detects.
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    open = true;
    handlers.onOpen();
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
    const alt = data?.channel?.alternatives?.[0];
    const text: string = alt?.transcript ?? "";
    if (!text) return;
    const isFinal = Boolean(data?.is_final);
    const speakerNum = alt?.words?.[0]?.speaker;
    handlers.onTranscript({
      text,
      isFinal,
      speaker: speakerNum != null ? `Speaker ${speakerNum + 1}` : null,
      start: data?.start ?? 0,
    });
  });

  connection.on(LiveTranscriptionEvents.Error, (err: any) => {
    handlers.onError(err?.message ?? "Deepgram stream error");
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    open = false;
    handlers.onClose();
  });

  return {
    send: (chunk: Buffer) => {
      if (!open) return;
      // Deepgram's send expects ArrayBuffer/Blob — hand it a clean ArrayBuffer
      // view of the Node Buffer.
      const ab = chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength
      ) as ArrayBuffer;
      connection.send(ab);
    },
    finish: () => {
      try {
        connection.requestClose();
      } catch {
        /* ignore */
      }
    },
    isOpen: () => open,
  };
}
