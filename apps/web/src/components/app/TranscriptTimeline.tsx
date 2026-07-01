import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Pencil,
  Highlighter,
  CheckCircle2,
  ListChecks,
  Copy,
  Check,
  X,
  UserCog,
} from "lucide-react";
import type { TranscriptSegmentDto } from "@aurora/shared";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/primitives";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Deterministic avatar palette (mirrors the server speaker.service palette). */
const PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f43f5e",
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SpeakerAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white",
        className
      )}
      style={{ backgroundColor: PALETTE[hash(name) % PALETTE.length] }}
    >
      {initials(name)}
    </span>
  );
}

type Seg = TranscriptSegmentDto;

export function TranscriptTimeline({
  meetingId,
  segments,
  readOnly = false,
}: {
  meetingId: string;
  segments: Seg[];
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Seg[]>(segments);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showClean, setShowClean] = useState(true);

  // Keep local copy in sync when the parent reloads the meeting.
  useEffect(() => setItems(segments), [segments]);

  const hasClean = useMemo(() => items.some((s) => s.cleanText && s.cleanText.trim()), [items]);

  const speakers = useMemo(
    () => [...new Set(items.map((s) => s.speakerName))],
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) =>
        s.text.toLowerCase().includes(q) ||
        s.speakerName.toLowerCase().includes(q)
    );
  }, [items, query]);

  const patchSegment = async (id: string, patch: Partial<Seg>) => {
    // optimistic
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      const { data } = await api.patch(
        `/meetings/${meetingId}/transcript/${id}`,
        patch
      );
      setItems((prev) => prev.map((s) => (s.id === id ? data.segment : s)));
    } catch {
      setItems(segments); // revert
      toast("Could not save change", "error");
    }
  };

  const saveEdit = async (id: string) => {
    const text = draft.trim();
    setEditingId(null);
    if (!text) return;
    await patchSegment(id, { text, edited: true });
    toast("Transcript updated", "success");
  };

  const renameSpeaker = async (from: string) => {
    const to = window.prompt(`Rename speaker "${from}" to:`, from)?.trim();
    if (!to || to === from) return;
    setItems((prev) =>
      prev.map((s) => (s.speakerName === from ? { ...s, speakerName: to } : s))
    );
    try {
      await api.post(`/meetings/${meetingId}/speakers/rename`, { from, to });
      toast(`Renamed “${from}” to “${to}”`, "success");
    } catch {
      setItems(segments);
      toast("Could not rename speaker", "error");
    }
  };

  const copySegment = (s: Seg) => {
    navigator.clipboard.writeText(`${s.speakerName} (${formatClock(s.startTime)}): ${s.text}`);
    toast("Segment copied", "success");
  };

  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm font-medium text-ink">No transcript yet</p>
        <p className="mt-1 text-sm text-muted">
          Transcript segments will appear here once the meeting is recorded or
          uploaded.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search + speaker chips */}
      <div className="border-b border-black/[0.06] px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcript…"
              className="w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-aurora-400"
            />
          </div>
          {hasClean && (
            <div className="inline-flex shrink-0 overflow-hidden rounded-xl border border-black/10 text-xs font-medium">
              <button
                onClick={() => setShowClean(true)}
                className={cn("px-2.5 py-2", showClean ? "bg-aurora-50 text-aurora-700" : "text-muted hover:text-ink")}
                title="Show cleaned, readable transcript"
              >
                Clean
              </button>
              <button
                onClick={() => setShowClean(false)}
                className={cn("px-2.5 py-2", !showClean ? "bg-aurora-50 text-aurora-700" : "text-muted hover:text-ink")}
                title="Show raw transcript as captured"
              >
                Raw
              </button>
            </div>
          )}
        </div>
        {speakers.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {speakers.map((sp) => (
              <button
                key={sp}
                onClick={() => !readOnly && renameSpeaker(sp)}
                disabled={readOnly}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] py-1 pl-1 pr-2.5 text-xs text-ink",
                  !readOnly && "hover:bg-aurora-50"
                )}
                title={readOnly ? sp : `Rename ${sp}`}
              >
                <SpeakerAvatar name={sp} className="h-5 w-5 text-[8px]" />
                {sp}
                {!readOnly && <UserCog className="h-3 w-3 text-muted" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No segments match “{query}”.
          </p>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group rounded-xl px-2 py-2.5 transition",
                s.highlighted ? "bg-amber-50" : "hover:bg-black/[0.02]"
              )}
            >
              <div className="flex gap-3">
                <SpeakerAvatar name={s.speakerName} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {s.speakerName}
                    </span>
                    <span className="text-xs text-muted">
                      {formatClock(s.startTime)}
                    </span>
                    {s.edited && <Badge tone="slate">edited</Badge>}
                    {s.isDecision && (
                      <Badge tone="green">
                        <CheckCircle2 className="h-3 w-3" /> Decision
                      </Badge>
                    )}
                    {s.isActionItem && (
                      <Badge tone="indigo">
                        <ListChecks className="h-3 w-3" /> Action
                      </Badge>
                    )}
                    {s.highlighted && (
                      <Badge tone="amber">
                        <Highlighter className="h-3 w-3" /> Highlight
                      </Badge>
                    )}

                    {/* Action toolbar */}
                    {!readOnly && editingId !== s.id && (
                      <div className="ml-auto flex items-center gap-0.5 transition lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                        <IconBtn
                          label="Edit text"
                          onClick={() => {
                            setEditingId(s.id);
                            setDraft(s.text);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          label="Highlight"
                          active={s.highlighted}
                          onClick={() =>
                            patchSegment(s.id, { highlighted: !s.highlighted })
                          }
                        >
                          <Highlighter className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          label="Mark as decision"
                          active={s.isDecision}
                          onClick={() =>
                            patchSegment(s.id, { isDecision: !s.isDecision })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          label="Mark as action item"
                          active={s.isActionItem}
                          onClick={() =>
                            patchSegment(s.id, { isActionItem: !s.isActionItem })
                          }
                        >
                          <ListChecks className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn label="Copy" onClick={() => copySegment(s)}>
                          <Copy className="h-3.5 w-3.5" />
                        </IconBtn>
                      </div>
                    )}
                  </div>

                  {editingId === s.id ? (
                    <div className="mt-1.5">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full rounded-lg border border-aurora-300 bg-white px-3 py-2 text-sm outline-none focus:border-aurora-500"
                      />
                      <div className="mt-1.5 flex gap-2">
                        <button
                          onClick={() => saveEdit(s.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-xs font-medium text-white"
                        >
                          <Check className="h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1 text-xs text-muted"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-sm leading-relaxed text-ink/80">
                      {showClean && s.cleanText && s.cleanText.trim() ? s.cleanText : s.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lg transition",
        active
          ? "bg-aurora-100 text-aurora-700"
          : "text-muted hover:bg-aurora-50 hover:text-aurora-700"
      )}
    >
      {children}
    </button>
  );
}
