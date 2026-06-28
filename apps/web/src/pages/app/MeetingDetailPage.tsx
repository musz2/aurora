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
  Send,
  Loader2,
  CheckCircle2,
  Lock,
  StickyNote,
  HelpCircle,
  Users2,
  History,
  AlertTriangle,
  Highlighter,
} from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Card, Avatar, Badge, Spinner } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge, PriorityBadge } from "@/components/app/shared";
import {
  TranscriptTimeline,
  SpeakerAvatar,
} from "@/components/app/TranscriptTimeline";
import { formatDate, formatDateTime, formatDuration } from "@/lib/format";
import type {
  MeetingDto,
  ChatMessageDto,
  PrivateAssistSuggestionDto,
} from "@aurora/shared";

type Tab = "summary" | "actions" | "notes" | "activity" | "chat";
type ExportFormat = "pdf" | "docx" | "txt" | "srt" | "vtt" | "json";

const SOURCE_LABEL: Record<string, string> = {
  LIVE: "Live recording",
  UPLOAD: "Uploaded file",
  ZOOM: "Zoom",
  MEET: "Google Meet",
  TEAMS: "Microsoft Teams",
};

interface AuditEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function MeetingDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("summary");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exporting, setExporting] = useState(false);

  const { data: meeting, isLoading, isError } = useQuery({
    queryKey: ["meeting", id],
    queryFn: async () =>
      (await api.get<{ meeting: MeetingDto }>(`/meetings/${id}`)).data.meeting,
  });

  const summarize = useMutation({
    mutationFn: async () =>
      (await api.post(`/meetings/${id}/finalize`)).data.meeting as MeetingDto,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting", id] });
      toast("Summary generated", "success");
    },
    onError: (err) => toast(apiError(err, "Could not generate summary"), "error"),
  });

  const share = useMutation({
    mutationFn: async () =>
      (await api.post(`/meetings/${id}/share`, { shared: true })).data as {
        shareId: string;
      },
    onSuccess: (data) => {
      navigator.clipboard.writeText(`${window.location.origin}/s/${data.shareId}`);
      toast("Share link copied to clipboard", "success");
      qc.invalidateQueries({ queryKey: ["meeting", id] });
    },
  });

  const driveExport = useMutation({
    mutationFn: async () =>
      (
        await api.post("/integrations/google-drive/actions/export", {
          meetingId: id,
          format: exportFormat,
        })
      ).data as { result: { message: string; url?: string; mode: "live" | "mock" } },
    onSuccess: (data) => {
      toast(data.result.message, data.result.mode === "live" ? "success" : "info");
      if (data.result.url) window.open(data.result.url, "_blank", "noopener,noreferrer");
    },
    onError: (err) => toast(apiError(err, "Could not export to Google Drive."), "error"),
  });

  const downloadExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/meetings/${id}/export`, {
        params: { format: exportFormat },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${meeting?.title ?? "meeting"}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-2xl text-ink">Meeting not found</h1>
        <p className="mt-2 text-sm text-muted">
          This meeting may have been deleted or you don’t have access to it.
        </p>
        <Button to="/app/meetings" variant="secondary" className="mt-5">
          Back to meetings
        </Button>
      </div>
    );
  }

  const segments = meeting.segments ?? [];
  const highlights = segments.filter((s) => s.highlighted);
  const decisionSegs = segments.filter((s) => s.isDecision);
  const questions = segments.filter((s) => s.text.trim().endsWith("?"));
  const speakerStats = computeSpeakerStats(segments);

  return (
    <div>
      <Link
        to="/app/meetings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to meetings
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl text-ink">{meeting.title}</h1>
            <StatusBadge status={meeting.status} />
            {meeting.demoMode && <Badge tone="amber">Demo / mock data</Badge>}
            <Badge tone="slate">{SOURCE_LABEL[meeting.source] ?? meeting.source}</Badge>
          </div>
          <p className="mt-1 text-muted">
            {formatDate(meeting.createdAt)} • {formatDuration(meeting.duration)} •{" "}
            {meeting.participants.length || speakerStats.length} participants
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => share.mutate()} disabled={share.isPending}>
            {share.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share
          </Button>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-aurora-400"
            aria-label="Export format"
          >
            {["pdf", "docx", "txt", "srt", "vtt", "json"].map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={downloadExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => driveExport.mutate()}
            disabled={driveExport.isPending}
          >
            {driveExport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Drive
          </Button>
        </div>
      </div>

      {meeting.shared && meeting.shareId && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-aurora-200 bg-aurora-50/60 px-4 py-2.5 text-sm text-aurora-800">
          <Share2 className="h-4 w-4" />
          <span className="font-medium">Shared read-only link active.</span>
          <code className="truncate rounded bg-white/70 px-1.5 py-0.5 text-xs">
            {window.location.origin}/s/{meeting.shareId}
          </code>
          <span className="text-aurora-700/80">Viewers never see private notes or assistant output.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Transcript */}
        <div className="lg:col-span-3">
          <Card className="flex h-[680px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-aurora-600" />
                <span className="font-medium text-ink">Transcript</span>
                <Badge tone="slate">{segments.length} segments</Badge>
                {meeting.demoMode && <Badge tone="amber">demo</Badge>}
              </div>
            </div>
            <TranscriptTimeline meetingId={meeting.id} segments={segments} />
          </Card>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-black/10 bg-white p-1">
            {[
              { id: "summary", label: "Summary", icon: Sparkles },
              { id: "actions", label: "Actions", icon: ListChecks },
              { id: "notes", label: "Notes", icon: StickyNote },
              { id: "activity", label: "Activity", icon: History },
              { id: "chat", label: "Ask", icon: MessageSquare },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as Tab)}
                className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-sm transition ${
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
              questions={questions.map((q) => q.text)}
              highlights={highlights.map((h) => h.text)}
              decisionSegs={decisionSegs.map((d) => d.text)}
              speakerStats={speakerStats}
              onGenerate={() => summarize.mutate()}
              generating={summarize.isPending}
            />
          )}
          {tab === "actions" && <ActionsPanel meeting={meeting} />}
          {tab === "notes" && <NotesPanel meetingId={meeting.id} sharedNotes={meeting.publishedNotes ?? []} />}
          {tab === "activity" && <ActivityPanel meetingId={meeting.id} />}
          {tab === "chat" && <ChatPanel meetingId={meeting.id} />}
        </div>
      </div>
    </div>
  );
}

interface SpeakerStat {
  speakerName: string;
  segmentCount: number;
  share: number;
}

function computeSpeakerStats(
  segments: { speakerName: string }[]
): SpeakerStat[] {
  const total = segments.length;
  const counts = new Map<string, number>();
  for (const s of segments)
    counts.set(s.speakerName, (counts.get(s.speakerName) ?? 0) + 1);
  return [...counts.entries()]
    .map(([speakerName, segmentCount]) => ({
      speakerName,
      segmentCount,
      share: total ? segmentCount / total : 0,
    }))
    .sort((a, b) => b.segmentCount - a.segmentCount);
}

function Section({
  icon: Icon,
  title,
  tone = "text-aurora-700",
  children,
}: {
  icon: React.ElementType;
  title: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <h3 className={`text-sm font-semibold ${tone}`}>{title}</h3>
      </div>
      <div className="mt-2.5">{children}</div>
    </Card>
  );
}

function SummaryPanel({
  meeting,
  questions,
  highlights,
  decisionSegs,
  speakerStats,
  onGenerate,
  generating,
}: {
  meeting: MeetingDto;
  questions: string[];
  highlights: string[];
  decisionSegs: string[];
  speakerStats: SpeakerStat[];
  onGenerate: () => void;
  generating: boolean;
}) {
  if (!meeting.summary) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-aurora-500" />
        <p className="mt-3 font-medium text-ink">No summary yet</p>
        <p className="mt-1 text-sm text-muted">
          {meeting.demoMode
            ? "Generate a clearly-labeled demo summary with key points, decisions, and action items."
            : "Generate an AI summary, key points, decisions, and action items."}
        </p>
        <Button variant="secondary" className="mt-4" onClick={onGenerate} disabled={generating}>
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
      {meeting.demoMode && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5" />
          Demo / mock output — not real AI. Configure OPENAI_API_KEY for live analysis.
        </div>
      )}
      <Section icon={Sparkles} title="Executive summary">
        <p className="text-sm leading-relaxed text-ink/80">{s.overview}</p>
      </Section>
      <Section icon={ListChecks} title="Timeline / key points">
        <ul className="space-y-1.5">
          {s.keyPoints.map((k, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink/80">
              <span className="text-aurora-500">•</span> {k}
            </li>
          ))}
        </ul>
      </Section>
      <Section icon={CheckCircle2} title="Key decisions" tone="text-emerald-700">
        {s.decisions.length || decisionSegs.length ? (
          <ul className="space-y-1.5">
            {[...s.decisions, ...decisionSegs].map((d, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink/80">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> {d}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No decisions recorded.</p>
        )}
      </Section>
      {highlights.length > 0 && (
        <Section icon={Highlighter} title="Highlights" tone="text-amber-700">
          <ul className="space-y-1.5">
            {highlights.map((h, i) => (
              <li key={i} className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-ink/80">
                {h}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {questions.length > 0 && (
        <Section icon={HelpCircle} title="Questions asked">
          <ul className="space-y-1.5">
            {questions.slice(0, 12).map((q, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink/80">
                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-aurora-400" /> {q}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {speakerStats.length > 0 && (
        <Section icon={Users2} title="Speaker-wise summary">
          <ul className="space-y-2">
            {speakerStats.map((sp) => (
              <li key={sp.speakerName} className="flex items-center gap-2">
                <SpeakerAvatar name={sp.speakerName} className="h-6 w-6 text-[9px]" />
                <span className="text-sm text-ink">{sp.speakerName}</span>
                <span className="ml-auto text-xs text-muted">
                  {sp.segmentCount} segs • {Math.round(sp.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section icon={Mail} title="Follow-up email">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink/80">
          {s.followUpEmail}
        </pre>
      </Section>
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
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            {a.assigneeName ? (
              <span className="inline-flex items-center gap-1">
                <Avatar name={a.assigneeName} className="h-4 w-4 text-[8px]" />
                {a.assigneeName}
              </span>
            ) : (
              <span className="italic">Unassigned</span>
            )}
            <span>·</span>
            <span>{a.dueDate ? `Due ${formatDate(a.dueDate)}` : "No due date"}</span>
            <StatusBadge status={a.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function NotesPanel({
  meetingId,
  sharedNotes,
}: {
  meetingId: string;
  sharedNotes: string[];
}) {
  const { data: notes, isLoading } = useQuery({
    queryKey: ["private-notes", meetingId],
    queryFn: async () =>
      (
        await api.get<{ notes: PrivateAssistSuggestionDto[] }>(
          `/meetings/${meetingId}/private-notes`
        )
      ).data.notes,
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-violetAccent" />
          <h3 className="text-sm font-semibold text-ink">Private notes</h3>
          <Badge tone="indigo">Host only</Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          Visible only to you. Never shared with viewers.
        </p>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : notes && notes.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-black/[0.03] px-3 py-2 text-sm text-ink/80">
                {n.suggestion}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No private notes for this meeting.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-aurora-600" />
          <h3 className="text-sm font-semibold text-ink">Shared notes</h3>
          <Badge tone="green">Published</Badge>
        </div>
        {sharedNotes.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {sharedNotes.map((n, i) => (
              <li key={i} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-ink/80">
                {n}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No published notes yet.</p>
        )}
      </Card>
    </div>
  );
}

const AUDIT_LABEL: Record<string, string> = {
  meeting_started: "Recording started",
  meeting_paused: "Recording paused",
  meeting_resumed: "Recording resumed",
  meeting_stopped: "Recording stopped",
  meeting_finalizing: "Finalizing",
  meeting_completed: "Meeting completed",
  meeting_failed: "Meeting failed",
  speaker_renamed: "Speaker renamed",
  transcript_exported: "Transcript exported",
  integration_action_sent: "Integration action sent",
};

function ActivityPanel({ meetingId }: { meetingId: string }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["meeting-audit", meetingId],
    queryFn: async () =>
      (await api.get<{ logs: AuditEntry[] }>(`/meetings/${meetingId}/audit`)).data
        .logs,
  });

  if (isLoading) {
    return <Card className="p-6 text-center text-sm text-muted">Loading activity…</Card>;
  }
  if (!logs || logs.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted">
        No audit activity recorded for this meeting yet.
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <ol className="relative space-y-4 border-l border-black/[0.08] pl-4">
        {logs.map((l) => (
          <li key={l.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-aurora-400" />
            <p className="text-sm font-medium text-ink">
              {AUDIT_LABEL[l.action] ?? l.action}
            </p>
            <p className="text-xs text-muted">{formatDateTime(l.createdAt)}</p>
          </li>
        ))}
      </ol>
    </Card>
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
              {["Summarize this meeting", "What are the action items?"].map((s) => (
                <button
                  key={s}
                  onClick={() => ask.mutate(s)}
                  className="block rounded-lg bg-aurora-50 px-3 py-1.5 text-xs text-aurora-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
              m.role === "user" ? "ml-auto bg-ink text-white" : "bg-aurora-50 text-ink"
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
