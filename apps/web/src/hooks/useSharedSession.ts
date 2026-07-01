import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL, WS_BASE_URL } from "@/lib/api";
import type { PublicSessionDto } from "@aurora/shared";

/**
 * Resilient, self-healing shared-session data layer for /s/:shareId.
 *
 * - WebSocket is primary (live transcript + published content).
 * - Automatic reconnect with exponential backoff + jitter (1,2,5,10,15s cap).
 * - Polling fallback every ~4s whenever the socket isn't open; reduced once the
 *   socket reconnects.
 * - Stale detection so the viewer never sits on an infinite blank loader.
 * - Last-known-good cache (PUBLIC data only) so a refresh/reconnect keeps the
 *   last transcript visible; cleared when the share expires/is revoked or ends.
 *
 * Only public endpoints are used — no private copilot drafts/prompts/notes.
 */

const log = (...a: unknown[]) => {
  if (import.meta.env.DEV) console.info("[VIEWER]", ...a);
};

export type ConnState =
  | "initializing"
  | "connected"
  | "receiving"
  | "stale"
  | "reconnecting"
  | "offline"
  | "degraded"
  | "ended"
  | "failed";

export interface SegmentEvent {
  id: string;
  speakerName: string;
  text: string;
  startTime: number;
  isFinal: boolean;
}
export interface InterimEvent {
  speakerName: string;
  text: string;
}

type LoadStatus = "loading" | "ok" | "notfound" | "error";

const BACKOFF = [1000, 2000, 5000, 10000, 15000];
const POLL_MS = 4000;
const STALE_MS = 40000; // live + no update for 40s -> stale
const CONNECTING_STALE_MS = 10000; // connecting > 10s -> stale

function cacheKey(shareId: string) {
  return `aurora.viewer.cache.${shareId}`;
}

interface CacheShape {
  session: PublicSessionDto;
  segments: SegmentEvent[];
  savedAt: number;
}

