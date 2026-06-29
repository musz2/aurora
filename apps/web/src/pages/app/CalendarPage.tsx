import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Video, Check, Bot, MonitorSpeaker, Link2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { PageTitle } from "@/components/app/shared";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import type { IntegrationCatalogEntry, MeetingDto } from "@aurora/shared";

interface CalendarEventDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  attendees: string[];
  meetingLink: { provider: string; url: string; meetingId?: string } | null;
  autoJoinEligible: boolean;
  consentRequired: boolean;
  source?: string;
}

const LIMITATIONS: Record<string, string> = {
  zoom: "Zoom bot joining requires an approved Zoom app and visible participant identity.",
  "google-meet": "Google Meet bot joining may require Google OAuth scopes and workspace policy approval.",
  teams: "Teams bot joining requires Microsoft Graph permissions and tenant admin consent.",
};

// Calendar UI tiles → integration catalog provider ids (single source of truth
// for connection state lives in the backend integrations service).
const CALENDAR_PROVIDERS = [
  { id: "google-calendar", name: "Google Calendar", color: "#4285F4" },
  { id: "outlook-calendar", name: "Outlook Calendar", color: "#0078D4" },
] as const;

export function CalendarPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [autoRecord, setAutoRecord] = useState(true);

  // Honest connection state: a calendar shows "Connected" only when the backend
  // confirms a real OAuth/token connection (state === "CONNECTED"). No local
  // optimistic "connected" flags.
  const { data: integrations } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () =>
      (
        await api.get<{
          integrations: (IntegrationCatalogEntry & { configured?: boolean })[];
        }>("/integrations")
      ).data.integrations,
  });

  const connect = useMutation({
    mutationFn: async (provider: string) =>
      (await api.post(`/integrations/${provider}/connect`)).data as {
        authUrl?: string;
        message: string;
        mode?: "mock";
        state?: string;
      },
    onSuccess: (res) => {
      if (res.authUrl) {
        window.location.href = res.authUrl;
        return;
      }
      toast(res.message, res.mode === "mock" ? "info" : "success");
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) => toast(apiError(err, "Could not start connection."), "error"),
  });

  const calendarState = (providerId: string) =>
    integrations?.find((it) => it.provider === providerId)?.state;

  const { data } = useQuery({
    queryKey: ["meetings", "", "SCHEDULED"],
    queryFn: async () =>
      (
        await api.get<{ meetings: MeetingDto[] }>("/meetings", {
          params: { status: "SCHEDULED" },
        })
      ).data.meetings,
  });

  const { data: calendarData } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () =>
      (await api.get<{ mode: "mock" | "live"; events: CalendarEventDto[]; message: string }>("/calendar/events"))
        .data,
  });

  const autoJoin = useMutation({
    mutationFn: async ({
      event,
      captureMode,
    }: {
      event: CalendarEventDto;
      captureMode: "bot" | "desktop";
    }) =>
      (
        await api.post("/calendar/auto-join", {
          event: {
            id: event.id,
            title: event.title,
            description: event.meetingLink?.url,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            attendees: event.attendees,
          },
          captureMode,
        })
      ).data as { result: { status: string; message: string; participantNotification: string } },
    onSuccess: (data) => toast(`${data.result.status}: ${data.result.message}`, "info"),
    onError: () => toast("Could not prepare meeting capture.", "error"),
  });

  const prepareBot = (event: CalendarEventDto) => {
    const provider = event.meetingLink?.provider ?? "meeting";
    const ok = window.confirm(
      `Aurora will only prepare a visible bot participant after you confirm participant consent. ${LIMITATIONS[provider] ?? ""}`
    );
    if (ok) autoJoin.mutate({ event, captureMode: "bot" });
  };

  return (
    <div>
      <PageTitle
        title="Calendar"
        subtitle="Connect your calendar so Aurora can join and record automatically."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-5">
            <h2 className="font-semibold text-ink">Connected calendars</h2>
            <div className="mt-4 space-y-3">
              {CALENDAR_PROVIDERS.map((c) => {
                const state = calendarState(c.id);
                const isConnected = state === "CONNECTED";
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-black/[0.06] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold text-white"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.name[0]}
                      </span>
                      <span className="text-sm font-medium text-ink">
                        {c.name}
                      </span>
                    </div>
                    {isConnected ? (
                      <Badge tone="green">
                        <Check className="h-3 w-3" /> Connected
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={connect.isPending}
                        onClick={() => connect.mutate(c.id)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              Calendars show “Connected” only after a verified provider connection.
              Manage credentials on the{" "}
              <a href="/app/integrations" className="font-medium text-aurora-700">
                Integrations
              </a>{" "}
              page.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-ink">Auto-record</h2>
                <p className="mt-1 text-sm text-muted">
                  Automatically record meetings on your calendar.
                </p>
              </div>
              <button
                onClick={() => setAutoRecord((a) => !a)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  autoRecord ? "bg-aurora-600" : "bg-black/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    autoRecord ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="mt-3 rounded-lg bg-aurora-50 px-3 py-2 text-xs text-aurora-700">
              Consent acknowledgement is still required before each recording.
            </p>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-3 font-semibold text-ink">Detected calendar meetings</h2>
          {calendarData?.message && (
            <p className="mb-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-sm text-muted">
              {calendarData.message}
            </p>
          )}
          <div className="space-y-3">
            {calendarData?.events && calendarData.events.length > 0 ? (
              calendarData.events.map((m) => (
                <Card
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-aurora-50 text-aurora-600">
                      <Calendar className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-medium text-ink">{m.title}</p>
                      <p className="text-sm text-muted">
                        {formatDateTime(m.startsAt)} • {m.attendees.length} participants
                      </p>
                      {m.meetingLink && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-aurora-700">
                          <Link2 className="h-3 w-3" /> {m.meetingLink.provider}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted">
                        Source: {m.source ?? "calendar"}{m.meetingLink ? ` · ${LIMITATIONS[m.meetingLink.provider] ?? "Visible join preparation required."}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={m.autoJoinEligible ? "indigo" : "slate"}>
                      {m.autoJoinEligible ? "Auto-join ready" : "No link"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!m.autoJoinEligible || autoJoin.isPending}
                      onClick={() => prepareBot(m)}
                    >
                      <Bot className="h-4 w-4" /> Prepare bot
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!m.autoJoinEligible || autoJoin.isPending}
                      onClick={() => autoJoin.mutate({ event: m, captureMode: "desktop" })}
                    >
                      <MonitorSpeaker className="h-4 w-4" /> No bot
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center text-sm text-muted">
                No upcoming meetings. Connect a calendar to see your schedule.
              </Card>
            )}
          </div>

          {data && data.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 font-semibold text-ink">Scheduled in Aurora</h2>
              <div className="space-y-3">
                {data.map((m) => (
                  <Card key={m.id} className="flex items-center justify-between gap-3 p-5">
                    <div>
                      <p className="font-medium text-ink">{m.title}</p>
                      <p className="text-sm text-muted">{formatDateTime(m.startedAt)}</p>
                    </div>
                    <Button to="/app/live" size="sm" variant="secondary">
                      <Video className="h-4 w-4" /> Join & record
                    </Button>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
