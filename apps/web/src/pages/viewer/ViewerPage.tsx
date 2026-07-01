import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
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
  Sparkles,
  Type as TypeIcon,
  SunMedium,
  MoonStar,
  Rows,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { StatusPill } from "@/components/ui/StatusPill";
import { Avatar, Spinner } from "@/components/ui/primitives";
import { TranscriptPanel } from "@/components/app/TranscriptPanel";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PublicSessionDto } from "@aurora/shared";

const log = (...a: unknown[]) => console.info("[VIEWER]", ...a);
const warn = (...a: unknown[]) => console.warn("[VIEWER]", ...a);

type Session = PublicSessionDto;
type Status = "loading" | "ok" | "notfound" | "error";

type ViewerMode = "standard" | "transparent";
type Opacity = 30 | 50 | 70 | 90;
type FontSize = "sm" | "md" | "lg";
type GlassTheme = "dark" | "light";
type Layout = "compact" | "expanded";

interface ViewerSettings {
  mode: ViewerMode;
  opacity: Opacity;
  font: FontSize;
  theme: GlassTheme;
  layout: Layout;
}

const SETTINGS_KEY = "aurora.viewer.v1";
const DEFAULT_SETTINGS: ViewerSettings = {
  mode: "standard",
  opacity: 70,
  font: "md",
  theme: "dark",
  layout: "expanded",
};

function loadSettings(): ViewerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ViewerSettings>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

