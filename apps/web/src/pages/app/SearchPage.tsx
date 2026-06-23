import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search as SearchIcon, FileText, ListChecks, Video } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Input } from "@/components/ui/primitives";
import { PageTitle, EmptyState } from "@/components/app/shared";
import { formatDate } from "@/lib/format";

interface SearchResults {
  meetings: { id: string; title: string; createdAt: string; status: string }[];
  segments: {
    id: string;
    text: string;
    speakerName: string;
    meetingId: string;
    meeting: { title: string };
  }[];
  actionItems: {
    id: string;
    task: string;
    meetingId: string;
    meeting: { title: string };
  }[];
  summaries: {
    id: string;
    overview: string;
    meetingId: string;
    meeting: { title: string };
  }[];
}

export function SearchPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["search", submitted],
    enabled: submitted.length > 0,
    queryFn: async () =>
      (await api.get<SearchResults>("/search", { params: { q: submitted } }))
        .data,
  });

  const total =
    (data?.meetings.length ?? 0) +
    (data?.segments.length ?? 0) +
    (data?.actionItems.length ?? 0) +
    (data?.summaries.length ?? 0);

  return (
    <div>
      <PageTitle
        title="Search"
        subtitle="Search across transcripts, summaries, decisions, and action items."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
        className="relative mb-6"
      >
        <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try: pricing, Kubernetes, launch date, roadmap…"
          className="py-3.5 pl-12 text-base"
          autoFocus
        />
      </form>

      {!submitted ? (
        <EmptyState
          icon={SearchIcon}
          title="Search your meeting knowledge base"
          subtitle="Find any decision, topic, speaker quote, or task across every meeting."
        />
      ) : isFetching ? (
        <p className="text-sm text-muted">Searching…</p>
      ) : total === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title={`No results for “${submitted}”`}
          subtitle="Try a different keyword or check your spelling."
        />
      ) : (
        <div className="space-y-8">
          {data!.meetings.length > 0 && (
            <Group title="Meetings" icon={Video}>
              {data!.meetings.map((m) => (
                <Link key={m.id} to={`/app/meetings/${m.id}`}>
                  <Card className="p-4 transition hover:shadow-glass">
                    <p className="font-medium text-ink">{m.title}</p>
                    <p className="text-sm text-muted">{formatDate(m.createdAt)}</p>
                  </Card>
                </Link>
              ))}
            </Group>
          )}
          {data!.summaries.length > 0 && (
            <Group title="Summaries & decisions" icon={FileText}>
              {data!.summaries.map((s) => (
                <Link key={s.id} to={`/app/meetings/${s.meetingId}`}>
                  <Card className="p-4 transition hover:shadow-glass">
                    <p className="font-medium text-ink">{s.meeting.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {s.overview}
                    </p>
                  </Card>
                </Link>
              ))}
            </Group>
          )}
          {data!.segments.length > 0 && (
            <Group title="Transcript matches" icon={FileText}>
              {data!.segments.map((s) => (
                <Link key={s.id} to={`/app/meetings/${s.meetingId}`}>
                  <Card className="p-4 transition hover:shadow-glass">
                    <p className="text-sm text-ink/80">
                      <span className="font-medium text-aurora-700">
                        {s.speakerName}:
                      </span>{" "}
                      {s.text}
                    </p>
                    <p className="mt-1 text-xs text-muted">{s.meeting.title}</p>
                  </Card>
                </Link>
              ))}
            </Group>
          )}
          {data!.actionItems.length > 0 && (
            <Group title="Action items" icon={ListChecks}>
              {data!.actionItems.map((a) => (
                <Link key={a.id} to={`/app/meetings/${a.meetingId}`}>
                  <Card className="p-4 transition hover:shadow-glass">
                    <p className="text-sm text-ink">{a.task}</p>
                    <p className="mt-1 text-xs text-muted">{a.meeting.title}</p>
                  </Card>
                </Link>
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-aurora-600" />
        <h2 className="font-semibold text-ink">{title}</h2>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
