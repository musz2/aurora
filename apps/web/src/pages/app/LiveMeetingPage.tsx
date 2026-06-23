import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Radio,
  Square,
  ShieldCheck,
  Loader2,
  Copy,
  Link2,
  Users,
  Wifi,
  WifiOff,
  AlertTriangle,
  PlayCircle,
  Bug,
} from "lucide-react";
import { SOCKET_EVENTS, type UsageSummary, type SessionMode } from "@aurora/shared";
import { api, apiError } from "@/lib/api";
import { AuroraSocket, type ConnState } from "@/lib/ws";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useConfig } from "@/lib/useConfig";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { MicSelector, MicLevelMeter } from "@/components/app/MicControls";
import { TranscriptPanel, type FinalSegment } from "@/components/app/TranscriptPanel";
import { AssistantPanel, type Suggestion } from "@/components/app/AssistantPanel";
import { UsageMeter } from "@/components/app/shared";
import { formatClock } from "@/lib/format";

type EngineState = "live" | "listening" | "processing" | "finalized" | "error" | "idle";

const ENGINE_LABEL: Record<EngineState, string> = {
  live: "Live",
  listening: "Listening…",
  processing: "Processing…",
  finalized: "Finalized",
  error: "STT error",
  idle: "Idle",
};

interface DebugInfo {
  packetsSent: number;
  packetsReceived: number;
  chunkSize: number;
  dgConnecting: boolean;
  dgConnected: boolean;
  dgEvents: number;
  dgReason: string;
  lastInterim: string;
  lastFinal: string;
}

const DEV = import.meta.env.DEV;

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c))
      return c;
  }
  return "";
}

