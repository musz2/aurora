import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Lock, Unlock } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface FinalSegment {
  id: string;
  speakerName: string;
  text: string;
  startTime: number;
}

interface Group {
  speakerName: string;
  startTime: number;
  text: string;
}

/** Group consecutive same-speaker finals into clean paragraphs (deduped). */
function groupSegments(segments: FinalSegment[]): Group[] {
  const groups: Group[] = [];
  for (const s of segments) {
    const last = groups[groups.length - 1];
    if (last && last.speakerName === s.speakerName) {
      // Avoid duplicate fragments being appended twice.
      if (!last.text.endsWith(s.text)) last.text += " " + s.text;
    } else {
      groups.push({
        speakerName: s.speakerName,
        startTime: s.startTime,
        text: s.text,
      });
    }
  }
  return groups;
}

export function TranscriptPanel({
  segments,
  interim,
  emptyState,
}: {
  segments: FinalSegment[];
  interim?: { speakerName: string; text: string } | null;
  emptyState?: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [locked, setLocked] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const groups = useMemo(() => groupSegments(segments), [segments]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || locked) return;
    el.scrollTop = el.scrollHeight;
  }, [groups, interim, locked]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(bottom);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setLocked(false);
  };

  const hasContent = groups.length > 0 || interim;

  return (
    <div className="relative flex h-full flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 space-y-5 overflow-y-auto px-5 py-5"
      >
        {!hasContent ? (
          emptyState
        ) : (
          <>
            {groups.map((g, i) => (
              <div key={i} className="flex gap-3 transcript-line">
                <Avatar name={g.speakerName} className="h-8 w-8 text-[10px]" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {g.speakerName}
                    </span>
                    <span className="text-xs text-muted">
                      {formatClock(g.startTime)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink/80">
                    {g.text}
                  </p>
                </div>
              </div>
            ))}
            {interim && interim.text && (
              <div className="flex gap-3 opacity-60">
                <Avatar
                  name={interim.speakerName}
                  className="h-8 w-8 text-[10px]"
                />
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-ink">
                    {interim.speakerName}
                  </span>
                  <p className="mt-0.5 text-sm italic leading-relaxed text-muted">
                    {interim.text}
                    <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse-dot bg-aurora-500 align-middle" />
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Scroll controls */}
      {hasContent && (
        <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-2">
          {!atBottom && (
            <button
              onClick={jumpToLatest}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white shadow-glass"
            >
              <ArrowDown className="h-3.5 w-3.5" /> Latest
            </button>
          )}
          <button
            onClick={() => setLocked((l) => !l)}
            className={cn(
              "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm",
              locked
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-black/10 bg-white text-muted"
            )}
            title={locked ? "Auto-scroll paused" : "Auto-scroll on"}
          >
            {locked ? (
              <>
                <Lock className="h-3.5 w-3.5" /> Scroll locked
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5" /> Auto-scroll
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
