import { useCallback, useRef, useState } from "react";
import { SOCKET_EVENTS } from "@aurora/shared";

/**
 * Desktop live-session pipeline.
 *
 * Connects the desktop app to the SAME backend WebSocket protocol the web app
 * uses (see apps/server/src/sockets/index.ts): create a meeting over REST, open
 * the authenticated /ws socket, complete the AUDIO_READY handshake, then stream
 * real microphone audio as binary frames and render the live transcript +
 * host-only private suggestions returned by the server.
 *
 * Consent-first and non-stealth: the caller gates start() behind an explicit
 * consent confirmation and a visible recording indicator. Auth is a real access
 * token from a logged-in web session — nothing here bypasses login/OAuth.
 */

export interface DesktopConfig {
  /** API origin, e.g. http://localhost:4000 (no trailing /api). */
  apiBase: string;
  /** Access token copied from an authenticated Aurora web session. */
  token: string;
}

export interface TranscriptLine {
  id: string;
  speakerName: string;
  text: string;
  startTime: number;
}

export interface DesktopSuggestion {
  id: string;
  question: string;
  text: string;
  confidence?: string;
  createdAt: string;
}

export type LiveStatus =
  | "idle"
  | "connecting"
  | "recording"
  | "error"
  | "stopped";

function normalizeApiBase(raw: string): string {
  return raw.trim().replace(/\/+$/, "").replace(/\/api$/, "");
}

function wsUrlFromApi(apiBase: string, token: string): string {
  const u = new URL(normalizeApiBase(apiBase));
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  u.search = `?token=${encodeURIComponent(token)}`;
  return u.toString();
}

/** Pick a MediaRecorder MIME type the server/Deepgram can decode. */
function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "";
}

/**
 * Minimal typed socket for the desktop. Mirrors the web client's critical rule:
 * NEVER send binary audio before the server sends AUDIO_READY (otherwise proxies
 * corrupt the first frame). Chunks are queued until the handshake completes.
 */
