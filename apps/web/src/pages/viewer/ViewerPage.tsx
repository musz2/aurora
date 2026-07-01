import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, WS_BASE_URL } from "@/lib/api";
import {
  Radio,
  CheckCircle2,
  StickyNote,
  AlertCircle,
  Eye,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { StatusPill } from "@/components/ui/StatusPill";
import { Avatar, Spinner } from "@/components/ui/primitives";
import { TranscriptPanel } from "@/components/app/TranscriptPanel";
import { formatDate } from "@/lib/format";
import type { PublicSessionDto } from "@aurora/shared";

const log = (...a: unknown[]) => console.info("[VIEWER]", ...a);
const warn = (...a: unknown[]) => console.warn("[VIEWER]", ...a);

type Session = PublicSessionDto;
type Status = "loading" | "ok" | "notfound" | "error";

interface InterimEvent {
  speakerName: string;
  text: string;
}

interface SegmentEvent {
  id: string;
  speakerName: string;
  text: string;
  startTime: number;
  isFinal: boolean;
}

export function ViewerPage() {
  const { shareId } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [interim, setInterim] = useState<InterimEvent | null>(null);
  const [segments, setSegments] = useState<SegmentEvent[]>([]);
  const [wsState, setWsState] = useState<"connecting" | "live" | "disconnected">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);

  // HTTP polling for initial load + non-transcript data (summary, notes, answers, status).
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const load = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/sessions/${shareId}`);
        if (!alive) return;
        setSession(data.session);
        setStatus("ok");

        // Sync segments from HTTP response on initial load; after that, WebSocket
        // keeps them current. Only re-sync from HTTP if WebSocket is disconnected.
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          const httpSegments = (data.session?.segments ?? []).map(
            (s: { id: string; speakerName: string; text: string; startTime: number }) => ({
              id: s.id,
              speakerName: s.speakerName,
              text: s.text,
              startTime: s.startTime,
              isFinal: true,
            })
          );
          setSegments(httpSegments);
        }

        if (data.session?.ended) stopPolling();
      } catch (err) {
        if (!alive) return;
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setStatus("notfound");
          stopPolling();
        } else {
          setStatus((prev) => (prev === "ok" ? "ok" : "error"));
        }
      }
    };
    load();
    // Poll every 3s for non-transcript updates (summary, notes, answers, ended status).
    timer = setInterval(load, 3000);
    return () => {
      alive = false;
      stopPolling();
    };
  }, [shareId]);

  // WebSocket for live transcript streaming (interim + final segments).
  // Use a ref for `ended` to avoid stale closures in the onclose handler.
  const endedRef = useRef(session?.ended ?? false);
  endedRef.current = session?.ended ?? false;

  useEffect(() => {
    if (!shareId) return;
    const wsUrl = `${WS_BASE_URL}/ws-viewer?shareId=${encodeURIComponent(shareId)}`;
    log("connecting to", wsUrl);
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const connect = () => {
      setWsState("connecting");
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!alive) { ws?.close(); return; }
        log("open — live");
        setWsState("live");
      };

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          if (type === "transcript:partial") {
            setInterim({ speakerName: payload.speakerName, text: payload.text });
          } else if (type === "transcript:segment") {
            setInterim(null);
            setSegments((prev) => {
              if (prev.some((s) => s.id === payload.id)) return prev;
              return [
                ...prev,
                {
                  id: payload.id,
                  speakerName: payload.speakerName,
                  text: payload.text,
                  startTime: payload.startTime,
                  isFinal: true,
                },
              ];
            });
          } else if (type === "session:published-answer") {
            // Host explicitly shared an answer — append instantly (polling is a fallback).
            setSession((prev) =>
              prev && !prev.publishedAnswers.some((a) => a.id === payload.id)
                ? { ...prev, publishedAnswers: [...prev.publishedAnswers, payload] }
                : prev
            );
          } else if (type === "session:published-note") {
            setSession((prev) =>
              prev && !prev.publishedNotes.includes(payload.note)
                ? { ...prev, publishedNotes: [...prev.publishedNotes, payload.note] }
                : prev
            );
          }
        } catch {
          warn("malformed message:", String(event.data).slice(0, 120));
        }
      };

      ws.onclose = (ev) => {
        if (!alive) return;
        log("closed — code=" + ev.code + " reason=" + (ev.reason || "(none)"));
        setWsState("disconnected");
        wsRef.current = null;
        // Auto-reconnect every 3s while the session is live.
        // Use a ref to avoid stale closure on `session?.ended`.
        if (!endedRef.current) {
          log("reconnecting in 3s...");
          reconnectTimer = setTimeout(connect, 3000);
        } else {
          log("session ended — not reconnecting");
        }
      };

      ws.onerror = () => {
        warn("error event");
        ws?.close();
      };
    };

    connect();

    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
      wsRef.current = null;
    };
  }, [shareId]);

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.06] bg-white/90 px-6 py-4 backdrop-blur">
        <Logo />
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-muted sm:inline-flex">
            <Eye className="h-3.5 w-3.5" /> Shared read-only view
          </span>
          {session && (
            <StatusPill
              tone={session.live ? "live" : session.ended ? "muted" : "processing"}
              pulse={session.live}
            >
              {session.live ? "Live now" : session.ended ? "Session ended" : "Processing"}
            </StatusPill>
          )}
          {wsState === "connecting" && (
            <StatusPill tone="processing">
              <Spinner className="h-3 w-3" /> Connecting
            </StatusPill>
          )}
          {wsState === "disconnected" && session?.live && (
            <StatusPill tone="error">
              Reconnecting
            </StatusPill>
          )}
          {wsState === "live" && session?.live && (
            <StatusPill tone="live" pulse>
              Live
            </StatusPill>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {status === "loading" && (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        )}

        {status === "error" && (
          <StateCard
            icon={AlertCircle}
            iconClass="text-amber-500"
            title="Can't reach this session"
            body="We couldn't load the shared session. It may be a temporary network issue — this page will keep retrying."
          />
        )}

        {status === "notfound" && (
          <StateCard
            icon={AlertCircle}
            iconClass="text-amber-500"
            title="Session link invalid or expired"
            body="This session link is invalid, private, or no longer shared by the host."
          />
        )}

        {status === "ok" && session && (
          <div>
            <div className="mb-6">
              <h1 className="font-display text-3xl text-ink">{session.title}</h1>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Shared read-only view. Private assistant output, host notes, and
                controls are never visible here.
              </p>
              {(session.startedAt || session.endedAt) && (
                <p className="mt-1 text-xs text-muted">
                  {session.startedAt ? formatDate(session.startedAt) : ""}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {session.participants.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-xs text-ink shadow-sm"
                  >
                    <Avatar name={p} className="h-5 w-5 text-[9px]" />
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
                  <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
                    <span className="font-medium text-ink">Shared transcript</span>
                    {session.live && (
                      <StatusPill tone="live" pulse>
                        Live
                      </StatusPill>
                    )}
                  </div>
                  <TranscriptPanel
                    segments={segments}
                    interim={interim}
                    emptyState={
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <Radio className="h-8 w-8 text-aurora-400" />
                        <p className="mt-3 text-sm text-muted">
                          {session.ended
                            ? "This session has ended."
                            : "Waiting for the host to start speaking…"}
                        </p>
                      </div>
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                {session.summary && (
                  <ViewerCard icon={CheckCircle2} iconClass="text-emerald-600" title="Summary">
                    <p className="text-sm leading-relaxed text-ink/80">
                      {session.summary.overview}
                    </p>
                    {session.summary.decisions.length > 0 && (
                      <>
                        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <ListChecks className="h-3.5 w-3.5" /> Decisions
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {session.summary.decisions.map((d, i) => (
                            <li key={i} className="text-sm text-ink/80">
                              • {d}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </ViewerCard>
                )}

                {session.publishedAnswers.length > 0 && (
                  <ViewerCard icon={CheckCircle2} iconClass="text-emerald-600" title="Published by Host">
                    <ul className="space-y-2.5">
                      {session.publishedAnswers.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2"
                        >
                          <p className="whitespace-pre-wrap text-sm text-ink/80">{a.text}</p>
                          <p className="mt-1 text-[11px] font-medium text-emerald-700">
                            Published by {a.publishedBy}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </ViewerCard>
                )}

                {session.publishedNotes.length > 0 && (
                  <ViewerCard icon={StickyNote} iconClass="text-aurora-600" title="Published notes">
                    <ul className="space-y-2">
                      {session.publishedNotes.map((n, i) => (
                        <li key={i} className="text-sm text-ink/80">
                          • {n}
                        </li>
                      ))}
                    </ul>
                  </ViewerCard>
                )}

                {!session.summary &&
                  session.publishedNotes.length === 0 &&
                  session.publishedAnswers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-muted">
                    The host hasn't published a summary or notes yet.
                  </div>
                )}

                <p className="rounded-xl bg-black/[0.03] px-4 py-3 text-xs leading-relaxed text-muted">
                  This is a public read-only view. Private notes and Aurora's
                  private assistant are never shared here.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StateCard({
  icon: Icon,
  iconClass,
  title,
  body,
}: {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-black/[0.06] bg-white p-10 text-center">
      <Icon className={`mx-auto h-10 w-10 ${iconClass}`} />
      <h1 className="mt-4 font-display text-2xl text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <Link to="/" className="mt-5 inline-block text-sm font-medium text-aurora-600">
        ← Back to Aurora
      </Link>
    </div>
  );
}

function ViewerCard({
  icon: Icon,
  iconClass,
  title,
  children,
}: {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}
