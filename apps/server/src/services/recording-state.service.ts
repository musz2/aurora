/**
 * Canonical recording state.
 *
 * The live socket emits several engine-specific, ad-hoc `state` strings
 * ("listening", "live", "processing", "finalized", "error", ...). The UI needs a
 * small, stable set of recording states to render an honest, consistent status
 * indicator. This service maps the internal signals to one canonical enum and is
 * pure so it can be unit-tested and reused on the client.
 *
 * Consent/visibility note: there is no "hidden"/"stealth" state — recording is
 * always one of these visible states.
 */

export const RECORDING_STATES = [
  "idle",
  "connecting",
  "recording",
  "paused",
  "reconnecting",
  "stopped",
  "failed",
] as const;

export type RecordingState = (typeof RECORDING_STATES)[number];

export function isRecordingState(value: unknown): value is RecordingState {
  return (
    typeof value === "string" &&
    (RECORDING_STATES as readonly string[]).includes(value)
  );
}

/**
 * Map an internal signal to a canonical recording state.
 *
 * - status: durable meeting status (RECORDING/PROCESSING/FAILED/...)
 * - engineState: ephemeral socket/engine hint (listening/live/processing/error/...)
 * - paused / stopped: explicit lifecycle flags (take precedence)
 * - connecting / reconnecting: transport-level hints
 */
export function toRecordingState(input: {
  status?: string;
  engineState?: string;
  paused?: boolean;
  stopped?: boolean;
  connecting?: boolean;
  reconnecting?: boolean;
}): RecordingState {
  if (input.stopped) return "stopped";
  if (input.paused) return "paused";
  if (input.reconnecting) return "reconnecting";

  const engine = input.engineState;
  if (engine === "error") return "failed";
  if (input.connecting || engine === "connecting") return "connecting";

  const status = input.status;
  if (status === "FAILED") return "failed";
  if (status === "PROCESSING") return "stopped"; // turning into finalize
  if (status === "SCHEDULED") return "idle";

  if (status === "RECORDING") {
    // Actively producing transcript vs. still negotiating the STT connection.
    if (engine === "listening") return "connecting";
    return "recording";
  }

  if (engine === "live" || engine === "listening" || engine === "processing") {
    return "recording";
  }

  return "idle";
}
