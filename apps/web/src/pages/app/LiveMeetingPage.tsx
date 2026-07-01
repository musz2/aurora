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
  Pause,
  Play,
  Bug,
  Smartphone,
  X,
} from "lucide-react";
import QRCode from "qrcode";
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
import {
  AssistantPanel,
  type AssistantMode,
  type PrivateNote,
  type Suggestion,
} from "@/components/app/AssistantPanel";
import {
  FinalizationReview,
  type FinalizationMeta,
} from "@/components/app/FinalizationReview";
import type { MeetingDto } from "@aurora/shared";
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
const log = (...a: unknown[]) => { if (DEV) console.info("[RECORDER]", ...a); };

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      log("using MIME type:", c);
      return c;
    }
  }
  log("no supported MIME type, using browser default");
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
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<SessionMode>("real");
  const [processing, setProcessing] = useState(false);
  const [segments, setSegments] = useState<FinalSegment[]>([]);
  const [interim, setInterim] = useState<{ speakerName: string; text: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [conn, setConn] = useState<ConnState>("closed");
  const [engineState, setEngineState] = useState<EngineState>("idle");
  const [sttError, setSttError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("General Meeting");
  const [generating, setGenerating] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [privateNotes, setPrivateNotes] = useState<PrivateNote[]>([]);
  const [sharedNotes, setSharedNotes] = useState<string[]>([]);
  const [title, setTitle] = useState("Live Session");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMeeting, setReviewMeeting] = useState<MeetingDto | null>(null);
  const [reviewMeta, setReviewMeta] = useState<FinalizationMeta | null>(null);
  const [companion, setCompanion] = useState<{
    url: string;
    qr: string;
    expiresAt: string;
  } | null>(null);
  const [companionBusy, setCompanionBusy] = useState(false);
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
  const noAudioTimerRef = useRef<number>();
  const packetsSentRef = useRef(0);

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
    if (noAudioTimerRef.current) clearTimeout(noAudioTimerRef.current);
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
    setPaused(false);
    setSegments([]);
    setSuggestions([]);
    setPrivateNotes([]);
    setSharedNotes([]);
    setShareLink(null);
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

    // Create the private session. Sharing is explicit and opt-in.
    try {
      const { data } = await api.post("/meetings", { title, source: "LIVE" });
      meetingIdRef.current = data.meeting.id;
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
        const msg =
          s.reason === "closed (code 1000)"
            ? "No audio received. Check your microphone and try again."
            : `Deepgram ${s.reason}`;
        setSttError((prev) => prev ?? msg);
      }
    });
    socket.on(SOCKET_EVENTS.AUDIO_ACK, (a) => {
      if (a.received > 0 && noAudioTimerRef.current) {
        clearTimeout(noAudioTimerRef.current);
        noAudioTimerRef.current = undefined;
      }
      if (DEV) setDebug((d) => ({ ...d, packetsReceived: a.received }));
    });
    socket.on(SOCKET_EVENTS.AI_SUGGESTION, (s) =>
      setSuggestions((prev) => [
        {
          id: crypto.randomUUID(),
          question: s.question,
          suggestion: s.suggestion,
          configured: s.configured !== false,
          mode: s.mode,
          confidence: s.confidence ?? s.structured?.confidence,
        },
        ...prev,
      ])
    );

    // Wait for socket to be open before sending MEETING_START or starting
    // the recorder, so that every message reaches the server in order with
    // no risk of dropping the first audio chunk.
    await socket.waitForOpen();
    console.info("[WS CLIENT] open");

    // Attach the AUDIO_READY listener BEFORE sending MEETING_START so there is no
    // race where the server's AUDIO_READY arrives before we are listening.
    const audioReadyPromise = new Promise<void>((resolve) => {
      const unsub = socket.on(SOCKET_EVENTS.AUDIO_READY, () => {
        console.info("[WS CLIENT] server ready for audio");
        unsub();
        resolve();
      });
    });
    console.info("[WS CLIENT] audio ready listener attached");

    socket.send(SOCKET_EVENTS.MEETING_START, {
      meetingId: meetingIdRef.current,
      mode: m,
      assistantMode,
    });
    console.info("[WS CLIENT] MEETING_START sent");

    // Wait for AUDIO_READY with a 10s timeout. If the server never responds,
    // surface an error instead of silently hanging.
    console.info("[WS CLIENT] waiting for audio ready");
    const audioReady = await Promise.race([
      audioReadyPromise.then(() => true),
      new Promise<boolean>((resolve) =>
        setTimeout(() => {
          console.warn("[WS CLIENT] audio ready timeout");
          resolve(false);
        }, 10000)
      ),
    ]);

    if (!audioReady) {
      console.warn("[WS CLIENT] audio ready timeout — aborting recorder start");
      setSttError((prev) => prev ?? "Server did not confirm audio readiness. Check your connection and try again.");
      return;
    }

    // Stream real microphone audio as binary frames (real mode only).
    if (m === "real" && stream) {
      const mimeType = pickMimeType();
      try {
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        recorder.onstart = () => {
          log("started", mimeType || "browser default", "@", stream.id);
        };
        recorder.onerror = () => {
          console.warn("[RECORDER] error", recorder.state);
        };
        recorder.ondataavailable = (e) => {
          if (!e.data || e.data.size === 0) return;
          socket.sendBinary(e.data);
          packetsSentRef.current += 1;
          setDebug((d) => ({
            ...d,
            packetsSent: d.packetsSent + 1,
            chunkSize: e.data.size,
          }));
          if (DEV && Math.random() < 0.1)
            console.info("[AUDIO] chunk sent", e.data.size, "bytes", mimeType || "browser default");
        };
        recorder.start(100); // 100ms chunks for low-latency interim results
        log("MediaRecorder started", mimeType || "browser default");

        // Recorder start timeout: if no data within 5s, surface an error.
        setTimeout(() => {
          if (recorderRef.current?.state !== "recording") return;
          if (packetsSentRef.current === 0) {
            console.warn("[RECORDER] started but no dataavailable after 5s");
            setSttError((prev) => prev ?? "Microphone opened but no audio data received. Check your mic connection and try again.");
          }
        }, 5000);
      } catch (err) {
        toast("Could not start audio recorder on this browser.", "error");
        if (DEV) console.error(err);
      }
    }

    packetsSentRef.current = 0;
    setRecording(true);
    setEngineState(m === "real" ? "listening" : "live");
    timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    // No-audio detection: if the server never acknowledges any packets within 8s,
    // show a hint. AUDIO_ACK from the server clears this timer.
    if (m === "real") {
      if (noAudioTimerRef.current) clearTimeout(noAudioTimerRef.current);
      noAudioTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state !== "recording") return;
        if (packetsSentRef.current === 0) {
          setSttError((prev) => prev ?? "No audio received from your microphone. Check your mic permissions and try again.");
        } else {
          setSttError((prev) => prev ?? "Audio sent but server is not acknowledging it. The connection may have been lost.");
        }
      }, 8000);
    }
  };

  /** Pause/resume the live capture without ending the session. */
  const togglePause = () => {
    const socket = socketRef.current;
    if (!socket || !recording) return;
    const id = meetingIdRef.current;
    if (!paused) {
      socket.send(SOCKET_EVENTS.MEETING_PAUSE, { meetingId: id });
      if (recorderRef.current?.state === "recording") recorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setPaused(true);
      setEngineState("idle");
      if (id) api.post(`/meetings/${id}/pause`).catch(() => {});
      toast("Recording paused", "success");
    } else {
      socket.send(SOCKET_EVENTS.MEETING_RESUME, { meetingId: id });
      if (recorderRef.current?.state === "paused") recorderRef.current.resume();
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
      setPaused(false);
      setEngineState(mode === "real" ? "listening" : "live");
      if (id) api.post(`/meetings/${id}/resume`).catch(() => {});
      toast("Recording resumed", "success");
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (noAudioTimerRef.current) clearTimeout(noAudioTimerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive")
      recorderRef.current.stop();
    socketRef.current?.send(SOCKET_EVENTS.MEETING_STOP, { meetingId: meetingIdRef.current });
    mic.stop();
    setRecording(false);
    setPaused(false);
    setEngineState("finalized");
    setProcessing(true);

    socketRef.current?.close();

    const id = meetingIdRef.current;
    if (!id) {
      setProcessing(false);
      return;
    }
    // Open the finalization review and run finalize in the background.
    setReviewOpen(true);
    await runFinalize(id);
    setProcessing(false);
  };

  /** Generate (or regenerate) the finalization output for the review screen. */
  const runFinalize = async (id: string) => {
    setProcessing(true);
    try {
      await api.post(`/meetings/${id}/stop`).catch(() => {});
      // /finalize generates summary/action items/speaker breakdown + audit trail.
      const { data } = await api.post(`/meetings/${id}/finalize`);
      setReviewMeeting(data.meeting as MeetingDto);
      setReviewMeta(data.finalization as FinalizationMeta);
    } catch (err) {
      toast(apiError(err, "Could not finalize session"), "error");
    } finally {
      setProcessing(false);
    }
  };

  const discardMeeting = async () => {
    const id = meetingIdRef.current;
    setReviewOpen(false);
    if (id) {
      await api.delete(`/meetings/${id}`).catch(() => {});
      toast("Meeting discarded", "info");
    }
    setReviewMeeting(null);
    setReviewMeta(null);
  };

  const finishReview = () => {
    const id = meetingIdRef.current;
    setReviewOpen(false);
    if (id) navigate(`/app/meetings/${id}`);
  };

  /** Same-page Private Copilot: generate a private draft via REST. */
  const runAssist = async (opts: { actionType?: string; customPrompt?: string }) => {
    const id = meetingIdRef.current;
    if (!id) {
      toast("Start a session first.", "error");
      return;
    }
    setGenerating(true);
    setAssistError(null);
    try {
      const { data } = await api.post(`/meetings/${id}/assist`, {
        mode: assistantMode,
        actionType: opts.actionType,
        customPrompt: opts.customPrompt,
      });
      const s = data.suggestion;
      const text = [
        `Answer: ${s.answer}`,
        `Talking points:\n${(s.talkingPoints ?? [])
          .map((p: string) => `  • ${p}`)
          .join("\n")}`,
        `Follow-up: ${s.followUpQuestion}`,
        `Risk: ${s.risk}`,
        `Next step: ${s.nextStep}`,
      ].join("\n");
      setSuggestions((prev) => [
        {
          id: crypto.randomUUID(),
          question: s.question,
          suggestion: text,
          configured: data.configured !== false,
          mode: s.mode,
          confidence: s.confidence,
        },
        ...prev,
      ]);
    } catch (err) {
      setAssistError(apiError(err, "Could not generate a suggestion"));
    } finally {
      setGenerating(false);
    }
  };

  /** Explicitly publish a reviewed draft to the shared session (instant). */
  const shareAnswer = async (text: string) => {
    const id = meetingIdRef.current;
    if (!id) return;
    try {
      await api.post(`/meetings/${id}/publish-answer`, { text });
      setSharedNotes((prev) => [...prev, text]);
      toast("Shared to session", "success");
    } catch (err) {
      toast(apiError(err, "Could not share to session"), "error");
    }
  };

  const savePrivateNote = (text: string) => {
    if (!meetingIdRef.current) {
      setPrivateNotes((prev) => [{ id: crypto.randomUUID(), text }, ...prev]);
      return;
    }
    api
      .post(`/meetings/${meetingIdRef.current}/private-notes`, { text })
      .then((res) => {
        const note = res.data.note;
        setPrivateNotes((prev) => [
          { id: note.id, text: note.suggestion, createdAt: note.createdAt },
          ...prev,
        ]);
        toast("Saved private note", "success");
      })
      .catch(() => toast("Could not save private note", "error"));
  };

  const createFollowUpTask = (text: string) => {
    if (!meetingIdRef.current) return;
    api
      .post(`/meetings/${meetingIdRef.current}/action-items`, {
        task: text,
        sourceText: "Created from private assistant suggestion",
      })
      .then(() => toast("Converted to follow-up task", "success"))
      .catch(() => toast("Could not create task", "error"));
  };

  const copyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    toast("Share link copied", "success");
  };

  const createShareLink = async () => {
    if (!meetingIdRef.current) {
      toast("Start a session before sharing.", "error");
      return;
    }
    setSharing(true);
    try {
      const { data } = await api.post(`/meetings/${meetingIdRef.current}/share`, {
        shared: true,
      });
      if (data.shareId) {
        setShareLink(`${window.location.origin}/s/${data.shareId}`);
        toast("Share link created", "success");
      }
    } catch (err) {
      toast(apiError(err, "Could not create share link"), "error");
    } finally {
      setSharing(false);
    }
  };

  const openCompanion = async () => {
    if (!meetingIdRef.current) {
      toast("Start a session before opening Companion Mode.", "error");
      return;
    }
    setCompanionBusy(true);
    try {
      const { data } = await api.post("/companion/pair", {
        meetingId: meetingIdRef.current,
      });
      const url = `${window.location.origin}/companion/${data.pairingId}#t=${data.token}`;
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
      setCompanion({ url, qr, expiresAt: data.expiresAt });
    } catch (err) {
      toast(apiError(err, "Could not open Companion Mode"), "error");
    } finally {
      setCompanionBusy(false);
    }
  };

  const revokeCompanion = async () => {
    if (!meetingIdRef.current) return;
    try {
      await api.post("/companion/revoke", { meetingId: meetingIdRef.current });
      setCompanion(null);
      toast("Companion links revoked.", "success");
    } catch (err) {
      toast(apiError(err, "Could not revoke companion links"), "error");
    }
  };

  const revokeShareLink = async () => {
    if (!meetingIdRef.current) return;
    setSharing(true);
    try {
      await api.post(`/meetings/${meetingIdRef.current}/share`, { shared: false });
      setShareLink(null);
      toast("Share link revoked", "success");
    } catch (err) {
      toast(apiError(err, "Could not revoke share link"), "error");
    } finally {
      setSharing(false);
    }
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
    if (sttError) {
      const isMicIssue = sttError.toLowerCase().includes("microphone") || sttError.toLowerCase().includes("mic");
      const isConnIssue = sttError.toLowerCase().includes("server") || sttError.toLowerCase().includes("connection");
      const isDgIssue = sttError.toLowerCase().includes("deepgram");
      const isPermissionIssue = sttError.toLowerCase().includes("permission");
      const isNoAudioIssue = sttError.toLowerCase().includes("no audio");
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <AlertTriangle className={`h-9 w-9 ${isPermissionIssue ? "text-amber-500" : isMicIssue ? "text-orange-500" : isConnIssue ? "text-red-500" : "text-red-500"}`} />
          <p className="mt-3 font-medium text-ink">Live transcription unavailable</p>
          <p className="mt-1 max-w-sm text-sm text-muted">{sttError}</p>
          {(isMicIssue || isNoAudioIssue) && (
            <button
              onClick={() => { mic.stop(); navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {}).catch(() => {}); }}
              className="mt-3 text-xs font-medium text-aurora-600 hover:text-aurora-700"
            >
              Re-check microphone
            </button>
          )}
        </div>
      );
    }
    if (recording)
      return (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <span className="flex items-center gap-2 text-aurora-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Listening… speak to begin</span>
          </span>
          {mic.level > 0.05 && (
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Mic active
            </span>
          )}
          {mic.silent && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
              No sound detected from your mic. Try speaking louder.
            </span>
          )}
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
              <StatusPill tone={paused ? "muted" : "live"} pulse={!paused}>
                {paused ? "PAUSED" : "REC"} {formatClock(elapsed)}
              </StatusPill>
            )}
            {recording && !paused && (
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
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={togglePause}
                aria-pressed={paused}
              >
                {paused ? (
                  <>
                    <Play className="h-4 w-4" /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" /> Pause
                  </>
                )}
              </Button>
              <Button variant="danger" size="lg" onClick={stopRecording}>
                <Square className="h-4 w-4" /> End & summarize
              </Button>
            </>
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

          {recording && (
            <Card className="p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <Link2 className="h-4 w-4 text-aurora-600" /> Share session
              </div>
              <p className="mt-1 text-xs text-muted">
              Private by default. Viewers see only the shared transcript and published notes.
              </p>
              {shareLink ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      readOnly
                      value={shareLink}
                      className="flex-1 truncate rounded-lg border border-black/10 bg-black/[0.02] px-2 py-1.5 text-xs text-muted"
                    />
                    <button
                      onClick={copyLink}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-white"
                      aria-label="Copy share link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                    <Users className="h-3.5 w-3.5" /> Live viewers join via the link
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={revokeShareLink}
                    disabled={sharing}
                  >
                    {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Revoke link
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={createShareLink}
                  disabled={sharing}
                >
                  {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  Create share link
                </Button>
              )}
            </Card>
          )}

          {recording && (
            <div className="rounded-xl border border-dashed border-black/10 p-3">
              <p className="text-xs text-muted">
                The Private Copilot on the right works right here — no second device
                needed. Optionally, mirror it to your phone.
              </p>
              <button
                onClick={openCompanion}
                disabled={companionBusy}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-aurora-600 hover:underline disabled:opacity-50"
              >
                {companionBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Smartphone className="h-3.5 w-3.5" />
                )}
                Open on another device
              </button>
            </div>
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
              hasContext={segments.length > 0}
              generating={generating}
              error={assistError}
              mode={assistantMode}
              onModeChange={setAssistantMode}
              suggestions={suggestions}
              privateNotes={privateNotes}
              sharedNotes={sharedNotes}
              onAssist={runAssist}
              onShareAnswer={(text) => shareAnswer(text)}
              onSavePrivateNote={savePrivateNote}
              onCreateTask={createFollowUpTask}
            />
          </Card>
        </div>
      </div>

      {/* Finalization review */}
      {reviewOpen && (
        <FinalizationReview
          meetingId={meetingIdRef.current}
          meeting={reviewMeeting}
          meta={reviewMeta}
          privateNotes={privateNotes}
          sharedNotes={sharedNotes}
          processing={processing}
          onRegenerate={() => runFinalize(meetingIdRef.current)}
          onSaved={finishReview}
          onDiscard={discardMeeting}
        />
      )}

      {/* Companion pairing modal */}
      {companion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-violetAccent" />
                <h2 className="font-display text-xl text-ink">Pair a companion device</h2>
              </div>
              <button
                onClick={() => setCompanion(null)}
                className="rounded-md p-1 text-muted hover:bg-black/[0.04]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">
              Scan this private QR (or open the link) on your own phone. It opens your
              host-only copilot — never shown to participants or viewers.
            </p>
            <div className="mt-4 flex justify-center">
              <img
                src={companion.qr}
                alt="Companion pairing QR code"
                className="rounded-xl border border-black/[0.06]"
                width={200}
                height={200}
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={companion.url}
                className="flex-1 truncate rounded-lg border border-black/10 bg-black/[0.02] px-2 py-1.5 text-xs text-muted"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(companion.url);
                  toast("Companion link copied", "success");
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-white"
                aria-label="Copy companion link"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Expires {new Date(companion.expiresAt).toLocaleString()}.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={revokeCompanion}
            >
              Revoke companion links
            </Button>
          </Card>
        </div>
      )}

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
