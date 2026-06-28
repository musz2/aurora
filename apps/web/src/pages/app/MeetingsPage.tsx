import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search,
  Video,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, Input, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import {
  PageTitle,
  StatusBadge,
  EmptyState,
  LoadingBlock,
} from "@/components/app/shared";
import { formatDate, formatDuration } from "@/lib/format";
import type { MeetingDto } from "@aurora/shared";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "RECORDING", label: "Recording" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "FAILED", label: "Failed" },
];

const SOURCE_FILTERS = [
  { value: "", label: "Any source" },
  { value: "LIVE", label: "Live" },
  { value: "UPLOAD", label: "Uploaded" },
  { value: "ZOOM", label: "Zoom" },
  { value: "MEET", label: "Meet" },
  { value: "TEAMS", label: "Teams" },
];

const SOURCE_TONE: Record<string, "indigo" | "cyan" | "slate" | "green"> = {
  LIVE: "indigo",
  UPLOAD: "cyan",
  ZOOM: "slate",
  MEET: "green",
  TEAMS: "slate",
};

type Mode = "" | "mock" | "live";

export function MeetingsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<Mode>("");
  const [hasActions, setHasActions] = useState(false);
  const [hasDecisions, setHasDecisions] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["meetings", q, status],
    queryFn: async () =>
      (
        await api.get<{ meetings: MeetingDto[] }>("/meetings", {
          params: { q: q || undefined, status: status || undefined },
        })
      ).data.meetings,
  });

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (source) list = list.filter((m) => m.source === source);
    if (mode === "mock") list = list.filter((m) => m.demoMode);
    if (mode === "live") list = list.filter((m) => !m.demoMode);
    if (hasActions)
      list = list.filter((m) => (m.actionItems?.length ?? 0) > 0);
    if (hasDecisions)
      list = list.filter((m) => (m.summary?.decisions?.length ?? 0) > 0);
    return list;
  }, [data, source, mode, hasActions, hasDecisions]);

  return (
    <div>
      <PageTitle
        title="Meetings"
        subtitle="Every recorded, uploaded, and scheduled conversation."
        action={
          <Button to="/app/upload">
            <Video className="h-4 w-4" /> New meeting
          </Button>
        }
      />

      {/* Search + primary filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title…"
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-aurora-400"
          aria-label="Status filter"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-aurora-400"
          aria-label="Source filter"
        >
          {SOURCE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-aurora-400"
          aria-label="Mock/live filter"
        >
          <option value="">Mock & live</option>
          <option value="live">Live only</option>
          <option value="mock">Mock/demo only</option>
        </select>
      </div>

      {/* Toggle filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Toggle active={hasActions} onClick={() => setHasActions((v) => !v)}>
          <ListChecks className="h-3.5 w-3.5" /> Has action items
        </Toggle>
        <Toggle active={hasDecisions} onClick={() => setHasDecisions((v) => !v)}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Has decisions
        </Toggle>
        {(source || mode || hasActions || hasDecisions || status) && (
          <button
            onClick={() => {
              setSource("");
              setMode("");
              setHasActions(false);
              setHasDecisions(false);
              setStatus("");
            }}
            className="text-xs font-medium text-aurora-600 hover:underline"
          >
            Clear filters
          </button>
        )}
        {data && (
          <span className="ml-auto text-xs text-muted">
            {filtered.length} of {data.length} meetings
          </span>
        )}
      </div>

      {isLoading ? (
        <LoadingBlock rows={4} />
      ) : isError ? (
        <Card className="p-10 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-3 font-medium text-ink">Couldn’t load meetings</p>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
          <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((m) => {
            const actions = m.actionItems?.length ?? 0;
            const decisions = m.summary?.decisions?.length ?? 0;
            return (
              <Link key={m.id} to={`/app/meetings/${m.id}`}>
                <Card className="p-5 transition hover:shadow-glass">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-ink">{m.title}</p>
                        <StatusBadge status={m.status} />
                        <Badge tone={SOURCE_TONE[m.source] ?? "slate"}>
                          {m.source.toLowerCase()}
                        </Badge>
                        {m.demoMode && <Badge tone="amber">demo</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {formatDate(m.createdAt)} • {formatDuration(m.duration)} •{" "}
                        {m.participants.length} participants
                      </p>
                      {m.summary?.overview ? (
                        <p className="mt-2 line-clamp-2 text-sm text-ink/70">
                          {m.summary.overview}
                        </p>
                      ) : (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted">
                          <Sparkles className="h-3.5 w-3.5 text-aurora-400" />
                          No summary generated yet
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {actions > 0 && (
                          <Badge tone="indigo">
                            <ListChecks className="h-3 w-3" /> {actions} action
                            {actions === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {decisions > 0 && (
                          <Badge tone="green">
                            <CheckCircle2 className="h-3 w-3" /> {decisions} decision
                            {decisions === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {m.tags.map((t) => (
                          <Badge key={t} tone="slate">
                            #{t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Video}
          title={data && data.length > 0 ? "No meetings match your filters" : "No meetings found"}
          subtitle={
            data && data.length > 0
              ? "Try clearing some filters to see more meetings."
              : "Start a live recording or upload an audio/video file to get started."
          }
          action={
            <Button to="/app/live" variant="secondary">
              Start recording
            </Button>
          }
        />
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-aurora-300 bg-aurora-50 text-aurora-700"
          : "border-black/10 bg-white text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
