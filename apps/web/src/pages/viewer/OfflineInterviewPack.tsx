import { useMemo, useState } from "react";
import {
  X,
  Search,
  Copy,
  BookOpen,
  HelpCircle,
  ChevronDown,
  Flame,
  Layers,
  Target,
  ClipboardList,
} from "lucide-react";
import {
  JOB_PACKS,
  QA_CATEGORIES,
  packEntries,
  mostAskedEntries,
  isSeniorScenario,
  entryView,
  getJobPack,
  getInterviewFlow,
  getRoleQuestions,
  jobPackOptions,
  INTERVIEWER_QUESTIONS,
  type QAEntry,
  type QACategory,
  type InterviewFlow,
} from "@aurora/shared";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type Filter = "All" | "Most Asked" | "Senior Scenarios" | QACategory;
const FILTERS: Filter[] = ["All", "Most Asked", "Senior Scenarios", ...QA_CATEGORIES];

/**
 * Offline Interview Pack — a Senior Answer Guide / interview reference for
 * experienced (10+ yr) candidates. Works fully offline (no AI, no live
 * transcript, no network once loaded). Built-in role guidance only — no host
 * private data. Preparation / reference mode.
 */
export function OfflineInterviewPack({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const options = useMemo(() => jobPackOptions(), []);
  const [jobId, setJobId] = useState(options[0]?.id ?? JOB_PACKS[0].id);
  const [filter, setFilter] = useState<Filter>("Most Asked");
  const [query, setQuery] = useState("");

  const pack = getJobPack(jobId) ?? JOB_PACKS[0];
  const flow = getInterviewFlow(pack.id);
  const roleQuestions = getRoleQuestions(pack.id);
  const allEntries = useMemo(() => packEntries(pack), [pack]);

  const entries = useMemo(() => {
    let base: QAEntry[];
    if (filter === "Most Asked") base = mostAskedEntries(pack);
    else if (filter === "Senior Scenarios") base = allEntries.filter(isSeniorScenario);
    else if (filter === "All") base = allEntries;
    else base = allEntries.filter((e) => e.category === filter);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (e) =>
        e.question.toLowerCase().includes(q) ||
        e.answer.toLowerCase().includes(q) ||
        (e.keyPoints ?? []).some((k) => k.toLowerCase().includes(q))
    );
  }, [pack, allEntries, filter, query]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied`, "success");
  };

  const showQuestionsToAsk = filter === "All" || filter === "Questions to Ask Interviewer";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-2 backdrop-blur-sm animate-fade-in sm:p-6">
      <div className="my-2 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-modal animate-slide-up sm:animate-scale-in">
        {/* Header + sticky filter bar */}
        <div className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-aurora-600" />
              <div>
                <h2 className="font-display text-lg text-ink">Offline Interview Pack</h2>
                <p className="text-xs text-muted">Senior Answer Guide (10+ yrs) — reference mode, works offline.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-black/[0.04]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-2 px-4 pb-3 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-aurora-400 sm:w-64"
                aria-label="Job title"
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search questions & answers…"
                  className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-aurora-400"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                    filter === f
                      ? "border-aurora-300 bg-aurora-50 text-aurora-700"
                      : "border-black/10 bg-white text-muted hover:text-ink"
                  )}
                >
                  {f === "Most Asked" && <Flame className="h-3 w-3" />}
                  {f === "Senior Scenarios" && <Layers className="h-3 w-3" />}
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[68vh] overflow-y-auto px-4 py-4 sm:px-5">
          {/* Interview Flow Summary */}
          {flow && filter !== "Questions to Ask Interviewer" && !query && (
            <InterviewFlowCard title={pack.title} flow={flow} strategy={pack.strategy} />
          )}

          {/* Q&A cards */}
          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No entries match your search.</p>
          ) : (
            <div className="space-y-3">
              {entries.map((e, i) => (
                <QACard key={`${e.category}-${i}-${e.question.slice(0, 24)}`} entry={e} onCopy={copy} />
              ))}
            </div>
          )}

          {/* Questions to ask the interviewer */}
          {showQuestionsToAsk && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                <HelpCircle className="h-4 w-4" /> Questions to ask the interviewer
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-emerald-700/80">Always ask</p>
              <ul className="mt-1 space-y-1.5">
                {INTERVIEWER_QUESTIONS.map((q) => (
                  <li key={q} className="flex items-start gap-2 text-sm text-ink/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {q}
                  </li>
                ))}
              </ul>
              {roleQuestions.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-emerald-700/80">
                    For a {pack.title} role
                  </p>
                  <ul className="mt-1 space-y-1.5">
                    {roleQuestions.map((q) => (
                      <li key={q} className="flex items-start gap-2 text-sm text-ink/80">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button
                onClick={() =>
                  copy(
                    [...INTERVIEWER_QUESTIONS, ...roleQuestions].map((q) => `- ${q}`).join("\n"),
                    "Interviewer questions"
                  )
                }
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-50"
              >
                <Copy className="h-3 w-3" /> Copy all
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-black/[0.06] px-4 py-2.5 text-center text-[11px] text-muted sm:px-5">
          Preparation &amp; reference only — built-in role guidance, no host private data.
          {" "}Showing {entries.length} of {allEntries.length} entries for {pack.title}.
        </div>
      </div>
    </div>
  );
}

function InterviewFlowCard({
  title,
  flow,
  strategy,
}: {
  title: string;
  flow: InterviewFlow;
  strategy: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-4 rounded-xl border border-aurora-200 bg-gradient-to-b from-aurora-50/70 to-white p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Target className="h-4 w-4 text-aurora-600" /> Interview Flow — {title}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-ink/80">{flow.overview}</p>
          <div className="rounded-lg bg-white/70 p-3">
            <p className="text-xs font-semibold text-aurora-700">Strong opening pitch</p>
            <p className="mt-0.5 italic text-ink/80">“{flow.openingPitch}”</p>
          </div>
          <FlowList label="What US hiring managers look for" items={flow.hiringManagersLookFor} />
          <p className="text-ink/80">
            <span className="text-xs font-semibold text-aurora-700">Positioning 10+ years:</span>{" "}
            {flow.positioningExperience}
          </p>
          <FlowList label="Strengths to highlight" items={flow.strengthsToHighlight} tone="emerald" />
          <FlowList label="Red flags to avoid" items={flow.redFlagsToAvoid} tone="red" />
          <FlowList label="Best projects to discuss" items={flow.bestProjectsToDiscuss} />
          <p className="text-xs text-muted">{strategy}</p>
        </div>
      )}
    </div>
  );
}

function FlowList({
  label,
  items,
  tone = "aurora",
}: {
  label: string;
  items: string[];
  tone?: "aurora" | "emerald" | "red";
}) {
  const color =
    tone === "emerald" ? "bg-emerald-400" : tone === "red" ? "bg-red-400" : "bg-aurora-400";
  return (
    <div>
      <p className="text-xs font-semibold text-aurora-700">{label}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li key={it} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-ink/75 shadow-sm">
            <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QACard({ entry, onCopy }: { entry: QAEntry; onCopy: (t: string, l: string) => void }) {
  const [open, setOpen] = useState(false);
  const v = entryView(entry);
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {entry.category}
            </span>
            {entry.mostAsked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                <Flame className="h-3 w-3" /> Most asked
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">{entry.question}</p>
          {!open && <p className="mt-1 line-clamp-2 text-sm text-ink/70">{v.summary}</p>}
        </div>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-black/[0.06] px-3.5 py-3">
          <Field label="Best Senior Answer">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{entry.answer}</p>
          </Field>
          <Field label="Quick Summary">
            <p className="text-sm text-ink/75">{v.summary}</p>
          </Field>
          {entry.keyPoints && entry.keyPoints.length > 0 && (
            <Field label="Key Points to Mention">
              <ul className="space-y-1">
                {entry.keyPoints.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm text-ink/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aurora-400" />
                    {k}
                  </li>
                ))}
              </ul>
            </Field>
          )}
          {entry.example && (
            <Field label="Real Project Example">
              <p className="rounded-lg bg-aurora-50/50 px-3 py-2 text-sm italic leading-relaxed text-ink/80">
                {entry.example}
              </p>
            </Field>
          )}
          <Field label="Follow-up Tip">
            <p className="text-sm text-ink/75">{v.followUpTip}</p>
          </Field>

          <div className="flex flex-wrap gap-2 pt-1">
            <CopyBtn label="Copy Full Answer" onClick={() => onCopy(entry.answer, "Answer")} />
            <CopyBtn label="Copy Summary" onClick={() => onCopy(v.summary, "Summary")} />
            {entry.keyPoints && entry.keyPoints.length > 0 && (
              <CopyBtn
                label="Copy Key Points"
                onClick={() => onCopy(entry.keyPoints!.map((k) => `• ${k}`).join("\n"), "Key points")}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-aurora-700">
        <ClipboardList className="h-3 w-3" /> {label}
      </p>
      {children}
    </div>
  );
}

function CopyBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-aurora-700 shadow-sm ring-1 ring-black/[0.04] hover:bg-aurora-50"
    >
      <Copy className="h-3 w-3" /> {label}
    </button>
  );
}
