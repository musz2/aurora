import {
  Mic,
  Sparkles,
  MessageSquare,
  ShieldQuestion,
  Library,
  ListChecks,
  Share2,
  Download,
  Plug,
  Lock,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";

const MODULES = [
  {
    icon: Mic,
    title: "Live transcription",
    desc: "Superfast, speaker-labeled captions stream as people speak. Interim words appear instantly and finalize into clean paragraphs after a brief pause.",
    to: "/app/live",
    cta: "Open host console",
  },
  {
    icon: Sparkles,
    title: "AI summaries",
    desc: "Every session ends with an overview, key points, decisions, and a ready-to-send follow-up email — generated automatically.",
    to: "/features",
    cta: "See how it works",
  },
  {
    icon: MessageSquare,
    title: "AI meeting chat",
    desc: "Ask questions across your entire history and get answers with cited transcript sources.",
    to: "/app/chat",
    cta: "Try AI chat",
  },
  {
    icon: ShieldQuestion,
    title: "Private Q&A assistant",
    desc: "Get private, real-time suggestions during a meeting. Answers stay private until you explicitly publish them.",
    to: "/app/live",
    cta: "Open console",
  },
  {
    icon: Library,
    title: "Searchable library",
    desc: "Find any decision, topic, quote, or task across every session in seconds.",
    to: "/app/search",
    cta: "Search meetings",
  },
  {
    icon: ListChecks,
    title: "Action items",
    desc: "Tasks, owners, due dates, and priorities are detected automatically and tracked to done.",
    to: "/app/action-items",
    cta: "View action items",
  },
  {
    icon: Share2,
    title: "Session sharing",
    desc: "Share a live or completed session with a safe viewer link — transcript and published notes only.",
    to: "/join",
    cta: "Join a session",
  },
  {
    icon: Download,
    title: "Export",
    desc: "Export transcripts and summaries to share or archive. Available on Pro and above.",
    to: "/pricing",
    cta: "See plans",
    gated: true,
  },
  {
    icon: Plug,
    title: "Integrations",
    desc: "Connect calendars, conferencing, CRM, and docs. Each shows an honest configured / not-configured state.",
    to: "/integrations",
    cta: "Browse integrations",
  },
];

export function ProductPage() {
  return (
    <div className="bg-background pb-24">
      <PageHeader
        eyebrow="Product"
        title={
          <>
            One platform for{" "}
            <span style={{ color: "#6F6F6F" }}>meeting intelligence</span>
          </>
        }
        subtitle="Capture every conversation, understand it instantly, and turn it into shareable, searchable, actionable knowledge."
      />

      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Card key={m.title} className="flex flex-col p-6">
              <div className="flex items-center gap-2">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-aurora-50 text-aurora-700">
                  <m.icon className="h-5 w-5" />
                </div>
                {m.gated && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    <Lock className="h-3 w-3" /> Pro+
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{m.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                {m.desc}
              </p>
              <Button to={m.to} variant="outline" size="sm" className="mt-4 self-start">
                {m.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
        </div>

        <div className="mt-16 grid gap-6 rounded-3xl bg-ink p-10 text-white sm:grid-cols-2 sm:p-14">
          <div>
            <h2 className="font-display text-3xl">Security & privacy, built in</h2>
            <p className="mt-3 text-white/70">
              Aurora is consent-first by design: a visible recording indicator is
              always shown and consent is required before every session. You
              control sharing, exports, and deletion.
            </p>
            <Button to="/security" variant="secondary" className="mt-6">
              Explore security
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["Consent-first", "Visible indicator", "Share controls", "Export & delete"].map(
              (s) => (
                <div
                  key={s}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm backdrop-blur"
                >
                  {s}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
