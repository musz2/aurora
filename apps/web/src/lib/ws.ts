import { useAuthStore } from "@/store/auth";

type Handler = (payload: any) => void;
export type ConnState = "connecting" | "open" | "closed" | "reconnecting";

const log = (...a: unknown[]) => console.info("[WS CLIENT]", ...a);
const warn = (...a: unknown[]) => console.warn("[WS CLIENT]", ...a);

function socketUrl(token: string | null): string {
  const configured = import.meta.env.VITE_WS_URL?.trim();
  if (configured) {
    const fallbackProto = window.location.protocol === "https:" ? "wss" : "ws";
    const raw = configured.startsWith("/")
      ? `${fallbackProto}://${window.location.host}${configured}`
      : configured;
    const url = new URL(raw);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    url.searchParams.set("token", token ?? "");
    return url.toString();
  }

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const url = new URL(`${proto}://${window.location.host}/ws`);
  url.searchParams.set("token", token ?? "");
  return url.toString();
}

/** Typed WebSocket client for the live meeting room, with auto-reconnect. */
export class AuroraSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private stateCb: ((s: ConnState) => void) | null = null;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private queue: string[] = [];
  /** Holds binary chunks ONLY until AUDIO_READY is received. Never flushed on open. */
  private binaryQueue: (ArrayBuffer | Blob)[] = [];
  private openPromise: Promise<void>;
  private resolveOpen: (() => void) | null = null;
  private binarySeq = 0;
  /** Server must send AUDIO_READY before any binary frames are sent. */
  private audioReady = false;
  private pendingBinaryAfterReady: (ArrayBuffer | Blob)[] = [];

  constructor() {
    this.openPromise = new Promise((resolve) => {
      this.resolveOpen = resolve;
    });
  }

  onState(cb: (s: ConnState) => void) {
    this.stateCb = cb;
    return this;
  }

  connect(): AuroraSocket {
    const token = useAuthStore.getState().accessToken;
    const url = socketUrl(token);
    this.shouldReconnect = true;
    this.audioReady = false;
    this.stateCb?.(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    log("connecting to", url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // CRITICAL: NEVER flush queued binary chunks on open. Old chunks from
      // a previous connection are stale. Wait for AUDIO_READY from the server
      // before sending any binary frames. Flushing old chunks immediately after
      // upgrade causes "Invalid frame header" errors on proxy infrastructures.
      if (this.binaryQueue.length > 0) {
        log("open — discarding", this.binaryQueue.length, "stale queued binary chunks (waiting for AUDIO_READY)");
        this.binaryQueue = [];
      }
      log("open — flushing", this.queue.length, "queued text messages");
      this.stateCb?.("open");
      this.queue.forEach((m) => this.ws?.send(m));
      this.queue = [];
      this.resolveOpen?.();
      this.openPromise = new Promise((resolve) => {
        this.resolveOpen = resolve;
      });
    };
    this.ws.onmessage = (e) => {
      if (typeof e.data === "string") {
        try {
          const { type, payload } = JSON.parse(e.data);
          // Intercept AUDIO_READY to gate binary sends.
          if (type === "audio:ready") {
            log("server ready for audio — flushing", this.pendingBinaryAfterReady.length, "pending binary chunks");
            this.audioReady = true;
            for (const chunk of this.pendingBinaryAfterReady) {
              this.ws?.send(chunk);
            }
            this.pendingBinaryAfterReady = [];
          }
          this.handlers.get(type)?.forEach((h) => h(payload));
        } catch {
          warn("malformed message:", String(e.data).slice(0, 120));
        }
      } else {
        warn("unexpected binary message from server (ignored)");
      }
    };
    this.ws.onclose = (ev) => {
      log("close code=" + ev.code + " reason=" + (ev.reason || "(none)") + " willReconnect=" + this.shouldReconnect);
      this.stateCb?.("closed");
      // Discard all queued binary — stale chunks are never replayed.
      if (this.binaryQueue.length > 0) {
        log("discarding", this.binaryQueue.length, "stale binary chunks on close");
        this.binaryQueue = [];
      }
      if (this.pendingBinaryAfterReady.length > 0) {
        log("discarding", this.pendingBinaryAfterReady.length, "pending binary chunks on close");
        this.pendingBinaryAfterReady = [];
      }
      this.audioReady = false;
      if (this.shouldReconnect && this.reconnectAttempts < 6) {
        this.reconnectAttempts += 1;
        this.stateCb?.("reconnecting");
        setTimeout(() => this.connect(), Math.min(5000, 800 * this.reconnectAttempts));
      }
    };
    this.ws.onerror = (ev) => {
      warn("error event");
      this.ws?.close();
    };
    return this;
  }

  /** Returns once the WebSocket is open (connects or already connected). */
  waitForOpen(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    return this.openPromise;
  }

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  send(type: string, payload?: Record<string, unknown>) {
    const data = JSON.stringify({ type, payload: payload ?? {} });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      log("queuing text message:", type);
      this.queue.push(data);
    }
  }

  /** Send raw audio bytes as a binary frame. Will NOT send until server
   *  confirms AUDIO_READY. Chunks are queued and flushed once ready. */
  sendBinary(buffer: ArrayBuffer | Blob) {
    if (!buffer || (buffer instanceof Blob && buffer.size === 0) || (buffer instanceof ArrayBuffer && buffer.byteLength === 0)) {
      warn("sendBinary called with empty buffer — skipping");
      return;
    }
    this.binarySeq += 1;
    if (!this.audioReady) {
      log("binary queue held until ready (seq=" + this.binarySeq + " size=" + (buffer instanceof Blob ? buffer.size : buffer.byteLength) + ")");
      this.pendingBinaryAfterReady.push(buffer);
      if (this.pendingBinaryAfterReady.length > 400) {
        warn("pending binary queue full (400) — dropping chunk");
        this.pendingBinaryAfterReady.shift();
      }
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      log("binary send seq=" + this.binarySeq + " size=" + (buffer instanceof Blob ? buffer.size : buffer.byteLength));
      this.ws.send(buffer);
    } else {
      log("binary queue held (socket not open, seq=" + this.binarySeq + ")");
      this.binaryQueue.push(buffer);
    }
  }

  get ready() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
    this.queue = [];
    this.binaryQueue = [];
    this.pendingBinaryAfterReady = [];
    this.binarySeq = 0;
    this.audioReady = false;
    log("closed (shouldReconnect=false)");
  }
}
