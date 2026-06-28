import type { MeetingLifecycleState } from "@aurora/shared";
import type { MeetingStatus } from "@prisma/client";

/**
 * Meeting lifecycle service.
 *
 * The UI exposes a rich set of ephemeral session states (see
 * `MEETING_LIFECYCLE_STATES` in @aurora/shared). The database stores a coarser,
 * durable `MeetingStatus`. This service is the single source of truth for:
 *   - mapping a lifecycle state to its persisted status
 *   - validating that a requested transition is legal
 *
 * Keeping this pure (no Prisma, no sockets) makes the rules unit-testable and
 * lets the socket layer, REST routes, and tests all agree on the same machine.
 */

export type { MeetingLifecycleState };

/** Persisted status for each lifecycle state. */
const STATE_TO_STATUS: Record<MeetingLifecycleState, MeetingStatus> = {
  not_recording: "SCHEDULED",
  requesting_permission: "SCHEDULED",
  recording: "RECORDING",
  paused: "RECORDING",
  reconnecting: "RECORDING",
  failed: "FAILED",
  stopped: "PROCESSING",
  finalizing: "PROCESSING",
  completed: "COMPLETED",
};

/**
 * Legal forward/lateral transitions. A meeting can always move to `failed`
 * (an error can happen at any time), so that edge is allowed implicitly.
 */
const ALLOWED_TRANSITIONS: Record<
  MeetingLifecycleState,
  MeetingLifecycleState[]
> = {
  not_recording: ["requesting_permission", "recording"],
  requesting_permission: ["recording", "not_recording"],
  recording: ["paused", "reconnecting", "stopped"],
  paused: ["recording", "reconnecting", "stopped"],
  reconnecting: ["recording", "paused", "stopped"],
  failed: ["requesting_permission", "recording", "not_recording"],
  stopped: ["finalizing", "completed"],
  finalizing: ["completed", "failed"],
  completed: [],
};

/** Map a lifecycle state to its durable persisted status. */
export function lifecycleToStatus(state: MeetingLifecycleState): MeetingStatus {
  return STATE_TO_STATUS[state];
}

/** True when `to` is a legal next state from `from`. `failed` is always reachable. */
export function canTransition(
  from: MeetingLifecycleState,
  to: MeetingLifecycleState
): boolean {
  if (from === to) return true;
  if (to === "failed") return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Returns the next state if legal, otherwise throws with a clear message. */
export function assertTransition(
  from: MeetingLifecycleState,
  to: MeetingLifecycleState
): MeetingLifecycleState {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal meeting transition: ${from} -> ${to}`);
  }
  return to;
}

/** A lifecycle state is terminal when no further transitions remain. */
export function isTerminal(state: MeetingLifecycleState): boolean {
  return state === "completed";
}

/** True while the session is actively capturing (recording or recovering). */
export function isActive(state: MeetingLifecycleState): boolean {
  return (
    state === "recording" || state === "reconnecting" || state === "paused"
  );
}

/** Audit action name for a lifecycle transition, or null if none should fire. */
export function auditActionForState(
  state: MeetingLifecycleState
): string | null {
  switch (state) {
    case "recording":
      return "meeting_started";
    case "paused":
      return "meeting_paused";
    case "stopped":
      return "meeting_stopped";
    case "failed":
      return "meeting_failed";
    case "completed":
      return "meeting_completed";
    default:
      return null;
  }
}