class DesktopSocket {
  private ws: WebSocket;
  private handlers = new Map<string, (payload: any) => void>();
  private audioReady = false;
  private pending: Blob[] = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      try {
        const { type, payload } = JSON.parse(e.data);
        if (type === SOCKET_EVENTS.AUDIO_READY) {
          this.audioReady = true;
          for (const chunk of this.pending) this.ws.send(chunk);
          this.pending = [];
        }
        this.handlers.get(type)?.(payload);
      } catch {
        /* ignore malformed frame */
      }
    };
  }

  on(type: string, handler: (payload: any) => void) {
    this.handlers.set(type, handler);
  }

  waitForOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("WebSocket connection failed"));
    });
  }

  send(type: string, payload?: Record<string, unknown>) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload: payload ?? {} }));
    }
  }

  sendBinary(chunk: Blob) {
    if (!chunk || chunk.size === 0) return;
    if (!this.audioReady || this.ws.readyState !== WebSocket.OPEN) {
      this.pending.push(chunk);
      if (this.pending.length > 400) this.pending.shift();
      return;
    }
    this.ws.send(chunk);
  }

  close() {
    this.handlers.clear();
    this.pending = [];
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

async function apiPost<T>(config: DesktopConfig, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${normalizeApiBase(config.apiBase)}/api${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export interface LiveSessionState {
  status: LiveStatus;
  error: string | null;
  sttConfigured: boolean | null;
  meetingId: string | null;
  lines: TranscriptLine[];
  partial: { speakerName: string; text: string } | null;
  suggestions: DesktopSuggestion[];
  start: (stream: MediaStream, config: DesktopConfig, assistantMode: string) => Promise<boolean>;
  ask: (question: string, assistantMode: string) => void;
  stop: () => Promise<void>;
}

/** React hook that drives a real desktop live transcription + copilot session. */
export function useLiveSession(): LiveSessionState {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sttConfigured, setSttConfigured] = useState<boolean | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [partial, setPartial] = useState<{ speakerName: string; text: string } | null>(null);
  const [suggestions, setSuggestions] = useState<DesktopSuggestion[]>([]);

  const socketRef = useRef<DesktopSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const configRef = useRef<DesktopConfig | null>(null);

  const start = useCallback(
    async (stream: MediaStream, config: DesktopConfig, assistantMode: string): Promise<boolean> => {
      setError(null);
      setLines([]);
      setPartial(null);
      setSuggestions([]);
      setStatus("connecting");

      if (!config.apiBase.trim() || !config.token.trim()) {
        setError("Enter your server URL and paste an access token from a logged-in web session.");
        setStatus("error");
        return false;
      }

      try {
        // 1. Create a meeting and enforce plan limits (REST returns 402 if over cap).
        const created = await apiPost<{ meeting: { id: string } }>(config, "/meetings", {
          title: `Desktop session · ${new Date().toLocaleString()}`,
          source: "LIVE",
        });
        const id = created.meeting.id;
        setMeetingId(id);
        configRef.current = config;
        await apiPost(config, `/meetings/${id}/start`);

        // 2. Open the authenticated socket and wait for it to be ready.
        const socket = new DesktopSocket(wsUrlFromApi(config.apiBase, config.token));
        socketRef.current = socket;
        await socket.waitForOpen();

        socket.on(SOCKET_EVENTS.TRANSCRIPT_SEGMENT, (p) => {
          setPartial(null);
          setLines((prev) => {
            // Dedupe by speaker+startTime+text (server may resend on reconnect).
            if (prev.some((l) => l.startTime === p.startTime && l.text === p.text && l.speakerName === p.speakerName)) {
              return prev;
            }
            return [...prev, { id: p.id, speakerName: p.speakerName, text: p.text, startTime: p.startTime }];
          });
        });
        socket.on(SOCKET_EVENTS.TRANSCRIPT_PARTIAL, (p) => {
          setPartial({ speakerName: p.speakerName, text: p.text });
        });
        socket.on(SOCKET_EVENTS.TRANSCRIPT_ERROR, (p) => {
          if (p?.code === "stt_not_configured") setSttConfigured(false);
          setError(p?.message ?? "Transcription error.");
        });
        socket.on(SOCKET_EVENTS.DG_STATUS, (p) => {
          if (p?.connected) setSttConfigured(true);
        });
        socket.on(SOCKET_EVENTS.AI_SUGGESTION, (p) => {
          setSuggestions((prev) => [
            {
              id: crypto.randomUUID(),
              question: p?.question ?? "",
              text: p?.suggestion ?? "",
              confidence: p?.confidence,
              createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
            ...prev,
          ]);
        });
        socket.on(SOCKET_EVENTS.AI_ERROR, (p) => {
          setError(p?.message ?? "Assistant error.");
        });

        // 3. Complete the AUDIO_READY handshake before streaming any audio.
        const audioReady = new Promise<boolean>((resolve) => {
          socket.on(SOCKET_EVENTS.AUDIO_READY, () => resolve(true));
          setTimeout(() => resolve(false), 10000);
        });
        socket.send(SOCKET_EVENTS.MEETING_START, { meetingId: id, mode: "real", assistantMode });
        if (!(await audioReady)) {
          setError("Server did not confirm audio readiness. Check the server URL and try again.");
          setStatus("error");
          socket.close();
          return false;
        }

        // 4. Stream microphone audio as binary frames.
        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) socket.sendBinary(e.data);
        };
        recorder.start(100);

        setStatus("recording");
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start the session.");
        setStatus("error");
        socketRef.current?.close();
        socketRef.current = null;
        return false;
      }
    },
    []
  );

  const ask = useCallback((question: string, assistantMode: string) => {
    const q = question.trim();
    if (!q || !socketRef.current) return;
    socketRef.current.send(SOCKET_EVENTS.AI_ASK_LIVE, { question: q, assistantMode });
  }, []);

  const stop = useCallback(async () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    socketRef.current?.send(SOCKET_EVENTS.MEETING_STOP, { meetingId: meetingId ?? undefined });
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("stopped");
    setPartial(null);

    // Persist the DB transition + finalize (summary/action items). WS MEETING_STOP
    // only stops the engine; the meeting stays RECORDING until the REST /stop runs,
    // which would otherwise leave the session stuck and inflate concurrent counts.
    const cfg = configRef.current;
    if (cfg && meetingId) {
      try {
        await apiPost(cfg, `/meetings/${meetingId}/stop`);
        await apiPost(cfg, `/meetings/${meetingId}/finalize`);
      } catch {
        /* best-effort finalize; the transcript is already persisted */
      }
    }
  }, [meetingId]);

  return {
    status,
    error,
    sttConfigured,
    meetingId,
    lines,
    partial,
    suggestions,
    start,
    ask,
    stop,
  };
}
