import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Radio,
  Square,
  ShieldCheck,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Send,
  Zap,
  Clock,
  ArrowRight,
  StickyNote,
  Share2,
  Search as SearchIcon,
  ListChecks,
  Settings as SettingsIcon,
  MessageSquare,
  PlayCircle,
  AlertTriangle,
} from "lucide-react";
import { SOCKET_EVENTS, type SessionMode } from "@aurora/shared";
import { api, apiError } from "@/lib/api";
import { AuroraSocket } from "@/lib/ws";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useConfig } from "@/lib/useConfig";
import { useToast } from "@/components/ui/Toast";
import { CopilotOverlay, type CopilotStatus } from "@/components/app/CopilotOverlay";
import {
  COPILOT_MODES,
  toAssistantMode,
  type CopilotMode,
  type CopilotSuggestion,
} from "@/lib/copilot";
import { formatClock } from "@/lib/format";

type Tab =
  | "Private Assist"
  | "Live Transcript"
  | "Smart Notes"
  | "Action Items"
  | "Search Memory"
  | "Settings";

const TABS: { id: Tab; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "Private Assist", icon: Sparkles },
  { id: "Live Transcript", icon: MessageSquare },
  { id: "Smart Notes", icon: StickyNote },
  { id: "Action Items", icon: ListChecks },
  { id: "Search Memory", icon: SearchIcon },
  { id: "Settings", icon: SettingsIcon },
];

