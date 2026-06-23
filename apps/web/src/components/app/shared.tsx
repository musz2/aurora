import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: any; label: string }> = {
    COMPLETED: { tone: "green", label: "Completed" },
    PROCESSING: { tone: "amber", label: "Processing" },
    RECORDING: { tone: "red", label: "Recording" },
    SCHEDULED: { tone: "indigo", label: "Scheduled" },
    FAILED: { tone: "red", label: "Failed" },
    OPEN: { tone: "slate", label: "Open" },
    IN_PROGRESS: { tone: "amber", label: "In progress" },
    DONE: { tone: "green", label: "Done" },
  };
  const cfg = map[status] ?? { tone: "slate", label: status };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, any> = {
    HIGH: "red",
    MEDIUM: "amber",
    LOW: "slate",
  };
  return <Badge tone={map[priority] ?? "slate"}>{priority.toLowerCase()}</Badge>;
}

export function UsageMeter({
  used,
  limit,
  label = "Transcription minutes",
}: {
  used: number;
  limit: number;
  label?: string;
}) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium text-ink">
          {used.toLocaleString()}
          {unlimited ? "" : ` / ${limit.toLocaleString()}`}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct > 90 ? "bg-red-500" : "bg-aurora-gradient"
          )}
          style={{ width: unlimited ? "12%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-aurora-50 text-aurora-600">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-semibold text-ink">{title}</h3>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-muted">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-2xl border border-black/[0.06] bg-white"
        />
      ))}
    </div>
  );
}
