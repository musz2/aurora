import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Radio,
  CheckCircle2,
  StickyNote,
  AlertCircle,
  Eye,
  ShieldCheck,
  ListChecks,
  LifeBuoy,
  BookOpen,
  WifiOff,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { StatusPill } from "@/components/ui/StatusPill";
import { Avatar, Spinner } from "@/components/ui/primitives";
import { TranscriptPanel } from "@/components/app/TranscriptPanel";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSharedSession, type ConnState } from "@/hooks/useSharedSession";
import { BackupAssistPanel } from "./BackupAssistPanel";
import { OfflineInterviewPack } from "./OfflineInterviewPack";

const TROUBLED: ConnState[] = ["stale", "reconnecting", "offline", "degraded", "failed"];

/** Public, read-only shared session viewer — resilient and self-healing. */
export function ViewerPage() {
  const { shareId } = useParams();
  const { session, segments, interim, connState, usingCache, flashAnswerId } =
    useSharedSession(shareId);

  const [assistOpen, setAssistOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const autoOpened = useRef(false);

  // Auto-surface Backup Assist the first time the session becomes troubled.
  useEffect(() => {
    if (!autoOpened.current && TROUBLED.includes(connState)) {
      autoOpened.current = true;
      setAssistOpen(true);
    }
  }, [connState]);

  const transcriptContext = useMemo(
    () =>
      segments
        .slice(-8)
        .map((s) => `${s.speakerName}: ${s.text}`)
        .join("\n"),
    [segments]
  );

  const banner = connectionBanner(connState);

  // Invalid / expired / revoked — last-known-good never bypasses this.
  if (connState === "failed") {
    return (
      <Shell onOpenPack={() => setPackOpen(true)} connState={connState}>
        <StateCard
          icon={AlertCircle}
          iconClass="text-amber-500"
          title="Session link invalid or expired"
          body="This session link is invalid, private, or no longer shared by the host. You can still open the Offline Interview Pack for preparation."
        />
        {packOpen && <OfflineInterviewPack onClose={() => setPackOpen(false)} />}
      </Shell>
    );
  }

  if (connState === "initializing" && !session) {
    return (
      <Shell onOpenPack={() => setPackOpen(true)} connState={connState}>
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
        {packOpen && <OfflineInterviewPack onClose={() => setPackOpen(false)} />}
      </Shell>
    );
  }

  return (
    <Shell
      onOpenPack={() => setPackOpen(true)}
      onToggleAssist={() => setAssistOpen((v) => !v)}
      connState={connState}
    >
      {session && (
        <div>
          <div className="mb-6 text-center">
            <p className="kicker">Shared session</p>
            <h1 className="display-section mt-2 text-ink">{session.title}</h1>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Public read-only view. Private assistant output, host notes, and controls are never
              visible here.
            </p>
            {session.startedAt && (
              <p className="mt-1 text-xs text-muted">{formatDate(session.startedAt)}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {session.participants.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-white py-1 pl-1 pr-3 text-xs text-ink"
                >
                  <Avatar name={p} className="h-5 w-5 text-[9px]" />
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Connection / reliability banner */}
          {(banner || usingCache) && (
            <div
              className={cn(
                "relative mb-4 flex items-center gap-2 overflow-hidden rounded-xl border px-4 py-2.5 text-sm",
                connState === "offline"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "reconnect-sweep border-amber-200 bg-amber-50 text-amber-800"
              )}
            >
              {connState === "offline" ? (
                <WifiOff className="h-4 w-4 shrink-0" />
              ) : (
                <Spinner className="h-4 w-4 shrink-0" />
              )}
              <span>
                {banner ?? "Showing last saved transcript while reconnecting."}
                {usingCache && banner ? " Showing last saved transcript while reconnecting." : ""}
              </span>
              <button
                onClick={() => setAssistOpen(true)}
                className="ml-auto shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-white"
              >
                Backup Assist
              </button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex h-[60dvh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card lg:h-[520px]">
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
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                      <p className="font-display text-3xl leading-tight text-ghost sm:text-4xl">
                        {session.ended ? "This session" : "Waiting for the host"}
                        <br />
                        <span className="text-ink/70">
                          {session.ended ? "has ended." : "to start speaking…"}
                        </span>
                      </p>
                      <Radio className="mt-6 h-6 w-6 text-aurora-400" />
                    </div>
                  }
                />
              </div>

              {assistOpen && shareId && (
                <BackupAssistPanel
                  shareId={shareId}
                  publicTranscriptContext={transcriptContext}
                  onOpenPack={() => setPackOpen(true)}
                />
              )}
            </div>

            <div className="space-y-4">
              {session.summary && (
                <ViewerCard icon={CheckCircle2} iconClass="text-emerald-600" title="Summary">
                  <p className="text-sm leading-relaxed text-ink/80">{session.summary.overview}</p>
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
                <ViewerCard icon={CheckCircle2} iconClass="text-emerald-600" title="Host shared answers">
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
                          Host shared answer · {a.publishedBy}
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
                This is a public read-only view. Private notes and Aurora's private assistant are never
                shared here.
              </p>
            </div>
          </div>
        </div>
      )}

      {packOpen && <OfflineInterviewPack onClose={() => setPackOpen(false)} />}
    </Shell>
  );
}

function Shell({
  children,
  onOpenPack,
  onToggleAssist,
  connState,
}: {
  children: React.ReactNode;
  onOpenPack: () => void;
  onToggleAssist?: () => void;
  connState: ConnState;
}) {
  const pill = statusPill(connState);
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-black/[0.06] bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1 text-xs font-medium text-muted sm:inline-flex">
            <Eye className="h-3.5 w-3.5" /> Shared read-only view
          </span>
          {pill && (
            <StatusPill tone={pill.tone} pulse={pill.pulse}>
              {pill.label}
            </StatusPill>
          )}
          {onToggleAssist && (
            <button
              onClick={onToggleAssist}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-ink transition hover:border-aurora-300 hover:text-aurora-700"
            >
              <LifeBuoy className="h-3.5 w-3.5" /> Backup Assist
            </button>
          )}
          <button
            onClick={onOpenPack}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-ink transition hover:border-aurora-300 hover:text-aurora-700"
          >
            <BookOpen className="h-3.5 w-3.5" /> Offline Interview Pack
          </button>
        </div>
      </header>
      <main className="page-enter mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

function statusPill(s: ConnState): {
  tone:
    | "live"
    | "connected"
    | "reconnecting"
    | "stale"
    | "degraded"
    | "offline"
    | "ended"
    | "expired"
    | "processing"
    | "error";
  label: string;
  pulse: boolean;
} | null {
  switch (s) {
    case "receiving":
    case "connected":
      return { tone: "live", label: "Live", pulse: true };
    case "initializing":
      return { tone: "processing", label: "Connecting", pulse: true };
    case "reconnecting":
      return { tone: "reconnecting", label: "Reconnecting", pulse: true };
    case "degraded":
      return { tone: "degraded", label: "Backup mode", pulse: true };
    case "stale":
      return { tone: "stale", label: "Delayed", pulse: true };
    case "offline":
      return { tone: "offline", label: "Offline", pulse: false };
    case "ended":
      return { tone: "ended", label: "Ended", pulse: false };
    case "failed":
      return { tone: "expired", label: "Unavailable", pulse: false };
    default:
      return null;
  }
}

function connectionBanner(s: ConnState): string | null {
  switch (s) {
    case "stale":
      return "Transcript updates are delayed. Aurora is reconnecting automatically.";
    case "reconnecting":
      return "Reconnecting to the live session…";
    case "degraded":
      return "Live connection interrupted — updating via backup polling.";
    case "offline":
      return "You appear to be offline. Aurora will resume automatically when you're back.";
    default:
      return null;
  }
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
    <div className="animate-slide-up rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}
