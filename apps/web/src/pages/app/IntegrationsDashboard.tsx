import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Settings2, AlertTriangle, XCircle, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { PageTitle, LoadingBlock } from "@/components/app/shared";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/auth";
import { PLANS } from "@aurora/shared";
import type { IntegrationCatalogEntry } from "@aurora/shared";

type IntegrationCard = IntegrationCatalogEntry & {
  connectionState?: "connected" | "disconnected" | "not_configured" | "needs_approval" | "expired" | "failed";
  configured?: boolean;
  connected?: boolean;
  lastSyncResult?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  tokenExpiresAt?: string | null;
};

const GROUPS = ["Meeting Platforms", "Calendars"] as const;

function StateBadge({ state }: { state: IntegrationCard["state"] }) {
  if (state === "CONNECTED")
    return (
      <StatusPill tone="success">
        <Check className="h-3 w-3" /> Connected
      </StatusPill>
    );
  if (state === "FAILED")
    return (
      <StatusPill tone="error">
        <XCircle className="h-3 w-3" /> Error
      </StatusPill>
    );
  if (state === "NEEDS_APPROVAL")
    return (
      <StatusPill tone="processing">
        <AlertTriangle className="h-3 w-3" /> Connect
      </StatusPill>
    );
  return (
    <StatusPill tone="muted">
      <Settings2 className="h-3 w-3" /> Not configured
    </StatusPill>
  );
}

export function IntegrationsDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const connect = useMutation({
    mutationFn: async (provider: string) =>
      (await api.post(`/integrations/${provider}/connect`)).data as { authUrl?: string; message: string },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      toast(data.message, "info");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => toast(apiError(err, "Could not start connection."), "error"),
  });
  const disconnect = useMutation({
    mutationFn: async (provider: string) => (await api.post(`/integrations/${provider}/disconnect`)).data,
    onSuccess: () => {
      toast("Integration disconnected.", "success");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => toast(apiError(err, "Could not disconnect integration."), "error"),
  });
  const testConn = useMutation({
    mutationFn: async (provider: string) =>
      (await api.post(`/integrations/${provider}/test`)).data as { message: string; ok: boolean },
    onSuccess: (data) => {
      toast(data.message, data.ok ? "success" : "info");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => toast(apiError(err, "Connection test failed."), "error"),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () =>
      (await api.get<{ integrations: IntegrationCard[] }>("/integrations")).data.integrations,
  });

  return (
    <div>
      <PageTitle
        title="Integrations"
        subtitle="Connect your meeting platforms and calendars. Aurora uses OAuth only. Email passwords are never used."
      />

      <div className="mb-5 rounded-xl border border-black/[0.06] bg-aurora-50/40 px-4 py-3 text-sm text-aurora-800">
        Aurora connects via official provider OAuth. Statuses are honest — a
        provider is only <span className="font-medium">Connected</span> after you
        complete its OAuth consent. <span className="font-medium">Not configured</span>{" "}
        means the server is missing that provider's OAuth credentials.
      </div>

      {error && !user?.developerBypass ? (
        <div className="rounded-xl border border-black/[0.06] bg-aurora-50/40 p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-aurora-600" />
          <h3 className="mt-3 font-display text-lg text-ink">Upgrade to unlock integrations</h3>
          <p className="mt-1 text-sm text-muted">
            Integrations are available on the {PLANS.BUSINESS.name} plan and above.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate("/app/billing")}>
            <Sparkles className="h-4 w-4" /> View plans
          </Button>
        </div>
      ) : isLoading ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const items = (data ?? []).filter((it) => it.category === group);
            if (items.length === 0) return null;
            return (
              <section key={group}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{group}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((it) => (
                    <Card key={it.provider} interactive className="flex flex-col p-5">
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

                      {it.state !== "CONNECTED" && it.setupNote && (
                        <p className="mt-2 rounded-lg bg-black/[0.03] px-2.5 py-1.5 text-xs text-muted">
                          {it.setupNote}
                        </p>
                      )}
                      {it.lastError ? (
                        <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                          Last error: {it.lastError}
                        </p>
                      ) : (
                        <p className="mt-2 rounded-lg bg-black/[0.03] px-2.5 py-1.5 text-xs text-muted">
                          {it.lastSyncAt
                            ? `Last synced: ${new Date(it.lastSyncAt).toLocaleString()}`
                            : "Not connected yet"}
                        </p>
                      )}

                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={connect.isPending || disconnect.isPending}
                          onClick={() =>
                            it.state === "CONNECTED"
                              ? disconnect.mutate(it.provider)
                              : connect.mutate(it.provider)
                          }
                        >
                          {it.state === "CONNECTED" ? "Disconnect" : "Connect"}
                        </Button>
                        {it.state === "CONNECTED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={testConn.isPending}
                            onClick={() => testConn.mutate(it.provider)}
                          >
                            {testConn.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            Test
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}

          <p className="text-xs text-muted">
            Aurora supports Zoom, Google Meet, and Microsoft Teams (meeting
            platforms) plus Google Calendar and Outlook Calendar. Aurora uses
            OAuth only. Email passwords are never used.
          </p>
        </div>
      )}
    </div>
  );
}
