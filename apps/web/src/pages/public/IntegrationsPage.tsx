import { Check, Clock, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { INTEGRATION_CATALOG, type IntegrationState } from "@aurora/shared";

const categories = [...new Set(INTEGRATION_CATALOG.map((i) => i.category))];

function StateBadge({ state }: { state: IntegrationState }) {
  if (state === "CONNECTED")
    return (
      <StatusPill tone="success">
        <Check className="h-3 w-3" /> Connected
      </StatusPill>
    );
  if (state === "COMING_SOON")
    return (
      <StatusPill tone="muted">
        <Clock className="h-3 w-3" /> Coming soon
      </StatusPill>
    );
  return (
    <StatusPill tone="processing">
      <Settings2 className="h-3 w-3" /> Not configured
    </StatusPill>
  );
}

export function IntegrationsPage() {
  return (
    <div className="bg-background pb-24">
      <PageHeader
        eyebrow="Integrations"
        title={
          <>
            Connect Aurora to your{" "}
            <span style={{ color: "#6F6F6F" }}>entire stack</span>
          </>
        }
        subtitle="Bring meetings in from your calendar and conferencing tools, and push summaries and action items out to where work happens. Every integration uses official APIs."
      />

      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        {categories.map((cat) => (
          <div key={cat} className="mb-12">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-muted">
              {cat}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {INTEGRATION_CATALOG.filter((i) => i.category === cat).map((it) => (
                <div
                  key={it.provider}
                  className="rounded-2xl border border-black/[0.06] bg-white p-5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: it.color }}
                    >
                      {it.name[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{it.name}</p>
                      <p className="text-xs text-muted">{it.category}</p>
                    </div>
                    <div className="ml-auto">
                      <StateBadge state={it.state} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted">{it.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-3xl bg-gradient-to-b from-aurora-50/60 to-white p-10 text-center">
          <h2 className="font-display text-3xl text-ink">
            Need a specific integration?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            Connectors are added continuously. Tell us what your team needs and
            we'll prioritize it.
          </p>
          <Button to="/signup" variant="secondary" className="mt-6">
            Start Free
          </Button>
        </div>
      </div>
    </div>
  );
}
