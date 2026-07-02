import { Logo } from "@/components/ui/Logo";
import { ShieldCheck, Sparkles, Search } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 flex-col justify-center">
          <div className="page-enter mx-auto w-full max-w-sm py-10">
            <h1 className="font-display text-4xl text-ink">{title}</h1>
            <p className="mt-2 text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>

      {/* Right — brand panel */}
      <div className="relative hidden overflow-hidden p-4 lg:block">
        <div className="absolute inset-0 bg-aurora-wash" />
        <div className="relative flex h-full flex-col justify-center rounded-3xl bg-ink p-14 text-white">
          <h2 className="max-w-md font-display text-5xl leading-tight">
            Turn every meeting into searchable intelligence.
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            Record, transcribe, summarize, and chat across every conversation —
            consent-first, always.
          </p>
          <div className="mt-10 space-y-3">
            {[
              { icon: Sparkles, text: "AI summaries & action items in seconds" },
              { icon: Search, text: "Search and chat across all meetings" },
              { icon: ShieldCheck, text: "Consent-first, enterprise-ready" },
            ].map((f) => (
              <div
                key={f.text}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3"
              >
                <f.icon className="h-5 w-5" />
                <span className="text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
