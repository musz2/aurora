import { useState } from "react";
import type React from "react";
import {
  ArrowUpToLine,
  ClipboardList,
  Copy,
  Lock,
  Send,
  Share2,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

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

export function AssistantPanel({
  aiConfigured,
  recording,
  mode,
  onModeChange,
  suggestions,
  privateNotes,
  sharedNotes,
  onAsk,
  onPublishTranscript,
  onPublishSharedNote,
  onSavePrivateNote,
  onCreateTask,
}: {
  aiConfigured: boolean;
  recording: boolean;
  mode: AssistantMode;
  onModeChange: (mode: AssistantMode) => void;
  suggestions: Suggestion[];
  privateNotes: PrivateNote[];
  sharedNotes: string[];
  onAsk: (q: string) => void;
  onPublishTranscript: (text: string) => void;
  onPublishSharedNote: (text: string) => void;
  onSavePrivateNote: (text: string) => void;
  onCreateTask: (text: string) => void;
}) {
  const { toast } = useToast();
  const [ask, setAsk] = useState("");
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask.trim()) return;
    onAsk(ask.trim());
    setAsk("");
  };

  const saveNote = () => {
    if (!note.trim()) return;
    onSavePrivateNote(note.trim());
    setNote("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-black/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violetAccent" />
          <span className="text-sm font-medium text-ink">Private assistant</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            <Lock className="h-3 w-3" /> Host only
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Private assistant — not visible to shared viewers.
        </p>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as AssistantMode)}
          className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-aurora-400"
          aria-label="Assistant mode"
        >
          {ASSISTANT_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {!aiConfigured && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Demo suggestions are generated only in demo mode. Real sessions need OPENAI_API_KEY for live AI.
          </p>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Suggested answers
          </p>
          {suggestions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/10 p-4 text-sm text-muted">
              Aurora detects questions from the live transcript and drafts private answers here.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div key={s.id} className="rounded-xl border border-black/[0.06] bg-aurora-50/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-aurora-700">“{s.question}”</p>
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
                          Mock
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
                    {s.suggestion}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Action
                      icon={Copy}
                      label="Copy"
                      onClick={() => {
                        navigator.clipboard.writeText(s.suggestion);
                        toast("Copied private suggestion", "success");
                      }}
                    />
                    <Action icon={StickyNote} label="Save private note" onClick={() => onSavePrivateNote(s.suggestion)} />
                    <Action icon={Share2} label="Publish shared note" onClick={() => onPublishSharedNote(s.suggestion)} />
                    <Action icon={ArrowUpToLine} label="Publish transcript" onClick={() => onPublishTranscript(s.suggestion)} />
                    <Action icon={ClipboardList} label="Follow-up task" onClick={() => onCreateTask(s.suggestion)} />
                  </div>
                </div>
              ))}
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
              onClick={saveNote}
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
            Shared notes
          </p>
          {sharedNotes.length === 0 ? (
            <p className="text-xs text-muted">Only manually published notes appear to viewers.</p>
          ) : (
            <div className="space-y-2">
              {sharedNotes.slice(-5).map((n, i) => (
                <p key={`${n}-${i}`} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {n}
                </p>
              ))}
            </div>
          )}
        </section>
      </div>

      <form
        onSubmit={submit}
        className={cn("flex items-center gap-2 border-t border-black/[0.06] p-3", !recording && "opacity-50")}
      >
        <input
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          disabled={!recording}
          placeholder="Ask Aurora privately…"
          className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
        />
        <button
          type="submit"
          disabled={!recording || !ask.trim()}
          className="grid h-9 w-9 place-items-center rounded-xl bg-violetAccent text-white disabled:opacity-50"
          aria-label="Ask Aurora privately"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
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
      className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-medium text-aurora-700 shadow-sm hover:bg-aurora-50"
      type="button"
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
