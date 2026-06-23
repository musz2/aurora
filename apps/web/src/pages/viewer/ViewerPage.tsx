import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Radio, CheckCircle2, StickyNote, AlertCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { StatusPill } from "@/components/ui/StatusPill";
import { Avatar, Spinner } from "@/components/ui/primitives";
import { TranscriptPanel } from "@/components/app/TranscriptPanel";

interface Session {
  id: string;
  title: string;
  status: string;
  live: boolean;
  ended: boolean;
  participants: string[];
  publishedNotes: string[];
  segments: { id: string; speakerName: string; text: string; startTime: number }[];
  summary: { overview: string; keyPoints: string[]; decisions: string[] } | null;
}

export function ViewerPage() {
  const { shareId } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "notfound">("loading");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await axios.get(`/api/sessions/${shareId}`);
        if (!alive) return;
        setSession(data.session);
        setStatus("ok");
      } catch {
        if (alive) setStatus("notfound");
      }
    };
    load();
    // Poll while live for near-real-time viewing.
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [shareId]);

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="flex items-center justify-between border-b border-black/[0.06] bg-white px-6 py-4">
        <Logo />
        {session && (
          <StatusPill tone={session.live ? "live" : session.ended ? "muted" : "processing"} pulse={session.live}>
            {session.live ? "Live now" : session.ended ? "Session ended" : "Processing"}
          </StatusPill>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {status === "loading" && (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        )}

        {status === "notfound" && (
          <div className="mx-auto max-w-md rounded-2xl border border-black/[0.06] bg-white p-10 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-4 font-display text-2xl text-ink">
              Session not available
            </h1>
            <p className="mt-2 text-sm text-muted">
              This session link is invalid, private, or no longer shared.
            </p>
            <Link
              to="/"
              className="mt-5 inline-block text-sm font-medium text-aurora-600"
            >
              ← Back to Aurora
            </Link>
          </div>
        )}

        {status === "ok" && session && (
          <div>
            <div className="mb-6">
              <h1 className="font-display text-3xl text-ink">{session.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {session.participants.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-xs text-ink shadow-sm"
                  >
                    <Avatar name={p} className="h-5 w-5 text-[9px]" />
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
                  <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
                    <span className="font-medium text-ink">Shared transcript</span>
                    {session.live && (
                      <StatusPill tone="live" pulse>
                        Live
                      </StatusPill>
                    )}
                  </div>
                  <TranscriptPanel
                    segments={session.segments}
                    emptyState={
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <Radio className="h-8 w-8 text-aurora-400" />
                        <p className="mt-3 text-sm text-muted">
                          {session.ended
                            ? "This session has ended."
                            : "Waiting for the host to start speaking…"}
                        </p>
                      </div>
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                {session.publishedNotes.length > 0 && (
                  <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
                    <div className="flex items-center gap-2">
                      <StickyNote className="h-4 w-4 text-aurora-600" />
                      <span className="text-sm font-medium text-ink">
                        Published notes
                      </span>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {session.publishedNotes.map((n, i) => (
                        <li key={i} className="text-sm text-ink/80">
                          • {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.summary && (
                  <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-ink">Summary</span>
                    </div>
                    <p className="mt-2 text-sm text-ink/80">
                      {session.summary.overview}
                    </p>
                  </div>
                )}

                {!session.summary && session.publishedNotes.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-muted">
                    The host hasn't published any notes yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
