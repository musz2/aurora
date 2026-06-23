import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Sparkles,
  ListChecks,
  MessageSquare,
  FileText,
  Mail,
  Download,
  Share2,
  Play,
  Send,
  Loader2,
} from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Card, Avatar, Badge, Spinner } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { StatusBadge, PriorityBadge } from "@/components/app/shared";
import { formatClock, formatDate, formatDuration } from "@/lib/format";
import type { MeetingDto, ChatMessageDto } from "@aurora/shared";

type Tab = "summary" | "actions" | "chat";

export function MeetingDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("summary");

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", id],
    queryFn: async () =>
      (await api.get<{ meeting: MeetingDto }>(`/meetings/${id}`)).data.meeting,
  });

  const summarize = useMutation({
    mutationFn: async () =>
      (await api.post(`/meetings/${id}/summarize`)).data.meeting as MeetingDto,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting", id] }),
  });

  if (isLoading || !meeting) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/app/meetings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to meetings
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl text-ink">{meeting.title}</h1>
            <StatusBadge status={meeting.status} />
          </div>
          <p className="mt-1 text-muted">
            {formatDate(meeting.createdAt)} • {formatDuration(meeting.duration)} •{" "}
            {meeting.participants.length} participants
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {meeting.participants.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] py-1 pl-1 pr-3 text-xs text-ink"
              >
                <Avatar name={p} className="h-5 w-5 text-[9px]" />
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Transcript */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-aurora-600" />
                <span className="font-medium text-ink">Transcript</span>
                <Badge tone="slate">
                  {meeting.segments?.length ?? 0} segments
                </Badge>
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-aurora-50 px-3 py-1.5 text-xs font-medium text-aurora-700">
                <Play className="h-3.5 w-3.5" /> Play audio
              </button>
            </div>
            <div className="max-h-[640px] space-y-5 overflow-y-auto px-5 py-5">
              {meeting.segments && meeting.segments.length > 0 ? (
                meeting.segments.map((s) => (
                  <div key={s.id} className="flex gap-3">
                    <Avatar name={s.speakerName} className="h-8 w-8 text-[10px]" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {s.speakerName}
                        </span>
                        <span className="text-xs text-muted">
                          {formatClock(s.startTime)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink/80">
                        {s.text}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-muted">
                  No transcript yet.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex gap-1 rounded-xl border border-black/10 bg-white p-1">
            {[
              { id: "summary", label: "Summary", icon: Sparkles },
              { id: "actions", label: "Actions", icon: ListChecks },
              { id: "chat", label: "Ask Aurora", icon: MessageSquare },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as Tab)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm transition ${
                  tab === t.id
                    ? "bg-aurora-50 text-aurora-700"
                    : "text-muted hover:text-ink"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {tab === "summary" && (
            <SummaryPanel
              meeting={meeting}
              onGenerate={() => summarize.mutate()}
              generating={summarize.isPending}
            />
          )}
          {tab === "actions" && <ActionsPanel meeting={meeting} />}
          {tab === "chat" && <ChatPanel meetingId={meeting.id} />}
        </div>
      </div>
    </div>
  );
}

function SummaryPanel({
  meeting,
  onGenerate,
  generating,
}: {
  meeting: MeetingDto;
  onGenerate: () => void;
  generating: boolean;
}) {
  if (!meeting.summary) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-aurora-500" />
        <p className="mt-3 font-medium text-ink">No summary yet</p>
        <p className="mt-1 text-sm text-muted">
          Generate an AI summary, key points, decisions, and action items.
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={onGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating…
            </>
          ) : (
            "Generate summary"
          )}
        </Button>
      </Card>
    );
  }
  const s = meeting.summary;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-aurora-700">Overview</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">{s.overview}</p>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-aurora-700">Key points</h3>
        <ul className="mt-2 space-y-1.5">
          {s.keyPoints.map((k, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink/80">
              <span className="text-aurora-500">•</span> {k}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-aurora-700">Decisions</h3>
        <ul className="mt-2 space-y-1.5">
          {s.decisions.map((d, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink/80">
              <span className="text-emerald-500">✓</span> {d}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-aurora-600" />
          <h3 className="text-sm font-semibold text-aurora-700">
            Follow-up email
          </h3>
        </div>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/80">
          {s.followUpEmail}
        </pre>
      </Card>
    </div>
  );
}

function ActionsPanel({ meeting }: { meeting: MeetingDto }) {
  const items = meeting.actionItems ?? [];
  if (items.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted">
        No action items detected. Generate a summary to extract tasks.
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((a) => (
        <Card key={a.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-ink">{a.task}</p>
            <PriorityBadge priority={a.priority} />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            {a.assigneeName && (
              <span className="inline-flex items-center gap-1">
                <Avatar name={a.assigneeName} className="h-4 w-4 text-[8px]" />
                {a.assigneeName}
              </span>
            )}
            <StatusBadge status={a.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function ChatPanel({ meetingId }: { meetingId: string }) {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [input, setInput] = useState("");

  const ask = useMutation({
    mutationFn: async (message: string) =>
      (
        await api.post("/ai/chat", {
          message,
          meetingId,
          scope: "current",
        })
      ).data as { answer: string },
    onSuccess: (data, message) => {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "user", content: message, createdAt: "" },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          createdAt: "",
        },
      ]);
    },
    onError: (err) => {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: apiError(err),
          createdAt: "",
        },
      ]);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    ask.mutate(input.trim());
    setInput("");
  };

  return (
    <Card className="flex h-[560px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted">
            <MessageSquare className="h-7 w-7 text-aurora-400" />
            <p className="mt-2">Ask anything about this meeting.</p>
            <div className="mt-3 space-y-1.5">
              {["Summarize this meeting", "What are the action items?"].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => ask.mutate(s)}
                    className="block rounded-lg bg-aurora-50 px-3 py-1.5 text-xs text-aurora-700"
                  >
                    {s}
                  </button>
                )
              )}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
              m.role === "user"
                ? "ml-auto bg-ink text-white"
                : "bg-aurora-50 text-ink"
            }`}
          >
            {m.content}
          </div>
        ))}
        {ask.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Aurora is thinking…
          </div>
        )}
      </div>
      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-black/[0.06] p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Aurora…"
          className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
        />
        <button
          type="submit"
          className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Card>
  );
}