function loadCache(shareId: string): CacheShape | null {
  try {
    const raw = localStorage.getItem(cacheKey(shareId));
    return raw ? (JSON.parse(raw) as CacheShape) : null;
  } catch {
    return null;
  }
}
function saveCache(shareId: string, data: CacheShape) {
  try {
    localStorage.setItem(cacheKey(shareId), JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}
function clearCache(shareId: string) {
  try {
    localStorage.removeItem(cacheKey(shareId));
  } catch {
    /* ignore */
  }
}

export interface SharedSessionState {
  session: PublicSessionDto | null;
  segments: SegmentEvent[];
  interim: InterimEvent | null;
  connState: ConnState;
  loadStatus: LoadStatus;
  usingCache: boolean;
  flashAnswerId: string | null;
}

export function useSharedSession(shareId: string | undefined): SharedSessionState {
  const cached = useMemo(() => (shareId ? loadCache(shareId) : null), [shareId]);

  const [session, setSession] = useState<PublicSessionDto | null>(cached?.session ?? null);
  const [segments, setSegments] = useState<SegmentEvent[]>(cached?.segments ?? []);
  const [interim, setInterim] = useState<InterimEvent | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [wsPhase, setWsPhase] = useState<"connecting" | "open" | "closed">("connecting");
  const [usingCache, setUsingCache] = useState<boolean>(Boolean(cached));
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [flashAnswerId, setFlashAnswerId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [, forceTick] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryIdx = useRef(0);
  const aliveRef = useRef(true);
  const endedRef = useRef(false);
  const sessionRef = useRef<PublicSessionDto | null>(session);
  const segmentsRef = useRef<SegmentEvent[]>(segments);
  sessionRef.current = session;
  segmentsRef.current = segments;

  const bump = useCallback(() => setLastUpdate(Date.now()), []);

  const persist = useCallback(() => {
    if (!shareId || !sessionRef.current) return;
    saveCache(shareId, { session: sessionRef.current, segments: segmentsRef.current, savedAt: Date.now() });
  }, [shareId]);

  const mergeSegmentsFromHttp = useCallback(
    (incoming: { id: string; speakerName: string; text: string; startTime: number }[]) => {
      setSegments((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const merged = [...prev];
        for (const s of incoming) {
          if (!seen.has(s.id)) merged.push({ ...s, isFinal: true });
        }
        return merged.length === prev.length ? prev : merged;
      });
    },
    []
  );

  /* ---------------- HTTP load / polling fallback (public only) ---------------- */
  const loadOnce = useCallback(async () => {
    if (!shareId) return;
    try {
      const { data } = await axios.get(`${API_BASE_URL}/sessions/${shareId}`);
      if (!aliveRef.current) return;
      setSession(data.session);
      setLoadStatus("ok");
      setUsingCache(false);
      endedRef.current = Boolean(data.session?.ended);
      // Only sync transcript from HTTP when the socket isn't the live source.
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        mergeSegmentsFromHttp(data.session?.segments ?? []);
      }
      bump();
      persist();
      if (data.session?.ended) {
        stopPolling();
      }
    } catch (err) {
      if (!aliveRef.current) return;
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        // Expired / revoked / invalid — never let the cache bypass this.
        setLoadStatus("notfound");
        if (shareId) clearCache(shareId);
        setUsingCache(false);
        stopPolling();
      } else {
        // Network error: keep last-known-good visible.
        setLoadStatus((prev) => (prev === "ok" ? "ok" : sessionRef.current ? "ok" : "error"));
        if (sessionRef.current) setUsingCache(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId, mergeSegmentsFromHttp, bump, persist]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);
  const startPolling = useCallback(() => {
    if (pollTimer.current || endedRef.current) return;
    pollTimer.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return; // WS is primary
      loadOnce();
    }, POLL_MS);
  }, [loadOnce]);

  /* ---------------------------- WebSocket (primary) --------------------------- */
  const connectWs = useCallback(() => {
    if (!shareId || endedRef.current) return;
    // Close any previous socket + strip listeners to avoid duplicates.
    if (wsRef.current) {
      try {
        wsRef.current.onopen = wsRef.current.onmessage = wsRef.current.onclose = wsRef.current.onerror = null;
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    setWsPhase("connecting");
    const ws = new WebSocket(`${WS_BASE_URL}/ws-viewer?shareId=${encodeURIComponent(shareId)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!aliveRef.current) {
        ws.close();
        return;
      }
      log("ws open");
      retryIdx.current = 0;
      setWsPhase("open");
      bump();
    };

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        if (type === "transcript:partial") {
          setInterim({ speakerName: payload.speakerName, text: payload.text });
          bump();
        } else if (type === "transcript:segment") {
          setInterim(null);
          setSegments((prev) => {
            if (prev.some((s) => s.id === payload.id)) return prev;
            return [...prev, { id: payload.id, speakerName: payload.speakerName, text: payload.text, startTime: payload.startTime, isFinal: true }];
          });
          bump();
          persist();
        } else if (type === "session:published-answer") {
          setSession((prev) =>
            prev && !prev.publishedAnswers.some((a) => a.id === payload.id)
              ? { ...prev, publishedAnswers: [...prev.publishedAnswers, payload] }
              : prev
          );
          setFlashAnswerId(payload.id);
          setTimeout(() => setFlashAnswerId((c) => (c === payload.id ? null : c)), 4000);
          bump();
          persist();
        } else if (type === "session:published-note") {
          setSession((prev) =>
            prev && !prev.publishedNotes.includes(payload.note)
              ? { ...prev, publishedNotes: [...prev.publishedNotes, payload.note] }
              : prev
          );
          bump();
          persist();
        } else if (type === "error") {
          // Server rejected the share (invalid/expired) — treat as not found.
          setLoadStatus("notfound");
          if (shareId) clearCache(shareId);
        }
      } catch {
        /* ignore malformed frame */
      }
    };

    ws.onclose = () => {
      if (!aliveRef.current) return;
      setWsPhase("closed");
      wsRef.current = null;
      startPolling(); // fall back to polling immediately
      if (endedRef.current) return;
      const delay = BACKOFF[Math.min(retryIdx.current, BACKOFF.length - 1)];
      retryIdx.current += 1;
      const jitter = delay * (0.8 + Math.random() * 0.4); // ±20%
      log("ws closed — reconnect in", Math.round(jitter), "ms");
      reconnectTimer.current = setTimeout(connectWs, jitter);
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [shareId, bump, persist, startPolling]);

  /* --------------------------------- lifecycle ------------------------------- */
  useEffect(() => {
    aliveRef.current = true;
    endedRef.current = false;
    retryIdx.current = 0;
    if (!shareId) return;
    loadOnce();
    connectWs();
    startPolling(); // safety net until WS opens
    const onOnline = () => {
      setOnline(true);
      connectWs();
      loadOnce();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Tick every 5s so stale detection re-evaluates even without events.
    const tick = setInterval(() => forceTick((n) => n + 1), 5000);

    return () => {
      aliveRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      stopPolling();
      clearInterval(tick);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (wsRef.current) {
        try {
          wsRef.current.onopen = wsRef.current.onmessage = wsRef.current.onclose = wsRef.current.onerror = null;
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  /* ------------------------- derive connection state ------------------------- */
  const connState: ConnState = useMemo(() => {
    if (loadStatus === "notfound") return "failed";
    if (session?.ended) return "ended";
    if (loadStatus === "loading" && !session) return "initializing";
    if (!online) return "offline";
    const sinceUpdate = Date.now() - lastUpdate;
    const live = Boolean(session?.live);
    if (wsPhase === "open") {
      if (live && sinceUpdate > STALE_MS) return "stale";
      return sinceUpdate < 6000 ? "receiving" : "connected";
    }
    // WS not open:
    if (wsPhase === "connecting" && sinceUpdate < CONNECTING_STALE_MS && !session) return "initializing";
    if (live && sinceUpdate > STALE_MS) return "stale";
    // Polling is carrying it.
    return session ? "degraded" : "reconnecting";
  }, [loadStatus, session, online, wsPhase, lastUpdate]);

  return { session, segments, interim, connState, loadStatus, usingCache, flashAnswerId };
}
