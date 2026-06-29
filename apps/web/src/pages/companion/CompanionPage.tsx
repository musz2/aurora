import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Sparkles,
  Lock,
  Send,
  Zap,
  ArrowRight,
  ShieldCheck,
  Share2,
  StickyNote,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

/** UI mode → server assistant mode. */
const COMPANION_MODES: { label: string; assistantMode: string }[] = [
  { label: "Interview", assistantMode: "Interview" },
  { label: "Sales", assistantMode: "Sales Call" },
  { label: "Technical", assistantMode: "Technical Meeting" },
  { label: "Recruiting", assistantMode: "Recruiting" },
  { label: "Client", assistantMode: "Client Call" },
  { label: "Standup", assistantMode: "Daily Standup" },
  { label: "Demo", assistantMode: "General Meeting" },
  { label: "General", assistantMode: "General Meeting" },
];

interface Structured {
  answer: string;
  talkingPoints: string[];
  followUpQuestion: string;
  risk: string;
  nextStep: string;
  confidence: "low" | "medium" | "high";
}
interface SessionData {
  meeting: { id: string; title: string; status: string; demoMode: boolean };
  transcript: { id: string; speakerName: string; text: string }[];
  privateNotes: { id: string; text: string }[];
}

function readToken(): string {
  // Token travels in the URL fragment so it is not sent to the server on page
  // load and stays out of server logs / referrers.
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return params.get("t") ?? "";
}