interface Seg {
  id: string;
  speakerName: string;
  text: string;
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUT_LABEL = isMac ? "⌘⇧A" : "Ctrl⇧A";

export function CopilotPage() {
  const mic = useMicrophone();
  const config = useConfig();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("Private Assist");
  const [mode, setMode] = useState<CopilotMode>("Meeting");
  const [recording, setRecording] = useState(false);
  const [sessionMode, setSessionMode] = useState<SessionMode>("demo");
  const [status, setStatus] = useState<CopilotStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [segments, setSegments] = useState<Seg[]>([]);
  const [interim, setInterim] = useState<string>("");
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [notes, setNotes] = useState<{ id: string; text: string }[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [ask, setAsk] = useState("");
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);
  // Privacy Mode: blur/lock private answers + auto-hide on inactivity. This is
  // shoulder-surfing protection only — it never hides content from screen share,
  // recording, or monitoring tools. On by default for a private copilot.
  const [privacyMode, setPrivacyMode] = useState(true);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [published, setPublished] = useState<string[]>([]);
  const [showConsent, setShowConsent] = useState(false);
  const [consented, setConsented] = useState(false);
  const [pendingMode, setPendingMode] = useState<SessionMode>("demo");
  const [sttError, setSttError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    { references: { meetingTitle: string; snippet: string; speakerName?: string }[] } | null
  >(null);

  const socketRef = useRef<AuroraSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const meetingIdRef = useRef<string>("");
  const timerRef = useRef<number>();

  const latest = suggestions[0] ?? null;

  useEffect(() => () => cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: Cmd/Ctrl + Shift + A toggles the private overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setOverlayCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Re-lock the in-page private answer when a new one arrives or Privacy Mode is
  // turned on (the host taps to reveal).
  useEffect(() => {
    if (privacyMode) setAnswerRevealed(false);
  }, [latest?.id, privacyMode]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive")
      recorderRef.current.stop();
    mic.stop();
    socketRef.current?.close();
  };

  const requestStart = (m: SessionMode) => {
    setPendingMode(m);
    setConsented(false);
    setShowConsent(true);
  };

  const begin = async () => {
    const m = pendingMode;
    setShowConsent(false);
    setSessionMode(m);
    setSegments([]);
    setSuggestions([]);
    setInterim("");
    setSttError(null);
    setElapsed(0);

    let stream: MediaStream | null = null;
    if (m === "real") {
      stream = await mic.start();
      if (!stream) {
        toast(mic.error ?? "Microphone access is required.", "error");
        return;
      }
    }

    try {
      const { data } = await api.post("/meetings", {
        title: `Copilot — ${mode}`,
        source: "LIVE",
      });
      meetingIdRef.current = data.meeting.id;
    } catch {
      meetingIdRef.current = "";
    }

    const socket = new AuroraSocket().connect();
    socketRef.current = socket;

    socket.on(SOCKET_EVENTS.TRANSCRIPT_PARTIAL, (p) => {
      setInterim(p.text);
    });
    socket.on(SOCKET_EVENTS.TRANSCRIPT_SEGMENT, (s) => {
      setInterim("");
      setSegments((prev) =>
        prev.some((x) => x.id === s.id)
          ? prev
          : [...prev, { id: s.id, speakerName: s.speakerName, text: s.text }]
      );
      if (typeof s.text === "string" && s.text.includes("?")) setStatus("question");
      else setStatus("listening");
    });
    socket.on(SOCKET_EVENTS.TRANSCRIPT_ERROR, (e) => {
      setSttError(e.message);
      setStatus("listening");
    });
    socket.on(SOCKET_EVENTS.AI_SUGGESTION, (s) => {
      setSuggestions((prev) => [
        {
          id: crypto.randomUUID(),
          question: s.question,
          suggestion: s.suggestion,
          configured: s.configured !== false,
          mode: s.mode,
          intent: s.intent,
          confidence: s.confidence ?? s.structured?.confidence,
          structured: s.structured,
        },
        ...prev,
      ]);
      setStatus("ready");
    });
    socket.on(SOCKET_EVENTS.AI_ERROR, (e) =>
      toast(e.message ?? "Assistant unavailable.", "error")
    );

    socket.send(SOCKET_EVENTS.MEETING_START, {
      meetingId: meetingIdRef.current,
      mode: m,
      assistantMode: toAssistantMode(mode),
    });

    if (m === "real" && stream) {
      try {
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) socket.sendBinary(e.data);
        };
        recorder.start(150);
      } catch {
        toast("Could not start audio recorder on this browser.", "error");
      }
    }

    setRecording(true);
    setStatus("listening");
    timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive")
      recorderRef.current.stop();
    socketRef.current?.send(SOCKET_EVENTS.MEETING_STOP, {
      meetingId: meetingIdRef.current,
    });
    mic.stop();
    socketRef.current?.close();
    setRecording(false);
    setStatus("idle");
    toast("Private session ended.", "success");
  };

  const sendAsk = (question: string) => {
    const q = question.trim();
    if (!q) return;
    if (!recording) {
      toast("Start a session to ask the private assistant.", "error");
      return;
    }
    socketRef.current?.send(SOCKET_EVENTS.AI_ASK_LIVE, {
      question: q,
      assistantMode: toAssistantMode(mode),
    });
    setStatus("preparing");
    setAsk("");
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Copied — stays private until you publish.", "success");
  };

  const addNote = (text: string) => {
    if (meetingIdRef.current) {
      api
        .post(`/meetings/${meetingIdRef.current}/private-notes`, { text })
        .then((res) =>
          setNotes((prev) => [
            { id: res.data.note.id, text: res.data.note.suggestion },
            ...prev,
          ])
        )
        .catch(() => toast("Could not save note", "error"));
    } else {
      setNotes((prev) => [{ id: crypto.randomUUID(), text }, ...prev]);
    }
    toast("Saved to private notes", "success");
  };

  // Publish requires explicit confirmation (handled in overlay / button).
  const publish = (text: string) => {
    if (!meetingIdRef.current) {
      toast("Start a session before publishing.", "error");
      return;
    }
    api
      .post(`/meetings/${meetingIdRef.current}/transcript`, {
        speakerName: "Host (published)",
        text,
        startTime: elapsed,
        endTime: elapsed,
      })
      .then(() => {
        setSegments((prev) => [
          ...prev,
          { id: crypto.randomUUID(), speakerName: "Host (published)", text },
        ]);
        setPublished((prev) => [text, ...prev].slice(0, 30));
        toast("Published to the shared transcript", "success");
      })
      .catch(() => toast("Could not publish", "error"));
  };

  const runSearch = async () => {
    if (!search.trim()) return;
    try {
      const { data } = await api.get("/search", { params: { q: search.trim() } });
      setSearchResults({ references: data.references ?? [] });
    } catch (err) {
      toast(apiError(err, "Search failed"), "error");
    }
  };

  return (
    <div
      className="overflow-hidden rounded-3xl border border-white/[0.06] bg-[#05070D] text-slate-200"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 text-indigo-200">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Aurora Private Copilot
            </h1>
            <p className="text-[11px] text-slate-400">
              Host-only · private by default · {SHORTCUT_LABEL} to toggle overlay
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-medium text-indigo-200">
          <Lock className="h-3 w-3" /> Private
        </span>

        {/* Privacy Mode toggle (shoulder-surfing protection: blur/lock + auto-hide) */}
        <button
          onClick={() => setPrivacyMode((p) => !p)}
          aria-pressed={privacyMode}
          title="Blur/lock private answers and auto-hide the overlay. Does not hide content from screen sharing or monitoring."
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            privacyMode
              ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
              : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
          }`}
        >
          {privacyMode ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          Privacy Mode {privacyMode ? "on" : "off"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {recording && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              REC {formatClock(elapsed)}
            </span>
          )}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CopilotMode)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-400/50"
            aria-label="Copilot mode"
          >
            {COPILOT_MODES.map((m) => (
              <option key={m} value={m} className="bg-[#0b1020]">
                {m}
              </option>
            ))}
          </select>
          {!recording ? (
            <>
              <button
                onClick={() => requestStart("real")}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                <Radio className="h-4 w-4" /> Start
              </button>
              <button
                onClick={() => requestStart("demo")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                <PlayCircle className="h-4 w-4" /> Demo
              </button>
            </>
          ) : (
            <button
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              <Square className="h-4 w-4" /> End
            </button>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id
                ? "bg-indigo-500/20 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.id}
          </button>
        ))}
      </div>

      {!config.services.liveTranscription && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-2.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Live STT not configured. Real sessions need DEEPGRAM_API_KEY; use Demo to
          preview with clearly-labelled sample data.
        </div>
      )}

      <div className="p-4">
        {tab === "Private Assist" && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Live Context */}
            <Panel title="Live Context" icon={Radio}>
              <StatusRow status={status} />
              <div className="mt-3 max-h-[44vh] space-y-2 overflow-y-auto pr-1">
                {segments.length === 0 && !interim ? (
                  <Empty>
                    {recording
                      ? "Listening… the conversation will appear here."
                      : "Start a session to capture live context."}
                  </Empty>
                ) : (
                  <>
                    {segments.slice(-12).map((s) => (
                      <p key={s.id} className="text-xs leading-relaxed text-slate-300">
                        <span className="font-medium text-indigo-300">
                          {s.speakerName}:
                        </span>{" "}
                        {s.text}
                      </p>
                    ))}
                    {interim && (
                      <p className="text-xs italic text-slate-500">{interim}…</p>
                    )}
                  </>
                )}
              </div>
            </Panel>

            {/* Private Answer Panel */}
            <Panel title="Private Answer" icon={Sparkles} highlight>
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
                  <Lock className="h-2.5 w-2.5" /> Private
                </span>
                {privacyMode && latest && (
                  <button
                    onClick={() => setAnswerRevealed((r) => !r)}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    {answerRevealed ? (
                      <>
                        <EyeOff className="h-3 w-3" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" /> Reveal
                      </>
                    )}
                  </button>
                )}
              </div>
              {!latest ? (
                <Empty>
                  No question detected yet. Aurora will surface suggestions when the
                  conversation needs help.
                </Empty>
              ) : (
                <div className="relative">
                  <div
                    className={`space-y-3 transition ${
                      privacyMode && !answerRevealed ? "select-none blur-sm" : ""
                    }`}
                    aria-hidden={privacyMode && !answerRevealed}
                  >
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Detected question
                  </p>
                  <p className="text-sm font-medium text-indigo-200">
                    “{latest.question}”
                  </p>
                  <AnswerBlock icon={Zap} label="Quick Reply">
                    {latest.structured?.answer ?? latest.suggestion}
                  </AnswerBlock>
                  {latest.structured && (
                    <>
                      <AnswerBlock icon={ArrowRight} label="Talking points">
                        {latest.structured.talkingPoints.map((p) => `• ${p}`).join("\n")}
                      </AnswerBlock>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <MiniBlock label="Follow-up" text={latest.structured.followUpQuestion} />
                        <MiniBlock label="Watch out" text={latest.structured.risk} />
                        <MiniBlock label="Next step" text={latest.structured.nextStep} />
                        <MiniBlock
                          label="Confidence"
                          text={latest.confidence ?? latest.structured.confidence}
                        />
                      </div>
                    </>
                  )}
                  {!latest.configured && (
                    <p className="rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-300">
                      Demo output — not real AI. Configure OPENAI_API_KEY for live answers.
                    </p>
                  )}
                  </div>
                  {privacyMode && !answerRevealed && (
                    <button
                      onClick={() => setAnswerRevealed(true)}
                      className="absolute inset-0 grid place-items-center rounded-xl bg-black/10"
                      aria-label="Reveal private answer"
                    >
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(12,16,28,0.92)] px-3 py-1.5 text-[11px] font-medium text-slate-200 ring-1 ring-white/10">
                        <Lock className="h-3 w-3" /> Private — tap to reveal
                      </span>
                    </button>
                  )}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendAsk(ask);
                }}
                className="mt-4 flex items-center gap-2"
              >
                <input
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  disabled={!recording}
                  placeholder="Ask Aurora privately…"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/50 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!recording || !ask.trim()}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50"
                  aria-label="Ask privately"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Give me the answer now", "Summarize the last 2 minutes", "What should I say next?"].map(
                  (q) => (
                    <button
                      key={q}
                      onClick={() => sendAsk(q)}
                      disabled={!recording}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 hover:border-indigo-400/40 hover:text-white disabled:opacity-40"
                    >
                      {q}
                    </button>
                  )
                )}
              </div>
            </Panel>

            {/* Meeting Memory */}
            <Panel title="Meeting Memory" icon={Clock}>
              <div className="flex items-center gap-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Recent suggestions
                </p>
                <LabelChip kind="private" />
              </div>
              <div className="mt-2 max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                {suggestions.length === 0 ? (
                  <Empty>Suggestions you receive are remembered here for the session.</Empty>
                ) : (
                  suggestions.slice(0, 12).map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
                    >
                      <p className="text-[11px] font-medium text-indigo-300">
                        “{s.question}”
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                        {s.structured?.answer ?? s.suggestion}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Published to viewers
                </p>
                <LabelChip kind="published" />
              </div>
              <div className="mt-2 max-h-[16vh] space-y-2 overflow-y-auto pr-1">
                {published.length === 0 ? (
                  <Empty>Nothing published. Private answers stay private until you confirm.</Empty>
                ) : (
                  published.slice(0, 8).map((p, i) => (
                    <p
                      key={`${i}-${p.slice(0, 12)}`}
                      className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1.5 text-xs text-emerald-200"
                    >
                      {p}
                    </p>
                  ))
                )}
              </div>
            </Panel>
          </div>
        )}

        {tab === "Live Transcript" && (
          <Panel title="Live Transcript" icon={MessageSquare} subtitle="Shared transcript — visible to viewers if you share the session.">
            <div className="mb-2">
              <LabelChip kind="shared" />
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {segments.length === 0 ? (
                <Empty>No transcript yet.</Empty>
              ) : (
                segments.map((s) => (
                  <p key={s.id} className="text-sm leading-relaxed text-slate-300">
                    <span className="font-medium text-indigo-300">{s.speakerName}:</span>{" "}
                    {s.text}
                  </p>
                ))
              )}
              {interim && <p className="text-sm italic text-slate-500">{interim}…</p>}
            </div>
          </Panel>
        )}

        {tab === "Smart Notes" && (
          <Panel title="Smart Notes" icon={StickyNote} subtitle="Private notes — host-only, never shared.">
            <div className="flex gap-2">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Capture a private thought…"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/50"
              />
              <button
                onClick={() => {
                  if (!noteDraft.trim()) return;
                  addNote(noteDraft.trim());
                  setNoteDraft("");
                }}
                className="rounded-xl bg-indigo-500 px-4 text-sm font-medium text-white hover:bg-indigo-400"
              >
                Save
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {notes.length === 0 ? (
                <Empty>Private notes stay host-only.</Empty>
              ) : (
                notes.map((n) => (
                  <p
                    key={n.id}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-300"
                  >
                    {n.text}
                  </p>
                ))
              )}
            </div>
          </Panel>
        )}

        {tab === "Action Items" && (
          <Panel title="Action Items" icon={ListChecks} subtitle="Action items are generated when you finalize a meeting.">
            <Empty>
              End and summarize a session from the Live Meeting console to extract
              action items, decisions, and a follow-up email.
            </Empty>
          </Panel>
        )}

        {tab === "Search Memory" && (
          <Panel title="Search Memory" icon={SearchIcon} subtitle="Search across your meeting history with cited sources.">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch();
              }}
              className="flex gap-2"
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search meetings, decisions, transcript…"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400/50"
              />
              <button className="rounded-xl bg-indigo-500 px-4 text-sm font-medium text-white hover:bg-indigo-400">
                Search
              </button>
            </form>
            <div className="mt-3 space-y-2">
              {searchResults?.references?.length ? (
                searchResults.references.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <p className="text-[11px] font-medium text-indigo-300">
                      {r.meetingTitle}
                      {r.speakerName ? ` · ${r.speakerName}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{r.snippet}</p>
                  </div>
                ))
              ) : searchResults ? (
                <Empty>No matches found.</Empty>
              ) : (
                <Empty>Search your meeting history with citation-style references.</Empty>
              )}
            </div>
          </Panel>
        )}

        {tab === "Settings" && (
          <Panel title="Settings" icon={SettingsIcon}>
            <div className="space-y-4 text-sm text-slate-300">
              <Setting
                icon={Lock}
                title="Private by default"
                body="Copilot answers and notes are host-only. They are never sent to the shared viewer unless you explicitly publish them (with confirmation)."
              />
              <Setting
                icon={privacyMode ? Lock : Unlock}
                title={`Privacy Mode (${privacyMode ? "on" : "off"})`}
                body="Blurs private answers and auto-hides the overlay after inactivity, as a shoulder-surfing convenience for people physically near your screen. Content remains fully visible to screen sharing and recording — Aurora is consent-first and keeps sessions transparent to participants."
              />
              <Setting
                icon={Eye}
                title="Visible recording"
                body="A recording indicator stays visible while a session is live. Aurora never hides or disguises recording."
              />
              <Setting
                icon={ShieldCheck}
                title="Consent-first"
                body="Every session begins with a consent acknowledgement. Ensure all participants are informed per your policy."
              />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-xs font-medium text-slate-200">Keyboard</p>
                <p className="mt-1 text-xs text-slate-400">
                  Toggle the private overlay with{" "}
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">
                    {SHORTCUT_LABEL}
                  </kbd>
                  .
                </p>
              </div>
            </div>
          </Panel>
        )}
      </div>

      {sttError && (
        <div className="mx-4 mb-4 rounded-xl border border-red-400/20 bg-red-500/[0.08] px-4 py-2.5 text-xs text-red-300">
          {sttError}
        </div>
      )}

      {/* floating private overlay */}
      <CopilotOverlay
        collapsed={overlayCollapsed}
        onToggle={() => setOverlayCollapsed((c) => !c)}
        status={status}
        suggestion={latest}
        shortcutLabel={SHORTCUT_LABEL}
        privacyMode={privacyMode}
        onAutoHide={() => setOverlayCollapsed(true)}
        onCopy={copy}
        onAddNote={addNote}
        onPublish={publish}
      />

      {/* consent modal */}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[rgba(12,16,28,0.95)] p-6 text-slate-200 backdrop-blur-xl"
            style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <h2 className="text-lg font-semibold text-white">
                {pendingMode === "demo" ? "Play demo session" : "Recording consent"}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              {pendingMode === "demo"
                ? "This is a clearly-labelled demo using sample transcript data — no microphone is recorded."
                : "This session may be recorded and transcribed. Make sure all required participants have been informed and consent has been obtained per applicable laws and policy."}
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-indigo-500"
              />
              <span className="text-sm text-slate-200">
                {pendingMode === "demo"
                  ? "I understand this is sample demo data."
                  : "I confirm I have permission to record/transcribe this session."}
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowConsent(false)}
                className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                disabled={!consented}
                onClick={begin}
                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {pendingMode === "demo" ? "Play demo" : "Start session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ small pieces ------------------------------ */

function Panel({
  title,
  subtitle,
  icon: Icon,
  highlight,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border bg-[rgba(12,16,28,0.82)] p-4 ${
        highlight ? "border-indigo-400/25" : "border-white/[0.06]"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-indigo-300" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {subtitle && <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-xs leading-relaxed text-slate-400">
      {children}
    </p>
  );
}

/** Private / Shared / Published trust labels. */
function LabelChip({ kind }: { kind: "private" | "shared" | "published" }) {
  const map = {
    private: { label: "Private", cls: "bg-indigo-500/15 text-indigo-200", icon: Lock },
    shared: { label: "Shared", cls: "bg-sky-500/15 text-sky-200", icon: Eye },
    published: { label: "Published", cls: "bg-emerald-500/15 text-emerald-200", icon: Share2 },
  } as const;
  const { label, cls, icon: Icon } = map[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      <Icon className="h-2.5 w-2.5" /> {label}
    </span>
  );
}

function StatusRow({ status }: { status: CopilotStatus }) {
  const label: Record<CopilotStatus, string> = {
    idle: "Idle",
    listening: "Listening",
    question: "Question Detected",
    preparing: "Preparing Answer",
    ready: "Ready",
  };
  const live = status !== "idle";
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1 text-[11px] text-slate-300">
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-slate-500"}`}
      />
      {label[status]}
    </div>
  );
}

function AnswerBlock({
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

function MiniBlock({ label, text }: { label: string; text?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs text-slate-300">{text ?? "—"}</p>
    </div>
  );
}

function Setting({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
      <div>
        <p className="text-xs font-medium text-slate-200">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{body}</p>
      </div>
    </div>
  );
}
