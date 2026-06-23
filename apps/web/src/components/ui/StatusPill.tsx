import { cn } from "@/lib/cn";

type Tone = "live" | "processing" | "idle" | "error" | "success" | "muted";

const tones: Record<Tone, string> = {
  live: "bg-red-50 text-red-700",
  processing: "bg-amber-50 text-amber-700",
  idle: "bg-slate-100 text-slate-600",
  error: "bg-red-50 text-red-700",
  success: "bg-emerald-50 text-emerald-700",
  muted: "bg-black/5 text-ink/70",
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
      {pulse && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "live"
              ? "animate-pulse-dot bg-red-500"
              : tone === "processing"
                ? "animate-pulse-dot bg-amber-500"
                : tone === "success"
                  ? "bg-emerald-500"
                  : "bg-slate-400"
          )}
        />
      )}
      {children}
    </span>
  );
}