const FONT_PX: Record<FontSize, string> = { sm: "14px", md: "16px", lg: "19px" };

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
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [interim, setInterim] = useState<InterimEvent | null>(null);
  const [segments, setSegments] = useState<SegmentEvent[]>([]);
  const [wsState, setWsState] = useState<"connecting" | "live" | "disconnected">("disconnected");
  const [flashAnswerId, setFlashAnswerId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Display settings. The ?mode= query param sets the UI mode only — it never
  // changes permissions or which data the server returns.
  const [settings, setSettings] = useState<ViewerSettings>(() => {
    const s = loadSettings();
    const q = new URLSearchParams(window.location.search).get("mode");
    if (q === "transparent" || q === "standard") s.mode = q;
    return s;
  });
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);
  const setMode = (mode: ViewerMode) => setSettings((s) => ({ ...s, mode }));
  const transparent = settings.mode === "transparent";
  // Keep a live copy of the ?mode param so a shared /s/:id?mode=transparent link
  // reflects intent without altering data access.
  useEffect(() => {
    const q = searchParams.get("mode");
    if (q === "transparent" || q === "standard") setMode(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    timer = setInterval(load, 3000);
    return () => {
      alive = false;
      stopPolling();
    };
  }, [shareId]);

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
            setSession((prev) =>
              prev && !prev.publishedAnswers.some((a) => a.id === payload.id)
                ? { ...prev, publishedAnswers: [...prev.publishedAnswers, payload] }
                : prev
            );
            setFlashAnswerId(payload.id);
            setTimeout(() => setFlashAnswerId((cur) => (cur === payload.id ? null : cur)), 4000);
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
        if (!endedRef.current) {
          reconnectTimer = setTimeout(connect, 3000);
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

  const connectionPill = useMemo(() => {
    if (!session) return null;
    if (wsState === "connecting") return { tone: "processing" as const, label: "Connecting", pulse: false };
    if (wsState === "disconnected" && session.live) return { tone: "error" as const, label: "Reconnecting", pulse: false };
    if (session.live) return { tone: "live" as const, label: "Live", pulse: true };
    if (session.ended) return { tone: "muted" as const, label: "Ended", pulse: false };
    return { tone: "processing" as const, label: "Processing", pulse: false };
  }, [session, wsState]);

  // ---- Transparent reader mode ------------------------------------------------
  if (transparent) {
    return (
      <TransparentReader
        session={session}
        status={status}
        segments={segments}
        interim={interim}
        settings={settings}
        setSettings={setSettings}
        setMode={setMode}
        connectionPill={connectionPill}
        flashAnswerId={flashAnswerId}
      />
    );
  }

  // ---- Standard mode ----------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.06] bg-white/90 px-6 py-4 backdrop-blur">
        <Logo />
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-muted sm:inline-flex">
            <Eye className="h-3.5 w-3.5" /> Shared read-only view
          </span>
          {connectionPill && (
            <StatusPill tone={connectionPill.tone} pulse={connectionPill.pulse}>
              {connectionPill.label}
            </StatusPill>
          )}
          <ModeToggle mode={settings.mode} onChange={setMode} />
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
                          className={cn(
                            "rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 transition",
                            flashAnswerId === a.id && "ring-2 ring-emerald-400"
                          )}
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

/* ---------------------------- Transparent reader ---------------------------- */

function TransparentReader({
  session,
  status,
  segments,
  interim,
  settings,
  setSettings,
  setMode,
  connectionPill,
  flashAnswerId,
}: {
  session: Session | null;
  status: Status;
  segments: SegmentEvent[];
  interim: InterimEvent | null;
  settings: ViewerSettings;
  setSettings: React.Dispatch<React.SetStateAction<ViewerSettings>>;
  setMode: (m: ViewerMode) => void;
  connectionPill: { tone: "live" | "muted" | "processing" | "error"; label: string; pulse: boolean } | null;
  flashAnswerId: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [segments, interim]);

  const dark = settings.theme === "dark";
  const alpha = settings.opacity / 100;
  const surface = dark ? `rgba(12,14,20,${alpha})` : `rgba(255,255,255,${alpha})`;
  const textColor = dark ? "#f4f5f7" : "#12131a";
  const subtle = dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";
  const border = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)";

  const rootStyle = {
    ["--viewer-opacity" as string]: String(alpha),
    ["--viewer-blur" as string]: "14px",
    ["--viewer-font-size" as string]: FONT_PX[settings.font],
    ["--viewer-text-contrast" as string]: dark ? "0 1px 2px rgba(0,0,0,0.55)" : "none",
    fontSize: "var(--viewer-font-size)",
    color: textColor,
  } as React.CSSProperties;

  const panelStyle: React.CSSProperties = {
    background: surface,
    backdropFilter: "blur(var(--viewer-blur))",
    WebkitBackdropFilter: "blur(var(--viewer-blur))",
    border: `1px solid ${border}`,
    color: textColor,
    textShadow: "var(--viewer-text-contrast)",
  };

  const compact = settings.layout === "compact";

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-transparent"
      style={{
        ...rootStyle,
        backgroundImage: dark
          ? "radial-gradient(1200px 600px at 50% -10%, rgba(80,70,229,0.10), transparent)"
          : "radial-gradient(1200px 600px at 50% -10%, rgba(80,70,229,0.06), transparent)",
      }}
    >
      {/* Compact control bar */}
      <div
        className="sticky top-0 z-20 mx-auto mt-2 flex max-w-4xl flex-wrap items-center gap-2 rounded-2xl px-3 py-2"
        style={panelStyle}
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4" style={{ color: "#8b7bff" }} /> Aurora
        </span>
        {connectionPill && (
          <StatusPill tone={connectionPill.tone} pulse={connectionPill.pulse}>
            {connectionPill.label}
          </StatusPill>
        )}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ color: subtle, border: `1px solid ${border}` }}
        >
          <Eye className="h-3 w-3" /> Read-only
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <ControlGroup label="Opacity">
            {([30, 50, 70, 90] as Opacity[]).map((o) => (
              <Seg key={o} active={settings.opacity === o} onClick={() => setSettings((s) => ({ ...s, opacity: o }))}>
                {o}
              </Seg>
            ))}
          </ControlGroup>
          <ControlGroup label="Text" icon={TypeIcon}>
            {(["sm", "md", "lg"] as FontSize[]).map((f) => (
              <Seg key={f} active={settings.font === f} onClick={() => setSettings((s) => ({ ...s, font: f }))}>
                {f.toUpperCase()}
              </Seg>
            ))}
          </ControlGroup>
          <ControlGroup>
            <Seg active={dark} onClick={() => setSettings((s) => ({ ...s, theme: "dark" }))} title="Dark glass">
              <MoonStar className="h-3.5 w-3.5" />
            </Seg>
            <Seg active={!dark} onClick={() => setSettings((s) => ({ ...s, theme: "light" }))} title="Light glass">
              <SunMedium className="h-3.5 w-3.5" />
            </Seg>
          </ControlGroup>
          <ControlGroup>
            <Seg active={compact} onClick={() => setSettings((s) => ({ ...s, layout: "compact" }))} title="Compact">
              <Rows className="h-3.5 w-3.5" />
            </Seg>
            <Seg active={!compact} onClick={() => setSettings((s) => ({ ...s, layout: "expanded" }))} title="Expanded">
              Exp
            </Seg>
          </ControlGroup>
          <button
            onClick={() => setMode("standard")}
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "#5046e5", color: "white" }}
          >
            Standard mode
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-3 pb-8 pt-3">
        {status !== "ok" || !session ? (
          <div className="rounded-2xl px-5 py-10 text-center" style={panelStyle}>
            {status === "loading" ? (
              <Spinner />
            ) : status === "notfound" ? (
              <p className="text-sm">This session link is invalid, private, or no longer shared.</p>
            ) : (
              <p className="text-sm">Can't reach this session — retrying…</p>
            )}
            <Link to="/" className="mt-4 inline-block text-xs font-medium" style={{ color: "#8b7bff" }}>
              ← Back to Aurora
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Title strip */}
            <div className="rounded-2xl px-4 py-3" style={panelStyle}>
              <h1 className="font-display text-xl leading-tight">{session.title}</h1>
              <p className="mt-0.5 text-[11px]" style={{ color: subtle }}>
                Public read-only transcript · Only host-published content appears here.
              </p>
            </div>

            {/* Transcript */}
            <div
              ref={scrollRef}
              className="overflow-y-auto rounded-2xl px-4 py-3"
              style={{ ...panelStyle, height: compact ? "48vh" : "62vh" }}
            >
              {segments.length === 0 && !interim ? (
                <div className="flex h-full items-center justify-center text-center text-sm" style={{ color: subtle }}>
                  {session.ended ? "This session has ended." : "Waiting for the host to start speaking…"}
                </div>
              ) : (
                <div className={compact ? "space-y-1.5" : "space-y-3"}>
                  {segments.map((s) => (
                    <div key={s.id}>
                      <span className="text-[11px] font-semibold" style={{ color: "#8b7bff" }}>
                        {s.speakerName}
                      </span>
                      <p className="leading-relaxed" style={{ color: textColor }}>
                        {s.text}
                      </p>
                    </div>
                  ))}
                  {interim && (
                    <div style={{ opacity: 0.7 }}>
                      <span className="text-[11px] font-semibold" style={{ color: "#8b7bff" }}>
                        {interim.speakerName}
                      </span>
                      <p className="leading-relaxed italic">{interim.text}…</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Host-published answers */}
            {session.publishedAnswers.length > 0 && (
              <div className="rounded-2xl px-4 py-3" style={panelStyle}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Host shared answers
                </p>
                <div className="space-y-2">
                  {session.publishedAnswers.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl px-3 py-2 transition"
                      style={{
                        border: `1px solid ${flashAnswerId === a.id ? "rgba(16,185,129,0.8)" : border}`,
                        boxShadow: flashAnswerId === a.id ? "0 0 0 2px rgba(16,185,129,0.35)" : "none",
                      }}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{a.text}</p>
                      <p className="mt-1 text-[10px]" style={{ color: subtle }}>
                        Host shared answer · {a.publishedBy}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Published notes */}
            {session.publishedNotes.length > 0 && (
              <div className="rounded-2xl px-4 py-3" style={panelStyle}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <StickyNote className="h-3.5 w-3.5" style={{ color: "#8b7bff" }} /> Published notes
                </p>
                <ul className="space-y-1">
                  {session.publishedNotes.map((n, i) => (
                    <li key={i} className="leading-relaxed">
                      • {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ControlGroup({
  label,
  icon: Icon,
  children,
}: {
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
      {label && <span className="text-[10px] uppercase tracking-wide opacity-60">{label}</span>}
      <div className="inline-flex overflow-hidden rounded-full" style={{ border: "1px solid currentColor" }}>
        {children}
      </div>
    </div>
  );
}

function Seg({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex min-w-[26px] items-center justify-center px-2 py-1 text-[11px] font-semibold transition"
      style={{
        background: active ? "#5046e5" : "transparent",
        color: active ? "white" : "inherit",
      }}
    >
      {children}
    </button>
  );
}

function ModeToggle({ mode, onChange }: { mode: ViewerMode; onChange: (m: ViewerMode) => void }) {
  return (
    <button
      onClick={() => onChange(mode === "transparent" ? "standard" : "transparent")}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-ink transition hover:border-aurora-300 hover:text-aurora-700"
    >
      <Eye className="h-3.5 w-3.5" />
      {mode === "transparent" ? "Standard mode" : "Transparent mode"}
    </button>
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
