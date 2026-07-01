import { cn } from "@/lib/cn";

type Tone =
  | "live"
  | "processing"
  | "idle"
  | "error"
  | "success"
  | "muted"
  | "connected"
  | "reconnecting"
  | "stale"
  | "degraded"
  | "offline"
  | "ended"
  | "expired"
  | "ai";

const tones: Record<Tone, string> = {
  live: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/70",
  processing: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/70",
  idle: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/70",
  error: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/70",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70",
  muted: "bg-black/5 text-ink/70 ring-1 ring-inset ring-black/5",
  connected: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70",
  reconnecting: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/70",
  stale: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200/70",
  degraded: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200/70",
  offline: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/70",
  ended: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/70",
  expired: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/70",
  ai: "bg-aurora-50 text-aurora-700 ring-1 ring-inset ring-aurora-200/70",
};

const dots: Record<Tone, string> = {
  live: "animate-pulse-dot bg-red-500 live-dot",
  processing: "animate-pulse-dot bg-amber-500",
  idle: "bg-slate-400",
  error: "bg-red-500",
  success: "bg-emerald-500",
  muted: "bg-slate-400",
  connected: "bg-emerald-500",
  reconnecting: "animate-pulse-dot bg-amber-500",
  stale: "animate-pulse-dot bg-orange-500",
  degraded: "animate-pulse-dot bg-orange-500",
  offline: "bg-slate-400",
  ended: "bg-slate-400",
  expired: "bg-slate-400",
  ai: "animate-pulse-dot bg-aurora-500",
};

export function StatusPill({
  tone = "idle",
  pulse,
  children,
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {pulse && <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}
