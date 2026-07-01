import { useState } from "react";
import axios from "axios";
import { LifeBuoy, Loader2, Copy, Eraser, BookOpen, Wand2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { jobPackOptions } from "@aurora/shared";
import { useToast } from "@/components/ui/Toast";

/**
 * Backup Assist — manual support when live transcript updates are interrupted.
 * Uses only the viewer's typed/pasted context and public shared content. It does
 * not access host private copilot data, does not auto-publish, and the shared
 * viewer stays read-only.
 */

interface BackupResult {
  answer: string;
  talkingPoints: string[];
  followUpQuestion: string;
  confidence: "low" | "medium" | "high";
  providerStatus: "ai" | "offline";
  createdAt: string;
}

const ACTIONS: { id: string; label: string }[] = [
  { id: "answer", label: "Answer this question" },
  { id: "talking_points", label: "Give senior-level talking points" },
  { id: "simplify", label: "Simplify answer" },
  { id: "follow_up", label: "Draft follow-up" },
  { id: "summarize", label: "Summarize context" },
  { id: "action_items", label: "Create action items" },
  { id: "interview_answer", label: "Give interview-style answer" },
];

const EXPERIENCE = ["10+ years", "7–10 years", "5–7 years", "3–5 years"];

export function BackupAssistPanel({
  shareId,
  publicTranscriptContext,
  onOpenPack,
}: {
  shareId: string;
  publicTranscriptContext?: string;
  onOpenPack: () => void;
}) {
  const { toast } = useToast();
  const options = jobPackOptions();
  const [jobType, setJobType] = useState(options[0]?.title ?? "");
  const [experienceLevel, setExperienceLevel] = useState("10+ years");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (actionType: string) => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/shared/${shareId}/backup-assist`, {
        manualContext: context,
        jobType,
        experienceLevel,
        actionType,
        publicTranscriptContext,
      });
      setResult(data as BackupResult);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError("This shared session link is no longer active.");
      } else if (axios.isAxiosError(err) && err.response?.status === 429) {
        setError("Too many requests — please wait a moment and try again.");
      } else {
        setError("Couldn't reach Backup Assist. Try the Offline Interview Pack.");
      }
    } finally {
      setBusy(false);
    }
  };

  const copyResult = () => {
    if (!result) return;
    const text = [
      `Answer: ${result.answer}`,
      `Talking points:`,
      ...result.talkingPoints.map((p) => `  • ${p}`),
      `Follow-up: ${result.followUpQuestion}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast("Copied", "success");
  };

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-aurora-600" />
          <div>
            <h3 className="font-medium text-ink">Backup Assist</h3>
            <p className="text-xs text-muted">Manual support when live transcript updates are interrupted.</p>
          </div>
        </div>
        <button
          onClick={onOpenPack}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:border-aurora-300 hover:text-aurora-700"
        >
          <BookOpen className="h-3.5 w-3.5" /> Offline Interview Pack
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-aurora-400 sm:w-1/2"
          aria-label="Interview / job type"
        >
          {options.map((o) => (
            <option key={o.id} value={o.title}>
              {o.title}
            </option>
          ))}
        </select>
        <select
          value={experienceLevel}
          onChange={(e) => setExperienceLevel(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-aurora-400 sm:w-1/2"
          aria-label="Experience level"
        >
          {EXPERIENCE.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        rows={3}
        placeholder="Paste or type the question/context here..."
        className="mt-2 w-full resize-none rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => generate(a.id)}
            disabled={busy}
            className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium text-ink/80 transition hover:border-aurora-300 hover:text-aurora-700 disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => generate("answer")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-aurora-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-aurora-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate
        </button>
        <button
          onClick={copyResult}
          disabled={!result}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium text-ink disabled:opacity-40"
        >
          <Copy className="h-4 w-4" /> Copy
        </button>
        <button
          onClick={() => {
            setContext("");
            setResult(null);
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium text-ink"
        >
          <Eraser className="h-4 w-4" /> Clear
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}

      {result && (
        <div className="mt-3 rounded-xl border border-black/[0.06] bg-aurora-50/40 p-3.5">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-medium">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
              {result.confidence} confidence
            </span>
            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-muted">
              {result.providerStatus === "ai" ? "AI" : "Offline pack"}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{result.answer}</p>
          {result.talkingPoints.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.talkingPoints.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink/75">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aurora-400" />
                  {p}
                </li>
              ))}
            </ul>
          )}
          {result.followUpQuestion && (
            <p className="mt-2 text-xs text-muted">Follow-up: {result.followUpQuestion}</p>
          )}
        </div>
      )}
    </div>
  );
}
