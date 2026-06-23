import { PageHeader } from "@/components/marketing/PageHeader";
import { INTEGRATIONS } from "@/lib/marketing";
import { Button } from "@/components/ui/Button";

const categories = [...new Set(INTEGRATIONS.map((i) => i.category))];

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
        subtitle="Bring meetings in from your calendar and conferencing tools, and push summaries and action items out to where work happens."
      />

      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        {categories.map((cat) => (
          <div key={cat} className="mb-12">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-muted">
              {cat}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {INTEGRATIONS.filter((i) => i.category === cat).map((it) => (
                <div
                  key={it.name}
                  className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-white p-5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: it.color }}
                    >
                      {it.name[0]}
                    </span>
                    <div>
                      <p className="font-medium text-ink">{it.name}</p>
                      <p className="text-xs text-muted">{it.category}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Connect
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-3xl bg-gradient-to-b from-aurora-50/60 to-white p-10 text-center">
          <h2 className="font-display text-3xl text-ink">
            Don't see your tool?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            Aurora connects to thousands of apps through Zapier and a developer
            API — automate any workflow.
          </p>
          <Button to="/signup" variant="secondary" className="mt-6">
            Start Free
          </Button>
        </div>
      </div>
    </div>
  );
}
