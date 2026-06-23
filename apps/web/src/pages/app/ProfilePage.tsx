import { useState } from "react";
import { Bell, KeyRound, Link2 } from "lucide-react";
import { Card, Input, Label, Avatar, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { PageTitle } from "@/components/app/shared";
import { useAuthStore } from "@/store/auth";

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState(user?.name ?? "");
  const [notifs, setNotifs] = useState({
    summaries: true,
    actionItems: true,
    weekly: false,
  });

  return (
    <div>
      <PageTitle
        title="Profile settings"
        subtitle="Manage your account, notifications, and connected services."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold text-ink">Account</h2>
          <div className="mt-4 flex items-center gap-4">
            <Avatar name={user?.name ?? "User"} className="h-16 w-16 text-lg" />
            <Button variant="outline" size="sm">
              Change avatar
            </Button>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <Button>Save changes</Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-aurora-600" />
              <h2 className="font-semibold text-ink">Notifications</h2>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { key: "summaries", label: "Meeting summaries ready" },
                { key: "actionItems", label: "New action items assigned to me" },
                { key: "weekly", label: "Weekly digest" },
              ].map((n) => (
                <div
                  key={n.key}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-ink">{n.label}</span>
                  <button
                    onClick={() =>
                      setNotifs((s) => ({
                        ...s,
                        [n.key]: !s[n.key as keyof typeof notifs],
                      }))
                    }
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      notifs[n.key as keyof typeof notifs]
                        ? "bg-aurora-600"
                        : "bg-black/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        notifs[n.key as keyof typeof notifs]
                          ? "translate-x-[22px]"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-aurora-600" />
              <h2 className="font-semibold text-ink">Password</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              Change your password to keep your account secure.
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              Change password
            </Button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-aurora-600" />
              <h2 className="font-semibold text-ink">Connected accounts</h2>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { name: "Google", connected: true },
                { name: "Microsoft", connected: false },
              ].map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-xl border border-black/[0.06] p-3"
                >
                  <span className="text-sm font-medium text-ink">{c.name}</span>
                  {c.connected ? (
                    <Badge tone="green">Connected</Badge>
                  ) : (
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
