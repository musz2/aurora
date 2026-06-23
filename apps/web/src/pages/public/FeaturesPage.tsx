import { PageHeader } from "@/components/marketing/PageHeader";
import { CORE_FEATURES } from "@/lib/marketing";
import { Button } from "@/components/ui/Button";

export function FeaturesPage() {
  return (
    <div className="bg-background pb-24">
      <PageHeader
        eyebrow="Product"
        title={
          <>
            Every feature, built for{" "}
            <span style={{ color: "#6F6F6F" }}>meeting intelligence</span>
          </>
        }
        subtitle="From live transcription to cross-meeting AI chat — Aurora is a complete platform for turning conversations into knowledge."
      />

      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-black/[0.06] bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-glass"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-aurora-50 text-aurora-700 transition-colors group-hover:bg-aurora-gradient group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl bg-ink p-10 text-center text-white sm:p-16">
          <h2 className="font-display text-3xl sm:text-4xl">
            See Aurora in action
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/70">
            Start a live meeting room with simulated transcription, AI
            suggestions, and a consent-first recording flow.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button to="/signup" variant="secondary">
              Start Free
            </Button>
            <Button
              to="/pricing"
              className="border border-white/30 bg-transparent hover:bg-white/10"
            >
              View Pricing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
