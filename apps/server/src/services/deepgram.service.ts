import {
  createClient,
  LiveTranscriptionEvents,
  type LiveClient,
} from "@deepgram/sdk";
import { env, hasDeepgram } from "../config/env.js";

/** How long to wait for Deepgram's `Open` event before timing out. */
const DEEPGRAM_OPEN_TIMEOUT_MS = 20_000;

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
  onClose: (reason: string) => void;
}

export interface LiveSttConnection {
  send: (chunk: Buffer) => void;
  finish: () => void;
  isOpen: () => boolean;
}

const log = (...a: unknown[]) => console.info("[deepgram]", ...a);
const warn = (...a: unknown[]) => console.warn("[deepgram]", ...a);

/**
 * Opens a Deepgram live transcription stream.
 *
 * Critical detail: the browser's MediaRecorder emits a WebM/Opus stream whose
 * initialization header lives in the FIRST chunk. Audio chunks can arrive over
 * our WebSocket before Deepgram's `Open` event fires. If we dropped those early
 * chunks we'd lose the header and Deepgram would decode nothing (0 events, then
 * an idle close). So we BUFFER chunks until open and flush them in order, then
 * keep the stream alive with periodic KeepAlive messages.
 *
 * Returns null when no key is configured — callers must surface an honest
 * "not configured" error and never fall back to demo transcript.
 */
export function createLiveTranscription(
  handlers: DeepgramHandlers
): LiveSttConnection | null {
  if (!hasDeepgram) {
    log("DEEPGRAM_API_KEY not configured — live STT unavailable");
    return null;
  }

  log("initializing SDK + live connection (nova-2, en, webm/opus auto-detect)");
  const deepgram = createClient(env.DEEPGRAM_API_KEY);

  log("calling deepgram.listen.live()…");
  const connection: LiveClient = deepgram.listen.live({
    model: "nova-2",
    language: "en",
    smart_format: false, // Disabled for lower latency (adds ~100ms processing delay)
    punctuate: true,
    interim_results: true,
    endpointing: 200, // fast finalization after a short pause
    vad_events: true,
    // No encoding/sample_rate/channels: the browser sends a WebM/Opus container
    // (from MediaRecorder), which Deepgram auto-detects.
  });
  log("deepgram.listen.live() returned");

  let open = false;
  let closed = false;
  const pending: Buffer[] = [];
  let keepAlive: NodeJS.Timeout | null = null;
  let openTimeoutTimer: NodeJS.Timeout | null = null;
  let openFired = false;

  const flushPending = () => {
    if (pending.length) {
      log(`flushing ${pending.length} buffered audio chunk(s) (${pending.reduce((s, c) => s + c.length, 0)} bytes)`);
    }
    while (pending.length) {
      const chunk = pending.shift()!;
      try {
        connection.send(toArrayBuffer(chunk));
      } catch (e) {
        warn("flush send failed:", (e as Error).message);
      }
    }
  };

  connection.on(LiveTranscriptionEvents.Open, () => {
    open = true;
    openFired = true;
    if (openTimeoutTimer) clearTimeout(openTimeoutTimer);
    log("open event — connection established");
    flushPending();
    keepAlive = setInterval(() => {
      try {
        connection.keepAlive();
      } catch {
        /* ignore */
      }
    }, 8000);
    handlers.onOpen();
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
    const alt = data?.channel?.alternatives?.[0];
    const text: string = alt?.transcript ?? "";
    if (!text) return;
    const isFinal = Boolean(data?.is_final);
    const speakerNum = alt?.words?.[0]?.speaker;
    log(`transcript event (#${isFinal ? "final" : "interim"}):`, text.slice(0, 80));
    handlers.onTranscript({
      text,
      isFinal,
      speaker: speakerNum != null ? `Speaker ${speakerNum + 1}` : null,
      start: data?.start ?? 0,
    });
  });

  connection.on(LiveTranscriptionEvents.Metadata, (m: any) => {
    log("metadata event:", JSON.stringify(m).slice(0, 120));
  });

  connection.on(LiveTranscriptionEvents.Error, (err: any) => {
    const message = err?.message ?? err?.reason ?? "Deepgram stream error";
    warn("error event:", message);
    if (openTimeoutTimer) clearTimeout(openTimeoutTimer);
    handlers.onError(message);
  });

  connection.on(LiveTranscriptionEvents.Close, (ev: any) => {
    open = false;
    closed = true;
    if (openTimeoutTimer) clearTimeout(openTimeoutTimer);
    if (keepAlive) clearInterval(keepAlive);
    const code = ev?.code ?? "?";
    const reason =
      ev?.reason || (code ? `closed (code ${code})` : "connection closed");
    log(`close event — code=${code} reason=${ev?.reason ?? "(none)"}`);
    handlers.onClose(String(reason));
  });

  // Timeout: if Deepgram hasn't opened within the limit, surface an error.
  // This prevents silent hangs when the network or Deepgram's servers are slow.
  openTimeoutTimer = setTimeout(() => {
    if (open || closed) return;
    warn(`open timeout (${DEEPGRAM_OPEN_TIMEOUT_MS}ms) — Deepgram did not open`);
    handlers.onError(
      `Deepgram connection timed out after ${DEEPGRAM_OPEN_TIMEOUT_MS / 1000}s. ` +
      "Check network connectivity and DEEPGRAM_API_KEY validity."
    );
    try { connection.requestClose(); } catch { /* ignore */ }
  }, DEEPGRAM_OPEN_TIMEOUT_MS);

  // Warning event (not in all SDK versions) — subscribe defensively.
  try {
    connection.on("warning" as any, (w: any) =>
      warn("warning event:", JSON.stringify(w).slice(0, 120))
    );
  } catch {
    /* ignore */
  }

  /** Track total bytes sent for logging. */
  let bytesSent = 0;

  return {
    send: (chunk: Buffer) => {
      if (closed) {
        warn(`send() called after close (${chunk.length}B dropped)`);
        return;
      }
      bytesSent += chunk.length;
      if (open) {
        try {
          connection.send(toArrayBuffer(chunk));
        } catch (e) {
          warn("send() error:", (e as Error).message);
        }
      } else {
        // Buffer until open so we never lose the WebM header.
        if (pending.length < 400) {
          pending.push(chunk);
          if (pending.length === 1) {
            log(`buffering first audio chunk (${chunk.length}B) until Deepgram open`);
          }
        } else {
          warn("pending buffer full (400) — dropping chunk");
        }
      }
    },
    finish: () => {
      log(`finish() called (${bytesSent}B sent, ${pending.length} pending)`);
      if (openTimeoutTimer) clearTimeout(openTimeoutTimer);
      if (keepAlive) clearInterval(keepAlive);
      try {
        connection.requestClose();
      } catch {
        /* ignore */
      }
    },
    isOpen: () => open,
  };
}

/** Clean ArrayBuffer view of a Node Buffer (Deepgram expects ArrayBuffer/Blob). */
function toArrayBuffer(chunk: Buffer): ArrayBuffer {
  return chunk.buffer.slice(
    chunk.byteOffset,
    chunk.byteOffset + chunk.byteLength
  ) as ArrayBuffer;
}
