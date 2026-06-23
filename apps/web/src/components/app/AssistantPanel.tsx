import { useState } from "react";
import { Sparkles, Send, ArrowUpToLine, StickyNote, Copy, Lock } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export interface Suggestion {
  id: string;
  question: string;
  suggestion: string;
  configured: boolean;
}

export function AssistantPanel({
  aiConfigured,
  recording,
  suggestions,
  onAsk,
  onPublish,
  onAddNote,
}: {
  aiConfigured: boolean;
  recording: boolean;
  suggestions: Suggestion[];
  onAsk: (q: string) => void;
  onPublish: (text: string) => void;
  onAddNote: (text: string) => void;
}) {
  const { toast } = useToast();
  const [ask, setAsk] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask.trim()) return;
    onAsk(ask.trim());
    setAsk("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-3">
        <Sparkles className="h-4 w-4 text-violetAccent" />
        <span className="text-sm font-medium text-ink">Private AI assistant</span>
        {!aiConfigured && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            <Lock className="h-3 w-3" /> Requires setup
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!aiConfigured ? (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-sm text-amber-800">
            <p className="font-medium">AI assistant not configured</p>
            <p className="mt-1 text-amber-700">
              Add <code className="rounded bg-amber-100 px-1">OPENAI_API_KEY</code>{" "}
              on the server to enable private, real-time suggestions. Aurora will
              never fabricate answers without a configured provider.
            </p>
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted">
            Ask Aurora privately for a suggested answer. Only you can see this —
            publish to the transcript or notes when you're ready.
          </p>
        ) : (
          suggestions.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-black/[0.06] bg-aurora-50/50 p-3"
            >
              <p className="text-xs font-medium text-aurora-700">“{s.question}”</p>
              <p className="mt-1.5 text-sm text-ink/80">{s.suggestion}</p>
              {s.configured && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => onPublish(s.suggestion)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-aurora-600 hover:underline"
                  >
                    <ArrowUpToLine className="h-3 w-3" /> Publish to transcript
                  </button>
                  <button
                    onClick={() => onAddNote(s.suggestion)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-aurora-600 hover:underline"
                  >
                    <StickyNote className="h-3 w-3" /> Add to notes
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(s.suggestion);
                      toast("Copied to clipboard", "success");
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={submit}
        className={cn(
          "flex items-center gap-2 border-t border-black/[0.06] p-3",
          (!recording || !aiConfigured) && "opacity-50"
        )}
      >
        <input
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          disabled={!recording || !aiConfigured}
          placeholder={
            aiConfigured ? "Ask Aurora privately…" : "AI not configured"
          }
          className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
        />
        <button
          type="submit"
          disabled={!recording || !aiConfigured}
          className="grid h-9 w-9 place-items-center rounded-xl bg-violetAccent text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
