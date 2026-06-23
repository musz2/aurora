import { useAuthStore } from "@/store/auth";

type Handler = (payload: any) => void;
export type ConnState = "connecting" | "open" | "closed" | "reconnecting";

/** Typed WebSocket client for the live meeting room, with auto-reconnect. */
export class AuroraSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private stateCb: ((s: ConnState) => void) | null = null;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private queue: string[] = [];

  onState(cb: (s: ConnState) => void) {
    this.stateCb = cb;
    return this;
  }

  connect(): AuroraSocket {
    const token = useAuthStore.getState().accessToken;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws?token=${token ?? ""}`;
    this.stateCb?.(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.stateCb?.("open");
      this.queue.forEach((m) => this.ws?.send(m));
      this.queue = [];
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

  /** Send raw audio bytes as a binary frame (dropped if socket not open). */
  sendBinary(buffer: ArrayBuffer | Blob) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(buffer);
  }

  get ready() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }
}
