import { useMemo, useState } from "react";
import { X, Search, Copy, BookOpen, HelpCircle } from "lucide-react";
import {
  JOB_PACKS,
  QA_CATEGORIES,
  packEntries,
  getJobPack,
  jobPackOptions,
  INTERVIEWER_QUESTIONS,
  type QAEntry,
  type QACategory,
} from "@aurora/shared";
import { useToast } from "@/components/ui/Toast";

type Filter = "All" | QACategory;
const FILTERS: Filter[] = ["All", ...QA_CATEGORIES];

/**
 * Offline Interview Pack — a preparation/reference resource for experienced
 * candidates. Works fully offline: no AI, no live transcript, no network needed
 * once loaded. Built-in role guidance only; no host private data.
 */
export function OfflineInterviewPack({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const options = useMemo(() => jobPackOptions(), []);
  const [jobId, setJobId] = useState(options[0]?.id ?? JOB_PACKS[0].id);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  const pack = getJobPack(jobId) ?? JOB_PACKS[0];
  const allEntries = useMemo(() => packEntries(pack), [pack]);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEntries.filter((e) => {
      if (filter !== "All" && e.category !== filter) return false;
      if (!q) return true;
      return (
        e.question.toLowerCase().includes(q) ||
        e.answer.toLowerCase().includes(q) ||
        (e.keyPoints ?? []).some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [allEntries, filter, query]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast(`${label} copied`, "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-6">
      <div className="my-2 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-aurora-600" />
            <div>
              <h2 className="font-display text-lg text-ink">Offline Interview Pack</h2>
              <p className="text-xs text-muted">Senior (10+ yrs) prep &amp; reference — works offline.</p>
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

        {/* Controls */}
        <div className="space-y-3 border-b border-black/[0.06] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-aurora-400 sm:w-64"
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
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  filter === f
                    ? "border-aurora-300 bg-aurora-50 text-aurora-700"
                    : "border-black/10 bg-white text-muted hover:text-ink"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[62vh] overflow-y-auto px-4 py-4 sm:px-5">
          {/* Role overview + strategy */}
          {filter === "All" && !query && (
            <div className="mb-4 rounded-xl border border-black/[0.06] bg-aurora-50/40 p-4">
              <p className="text-sm font-semibold text-ink">{pack.title}</p>
              <p className="mt-1 text-sm text-ink/75">{pack.overview}</p>
              <p className="mt-2 text-xs font-medium text-aurora-700">Senior strategy</p>
              <p className="text-sm text-ink/75">{pack.strategy}</p>
            </div>
          )}

          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No entries match your search.</p>
          ) : (
            <div className="space-y-3">
              {entries.map((e, i) => (
                <QACard key={`${e.category}-${i}-${e.question.slice(0, 24)}`} entry={e} onCopy={copy} />
              ))}
            </div>
          )}

          {/* Always-available "Questions to ask" quick reference */}
          {(filter === "All" || filter === "Questions to Ask Interviewer") && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                <HelpCircle className="h-4 w-4" /> Strong questions to ask the interviewer
              </p>
              <ul className="mt-2 space-y-1.5">
                {INTERVIEWER_QUESTIONS.map((q) => (
                  <li key={q} className="flex items-start gap-2 text-sm text-ink/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {q}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => copy(INTERVIEWER_QUESTIONS.map((q) => `- ${q}`).join("\n"), "Interviewer questions")}
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-50"
              >
                <Copy className="h-3 w-3" /> Copy all
              </button>
            </div>
          )}
        </div>

        <div className="rounded-b-2xl border-t border-black/[0.06] px-4 py-2.5 text-center text-[11px] text-muted sm:px-5">
          Preparation &amp; reference only. Uses built-in role guidance — no host private data.
          {" "}Showing {allEntries.length} entries for {pack.title}.
        </div>
      </div>
    </div>
  );
}

function QACard({ entry, onCopy }: { entry: QAEntry; onCopy: (t: string, l: string) => void }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
          {entry.category}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-ink">{entry.question}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{entry.answer}</p>
      {entry.keyPoints && entry.keyPoints.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entry.keyPoints.map((k) => (
            <li key={k} className="rounded-md bg-aurora-50 px-2 py-0.5 text-[11px] text-aurora-700">
              {k}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={() => onCopy(entry.answer, "Answer")}
          className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-medium text-aurora-700 shadow-sm hover:bg-aurora-50"
        >
          <Copy className="h-3 w-3" /> Copy answer
        </button>
        {entry.keyPoints && entry.keyPoints.length > 0 && (
          <button
            onClick={() => onCopy(entry.keyPoints!.map((k) => `• ${k}`).join("\n"), "Key points")}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-medium text-aurora-700 shadow-sm hover:bg-aurora-50"
          >
            <Copy className="h-3 w-3" /> Copy key points
          </button>
        )}
      </div>
    </div>
  );
}
