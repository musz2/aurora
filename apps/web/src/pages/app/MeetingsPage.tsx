import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, Video, Filter } from "lucide-react";
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

const FILTERS = [
  { value: "", label: "All" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SCHEDULED", label: "Scheduled" },
];

export function MeetingsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["meetings", q, status],
    queryFn: async () =>
      (
        await api.get<{ meetings: MeetingDto[] }>("/meetings", {
          params: { q: q || undefined, status: status || undefined },
        })
      ).data.meetings,
  });

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

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white p-1">
          <Filter className="ml-2 h-4 w-4 text-muted" />
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                status === f.value
                  ? "bg-aurora-50 text-aurora-700"
                  : "text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock rows={4} />
      ) : data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((m) => (
            <Link key={m.id} to={`/app/meetings/${m.id}`}>
              <Card className="p-5 transition hover:shadow-glass">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-ink">{m.title}</p>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {formatDate(m.createdAt)} • {formatDuration(m.duration)} •{" "}
                      {m.participants.length} participants •{" "}
                      <span className="capitalize">{m.source.toLowerCase()}</span>
                    </p>
                    {m.summary?.overview && (
                      <p className="mt-2 line-clamp-1 text-sm text-muted">
                        {m.summary.overview}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
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
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Video}
          title="No meetings found"
          subtitle="Start a live recording or upload an audio/video file to get started."
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