export function LiveMeetingPage() {
  const navigate = useNavigate();
  const config = useConfig();
  const mic = useMicrophone();
  const { toast } = useToast();

  const [showConsent, setShowConsent] = useState(false);
  const [consented, setConsented] = useState(false);
  const [pendingMode, setPendingMode] = useState<SessionMode>("real");
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<SessionMode>("real");
  const [processing, setProcessing] = useState(false);
  const [segments, setSegments] = useState<FinalSegment[]>([]);
  const [interim, setInterim] = useState<{ speakerName: string; text: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [conn, setConn] = useState<ConnState>("closed");
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [sttError, setSttError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [title, setTitle] = useState("Live Session");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugInfo>({
    packetsSent: 0,
    packetsReceived: 0,
    chunkSize: 0,
    dgConnecting: false,
    dgConnected: false,
    dgEvents: 0,
    dgReason: "",
    lastInterim: "",
    lastFinal: "",
  });

  const socketRef = useRef<AuroraSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const meetingIdRef = useRef<string>("");
  const timerRef = useRef<number>();

  const { data: usage } = useQuery({
    queryKey: ["usage"],
    queryFn: async () =>
      (await api.get<{ usage: UsageSummary }>("/dashboard/usage")).data.usage,
  });

  const overLimit =
    usage && usage.limitMinutes !== -1 && usage.usedMinutes >= usage.limitMinutes;

  useEffect(() => () => cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    mic.stop();
    socketRef.current?.close();
  };

  const requestStart = (m: SessionMode) => {
    if (m === "real" && overLimit) {
      toast("Monthly transcription limit reached. Upgrade to keep recording.", "error");
      navigate("/app/billing");
      return;
    }
    setPendingMode(m);
    setShowConsent(true);
  };

  const beginRecording = async () => {
    const m = pendingMode;
    setShowConsent(false);
    setMode(m);
    setSegments([]);
    setSuggestions([]);
    setInterim(null);
    setSttError(null);
    setElapsed(0);
    setDebug({
      packetsSent: 0,
      packetsReceived: 0,
      chunkSize: 0,
      dgConnecting: false,
      dgConnected: false,
      dgEvents: 0,
      dgReason: "",
      lastInterim: "",
      lastFinal: "",
    });

    // Real sessions require the microphone. Demo mode does not.
    let stream: MediaStream | null = null;
    if (m === "real") {
      stream = await mic.start();
      if (!stream) {
        toast(mic.error ?? "Microphone access is required to record.", "error");
        return;
      }
    }

    // Create the session + a public share link.
    try {
      const { data } = await api.post("/meetings", { title, source: "LIVE" });
      meetingIdRef.current = data.meeting.id;
      const share = await api.post(`/meetings/${data.meeting.id}/share`, { shared: true });
      if (share.data.shareId)
        setShareLink(`${window.location.origin}/s/${share.data.shareId}`);
    } catch {
      meetingIdRef.current = "";
    }

    // Connect socket + subscribe.
    const socket = new AuroraSocket().onState(setConn).connect();
    socketRef.current = socket;

    socket.on(SOCKET_EVENTS.TRANSCRIPT_PARTIAL, (p) => {
      setInterim({ speakerName: p.speakerName, text: p.text });
      if (DEV) {
        // eslint-disable-next-line no-console
        console.log("[stt] interim:", p.text);
        setDebug((d) => ({ ...d, lastInterim: p.text }));
      }
    });
    socket.on(SOCKET_EVENTS.TRANSCRIPT_SEGMENT, (s) => {
      setInterim(null);
      setSegments((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
      if (DEV) {
        // eslint-disable-next-line no-console
        console.log("[stt] FINAL:", s.text);
        setDebug((d) => ({ ...d, lastFinal: s.text }));
      }
    });
    socket.on(SOCKET_EVENTS.TRANSCRIPT_ERROR, (e) => {
      setSttError(e.message);
      setEngineState("error");
      if (DEV) console.warn("[stt] error:", e.code, e.message);
    });
    socket.on(SOCKET_EVENTS.MEETING_STATUS, (s) => {
      if (s.state) setEngineState(s.state as EngineState);
    });
    socket.on(SOCKET_EVENTS.DG_STATUS, (s) => {
      if (DEV) {
        // eslint-disable-next-line no-console
        console.log("[deepgram] status:", s);
        setDebug((d) => ({
          ...d,
          dgConnecting: Boolean(s.connecting),
          dgConnected: Boolean(s.connected),
          dgEvents: s.events ?? d.dgEvents,
          dgReason: s.reason ?? d.dgReason,
        }));
      }
      // Surface an unexpected close reason to the host as an STT error.
      if (!s.connected && !s.connecting && s.reason) {
        setSttError((prev) => prev ?? `Deepgram ${s.reason}`);
      }
    });
    socket.on(SOCKET_EVENTS.AUDIO_ACK, (a) => {
      if (DEV) setDebug((d) => ({ ...d, packetsReceived: a.received }));
    });
    socket.on(SOCKET_EVENTS.AI_SUGGESTION, (s) =>
      setSuggestions((prev) => [
        { id: crypto.randomUUID(), question: s.question, suggestion: s.suggestion, configured: s.configured !== false },
        ...prev,
      ])
    );

    socket.send(SOCKET_EVENTS.MEETING_START, { meetingId: meetingIdRef.current, mode: m });

    // Stream real microphone audio as binary frames (real mode only).
    if (m === "real" && stream) {
      const mimeType = pickMimeType();
      try {
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            socket.sendBinary(e.data);
            setDebug((d) => ({
              ...d,
              packetsSent: d.packetsSent + 1,
              chunkSize: e.data.size,
            }));
            if (DEV && Math.random() < 0.1)
              // eslint-disable-next-line no-console
              console.log("[audio] chunk sent", e.data.size, "bytes", mimeType);
          }
        };
        recorder.start(150); // 150ms chunks for low-latency interim results
        if (DEV) console.info("[audio] MediaRecorder started", mimeType);
      } catch (err) {
        toast("Could not start audio recorder on this browser.", "error");
        if (DEV) console.error(err);
      }
    }

    setRecording(true);
    setEngineState(m === "real" ? "listening" : "live");
    timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive")
      recorderRef.current.stop();
    socketRef.current?.send(SOCKET_EVENTS.MEETING_STOP, { meetingId: meetingIdRef.current });
    mic.stop();
    setRecording(false);
    setEngineState("finalized");
    setProcessing(true);

    const id = meetingIdRef.current;
    if (id) {
      try {
        await api.post(`/meetings/${id}/stop`);
        await api.post(`/meetings/${id}/summarize`);
        socketRef.current?.close();
        navigate(`/app/meetings/${id}`);
        return;
      } catch (err) {
        toast(apiError(err, "Could not finalize session"), "error");
      }
    }
    setProcessing(false);
    socketRef.current?.close();
  };

  const askLive = (q: string) =>
    socketRef.current?.send(SOCKET_EVENTS.AI_ASK_LIVE, { question: q });

  const publishToTranscript = (text: string) => {
    const seg: FinalSegment = {
      id: crypto.randomUUID(),
      speakerName: "Host (published)",
      text,
      startTime: elapsed,
    };
    setSegments((prev) => [...prev, seg]);
    if (meetingIdRef.current)
      api
        .post(`/meetings/${meetingIdRef.current}/transcript`, {
          speakerName: seg.speakerName,
          text,
          startTime: elapsed,
          endTime: elapsed,
        })
        .catch(() => {});
    toast("Published to the shared transcript", "success");
  };

  const addNote = (text: string) => {
    if (!meetingIdRef.current) return;
    api
      .post(`/meetings/${meetingIdRef.current}/notes`, { note: text })
      .then(() => toast("Added to shared notes", "success"))
      .catch(() => toast("Could not add note", "error"));
  };

  const copyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    toast("Share link copied", "success");
  };

  const connPill = () => {
    if (conn === "open")
      return <StatusPill tone="success" pulse>Connected · low latency</StatusPill>;
    if (conn === "reconnecting")
      return (
        <StatusPill tone="processing" pulse>
          <WifiOff className="h-3 w-3" /> Reconnecting…
        </StatusPill>
      );
    if (conn === "connecting")
      return <StatusPill tone="processing" pulse>Connecting…</StatusPill>;
    return (
      <StatusPill tone="idle">
        <Wifi className="h-3 w-3" /> Idle
      </StatusPill>
    );
  };

  const emptyTranscript = () => {
    if (sttError)
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <AlertTriangle className="h-9 w-9 text-red-500" />
          <p className="mt-3 font-medium text-ink">Live transcription unavailable</p>
          <p className="mt-1 max-w-sm text-sm text-muted">{sttError}</p>
        </div>
      );
    if (recording)
      return (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <span className="flex items-center gap-2 text-aurora-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Listening… speak to begin</span>
          </span>
          <p className="mt-2 max-w-xs text-sm text-muted">
            {mode === "real"
              ? "Your microphone is live. Say a sentence and it will appear here within a couple of seconds."
              : "Playing sample transcript (demo mode)."}
          </p>
        </div>
      );
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <Radio className="h-9 w-9 text-aurora-400" />
        <p className="mt-3 font-medium text-ink">Ready when you are</p>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Start a real session to transcribe your microphone live, or play a
          sample to preview the experience.
        </p>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          {recording ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent font-display text-3xl text-ink outline-none"
            />
          ) : (
            <h1 className="font-display text-3xl text-ink">Host Console</h1>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {recording && (
              <StatusPill tone="live" pulse>
                REC {formatClock(elapsed)}
              </StatusPill>
            )}
            {recording && (
              <StatusPill tone={engineState === "error" ? "error" : engineState === "processing" ? "processing" : "success"}>
                {ENGINE_LABEL[engineState]}
              </StatusPill>
            )}
            {recording && connPill()}
            {recording && mode === "demo" && (
              <StatusPill tone="muted">Demo sample</StatusPill>
            )}
            <StatusPill tone="muted">
              {config.services.liveTranscription
                ? "Deepgram STT"
                : "STT not configured"}
            </StatusPill>
          </div>
        </div>

        <div className="flex gap-2">
          {!recording ? (
            <>
              <Button variant="secondary" size="lg" onClick={() => requestStart("real")} disabled={processing}>
                <Radio className="h-5 w-5" /> Start session
              </Button>
              <Button variant="outline" size="lg" onClick={() => requestStart("demo")} disabled={processing}>
                <PlayCircle className="h-5 w-5" /> Play demo
              </Button>
            </>
          ) : (
            <Button variant="danger" size="lg" onClick={stopRecording}>
              <Square className="h-4 w-4" /> End & summarize
            </Button>
          )}
        </div>
      </div>

      {/* Honest engine banners */}
      {!config.services.liveTranscription && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">Live STT not configured.</span> Real
            sessions need <code className="rounded bg-amber-100 px-1">DEEPGRAM_API_KEY</code>{" "}
            on the server. A real session will start empty and show an error
            instead of fake transcript. Use <span className="font-medium">Play demo</span>{" "}
            to preview with sample data (clearly labeled, never mixed into a real
            recording).
          </p>
        </div>
      )}

      {processing && (
        <Card className="mb-6 flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-aurora-600" />
          <span className="text-sm text-ink">
            Processing session — generating summary and action items…
          </span>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-ink">Consent</span>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Consent-first. The recording indicator stays visible and is never
              hidden. Ensure all participants are informed.
            </p>
            <MicSelector mic={mic} />
            <MicLevelMeter mic={mic} />
            {mic.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {mic.error}
              </p>
            )}
          </Card>

          {usage && (
            <Card className="p-4">
              <UsageMeter used={usage.usedMinutes} limit={usage.limitMinutes} />
              {overLimit && (
                <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => navigate("/app/billing")}>
                  Upgrade to continue
                </Button>
              )}
            </Card>
          )}

          {shareLink && (
            <Card className="p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <Link2 className="h-4 w-4 text-aurora-600" /> Share session
              </div>
              <p className="mt-1 text-xs text-muted">
                Viewers see the shared transcript and published notes only.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={shareLink}
                  className="flex-1 truncate rounded-lg border border-black/10 bg-black/[0.02] px-2 py-1.5 text-xs text-muted"
                />
                <button onClick={copyLink} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-white">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <Users className="h-3.5 w-3.5" /> Live viewers join via the link
              </div>
            </Card>
          )}

          {DEV && (
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                <Bug className="h-4 w-4 text-violetAccent" /> Debug (dev only)
              </div>
              <dl className="space-y-1 text-xs text-muted">
                <Row k="Mic" v={mic.activeLabel ? "active" : "inactive"} />
                <Row k="Device" v={mic.activeLabel ?? "—"} />
                <Row k="deviceId" v={(mic.deviceId ?? "—").slice(0, 14)} />
                <Row k="Permission" v={mic.permission} />
                <Row k="Mic level" v={mic.level.toFixed(3)} />
                <Row k="Chunk size" v={`${debug.chunkSize} B`} />
                <Row k="Packets sent" v={String(debug.packetsSent)} />
                <Row k="Packets recv" v={String(debug.packetsReceived)} />
                <Row
                  k="Deepgram"
                  v={
                    debug.dgConnected
                      ? "connected"
                      : debug.dgConnecting
                        ? "connecting…"
                        : "disconnected"
                  }
                />
                <Row k="DG events" v={String(debug.dgEvents)} />
                <Row k="DG reason" v={debug.dgReason || "—"} />
                <Row k="Last interim" v={debug.lastInterim.slice(0, 28) || "—"} />
                <Row k="Last final" v={debug.lastFinal.slice(0, 28) || "—"} />
              </dl>
            </Card>
          )}
        </div>

        {/* CENTER */}
        <div className="lg:col-span-6">
          <Card className="flex h-[640px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
              <span className="font-medium text-ink">Live transcript</span>
              {recording && (
                <StatusPill tone={engineState === "error" ? "error" : engineState === "processing" ? "processing" : "success"} pulse>
                  {ENGINE_LABEL[engineState]}
                </StatusPill>
              )}
            </div>
            <TranscriptPanel segments={segments} interim={interim} emptyState={emptyTranscript()} />
          </Card>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-3">
          <Card className="h-[640px] overflow-hidden">
            <AssistantPanel
              aiConfigured={config.services.ai}
              recording={recording}
              suggestions={suggestions}
              onAsk={askLive}
              onPublish={publishToTranscript}
              onAddNote={addNote}
            />
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
                {pendingMode === "demo" ? "Play demo session" : "Recording consent"}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {pendingMode === "demo"
                ? "This is a clearly-labeled demo using sample transcript data — no microphone is recorded. It will not be mixed into a real recording."
                : "This session may be recorded and transcribed. Make sure all required participants have been informed and consent has been obtained according to applicable laws and company policy."}
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 p-3">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-aurora-600"
              />
              <span className="text-sm text-ink">
                {pendingMode === "demo"
                  ? "I understand this is sample demo data."
                  : "I confirm I have permission to record/transcribe this session."}
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
              <Button variant="secondary" disabled={!consented} onClick={beginRecording}>
                {pendingMode === "demo" ? "Play demo" : "Start session"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt>{k}</dt>
      <dd className="font-mono text-ink/70">{v}</dd>
    </div>
  );
}
