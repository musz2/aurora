import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ShieldCheck, Users, BookMarked } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Input, Label, Avatar, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { PageTitle } from "@/components/app/shared";

interface Member {
  id: string;
  role: string;
  status: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}
interface Workspace {
  id: string;
  name: string;
  plan: string;
  requireConsent: boolean;
  allPartyConsent: boolean;
  visibleIndicator: boolean;
  dataRetentionDays: number;
}
interface Vocab {
  id: string;
  term: string;
  description: string | null;
}

export function WorkspaceSettingsPage() {
  const qc = useQueryClient();

  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: async () =>
      (await api.get<{ workspace: Workspace }>("/workspace")).data.workspace,
  });
  const { data: members } = useQuery({
    queryKey: ["workspace", "members"],
    queryFn: async () =>
      (await api.get<{ members: Member[] }>("/workspace/members")).data.members,
  });
  const { data: vocab } = useQuery({
    queryKey: ["workspace", "vocab"],
    queryFn: async () =>
      (await api.get<{ vocabulary: Vocab[] }>("/workspace/vocabulary")).data
        .vocabulary,
  });

  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [term, setTerm] = useState("");

  const updateWs = useMutation({
    mutationFn: async (patch: Partial<Workspace>) =>
      api.put("/workspace", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace"] }),
  });
  const inviteMember = useMutation({
    mutationFn: async (email: string) =>
      api.post("/workspace/invite", { email, role: "MEMBER" }),
    onSuccess: () => {
      setInvite("");
      qc.invalidateQueries({ queryKey: ["workspace", "members"] });
    },
  });
  const addTerm = useMutation({
    mutationFn: async (t: string) => api.post("/workspace/vocabulary", { term: t }),
    onSuccess: () => {
      setTerm("");
      qc.invalidateQueries({ queryKey: ["workspace", "vocab"] });
    },
  });
  const delTerm = useMutation({
    mutationFn: async (id: string) => api.delete(`/workspace/vocabulary/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", "vocab"] }),
  });

  const consentToggles: { key: keyof Workspace; label: string; desc: string }[] =
    [
      {
        key: "requireConsent",
        label: "Require consent acknowledgement",
        desc: "Show the consent modal before every recording.",
      },
      {
        key: "allPartyConsent",
        label: "All-party consent mode",
        desc: "Require that every participant has consented.",
      },
      {
        key: "visibleIndicator",
        label: "Always-visible recording indicator",
        desc: "Never hide the recording status. Recommended.",
      },
    ];

  return (
    <div>
      <PageTitle
        title="Workspace settings"
        subtitle="Manage your team, vocabulary, and consent policies."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* General */}
        <Card className="p-6">
          <h2 className="font-semibold text-ink">General</h2>
          <div className="mt-4">
            <Label>Workspace name</Label>
            <div className="flex gap-2">
              <Input
                value={name || workspace?.name || ""}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                onClick={() => updateWs.mutate({ name: name || workspace?.name })}
                disabled={updateWs.isPending}
              >
                Save
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Plan: <Badge tone="indigo">{workspace?.plan}</Badge>
            </p>
          </div>
        </Card>

        {/* Consent */}
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="font-semibold text-ink">Consent & recording</h2>
          </div>
          <div className="mt-4 space-y-3">
            {consentToggles.map((t) => (
              <div
                key={t.key}
                className="flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{t.label}</p>
                  <p className="text-xs text-muted">{t.desc}</p>
                </div>
                <button
                  onClick={() =>
                    updateWs.mutate({
                      [t.key]: !workspace?.[t.key],
                    } as Partial<Workspace>)
                  }
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                    workspace?.[t.key] ? "bg-aurora-600" : "bg-black/15"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      workspace?.[t.key]
                        ? "translate-x-[22px]"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Members */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-aurora-600" />
            <h2 className="font-semibold text-ink">Members</h2>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="teammate@company.com"
              type="email"
            />
            <Button
              onClick={() => invite && inviteMember.mutate(invite)}
              disabled={inviteMember.isPending}
            >
              <Plus className="h-4 w-4" /> Invite
            </Button>
          </div>
          <div className="mt-4 divide-y divide-black/[0.06]">
            {members?.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={m.user.name} url={m.user.avatarUrl} />
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {m.user.name}
                    </p>
                    <p className="text-xs text-muted">{m.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="slate">{m.role}</Badge>
                  {m.status === "INVITED" && (
                    <Badge tone="amber">Invited</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Custom vocabulary */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-aurora-600" />
            <h2 className="font-semibold text-ink">Custom vocabulary</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            Teach Aurora your product names, acronyms, and domain terms for more
            accurate transcripts.
          </p>
          <div className="mt-4 flex gap-2">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. Kubernetes, Onboarding, The Career Insights"
            />
            <Button
              onClick={() => term && addTerm.mutate(term)}
              disabled={addTerm.isPending}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {vocab?.map((v) => (
              <span
                key={v.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-aurora-50 py-1 pl-3 pr-1.5 text-sm text-aurora-700"
              >
                {v.term}
                <button
                  onClick={() => delTerm.mutate(v.id)}
                  className="grid h-5 w-5 place-items-center rounded-full hover:bg-aurora-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
            {vocab?.length === 0 && (
              <p className="text-sm text-muted">No terms yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