export function CompanionPage() {
  const token = useMemo(readToken, []);
  const client = useMemo(
    () =>
      axios.create({
        baseURL: `${API_BASE_URL}/companion`,
        headers: { "x-companion-token": token },
      }),
    [token]
  );

  const [status, setStatus] = useState<"loading" | "ok" | "invalid">("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [mode, setMode] = useState(COMPANION_MODES[0].label);
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState<Structured | null>(null);
  const [configured, setConfigured] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [published, setPublished] = useState<string[]>([]);
  const toastTimer = useRef<number>();

  const assistantMode =
    COMPANION_MODES.find((m) => m.label === mode)?.assistantMode ?? "General Meeting";

  const flash = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  };

  const loadSession = async () => {
    if (!token) return setStatus("invalid");
    try {
      const { data } = await client.get<SessionData>("/session");
      setSession(data);
      setStatus("ok");
    } catch {
      setStatus("invalid");
    }
  };

  useEffect(() => {
    loadSession();
    const t = setInterval(loadSession, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const sendAsk = async (question: string) => {
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setConfirming(false);
    try {
      const { data } = await client.post<{ suggestion: Structured; configured: boolean }>(
        "/ask",
        { question: q, mode: assistantMode }
      );
      setAnswer(data.suggestion);
      setConfigured(data.configured);
      // Pre-fill the editable draft with a readable, publishable version.
      setDraft(
        [
          data.suggestion.answer,
          ...data.suggestion.talkingPoints.map((p) => `• ${p}`),
        ].join("\n")
      );
      setAsk("");
    } catch {
      flash("Could not get an answer. The link may have expired.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await client.post("/publish", { text });
      setPublished((prev) => [text, ...prev]);
      setConfirming(false);
      flash("Published to viewers — labelled “Published by Host”.");
    } catch {
      flash("Could not publish.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "invalid") {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[rgba(12,16,28,0.85)] p-8 text-center">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-400" />
          <h1 className="mt-4 text-xl font-semibold text-white">Companion link inactive</h1>
          <p className="mt-2 text-sm text-slate-400">
            This pairing link is invalid, expired, or has been revoked by the host.
            Generate a new link from the live meeting page.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        {/* header */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-400/20 bg-[rgba(12,16,28,0.85)] px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 text-indigo-200">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white">
              {session?.meeting.title ?? "Companion"}
            </h1>
            <p className="text-[11px] text-slate-400">Aurora Companion · host-only second screen</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-medium text-indigo-200">
            <Lock className="h-3 w-3" /> Private
          </span>
          {session?.meeting.status === "RECORDING" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" /> REC
            </span>
          )}
        </div>

        {/* mode + ask */}
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[rgba(12,16,28,0.82)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-400/50"
              aria-label="Meeting mode"
            >
              {COMPANION_MODES.map((m) => (
                <option key={m.label} value={m.label} className="bg-[#0b1020]">
                  {m.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => sendAsk("What should I say next?")}
              disabled={busy}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] text-slate-300 hover:border-indigo-400/40 hover:text-white disabled:opacity-50"
            >
              What should I say next?
            </button>
            <button
              onClick={() => sendAsk("Summarize the last 2 minutes")}
              disabled={busy}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] text-slate-300 hover:border-indigo-400/40 hover:text-white disabled:opacity-50"
            >
              Summarize last 2 minutes
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendAsk(ask);
            }}
            className="mt-3 flex items-center gap-2"
          >
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Ask Aurora privately…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/50"
            />
            <button
              type="submit"
              disabled={busy || !ask.trim()}
              className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50"
              aria-label="Ask privately"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* private answer */}
        <div className="mt-4 rounded-2xl border border-indigo-400/20 bg-[rgba(12,16,28,0.82)] p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-300" />
            <span className="text-sm font-semibold text-white">Private answer</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
              <Lock className="h-2.5 w-2.5" /> Private
            </span>
          </div>
          {!answer ? (
            <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-xs text-slate-400">
              No answer yet. Ask a question or use a quick action above.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {!configured && (
                <span className="inline-block rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  Demo output — not real AI
                </span>
              )}
              <Block icon={Zap} label="Quick reply">{answer.answer}</Block>
              <Block icon={ArrowRight} label="Talking points">
                {answer.talkingPoints.map((p) => `• ${p}`).join("\n")}
              </Block>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Mini label="Follow-up" text={answer.followUpQuestion} />
                <Mini label="Watch out" text={answer.risk} />
                <Mini label="Next step" text={answer.nextStep} />
                <Mini label="Confidence" text={answer.confidence} />
              </div>

              {/* edit before publish */}
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">
                  Edit before publishing
                </p>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
                />
              </div>

              <button
                onClick={() => setConfirming(true)}
                disabled={!draft.trim() || busy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500/90 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" /> Publish to Viewer
              </button>
            </div>
          )}
        </div>

        {/* context + notes */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card icon={RefreshCw} title="Recent transcript">
            {session?.transcript.length ? (
              <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                {session.transcript.slice(-10).map((s) => (
                  <p key={s.id} className="text-xs text-slate-300">
                    <span className="font-medium text-indigo-300">{s.speakerName}:</span>{" "}
                    {s.text}
                  </p>
                ))}
              </div>
            ) : (
              <Empty>Waiting for conversation…</Empty>
            )}
          </Card>
          <Card icon={StickyNote} title="Private notes">
            {session?.privateNotes.length ? (
              <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                {session.privateNotes.map((n) => (
                  <p key={n.id} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300">
                    {n.text}
                  </p>
                ))}
              </div>
            ) : (
              <Empty>Host-only notes appear here.</Empty>
            )}
          </Card>
        </div>

        {published.length > 0 && (
          <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
            <p className="text-[11px] uppercase tracking-wide text-emerald-300">
              Published to viewers
            </p>
            <div className="mt-2 space-y-1.5">
              {published.slice(0, 5).map((p, i) => (
                <p key={i} className="text-xs text-emerald-100">{p}</p>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Consent-first. Viewers see only what you explicitly publish.
        </p>
      </div>

      {/* publish confirmation */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[rgba(12,16,28,0.96)] p-6">
            <h2 className="text-lg font-semibold text-white">Publish to viewers?</h2>
            <p className="mt-2 text-sm text-slate-400">
              This makes the edited answer visible to everyone viewing the shared
              session, labelled “Published by Host”. Private notes, drafts, and context
              are never shared.
            </p>
            <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 font-sans text-xs text-slate-200">
              {draft}
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                onClick={publish}
                disabled={busy}
                className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                Publish to viewers
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                Keep private
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[rgba(12,16,28,0.95)] px-4 py-2 text-xs text-slate-200 shadow-lg">
          {toast}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#05070D] px-4 py-6 text-slate-200"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}

function Block({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-300">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <pre className="mt-1.5 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-200">
        {children}
      </pre>
    </div>
  );
}

function Mini({ label, text }: { label: string; text?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs text-slate-300">{text ?? "—"}</p>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[rgba(12,16,28,0.82)] p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
        <Icon className="h-4 w-4 text-indigo-300" /> {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}
