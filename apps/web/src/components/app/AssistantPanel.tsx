import { useState } from "react";
import type React from "react";
import {
  ClipboardList,
  Copy,
  Loader2,
  Lock,
  Sparkles,
  Share2,
  StickyNote,
  CheckCircle2,
  ListChecks,
  MessageCircleQuestion,
  Clock,
  ShieldAlert,
  Wand2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/** Server-side assistant modes (must match private-assistant.service on the API). */
export const ASSISTANT_MODES = [
  "Interview",
  "Sales Call",
  "Technical Meeting",
  "Client Call",
  "Daily Standup",
  "Recruiting",
  "Leadership Meeting",
  "General Meeting",
] as const;

export type AssistantMode = (typeof ASSISTANT_MODES)[number];

/** Host-facing mode labels mapped to the server AssistantMode value. */
const MODE_OPTIONS: { label: string; value: AssistantMode }[] = [
  { label: "General Meeting", value: "General Meeting" },
  { label: "Technical Interview", value: "Interview" },
  { label: "Sales Call", value: "Sales Call" },
  { label: "Recruiting Screen", value: "Recruiting" },
  { label: "Client Meeting", value: "Client Call" },
  { label: "Standup", value: "Daily Standup" },
  { label: "Leadership Meeting", value: "Leadership Meeting" },
];

const QUICK_ACTIONS: { label: string; actionType: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Answer latest question", actionType: "answer_latest", icon: MessageCircleQuestion },
  { label: "Summarize last 2 minutes", actionType: "summarize_2min", icon: Clock },
  { label: "Give talking points", actionType: "talking_points", icon: ListChecks },
  { label: "Draft follow-up question", actionType: "follow_up", icon: MessageCircleQuestion },
  { label: "Identify risks/blockers", actionType: "risks", icon: ShieldAlert },
  { label: "Create action items", actionType: "action_items", icon: ClipboardList },
];

export interface Suggestion {
  id: string;
  question: string;
  suggestion: string;
  configured: boolean;
  mode?: AssistantMode;
  confidence?: "low" | "medium" | "high";
}

export interface PrivateNote {
  id: string;
  text: string;
  createdAt?: string;
}

export interface AssistOptions {
  actionType?: string;
  customPrompt?: string;
}

export function AssistantPanel({
  aiConfigured,
  recording,
  hasContext,
  generating,
  error,
  mode,
  onModeChange,
  suggestions,
  privateNotes,
  sharedNotes,
  onAssist,
  onShareAnswer,
  onSavePrivateNote,
  onCreateTask,
}: {
  aiConfigured: boolean;
  recording: boolean;
  hasContext: boolean;
  generating: boolean;
  error: string | null;
  mode: AssistantMode;
  onModeChange: (mode: AssistantMode) => void;
  suggestions: Suggestion[];
  privateNotes: PrivateNote[];
  sharedNotes: string[];
  onAssist: (opts: AssistOptions) => void;
  onShareAnswer: (text: string, draftId: string) => void;
  onSavePrivateNote: (text: string) => void;
  onCreateTask: (text: string) => void;
}) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [note, setNote] = useState("");
  const [shared, setShared] = useState<Set<string>>(new Set());

  const canAssist = recording && hasContext && !generating;

  const runAssist = () => {
    if (!canAssist && !prompt.trim()) return;
    onAssist(prompt.trim() ? { customPrompt: prompt.trim() } : { actionType: "answer_latest" });
    setPrompt("");
  };

  const runQuick = (actionType: string) => {
    if (generating) return;
    onAssist({ actionType, customPrompt: prompt.trim() || undefined });
  };

  const markShared = (draftId: string, text: string) => {
    onShareAnswer(text, draftId);
    setShared((prev) => new Set(prev).add(draftId));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-black/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violetAccent" />
          <span className="text-sm font-semibold text-ink">Private Copilot</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            <Lock className="h-3 w-3" /> Host only
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Runs on this page — drafts are private until you share them.
        </p>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as AssistantMode)}
          className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-aurora-400"
          aria-label="Meeting mode"
        >
          {MODE_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Prompt + Assist */}
      <div className="border-b border-black/[0.06] p-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              runAssist();
            }
          }}
          rows={2}
          placeholder="Ask Aurora anything about this meeting…"
          className="w-full resize-none rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
        />
        <button
          onClick={runAssist}
          disabled={!recording || generating || (!hasContext && !prompt.trim())}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violetAccent py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" /> Assist
            </>
          )}
        </button>

        {/* Quick actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.actionType}
              onClick={() => runQuick(a.actionType)}
              disabled={!recording || generating || !hasContext}
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-left text-xs font-medium text-ink/80 transition hover:border-aurora-300 hover:text-aurora-700 disabled:opacity-50"
            >
              <a.icon className="h-3.5 w-3.5 shrink-0 text-violetAccent" />
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>

        {!recording && (
          <p className="mt-3 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-muted">
            Start the session to use the copilot.
          </p>
        )}
        {recording && !hasContext && (
          <p className="mt-3 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-muted">
            Waiting for transcript — quick actions unlock once there's conversation. You can still type a prompt.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        {!aiConfigured && !error && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Live AI needs <code>OPENAI_API_KEY</code> on the server. Demo sessions use sample output.
          </p>
        )}
      </div>

      {/* Drafts + notes */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Private drafts
          </p>
          {suggestions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/10 p-4 text-sm text-muted">
              Click <span className="font-medium text-ink">Assist</span> or a quick action to draft a
              private answer from the live transcript.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => {
                const isShared = shared.has(s.id);
                return (
                  <div key={s.id} className="rounded-xl border border-black/[0.06] bg-aurora-50/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-xs font-medium text-aurora-700">“{s.question}”</p>
                      <div className="flex shrink-0 items-center gap-1">
                        {s.confidence && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              s.confidence === "high"
                                ? "bg-emerald-100 text-emerald-700"
                                : s.confidence === "medium"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-black/[0.06] text-muted"
                            )}
                          >
                            {s.confidence}
                          </span>
                        )}
                        {!s.configured && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            demo
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/80">
                      {s.suggestion}
                    </p>

                    {/* Privacy status */}
                    {isShared ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Published to shared session
                      </p>
                    ) : (
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700">
                        <Lock className="h-3 w-3" /> Private draft — not visible to viewers
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Action
                        icon={Copy}
                        label="Copy"
                        onClick={() => {
                          navigator.clipboard.writeText(s.suggestion);
                          toast("Copied to clipboard", "success");
                        }}
                      />
                      <Action
                        icon={StickyNote}
                        label="Save private note"
                        onClick={() => onSavePrivateNote(s.suggestion)}
                      />
                      <Action
                        icon={Share2}
                        label={isShared ? "Shared" : "Share to session"}
                        primary={!isShared}
                        disabled={isShared}
                        onClick={() => markShared(s.id, s.suggestion)}
                      />
                      <Action
                        icon={ClipboardList}
                        label="Create action item"
                        onClick={() => onCreateTask(s.suggestion)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Private notes
          </p>
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Save a private thought…"
              className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
            />
            <button
              onClick={() => {
                if (!note.trim()) return;
                onSavePrivateNote(note.trim());
                setNote("");
              }}
              className="rounded-xl bg-ink px-3 text-sm font-medium text-white disabled:opacity-50"
              disabled={!note.trim()}
            >
              Save
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {privateNotes.length === 0 ? (
              <p className="text-xs text-muted">Private notes stay host-only.</p>
            ) : (
              privateNotes.slice(0, 5).map((n) => (
                <p key={n.id} className="rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-ink/80">
                  {n.text}
                </p>
              ))
            )}
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Shared with viewers
          </p>
          {sharedNotes.length === 0 ? (
            <p className="text-xs text-muted">
              Nothing shared yet. Use “Share to session” on a draft to publish it.
            </p>
          ) : (
            <div className="space-y-2">
              {sharedNotes.slice(-5).map((n, i) => (
                <p
                  key={`${n}-${i}`}
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                >
                  {n}
                </p>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  primary,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium shadow-sm transition disabled:opacity-60",
        primary
          ? "bg-violetAccent text-white hover:opacity-95"
          : "bg-white text-aurora-700 hover:bg-aurora-50"
      )}
      type="button"
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
