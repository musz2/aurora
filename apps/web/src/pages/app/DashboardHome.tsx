import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Video,
  ListChecks,
  Clock,
  Radio,
  Upload,
  MessageSquare,
  ArrowRight,
  Calendar,
  Plug,
  LifeBuoy,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/primitives";
import {
  PageTitle,
  StatusBadge,
  PriorityBadge,
  UsageMeter,
  LoadingBlock,
} from "@/components/app/shared";
import { useAuthStore } from "@/store/auth";
import { formatDate, relativeDay } from "@/lib/format";
import type { MeetingDto, ActionItemDto, UsageSummary, IntegrationCatalogEntry } from "@aurora/shared";

interface DashboardData {
  recentMeetings: MeetingDto[];
  upcomingMeetings: MeetingDto[];
  myActionItems: ActionItemDto[];
  usage: UsageSummary;
  totalMeetings: number;
}

const QUICK = [
  { to: "/app/live", label: "Start live meeting", icon: Radio, accent: true },
  { to: "/app/upload", label: "Upload a recording", icon: Upload },
  { to: "/app/chat", label: "Ask Aurora", icon: MessageSquare },
  { to: "/app/copilot", label: "Private Copilot", icon: Sparkles },
];

export function DashboardHome() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardData>("/dashboard")).data,
  });
  const { data: integrations } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () =>
      (await api.get<{ integrations: (IntegrationCatalogEntry & { state: string })[] }>("/integrations"))
        .data.integrations,
    retry: false,
  });

  const connectedCount = integrations?.filter((i) => i.state === "CONNECTED").length ?? 0;

  return (
    <div>
      <PageTitle
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}`}
        subtitle="Your meeting command center — capture, understand, and follow through."
      />

      {/* Quick actions */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK.map((q, i) => (
          <Link
            key={q.to}
            to={q.to}
            style={{ animationDelay: `${i * 40}ms` }}
            className={`group card-lift animate-slide-up flex items-center gap-3 rounded-2xl border p-4 ${
              q.accent
                ? "border-transparent bg-aurora-gradient text-white shadow-sm"
                : "border-black/[0.06] bg-white text-ink shadow-card"
            }`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                q.accent ? "bg-white/15" : "bg-aurora-50 text-aurora-600"
              }`}
            >
              <q.icon className="h-5 w-5" />
            </span>
            <span className="font-medium">{q.label}</span>
            <ArrowRight className="ml-auto h-4 w-4 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Video} label="Total meetings" value={data?.totalMeetings ?? 0} />
        <StatCard
          icon={ListChecks}
          label="Open action items"
          value={data?.myActionItems.length ?? 0}
        />
        <StatCard icon={Clock} label="Minutes used" value={data?.usage.usedMinutes ?? 0} />
        <Card className="p-5">
          {data ? (
            <UsageMeter used={data.usage.usedMinutes} limit={data.usage.limitMinutes} />
          ) : (
            <div className="space-y-2">
              <div className="skeleton h-3.5 w-2/3" />
              <div className="skeleton h-2 w-full" />
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent meetings */}
        <div className="lg:col-span-2">
          <SectionTitle title="Recent meetings" to="/app/meetings" />
          {isLoading ? (
            <LoadingBlock />
          ) : (
            <div className="space-y-3">
              {data?.recentMeetings.map((m, i) => (
                <Link
                  key={m.id}
                  to={`/app/meetings/${m.id}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="card-lift animate-slide-up block rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{m.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatDate(m.createdAt)} • {m.participants.length} participants
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  {m.summary?.overview && (
                    <p className="mt-3 line-clamp-2 text-sm text-muted">{m.summary.overview}</p>
                  )}
                </Link>
              ))}
              {data?.recentMeetings.length === 0 && (
                <Card className="p-8 text-center text-sm text-muted">
                  No meetings yet — start a live meeting or upload a recording.
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div>
            <SectionTitle title="My action items" to="/app/action-items" />
            <div className="space-y-2">
              {data?.myActionItems.slice(0, 5).map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-ink">{a.task}</p>
                    <PriorityBadge priority={a.priority} />
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {a.dueDate ? `Due ${relativeDay(a.dueDate)}` : "No due date"}
                  </p>
                </Card>
              ))}
              {data?.myActionItems.length === 0 && (
                <Card className="p-6 text-center text-sm text-muted">You're all caught up 🎉</Card>
              )}
            </div>
          </div>

          <div>
            <SectionTitle title="Upcoming" to="/app/calendar" />
            <div className="space-y-2">
              {data?.upcomingMeetings.map((m) => (
                <Card key={m.id} className="flex items-center gap-3 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-aurora-50 text-aurora-600">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{m.title}</p>
                    <p className="text-xs text-muted">{relativeDay(m.startedAt)}</p>
                  </div>
                </Card>
              ))}
              {data?.upcomingMeetings.length === 0 && (
                <Card className="p-6 text-center text-sm text-muted">
                  No upcoming meetings scheduled.
                </Card>
              )}
            </div>
          </div>

          {/* Workspace status */}
          <div>
            <SectionTitle title="Workspace status" to="/app/integrations" label="Integrations" />
            <Card className="divide-y divide-black/[0.05]">
              <Link
                to="/app/integrations"
                className="flex items-center gap-3 p-4 transition hover:bg-black/[0.02]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-aurora-50 text-aurora-600">
                  <Plug className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">Integrations</p>
                  <p className="text-xs text-muted">
                    {integrations
                      ? `${connectedCount} of ${integrations.length} connected`
                      : "Zoom, Meet, Teams + calendars"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
              <Link
                to="/app/live"
                className="flex items-center gap-3 p-4 transition hover:bg-black/[0.02]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <LifeBuoy className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">Backup Assist</p>
                  <p className="text-xs text-muted">
                    Connection recovery and offline packs live inside every session.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-aurora-50 text-aurora-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-2xl tabular-nums text-ink">{value.toLocaleString()}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </Card>
  );
}

function SectionTitle({ title, to, label = "View all" }: { title: string; to: string; label?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-semibold text-ink">{title}</h2>
      <Link to={to} className="text-sm text-aurora-600 hover:underline">
        {label}
      </Link>
    </div>
  );
}
