import { useQuery } from "@tanstack/react-query";
import { Check, Clock, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { PageTitle, LoadingBlock } from "@/components/app/shared";
import { useToast } from "@/components/ui/Toast";
import type { IntegrationCatalogEntry } from "@aurora/shared";

function StateBadge({ state }: { state: IntegrationCatalogEntry["state"] }) {
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

export function IntegrationsDashboard() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () =>
      (await api.get<{ integrations: IntegrationCatalogEntry[] }>("/integrations"))
        .data.integrations,
  });

  return (
    <div>
      <PageTitle
        title="Integrations"
        subtitle="Connect Aurora to your meeting, calendar, CRM, and docs tools."
      />

      <div className="mb-5 rounded-xl border border-black/[0.06] bg-aurora-50/40 px-4 py-3 text-sm text-aurora-800">
        Integrations use official provider APIs and OAuth. Statuses are honest —
        Aurora never shows a fake “Connected”. Items marked{" "}
        <span className="font-medium">Not configured</span> require server
        credentials; <span className="font-medium">Coming soon</span> items are
        planned.
      </div>

      {isLoading ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((it) => (
            <Card key={it.provider} className="flex flex-col p-5">
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
              <p className="mt-3 flex-1 text-sm text-muted">{it.description}</p>
              {it.state === "NOT_CONFIGURED" && it.setupNote && (
                <p className="mt-2 rounded-lg bg-black/[0.03] px-2.5 py-1.5 text-xs text-muted">
                  {it.setupNote}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={it.state === "COMING_SOON"}
                  onClick={() =>
                    toast(
                      it.state === "COMING_SOON"
                        ? `${it.name} is coming soon.`
                        : `${it.name} requires setup. ${it.setupNote ?? ""}`,
                      "info"
                    )
                  }
                >
                  {it.state === "COMING_SOON"
                    ? "Coming soon"
                    : it.state === "CONNECTED"
                      ? "Manage"
                      : "Configure"}
                </Button>
                {it.state === "NOT_CONFIGURED" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toast(
                        `${it.name}: not configured — connection test unavailable until credentials are set.`,
                        "info"
                      )
                    }
                  >
                    Test
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
