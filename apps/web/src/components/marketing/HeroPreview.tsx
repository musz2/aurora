import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Sparkles,
  CheckCircle2,
  ListTodo,
} from "lucide-react";

const LINES = [
  { speaker: "Justin Carter", text: "Let's align on the Q3 launch scope." },
  { speaker: "Pat Reynolds", text: "Live transcription is stable — ship it." },
  { speaker: "Emily Brooks", text: "Pair it with AI summaries for value." },
  { speaker: "Rachel Morgan", text: "I'll own action-item extraction." },
];

export function HeroPreview() {
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible((v) => (v >= LINES.length ? 1 : v + 1));
    }, 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative mx-auto mt-4 grid max-w-5xl gap-5 px-2 sm:grid-cols-2 lg:grid-cols-3">
      {/* Live transcript card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass relative rounded-2xl p-5 text-left shadow-glass sm:col-span-2 lg:col-span-1 lg:row-span-2"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-aurora-600">
            Live transcript
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-red-500" />
            REC 12:04
          </span>
        </div>
        <div className="space-y-3">
          {LINES.slice(0, visible).map((l, i) => (
            <div key={i} className="transcript-line">
              <p className="text-[11px] font-semibold text-aurora-700">
                {l.speaker}
              </p>
              <p className="text-sm text-ink/80">{l.text}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* AI summary card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="glass rounded-2xl p-5 text-left shadow-glass"
      >
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violetAccent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-violetAccent">
            AI Summary
          </span>
        </div>
        <p className="text-sm text-ink/80">
          Team aligned on Q3 scope: live transcription, AI summaries, and
          cross-meeting search. Owners assigned.
        </p>
      </motion.div>

      {/* Action items card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
        className="glass rounded-2xl p-5 text-left shadow-glass"
      >
        <div className="mb-3 flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-cyanAccent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cyanAccent">
            Action Items
          </span>
        </div>
        <ul className="space-y-2 text-sm text-ink/80">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Share roadmap doc — Shaibaz
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Own extraction — Haseebuddin
          </li>
        </ul>
      </motion.div>

      {/* Search card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="glass rounded-2xl p-4 text-left shadow-glass sm:col-span-2"
      >
        <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-white/70 px-4 py-3">
          <Search className="h-4 w-4 text-muted" />
          <span className="text-sm text-muted">
            “What did the client say about pricing?”
          </span>
          <span className="ml-auto rounded-md bg-aurora-50 px-2 py-0.5 text-[11px] font-medium text-aurora-700">
            Ask Aurora
          </span>
        </div>
      </motion.div>
    </div>
  );
}
