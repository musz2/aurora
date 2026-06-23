import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Video, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { PageTitle } from "@/components/app/shared";
import { formatDateTime } from "@/lib/format";
import type { MeetingDto } from "@aurora/shared";

export function CalendarPage() {
  const [autoRecord, setAutoRecord] = useState(true);
  const [connected, setConnected] = useState<Record<string, boolean>>({
    google: true,
    outlook: false,
  });

  const { data } = useQuery({
    queryKey: ["meetings", "", "SCHEDULED"],
    queryFn: async () =>
      (
        await api.get<{ meetings: MeetingDto[] }>("/meetings", {
          params: { status: "SCHEDULED" },
        })
      ).data.meetings,
  });

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
              {[
                { id: "google", name: "Google Calendar", color: "#4285F4" },
                { id: "outlook", name: "Outlook Calendar", color: "#0078D4" },
              ].map((c) => (
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
                  {connected[c.id] ? (
                    <Badge tone="green">
                      <Check className="h-3 w-3" /> Connected
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setConnected((s) => ({ ...s, [c.id]: true }))
                      }
                    >
                      Connect
                    </Button>
                  )}
                </div>
              ))}
            </div>
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
          <h2 className="mb-3 font-semibold text-ink">Upcoming meetings</h2>
          <div className="space-y-3">
            {data && data.length > 0 ? (
              data.map((m) => (
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
                        {formatDateTime(m.startedAt)} •{" "}
                        {m.participants.length} participants
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="indigo">Auto-record on</Badge>
                    <Button to="/app/live" size="sm" variant="secondary">
                      <Video className="h-4 w-4" /> Join & record
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
        </div>
      </div>
    </div>
  );
}
