import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  CircleStop,
  Mic,
  MonitorUp,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLiveSession, type DesktopConfig } from "./live";

type SessionState = "idle" | "consent" | "recording";

const ASSISTANT_MODES = [
  "Interview",
  "Sales Call",
  "Technical Meeting",
  "Client Call",
  "Daily Standup",
  "Recruiting",
  "Leadership Meeting",
  "General Meeting",
] as const;

const CONFIG_KEY = "aurora.desktop.config";

function loadConfig(): DesktopConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as DesktopConfig;
  } catch {
    /* ignore */
  }
  return { apiBase: "http://localhost:4000", token: "" };
}

export function App() {
  if (window.location.hash === "#overlay") return <OverlayApp />;
  return <DesktopApp />;
}

function DesktopApp() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [consented, setConsented] = useState(false);
  const [privateQuestion, setPrivateQuestion] = useState("");
  const [assistantMode, setAssistantMode] = useState<string>("Technical Meeting");
  const [config, setConfig] = useState<DesktopConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const mic = useMicCapture();
  const live = useLiveSession();
  const recording = sessionState === "recording";

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* ignore */
    }
  }, [config]);

  const statusLabel = useMemo(() => {
    if (recording) return live.status === "recording" ? "Private session active" : "Connecting…";
    if (sessionState === "consent") return "Consent required";
    return "Ready";
  }, [recording, sessionState, live.status]);

  const startSession = async () => {
    const stream = await mic.start();
    if (!stream) return;
    setSessionState("recording");
    await window.auroraDesktop?.setOverlayVisible(true);
    await window.auroraDesktop?.setOverlayRecording(true);
    const ok = await live.start(stream, config, assistantMode);
    if (!ok) {
      // Connection failed — mic stays on so the user can retry, but reflect state.
      await window.auroraDesktop?.setOverlayRecording(false);
    }
  };

  const stopSession = async () => {
    await live.stop();
    mic.stop();
    setSessionState("idle");
    setConsented(false);
    await window.auroraDesktop?.setOverlayRecording(false);
    await window.auroraDesktop?.setOverlayVisible(false);
  };

  const askPrivately = () => {
    const question = privateQuestion.trim();
    if (!question) return;
    live.ask(question, assistantMode);
    setPrivateQuestion("");
  };

  const configured = Boolean(config.apiBase.trim() && config.token.trim());

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="button ghost"
            onClick={() => setShowSettings(true)}
            aria-label="Connection settings"
          >
            <Settings size={16} /> Connection
          </button>
          <span className={`status ${recording && live.status === "recording" ? "status-live" : ""}`}>
            {recording && live.status === "recording" && <span className="pulse" />}
            {statusLabel}
          </span>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel controls-panel">
          <div className="section-title">
            <ShieldCheck size={18} />
            Session controls
          </div>
          <p className="muted">
            Desktop sessions stay private unless you publish notes to the web dashboard.
          </p>

          <label className="field-label">Assistant mode</label>
          <select
            className="select"
            value={assistantMode}
            onChange={(e) => setAssistantMode(e.target.value)}
            disabled={recording}
          >
            {ASSISTANT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {recording ? (
            <button className="button danger wide" onClick={stopSession}>
              <CircleStop size={17} />
              Stop session
            </button>
          ) : (
            <button
              className="button primary wide"
              onClick={() => (configured ? setSessionState("consent") : setShowSettings(true))}
            >
              <Mic size={17} />
              {configured ? "Start mic session" : "Connect to start"}
            </button>
          )}

          {live.error && <p className="error-text">{live.error}</p>}

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
                {live.sttConfigured === false ? " · STT not configured on server" : ""}
              </p>
            )}
            <div className="device-row disabled">
              <MonitorUp size={17} />
              <div>
                <strong>System audio</strong>
                <span>Not supported yet — microphone capture only.</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="panel transcript-panel">
          <div className="section-title">
            <Radio size={18} />
            Live transcript
          </div>
          {live.lines.length === 0 && !live.partial ? (
            <div className="empty-state">
              <Mic size={28} />
              <strong>{recording ? "Listening…" : "No active session"}</strong>
              <span>
                {recording
                  ? "Audio is streaming to the server. Transcript segments appear here as they are recognized."
                  : "Start a consented mic session to begin live transcription."}
              </span>
            </div>
          ) : (
            <div className="transcript-list">
              {live.lines.map((l) => (
                <article className="transcript-line" key={l.id}>
                  <strong>{l.speakerName}</strong>
                  <p>{l.text}</p>
                </article>
              ))}
              {live.partial && (
                <article className="transcript-line partial">
                  <strong>{live.partial.speakerName}</strong>
                  <p>{live.partial.text}…</p>
                </article>
              )}
            </div>
          )}
        </section>

        <aside className="panel suggestions-panel">
          <div className="section-title">
            <Sparkles size={18} />
            Private suggestions
          </div>
          <div className="suggestion-list">
            {live.suggestions.length === 0 ? (
              <div className="private-empty">
                <Bot size={18} />
                <span>No private suggestions yet.</span>
              </div>
            ) : (
              live.suggestions.map((suggestion) => (
                <article className="suggestion" key={suggestion.id}>
                  <Bot size={16} />
                  <div>
                    <time>
                      {suggestion.createdAt}
                      {suggestion.confidence ? ` · ${suggestion.confidence} confidence` : ""}
                    </time>
                    {suggestion.question && <strong className="suggestion-q">{suggestion.question}</strong>}
                    <p style={{ whiteSpace: "pre-wrap" }}>{suggestion.text}</p>
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

      {showSettings && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="section-title">
              <Settings size={18} />
              <span id="settings-title">Connection settings</span>
            </div>
            <p className="muted">
              Aurora Desktop connects to your Aurora server with a real access token from a
              logged-in web session — it never bypasses login. In the web app, sign in, then copy
              your access token and paste it below.
            </p>
            <label className="field-label">Server URL</label>
            <input
              className="text-input"
              value={config.apiBase}
              onChange={(e) => setConfig((c) => ({ ...c, apiBase: e.target.value }))}
              placeholder="http://localhost:4000"
            />
            <label className="field-label">Access token</label>
            <textarea
              className="text-input"
              value={config.token}
              onChange={(e) => setConfig((c) => ({ ...c, token: e.target.value }))}
              placeholder="Paste your access token…"
            />
            <div className="button-row">
              <button className="button primary" onClick={() => setShowSettings(false)}>
                <Check size={16} /> Save
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stop = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
    streamRef.current = null;
    audioContextRef.current = null;
    animationRef.current = null;
    timerRef.current = null;
    startedAtRef.current = null;
    setRecording(false);
    setLevel(0);
  };

  const start = async (): Promise<MediaStream | null> => {
    setError("");
    setChunkCount(0);
    setElapsedSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      setDeviceLabel(stream.getAudioTracks()[0]?.label ?? "Microphone");

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
        setChunkCount((c) => c); // no-op keep stable
        if (startedAtRef.current) {
          setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
        animationRef.current = requestAnimationFrame(tick);
      };
      startedAtRef.current = Date.now();
      tick();

      timerRef.current = window.setInterval(() => {
        setChunkCount((c) => c + 1);
      }, 1000);
      setRecording(true);
      return stream;
    } catch (err) {
      stop();
      setError(
        err instanceof Error
          ? err.message
          : "Microphone permission is required to start capture."
      );
      return null;
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
