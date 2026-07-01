import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  interactive,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-black/[0.06] bg-white shadow-card",
        interactive && "card-lift",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type BadgeTone = "default" | "indigo" | "green" | "amber" | "red" | "slate" | "cyan";
const tones: Record<BadgeTone, string> = {
  default: "bg-black/5 text-ink",
  indigo: "bg-aurora-50 text-aurora-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-600",
  cyan: "bg-cyan-50 text-cyan-700",
};

export function Badge({
  tone = "default",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  url,
  className,
}: {
  name: string;
  url?: string | null;
  className?: string;
}) {
  const init = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={cn("h-9 w-9 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-aurora-gradient text-xs font-semibold text-white",
        className
      )}
    >
      {init}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-aurora-200 border-t-aurora-600",
        className
      )}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-aurora-400 focus:ring-2 focus:ring-aurora-100",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-aurora-400 focus:ring-2 focus:ring-aurora-100",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-ink", className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

export function CopyButton({
  text,
  label = "Copy",
  className,
  size = "sm",
}: {
  text: string;
  label?: string;
  className?: string;
  size?: "sm" | "xs";
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border font-medium transition-colors",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]",
        copied
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-black/10 bg-white text-ink/80 hover:border-black/25 hover:text-ink",
        className
      )}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-black/[0.08] bg-white p-1",
        className
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
            value === t.value
              ? "bg-ink text-white shadow-sm"
              : "text-muted hover:bg-black/[0.04] hover:text-ink"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink/45 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-modal animate-slide-up sm:rounded-3xl sm:animate-scale-in",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-black/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.06] px-5 py-3.5 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-ink/45 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-modal animate-slide-in-right"
      >
        <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-black/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
      </aside>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 px-6 py-14 text-center"
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-100 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-black/30"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && (
        <span className="text-sm font-semibold uppercase tracking-widest text-aurora-600">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg text-muted">{subtitle}</p>}
    </div>
  );
}
