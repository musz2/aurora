import { useAuthStore } from "@/store/auth";

type Handler = (payload: any) => void;

/** Lightweight typed WebSocket client for the live meeting room. */
export class AuroraSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();

  connect() {
    const token = useAuthStore.getState().accessToken;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws?token=${token ?? ""}`;
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      try {
        const { type, payload } = JSON.parse(e.data);
        this.handlers.get(type)?.forEach((h) => h(payload));
      } catch {
        /* ignore malformed */
      }
    };
    return this;
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
    } else if (this.ws) {
      this.ws.addEventListener("open", () => this.ws?.send(data), { once: true });
    }
  }

  get ready() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }
}
