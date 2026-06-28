import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  CircleStop,
  Mic,
  MonitorUp,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type SessionState = "idle" | "consent" | "recording";
type PrivateSuggestion = { id: string; text: string; createdAt: string };

export function App() {
  if (window.location.hash === "#overlay") return <OverlayApp />;
  return <DesktopApp />;
}

function DesktopApp() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [consented, setConsented] = useState(false);
  const [privateQuestion, setPrivateQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<PrivateSuggestion[]>([]);
  const mic = useMicCapture();
  const recording = sessionState === "recording";

  const statusLabel = useMemo(() => {
    if (recording) return "Private session active";
    if (sessionState === "consent") return "Consent required";
    return "Ready";
  }, [recording, sessionState]);

  const startSession = async () => {
    const started = await mic.start();
    if (!started) return;
    setSessionState("recording");
    await window.auroraDesktop?.setOverlayVisible(true);
    await window.auroraDesktop?.setOverlayRecording(true);
  };

  const stopSession = async () => {
    mic.stop();
    setSessionState("idle");
    setConsented(false);
    await window.auroraDesktop?.setOverlayRecording(false);
    await window.auroraDesktop?.setOverlayVisible(false);
  };

  const askPrivately = () => {
    const question = privateQuestion.trim();
    if (!question) return;
    setSuggestions((prev) => [
      {
        id: crypto.randomUUID(),
        text: "Private AI suggestions require a configured desktop copilot connection. No shared note was created.",
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev,
    ]);
    setPrivateQuestion("");
  };

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <div className="brand-row">
            <span className="brand-mark">A</span>
            <span className="brand-name">Aurora Desktop</span>
          </div>
          <h1>Live capture and private copilot</h1>
        </div>
        <span className={`status ${recording ? "status-live" : ""}`}>
          {recording && <span className="pulse" />}
          {statusLabel}
        </span>
      </section>

      <section className="workspace">
        <aside className="panel controls-panel">
          <div className="section-title">
            <ShieldCheck size={18} />
            Session controls
          </div>
          <p className="muted">
            Desktop sessions stay private unless notes are published to the web dashboard.
          </p>

          {recording ? (
            <button className="button danger wide" onClick={stopSession}>
              <CircleStop size={17} />
              Stop session
            </button>
          ) : (
            <button className="button primary wide" onClick={() => setSessionState("consent")}>
              <Mic size={17} />
              Start mic session
            </button>
          )}

          <div className="device-box">
            <div className="device-row">
              <Mic size={17} />
              <div>
                <strong>Microphone</strong>
                <span>{mic.deviceLabel || (recording ? "Active input" : "Idle")}</span>
              </div>
            </div>
            <div className="level-track" aria-label="Microphone level">
              <span style={{ width: `${Math.round(mic.level * 100)}%` }} />
            </div>
            {mic.error && <p className="error-text">{mic.error}</p>}
            {recording && (
              <p className="capture-meta">
                {formatDuration(mic.elapsedSeconds)} · {mic.chunkCount} audio chunks captured
              </p>
            )}
            <div className="device-row disabled">
              <MonitorUp size={17} />
              <div>
                <strong>System audio</strong>
                <span>Not enabled in this MVP.</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="panel transcript-panel">
          <div className="section-title">
            <Radio size={18} />
            Live transcript
          </div>
          <div className="empty-state">
            <Mic size={28} />
            <strong>{recording ? "Microphone capture active" : "No active session"}</strong>
            <span>
              {recording
                ? "Audio is being captured locally from the microphone. Transcription wiring remains separate from sharing."
                : "Start a consented mic session to begin live capture."}
            </span>
          </div>
        </section>

        <aside className="panel suggestions-panel">
          <div className="section-title">
            <Sparkles size={18} />
            Private suggestions
          </div>
          <div className="suggestion-list">
            {suggestions.length === 0 ? (
              <div className="private-empty">
                <Bot size={18} />
                <span>No private suggestions yet.</span>
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <article className="suggestion" key={suggestion.id}>
                  <Bot size={16} />
                  <div>
                    <time>{suggestion.createdAt}</time>
                    <p>{suggestion.text}</p>
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="ask-box">
            <textarea
              value={privateQuestion}
              onChange={(event) => setPrivateQuestion(event.target.value)}
              placeholder="Ask privately..."
              disabled={!recording}
            />
            <button className="button secondary wide" disabled={!recording} onClick={askPrivately}>
              Ask privately
            </button>
          </div>
        </aside>
      </section>

      {sessionState === "consent" && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="consent-title">
            <div className="section-title">
              <ShieldCheck size={18} />
              <span id="consent-title">Recording consent</span>
            </div>
            <p className="muted">
              Confirm participant consent before Aurora starts microphone capture.
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
              />
              <span>I have permission to record and transcribe this session.</span>
            </label>
            <div className="button-row">
              <button className="button secondary" onClick={() => setSessionState("idle")}>
                Cancel
              </button>
              <button className="button primary" disabled={!consented} onClick={startSession}>
                <Radio size={16} />
                Start
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function OverlayApp() {
  const [recording, setRecording] = useState(false);

  useEffect(() => window.auroraDesktop?.onOverlayRecording(setRecording), []);

  return (
    <main className="overlay">
      <div className="overlay-header">
        <span className={recording ? "pulse" : "idle-dot"} />
        <strong>{recording ? "Recording" : "Private copilot"}</strong>
      </div>
      <div className="overlay-body">
        <div className="overlay-card">
          <Check size={16} />
          <span>Recording indicator visible</span>
        </div>
        <div className="overlay-card">
          <Bot size={16} />
          <span>Suggestions stay private</span>
        </div>
      </div>
    </main>
  );
}

function useMicCapture() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [chunkCount, setChunkCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stop = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
    recorderRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    animationRef.current = null;
    timerRef.current = null;
    startedAtRef.current = null;
    setRecording(false);
    setLevel(0);
  };

  const start = async () => {
    setError("");
    setChunkCount(0);
    setElapsedSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      setDeviceLabel(stream.getAudioTracks()[0]?.label ?? "Microphone");

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) setChunkCount((count) => count + 1);
      };
      recorder.start(1000);
      recorderRef.current = recorder;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const average = data.reduce((sum, value) => sum + value, 0) / data.length;
        setLevel(Math.min(1, average / 120));
        if (startedAtRef.current) {
          setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
        animationRef.current = requestAnimationFrame(tick);
      };
      startedAtRef.current = Date.now();
      tick();

      timerRef.current = window.setInterval(() => {
        if (recorder.state === "recording") recorder.requestData();
      }, 1000);
      setRecording(true);
      return true;
    } catch (err) {
      stop();
      setError(
        err instanceof Error
          ? err.message
          : "Microphone permission is required to start capture."
      );
      return false;
    }
  };

  useEffect(() => stop, []);

  return {
    recording,
    error,
    level,
    deviceLabel,
    chunkCount,
    elapsedSeconds,
    start,
    stop,
  };
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}
