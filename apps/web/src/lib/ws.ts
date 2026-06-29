import { useAuthStore } from "@/store/auth";

type Handler = (payload: any) => void;
export type ConnState = "connecting" | "open" | "closed" | "reconnecting";

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
  private binaryQueue: (ArrayBuffer | Blob)[] = [];
  private openPromise: Promise<void>;
  private resolveOpen: (() => void) | null = null;

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
    this.stateCb?.(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.stateCb?.("open");
      this.queue.forEach((m) => this.ws?.send(m));
      this.queue = [];
      this.binaryQueue.forEach((b) => this.ws?.send(b));
      this.binaryQueue = [];
      this.resolveOpen?.();
      this.openPromise = new Promise((resolve) => {
        this.resolveOpen = resolve;
      });
    };
    this.ws.onmessage = (e) => {
      try {
        const { type, payload } = JSON.parse(e.data);
        this.handlers.get(type)?.forEach((h) => h(payload));
      } catch {
        /* ignore malformed */
      }
    };
    this.ws.onclose = () => {
      this.stateCb?.("closed");
      if (this.shouldReconnect && this.reconnectAttempts < 6) {
        this.reconnectAttempts += 1;
        this.stateCb?.("reconnecting");
        setTimeout(() => this.connect(), Math.min(5000, 800 * this.reconnectAttempts));
      }
    };
    this.ws.onerror = () => this.ws?.close();
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
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data);
    else this.queue.push(data);
  }

  /** Send raw audio bytes as a binary frame (queued until socket opens). */
  sendBinary(buffer: ArrayBuffer | Blob) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(buffer);
    } else {
      if (this.binaryQueue.length < 400) this.binaryQueue.push(buffer);
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
  }
}
