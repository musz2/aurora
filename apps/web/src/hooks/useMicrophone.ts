import { useCallback, useEffect, useRef, useState } from "react";

export type MicPermission = "unknown" | "granted" | "denied" | "prompt";

export interface MicState {
  devices: MediaDeviceInfo[];
  deviceId: string | null;
  setDeviceId: (id: string) => void;
  permission: MicPermission;
  level: number; // 0..1 smoothed input level
  silent: boolean; // true if granted but no input detected for a while
  stream: MediaStream | null;
  activeLabel: string | null;
  start: () => Promise<MediaStream | null>;
  stop: () => void;
  error: string | null;
}

const log = (...a: unknown[]) => console.info("[MIC]", ...a);
const warn = (...a: unknown[]) => console.warn("[MIC]", ...a);

/**
 * Captures the selected physical microphone only (not system/tab audio) and
 * exposes a live input level via the Web Audio API. Logs device/sample-rate/
 * channel/encoding details in development for debugging the capture pipeline.
 */
export function useMicrophone(): MicState {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [level, setLevel] = useState(0);
  const [silent, setSilent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>();
  const silenceFramesRef = useRef(0);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "audioinput"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () =>
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        refreshDevices
      );
  }, [refreshDevices]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
    setSilent(false);
    setActiveLabel(null);
  }, []);

  const start = useCallback(async (): Promise<MediaStream | null> => {
    setError(null);
    stop();
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1, // mono — matches STT requirements
        },
        video: false,
      };
      log("requesting getUserMedia...", { deviceId });
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermission("granted");
      await refreshDevices();

      const track = stream.getAudioTracks()[0];
      const settings = track.getSettings();
      setActiveLabel(track.label || "Default microphone");
      if (!deviceId && settings.deviceId) setDeviceId(settings.deviceId);
      log("capture started", {
        device: track.label,
        deviceId: settings.deviceId,
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        trackState: track.readyState,
        trackEnabled: track.enabled,
      });

      // Level metering via AnalyserNode.
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // Resume AudioContext (browsers start it suspended outside user gesture).
      if (ctx.state === "suspended") {
        log("AudioContext suspended — resuming...");
        await ctx.resume();
        log("AudioContext state:", ctx.state);
      }
      log("AudioContext created:", ctx.state);

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const next = Math.min(1, rms * 2.2);
        setLevel((prev) => prev * 0.6 + next * 0.4);

        // Silent-mic detection: ~3s of near-zero input.
        if (rms < 0.01) {
          silenceFramesRef.current += 1;
          if (silenceFramesRef.current === 1) log("silence detected (first frame)");
          if (silenceFramesRef.current > 180) {
            if (!silent) log("mic silent for ~3s — showing warning");
            setSilent(true);
          }
        } else {
          if (silenceFramesRef.current > 10) log("audio detected after silence");
          silenceFramesRef.current = 0;
          setSilent(false);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      return stream;
    } catch (err) {
      const e = err as DOMException;
      warn("getUserMedia failed:", e.name, e.message);
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        setPermission("denied");
        setError("Microphone permission denied. Enable mic access to record.");
      } else if (e.name === "NotFoundError") {
        setError("No microphone found. Connect an input device and retry.");
      } else {
        setError(e.message || "Could not access the microphone.");
      }
      return null;
    }
  }, [deviceId, refreshDevices, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    devices,
    deviceId,
    setDeviceId,
    permission,
    level,
    silent,
    stream: streamRef.current,
    activeLabel,
    start,
    stop,
    error,
  };
}
