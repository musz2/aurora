import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Radio,
  Square,
  Mic,
  MicOff,
  Sparkles,
  Send,
  ShieldCheck,
  Wifi,
  Loader2,
  ArrowUpToLine,
} from "lucide-react";
import { SOCKET_EVENTS } from "@aurora/shared";
import { api } from "@/lib/api";
import { AuroraSocket } from "@/lib/ws";
import { Card, Avatar, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Segment {
  id: string;
  speakerName: string;
  text: string;
  startTime: number;
}

interface Suggestion {
  question: string;
  suggestion: string;
}

export function LiveMeetingPage() {
  const navigate = useNavigate();
  const [showConsent, setShowConsent] = useState(false);
  const [consented, setConsented] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [partial, setPartial] = useState<{ speaker: string; text: string } | null>(
    null
  );
  const [elapsed, setElapsed] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [connected, setConnected] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ask, setAsk] = useState("");
  const [title, setTitle] = useState("Live Meeting");

  const socketRef = useRef<AuroraSocket | null>(null);
  const meetingIdRef = useRef<string>("");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number>();
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, partial]);

  useEffect(() => {
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    socketRef.current?.close();
  };

  const beginRecording = async () => {
    setShowConsent(false);
    setProcessing(false);
    setSegments([]);
    setSuggestions([]);
    setElapsed(0);

    // 1. Create the meeting record.
    try {
      const { data } = await api.post("/meetings", {
        title,
        source: "LIVE",
      });
      meetingIdRef.current = data.meeting.id;
    } catch {
      meetingIdRef.current = "";
    }

    // 2. Request the microphone (drives the visible mic indicator).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.start(1000);
      setMicOn(true);
    } catch {
      setMicOn(false);
    }

    // 3. Connect the socket and start streaming transcript.
    const socket = new AuroraSocket().connect();
    socketRef.current = socket;
    setConnected(true);

    socket.on(SOCKET_EVENTS.TRANSCRIPT_PARTIAL, (p) =>
      setPartial({ speaker: p.speakerName, text: p.text })
    );
    socket.on(SOCKET_EVENTS.TRANSCRIPT_SEGMENT, (s) => {
      setPartial(null);
      setSegments((prev) => [...prev, s]);
    });
    socket.on(SOCKET_EVENTS.AI_SUGGESTION, (s: Suggestion) =>
      setSuggestions((prev) => [s, ...prev])
    );
    socket.on(SOCKET_EVENTS.MEETING_STATUS, () => {});

    socket.send(SOCKET_EVENTS.MEETING_START, {
      meetingId: meetingIdRef.current,
    });

    setRecording(true);
    timerRef.current = window.setInterval(
      () => setElapsed((e) => e + 1),
      1000
    );
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    socketRef.current?.send(SOCKET_EVENTS.MEETING_STOP, {
      meetingId: meetingIdRef.current,
    });
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setMicOn(false);
    setRecording(false);
    setProcessing(true);

    // Finalize: stop + summarize on the server.
    const id = meetingIdRef.current;
    if (id) {
      try {
        await api.post(`/meetings/${id}/stop`);
        await api.post(`/meetings/${id}/summarize`);
        socketRef.current?.close();
        navigate(`/app/meetings/${id}`);
        return;
      } catch {
        /* fall through */
      }
    }
    setProcessing(false);
    socketRef.current?.close();
  };

  const askAurora = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask.trim()) return;
    socketRef.current?.send(SOCKET_EVENTS.AI_ASK_LIVE, { question: ask.trim() });
    setAsk("");
  };

  const publishToTranscript = (text: string) => {
    const seg: Segment = {
      id: crypto.randomUUID(),
      speakerName: "You (Aurora-assisted)",
      text,
      startTime: elapsed,
    };
    setSegments((prev) => [...prev, seg]);
    if (meetingIdRef.current) {
      api
        .post(`/meetings/${meetingIdRef.current}/transcript`, {
          speakerName: seg.speakerName,
          text,
          startTime: elapsed,
          endTime: elapsed,
        })
        .catch(() => {});
    }
  };

  return (
    <div>
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          {recording ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent font-display text-3xl text-ink outline-none"
            />
          ) : (
            <h1 className="font-display text-3xl text-ink">Live Meeting Room</h1>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {recording && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-red-500" />
                Recording • {formatClock(elapsed)}
              </span>
            )}
            <Badge tone={connected ? "green" : "slate"}>
              <Wifi className="h-3 w-3" />
              {connected ? "Connected" : "Idle"}
            </Badge>
            <Badge tone={micOn ? "green" : "slate"}>
              {micOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
              {micOn ? "Mic on" : "Mic off"}
            </Badge>
          </div>
        </div>

        <div>
          {!recording ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setShowConsent(true)}
              disabled={processing}
            >
              <Radio className="h-5 w-5" /> Start recording
            </Button>
          ) : (
            <Button variant="danger" size="lg" onClick={stopRecording}>
              <Square className="h-4 w-4" /> Stop & summarize
            </Button>
          )}
        </div>
      </div>

      {processing && (
        <Card className="mb-6 flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-aurora-600" />
          <span className="text-sm text-ink">
            Processing recording — generating summary and action items…
          </span>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live transcript */}
        <div className="lg:col-span-2">
          <Card className="flex h-[640px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
              <span className="font-medium text-ink">Live transcript</span>
              {recording && (
                <span className="text-xs text-muted">
                  Streaming{micOn ? " · simulated engine" : ""}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {!recording && segments.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Radio className="h-9 w-9 text-aurora-400" />
                  <p className="mt-3 font-medium text-ink">
                    Ready when you are
                  </p>
                  <p className="mt-1 max-w-xs text-sm text-muted">
                    Start recording to see live, speaker-labeled transcription
                    stream in real time.
                  </p>
                </div>
              ) : (
                <>
                  {segments.map((s) => (
                    <div key={s.id} className="flex gap-3 transcript-line">
                      <Avatar
                        name={s.speakerName}
                        className="h-8 w-8 text-[10px]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink">
                            {s.speakerName}
                          </span>
                          <span className="text-xs text-muted">
                            {formatClock(s.startTime)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm leading-relaxed text-ink/80">
                          {s.text}
                        </p>
                      </div>
                    </div>
                  ))}
                  {partial && (
                    <div className="flex gap-3 opacity-60">
                      <Avatar
                        name={partial.speaker}
                        className="h-8 w-8 text-[10px]"
                      />
                      <div>
                        <span className="text-sm font-semibold text-ink">
                          {partial.speaker}
                        </span>
                        <p className="mt-0.5 text-sm italic text-muted">
                          {partial.text}…
                        </p>
                      </div>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Right: AI assistant + privacy */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-ink">
                Consent & recording status
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Aurora is consent-first. The recording indicator is always visible
              and never hidden. Ensure all participants have been informed.
            </p>
          </Card>

          <Card className="flex h-[460px] flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-3">
              <Sparkles className="h-4 w-4 text-violetAccent" />
              <span className="text-sm font-medium text-ink">
                Private AI assistant
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted">
                  Ask Aurora privately for a suggested answer. Only you can see
                  this — publish to the transcript when you're ready.
                </p>
              ) : (
                suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-black/[0.06] bg-aurora-50/50 p-3"
                  >
                    <p className="text-xs font-medium text-aurora-700">
                      “{s.question}”
                    </p>
                    <p className="mt-1.5 text-sm text-ink/80">{s.suggestion}</p>
                    <button
                      onClick={() => publishToTranscript(s.suggestion)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-aurora-600 hover:underline"
                    >
                      <ArrowUpToLine className="h-3 w-3" /> Publish to transcript
                    </button>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={askAurora}
              className={cn(
                "flex items-center gap-2 border-t border-black/[0.06] p-3",
                !recording && "opacity-50"
              )}
            >
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                disabled={!recording}
                placeholder="Ask Aurora privately…"
                className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-aurora-400"
              />
              <button
                type="submit"
                disabled={!recording}
                className="grid h-9 w-9 place-items-center rounded-xl bg-violetAccent text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </Card>
        </div>
      </div>

      {/* Consent modal */}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-red-500" />
              <h2 className="font-display text-2xl text-ink">
                Recording consent
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              This meeting may be recorded and transcribed. Make sure all
              required participants have been informed and consent has been
              obtained according to applicable laws and company policy.
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 p-3">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-aurora-600"
              />
              <span className="text-sm text-ink">
                I confirm I have permission to record/transcribe this meeting.
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowConsent(false);
                  setConsented(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                disabled={!consented}
                onClick={beginRecording}
              >
                Start recording
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
