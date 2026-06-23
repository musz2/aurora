import { useRef, useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Send, Sparkles, Loader2, FileText } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/primitives";
import { PageTitle } from "@/components/app/shared";

interface Citation {
  meetingId: string;
  meetingTitle: string;
  snippet: string;
}
interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

const SUGGESTIONS = [
  "What are my action items?",
  "Summarize my last meeting.",
  "What did the client say about pricing?",
  "Create a follow-up email.",
  "Find meetings where we discussed the launch date.",
];

export function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [scope, setScope] = useState<"all" | "current">("all");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = useMutation({
    mutationFn: async (message: string) =>
      (await api.post("/ai/chat", { message, scope })).data as {
        answer: string;
        citations: Citation[];
      },
    onSuccess: (data) => {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
        },
      ]);
    },
    onError: (err) => {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: apiError(err) },
      ]);
    },
  });

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);
    ask.mutate(text);
    setInput("");
  };

  return (
    <div>
      <PageTitle
        title="Aurora AI Chat"
        subtitle="Ask questions across your entire meeting history — with cited sources."
      />

      <Card className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Sparkles className="h-4 w-4 text-violetAccent" /> Context
          </div>
          <div className="flex rounded-lg border border-black/10 p-0.5">
            {(["all", "current"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                  scope === s ? "bg-aurora-50 text-aurora-700" : "text-muted"
                }`}
              >
                {s === "all" ? "All meetings" : "Recent meeting"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-aurora-gradient text-white">
                <Sparkles className="h-7 w-7" />
              </span>
              <h3 className="mt-4 font-display text-2xl text-ink">
                How can I help across your meetings?
              </h3>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-ink transition hover:border-aurora-300 hover:bg-aurora-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-ink text-white"
                    : "bg-aurora-50 text-ink"
                }`}
              >
                {m.content}
              </div>
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {m.citations.map((c) => (
                    <Link
                      key={c.meetingId}
                      to={`/app/meetings/${c.meetingId}`}
                      className="flex items-start gap-2 rounded-xl border border-black/[0.06] bg-white p-3 text-xs transition hover:border-aurora-300"
                    >
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-aurora-600" />
                      <span>
                        <span className="font-medium text-ink">
                          {c.meetingTitle}
                        </span>
                        <span className="block text-muted">{c.snippet}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          {ask.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Aurora is searching
              your meetings…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-black/[0.06] p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Aurora anything about your meetings…"
            className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:border-aurora-400"
          />
          <button
            type="submit"
            className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </Card>
    </div>
  );
}
