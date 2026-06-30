import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Settings2, FlaskConical, AlertTriangle, XCircle, Sparkles } from "lucide-react";
import { useState } from "react";
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
  connectionState?: "connected" | "disconnected" | "mock" | "failed" | "needs_approval";
  configured?: boolean;
  lastSyncResult?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  mockMode?: boolean;
};

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
        <XCircle className="h-3 w-3" /> Failed
      </StatusPill>
    );
  if (state === "NEEDS_APPROVAL")
    return (
      <StatusPill tone="processing">
        <AlertTriangle className="h-3 w-3" /> Needs approval
      </StatusPill>
    );
  if (state === "DISCONNECTED")
    return (
      <StatusPill tone="muted">
        <Settings2 className="h-3 w-3" /> Disconnected
      </StatusPill>
    );
  if (state === "COMING_SOON")
    return (
      <StatusPill tone="muted">
        <Clock className="h-3 w-3" /> Coming soon
      </StatusPill>
    );
  if (state === "MOCK_MODE")
    return (
      <StatusPill tone="processing">
        <FlaskConical className="h-3 w-3" /> Mock mode
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
  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [channelIds, setChannelIds] = useState<Record<string, string>>({});
  const testAction = useMutation({
    mutationFn: async (provider: string) =>
      (
        await api.post(`/integrations/${provider}/actions/share-summary`, {
          ...(provider === "slack" && channelIds.slack
            ? { channelId: channelIds.slack }
            : {}),
        })
      ).data as { result: { message: string; mode: "live" | "mock" } },
    onSuccess: (data) => {
      toast(data.result.message, data.result.mode === "live" ? "success" : "info");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => toast(apiError(err, "Integration action failed."), "error"),
  });
  const connect = useMutation({
    mutationFn: async (provider: string) =>
      (await api.post(`/integrations/${provider}/connect`)).data as {
        authUrl?: string;
        message: string;
        mode?: "mock";
      },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      toast(data.message, data.mode === "mock" ? "info" : "success");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => toast(apiError(err, "Could not start connection."), "error"),
  });
  const disconnect = useMutation({
    mutationFn: async (provider: string) =>
      (await api.post(`/integrations/${provider}/disconnect`)).data,
    onSuccess: () => {
      toast("Integration disconnected.", "success");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => toast(apiError(err, "Could not disconnect integration."), "error"),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () =>
      (await api.get<{ integrations: IntegrationCard[] }>("/integrations"))
        .data.integrations,
  });

  return (
    <div>
      <PageTitle
        title="Integrations"
        subtitle="Connect Aurora to your meeting, calendar, CRM, and docs tools."
      />

      <div className="mb-5 rounded-xl border border-black/[0.06] bg-aurora-50/40 px-4 py-3 text-sm text-aurora-800">
        Integrations use official provider APIs and OAuth. Statuses are honest:
        Aurora never shows a fake “Connected”. Items marked{" "}
        <span className="font-medium">Not configured</span> require server
        credentials; <span className="font-medium">Mock mode</span> can run
        local development flows until credentials are added.
      </div>

      {error && !user?.developerBypass ? (
        <div className="rounded-xl border border-black/[0.06] bg-aurora-50/40 p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-aurora-600" />
          <h3 className="mt-3 font-display text-lg text-ink">Upgrade to unlock integrations</h3>
          <p className="mt-1 text-sm text-muted">
            Integrations are available on the {PLANS.BUSINESS.name} plan and above.
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate("/app/billing")}
          >
            <Sparkles className="h-4 w-4" /> View plans
          </Button>
        </div>
      ) : isLoading ? (
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
              {it.mockMode && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                  Mock mode: no live provider call will be made until credentials are configured.
                </p>
              )}
              <p className="mt-2 rounded-lg bg-black/[0.03] px-2.5 py-1.5 text-xs text-muted">
                Last sync: {it.lastError ?? it.lastSyncResult ?? "Not run yet"}
              </p>
              {it.provider === "slack" && (
                <input
                  value={channelIds.slack ?? ""}
                  onChange={(e) =>
                    setChannelIds((current) => ({
                      ...current,
                      slack: e.target.value,
                    }))
                  }
                  placeholder="Slack channel ID"
                  className="mt-3 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
                />
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={it.state === "COMING_SOON"}
                  onClick={() =>
                    it.state === "CONNECTED"
                      ? disconnect.mutate(it.provider)
                      : connect.mutate(it.provider)
                  }
                >
                  {it.state === "COMING_SOON"
                    ? "Coming soon"
                    : it.state === "CONNECTED"
                      ? "Disconnect"
                      : "Configure"}
                </Button>
                {it.state !== "COMING_SOON" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={testAction.isPending}
                    onClick={() => testAction.mutate(it.provider)}
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
