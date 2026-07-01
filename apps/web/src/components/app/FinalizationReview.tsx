import { useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  Mail,
  CheckCircle2,
  HelpCircle,
  Users2,
  Lock,
  StickyNote,
  RefreshCw,
  Trash2,
  Save,
  AlertTriangle,
  X,
} from "lucide-react";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/primitives";
import { SpeakerAvatar } from "@/components/app/TranscriptTimeline";
import { useToast } from "@/components/ui/Toast";
import type { PrivateNote } from "@/components/app/AssistantPanel";
import type { MeetingDto } from "@aurora/shared";

export interface FinalizationMeta {
  source: "ai" | "mock" | "unavailable";
  mock: boolean;
  label: string;
  speakerSummaries: { speakerName: string; segmentCount: number; share: number }[];
  questions: string[];
  durationSeconds: number;
}

/** Full-screen review shown after the host ends a session, before saving. */
export function FinalizationReview({
  meetingId,
  meeting,
  meta,
  privateNotes,
  sharedNotes,
  processing,
  onRegenerate,
  onSaved,
  onDiscard,
}: {
  meetingId: string;
  meeting: MeetingDto | null;
  meta: FinalizationMeta | null;
  privateNotes: PrivateNote[];
  sharedNotes: string[];
  processing: boolean;
  onRegenerate: () => void;
  onSaved: () => void;
  onDiscard: () => void;
}) {
  const { toast } = useToast();
  const summary = meeting?.summary;
  const [overview, setOverview] = useState(summary?.overview ?? "");
  const [keyPoints, setKeyPoints] = useState((summary?.keyPoints ?? []).join("\n"));
  const [decisions, setDecisions] = useState((summary?.decisions ?? []).join("\n"));
  const [email, setEmail] = useState(summary?.followUpEmail ?? "");
  const [saving, setSaving] = useState(false);

  // Re-seed editable fields when a fresh summary arrives (e.g. after regenerate).
  const summaryId = summary?.id ?? "";
  const [seededId, setSeededId] = useState(summaryId);
  if (summaryId && summaryId !== seededId) {
    setSeededId(summaryId);
    setOverview(summary?.overview ?? "");
    setKeyPoints((summary?.keyPoints ?? []).join("\n"));
    setDecisions((summary?.decisions ?? []).join("\n"));
    setEmail(summary?.followUpEmail ?? "");
  }

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/meetings/${meetingId}/summary`, {
        overview,
        keyPoints: keyPoints.split("\n").map((l) => l.trim()).filter(Boolean),
        decisions: decisions.split("\n").map((l) => l.trim()).filter(Boolean),
        followUpEmail: email,
      });
      toast("Meeting saved", "success");
      onSaved();
    } catch (err) {
      toast(apiError(err, "Could not save meeting"), "error");
    } finally {
      setSaving(false);
    }
  };

  const actionItems = meeting?.actionItems ?? [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="mx-auto my-6 w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-black/[0.06] bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 className="font-display text-2xl text-ink">Finalization review</h2>
            <p className="text-sm text-muted">
              Review and edit before saving to your meeting history.
            </p>
          </div>
          <button
            onClick={onDiscard}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-black/[0.04]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {processing && <FinalizationProgress />}

          {meta && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs ${
                meta.mock
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {meta.label}
            </div>
          )}

          {!processing && !summary && (
            <div className="rounded-xl border border-dashed border-black/10 p-8 text-center text-sm text-muted">
              No summary was generated. Try regenerating below.
            </div>
          )}

          {summary && (
            <>
              <Field icon={Sparkles} label="Executive summary">
                <textarea
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
                />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field icon={Sparkles} label="Timeline / key points (one per line)">
                  <textarea
                    value={keyPoints}
                    onChange={(e) => setKeyPoints(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
                  />
                </Field>
                <Field icon={CheckCircle2} label="Key decisions (one per line)">
                  <textarea
                    value={decisions}
                    onChange={(e) => setDecisions(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
                  />
                </Field>
              </div>

              <Field icon={Mail} label="Follow-up email draft">
                <textarea
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 font-mono text-xs outline-none focus:border-aurora-400"
                />
              </Field>
            </>
          )}

          {/* Read-only review sections */}
          <div className="grid gap-5 md:grid-cols-2">
            <ReadSection icon={CheckCircle2} label={`Action items (${actionItems.length})`}>
              {actionItems.length > 0 ? (
                <ul className="space-y-1.5">
                  {actionItems.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 text-sm text-ink/80">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-aurora-400" />
                      <span>
                        {a.task}
                        {a.assigneeName && (
                          <span className="text-muted"> — {a.assigneeName}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No action items detected.</Empty>
              )}
            </ReadSection>

            <ReadSection icon={HelpCircle} label={`Questions asked (${meta?.questions.length ?? 0})`}>
              {meta && meta.questions.length > 0 ? (
                <ul className="space-y-1.5">
                  {meta.questions.slice(0, 8).map((q, i) => (
                    <li key={i} className="text-sm text-ink/80">• {q}</li>
                  ))}
                </ul>
              ) : (
                <Empty>No questions detected.</Empty>
              )}
            </ReadSection>

            <ReadSection icon={Users2} label="Speaker-wise summary">
              {meta && meta.speakerSummaries.length > 0 ? (
                <ul className="space-y-2">
                  {meta.speakerSummaries.map((sp) => (
                    <li key={sp.speakerName} className="flex items-center gap-2">
                      <SpeakerAvatar name={sp.speakerName} className="h-6 w-6 text-[9px]" />
                      <span className="text-sm text-ink">{sp.speakerName}</span>
                      <span className="ml-auto text-xs text-muted">
                        {Math.round(sp.share * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No speaker data.</Empty>
              )}
            </ReadSection>

            <ReadSection icon={Lock} label={`Private notes (${privateNotes.length})`} badge="Host only">
              {privateNotes.length > 0 ? (
                <ul className="space-y-1.5">
                  {privateNotes.map((n) => (
                    <li key={n.id} className="rounded-lg bg-black/[0.03] px-2.5 py-1.5 text-sm text-ink/80">
                      {n.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No private notes.</Empty>
              )}
            </ReadSection>
          </div>

          <ReadSection icon={StickyNote} label={`Shared notes (${sharedNotes.length})`}>
            {sharedNotes.length > 0 ? (
              <ul className="space-y-1.5">
                {sharedNotes.map((n, i) => (
                  <li key={i} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm text-ink/80">
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No shared notes published.</Empty>
            )}
          </ReadSection>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-black/[0.06] bg-white/95 px-6 py-4 backdrop-blur">
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            <Trash2 className="h-4 w-4" /> Discard meeting
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onRegenerate} disabled={processing || saving}>
              <RefreshCw className={`h-4 w-4 ${processing ? "animate-spin" : ""}`} /> Regenerate
            </Button>
            <Button variant="secondary" onClick={save} disabled={saving || processing}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save meeting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-aurora-700">
        <Icon className="h-4 w-4" /> {label}
      </label>
      {children}
    </div>
  );
}

function ReadSection({
  icon: Icon,
  label,
  badge,
  children,
}: {
  icon: React.ElementType;
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/[0.06] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-aurora-600" />
        <span className="text-sm font-semibold text-ink">{label}</span>
        {badge && <Badge tone="indigo">{badge}</Badge>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

/**
 * Staged finalization progress. Reflects the real server steps (cleanup →
 * summary → Q&A → decisions/actions → save). Advances on a timer while the
 * finalize request is in flight; the result banner above confirms the outcome,
 * so completion is never faked.
 */
const FINALIZE_STAGES = [
  "Cleaning transcript…",
  "Generating summary…",
  "Extracting questions and answers…",
  "Finding decisions and action items…",
  "Saving meeting notes…",
];

function FinalizationProgress() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setStage((s) => Math.min(s + 1, FINALIZE_STAGES.length - 1)),
      900
    );
    return () => clearInterval(t);
  }, []);
  return (
    <div className="rounded-xl border border-aurora-200 bg-aurora-50/60 px-4 py-3">
      <ul className="space-y-1.5">
        {FINALIZE_STAGES.map((label, i) => (
          <li key={label} className="flex items-center gap-2 text-sm">
            {i < stage ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : i === stage ? (
              <Loader2 className="h-4 w-4 animate-spin text-aurora-600" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-black/15" />
            )}
            <span className={i <= stage ? "text-ink" : "text-muted"}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
