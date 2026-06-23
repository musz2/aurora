import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plug } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { PageTitle, LoadingBlock } from "@/components/app/shared";
import { INTEGRATIONS } from "@/lib/marketing";

interface IntegrationStatus {
  provider: string;
  status: "CONNECTED" | "DISCONNECTED";
}

const META = new Map(
  INTEGRATIONS.map((i) => [
    i.name
      .toLowerCase()
      .replace("microsoft ", "")
      .replace("google ", "google-")
      .replace(" ", "-"),
    i,
  ])
);

function describe(provider: string) {
  const found = INTEGRATIONS.find(
    (i) =>
      i.name.toLowerCase().includes(provider.replace("-", " ")) ||
      provider.includes(i.name.toLowerCase().split(" ")[0])
  );
  return found;
}

export function IntegrationsDashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () =>
      (await api.get<{ integrations: IntegrationStatus[] }>("/integrations"))
        .data.integrations,
  });

  const toggle = useMutation({
    mutationFn: async ({
      provider,
      connect,
    }: {
      provider: string;
      connect: boolean;
    }) =>
      api.post(`/integrations/${provider}/${connect ? "connect" : "disconnect"}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });

  return (
    <div>
      <PageTitle
        title="Integrations"
        subtitle="Connect Aurora to your meeting, CRM, task, and storage tools."
      />

      {isLoading ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((it) => {
            const meta = describe(it.provider) ?? META.get(it.provider);
            const connected = it.status === "CONNECTED";
            return (
              <Card key={it.provider} className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: meta?.color ?? "#6366f1" }}
                  >
                    {(meta?.name ?? it.provider)[0].toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium capitalize text-ink">
                      {meta?.name ?? it.provider.replace("-", " ")}
                    </p>
                    <p className="text-xs text-muted">
                      {meta?.category ?? "Integration"}
                    </p>
                  </div>
                  {connected && (
                    <Badge tone="green" className="ml-auto">
                      <Check className="h-3 w-3" /> Connected
                    </Badge>
                  )}
                </div>
                <p className="mt-3 flex-1 text-sm text-muted">
                  {connected
                    ? "Active — meetings and data sync automatically."
                    : `Connect ${meta?.name ?? it.provider} to sync meetings, notes, and tasks.`}
                </p>
                <Button
                  variant={connected ? "outline" : "secondary"}
                  size="sm"
                  className="mt-4"
                  onClick={() =>
                    toggle.mutate({
                      provider: it.provider,
                      connect: !connected,
                    })
                  }
                  disabled={toggle.isPending}
                >
                  {connected ? "Disconnect" : "Connect"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
