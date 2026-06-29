import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Lock,
  ChevronDown,
  Copy,
  StickyNote,
  Share2,
  ShieldAlert,
  EyeOff,
  X,
} from "lucide-react";
import {
  deepAnswer,
  quickReply,
  strongAnswer,
  TONE_TRANSFORMS,
  type CopilotSuggestion,
} from "@/lib/copilot";

export type CopilotStatus =
  | "idle"
  | "listening"
  | "question"
  | "preparing"
  | "ready";

const STATUS_LABEL: Record<CopilotStatus, string> = {
  idle: "Idle",
  listening: "Listening",
  question: "Question Detected",
  preparing: "Preparing Answer",
  ready: "Ready",
};

const DEPTHS = ["Quick Reply", "Strong Answer", "Deep Answer"] as const;
type Depth = (typeof DEPTHS)[number];

/**
 * Floating, host-only private overlay. Collapsed = a discreet pill; expanded =
 * the detected question + answer depths + tone tools + actions. "Publish to
 * Transcript" always asks for confirmation — private answers are never shared
 * automatically.
 */
export function CopilotOverlay({
  collapsed,
  onToggle,
  status,
  suggestion,
  shortcutLabel,
  privacyMode = false,
  onAutoHide,
  onCopy,
  onAddNote,
  onPublish,
}: {
  collapsed: boolean;
  onToggle: () => void;
  status: CopilotStatus;
  suggestion: CopilotSuggestion | null;
  shortcutLabel: string;
  /** Privacy Mode blurs/locks the answer and auto-hides on inactivity. This is
   *  shoulder-surfing protection only — content is NOT hidden from screen share,
   *  recording, or monitoring tools. */
  privacyMode?: boolean;
  onAutoHide?: () => void;
  onCopy: (text: string) => void;
  onAddNote: (text: string) => void;
  onPublish: (text: string) => void;
}) {
  const [depth, setDepth] = useState<Depth>("Strong Answer");
  const [override, setOverride] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [activity, setActivity] = useState(0);

  // Reset tone/confirm + re-lock the answer whenever a new suggestion arrives.
  useEffect(() => {
    setOverride(null);
    setConfirming(false);
    setRevealed(false);
  }, [suggestion?.id]);

  // Re-lock immediately when Privacy Mode is switched on.
  useEffect(() => {
    if (privacyMode) setRevealed(false);
  }, [privacyMode]);

  // Auto-hide (collapse) the overlay after inactivity while Privacy Mode is on.
  // Resets on any interaction. Purely a privacy convenience, not stealth.
  useEffect(() => {
    if (!privacyMode || collapsed) return;
    const t = setTimeout(() => onAutoHide?.(), 30_000);
    return () => clearTimeout(t);
  }, [privacyMode, collapsed, suggestion?.id, revealed, activity, onAutoHide]);

  const locked = privacyMode && !revealed;

  const baseText = useMemo(() => {
    if (!suggestion) return "";
    if (depth === "Quick Reply") return quickReply(suggestion);
    if (depth === "Deep Answer") return deepAnswer(suggestion);
    return strongAnswer(suggestion);
  }, [suggestion, depth]);

  const text = override ?? baseText;
  const live = status === "listening" || status === "question" || status === "preparing" || status === "ready";

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="pointer-events-auto w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-indigo-400/20 bg-[rgba(12,16,28,0.82)] text-slate-100 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl"
            style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
            role="dialog"
            aria-label="Aurora private assistant"
            onMouseMove={() => setActivity((a) => a + 1)}
            onPointerDown={() => setActivity((a) => a + 1)}
            onKeyDownCapture={() => setActivity((a) => a + 1)}
          >
            {/* header */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <Sparkles className="h-4 w-4 text-indigo-300" />
              <span className="text-sm font-semibold tracking-tight">Aurora Private</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
                <Lock className="h-2.5 w-2.5" /> Host only
              </span>
              {privacyMode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                  <Lock className="h-2.5 w-2.5" /> Privacy
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    live ? "animate-pulse bg-emerald-400" : "bg-slate-500"
                  }`}
                />
                {STATUS_LABEL[status]}
              </span>
              <button
                onClick={onToggle}
                className="ml-1 rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                aria-label="Collapse private assistant"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {!suggestion ? (
                <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-xs leading-relaxed text-slate-400">
                  No question detected yet. Aurora will surface suggestions when the
                  conversation needs help.
                </p>
              ) : (
                <>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Detected question
                  </p>
                  <p className="mt-1 text-sm font-medium text-indigo-200">
                    “{suggestion.question}”
                  </p>
                  {!suggestion.configured && (
                    <span className="mt-2 inline-block rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                      Demo output — not real AI
                    </span>
                  )}

                  {/* depth tabs */}
                  <div className="mt-3 flex gap-1 rounded-xl bg-white/[0.04] p-1">
                    {DEPTHS.map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setDepth(d);
                          setOverride(null);
                        }}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                          depth === d
                            ? "bg-indigo-500/30 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  <div className="relative mt-3">
                    <pre
                      className={`whitespace-pre-wrap break-words rounded-xl border border-white/[0.06] bg-black/30 p-3 font-sans text-sm leading-relaxed text-slate-100 transition ${
                        locked ? "select-none blur-sm" : ""
                      }`}
                      aria-hidden={locked}
                    >
                      {text}
                    </pre>
                    {locked && (
                      <button
                        onClick={() => setRevealed(true)}
                        className="absolute inset-0 grid place-items-center rounded-xl bg-black/20"
                        aria-label="Reveal private answer"
                      >
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(12,16,28,0.92)] px-3 py-1.5 text-[11px] font-medium text-slate-200 ring-1 ring-white/10">
                          <Lock className="h-3 w-3" /> Private — tap to reveal
                        </span>
                      </button>
                    )}
                  </div>
                  {privacyMode && revealed && (
                    <button
                      onClick={() => setRevealed(false)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      <EyeOff className="h-3 w-3" /> Hide again
                    </button>
                  )}

                  {suggestion.confidence && (
                    <p className="mt-2 text-[11px] text-slate-400">
                      Confidence:{" "}
                      <span
                        className={
                          suggestion.confidence === "high"
                            ? "text-emerald-300"
                            : suggestion.confidence === "medium"
                              ? "text-amber-300"
                              : "text-slate-300"
                        }
                      >
                        {suggestion.confidence}
                      </span>
                    </p>
                  )}

                  {/* tone tools */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {TONE_TRANSFORMS.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => setOverride(t.fn(baseText))}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 hover:border-indigo-400/40 hover:text-white"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* actions */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <Action icon={Copy} label="Copy" onClick={() => onCopy(text)} />
                    <Action
                      icon={StickyNote}
                      label="Add to Private Notes"
                      onClick={() => onAddNote(text)}
                    />
                  </div>

                  {/* publish requires confirmation */}
                  {confirming ? (
                    <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-200">
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        This publishes a private answer to the shared transcript that
                        viewers can see. Continue?
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => {
                            onPublish(text);
                            setConfirming(false);
                          }}
                          className="flex-1 rounded-lg bg-amber-400 px-2 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-300"
                        >
                          Publish to viewers
                        </button>
                        <button
                          onClick={() => setConfirming(false)}
                          className="flex-1 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-white/5"
                        >
                          Keep private
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(true)}
                      className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] font-medium text-slate-300 hover:border-indigo-400/40 hover:text-white"
                    >
                      <Share2 className="h-3.5 w-3.5" /> Publish to Transcript…
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* collapsed pill (always present) */}
      <button
        onClick={onToggle}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-[rgba(12,16,28,0.9)] px-4 py-2.5 text-xs font-medium text-slate-200 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl transition hover:border-indigo-400/50"
        style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
        aria-expanded={!collapsed}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${
              live ? "animate-ping bg-emerald-400/60" : ""
            }`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              live ? "bg-emerald-400" : "bg-slate-500"
            }`}
          />
        </span>
        Aurora Private • {STATUS_LABEL[status]} • {shortcutLabel}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`}
        />
      </button>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] font-medium text-slate-300 hover:border-indigo-400/40 hover:text-white"
      type="button"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
