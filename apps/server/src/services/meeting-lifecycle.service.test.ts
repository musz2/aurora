import { test } from "node:test";
import assert from "node:assert/strict";
import { MEETING_LIFECYCLE_STATES } from "@aurora/shared";
import {
  assertTransition,
  auditActionForState,
  canTransition,
  isActive,
  isTerminal,
  lifecycleToStatus,
} from "./meeting-lifecycle.service.js";

test("lifecycleToStatus maps every lifecycle state to a persisted status", () => {
  for (const state of MEETING_LIFECYCLE_STATES) {
    const status = lifecycleToStatus(state);
    assert.ok(
      ["SCHEDULED", "RECORDING", "PROCESSING", "COMPLETED", "FAILED"].includes(
        status
      ),
      `${state} -> ${status} should be a valid MeetingStatus`
    );
  }
  assert.equal(lifecycleToStatus("recording"), "RECORDING");
  assert.equal(lifecycleToStatus("paused"), "RECORDING");
  assert.equal(lifecycleToStatus("finalizing"), "PROCESSING");
  assert.equal(lifecycleToStatus("completed"), "COMPLETED");
  assert.equal(lifecycleToStatus("failed"), "FAILED");
});

test("canTransition enforces the lifecycle state machine", () => {
  assert.ok(canTransition("recording", "paused"));
  assert.ok(canTransition("paused", "recording"));
  assert.ok(canTransition("recording", "stopped"));
  assert.ok(canTransition("stopped", "finalizing"));
  assert.ok(canTransition("finalizing", "completed"));

  // Illegal jumps
  assert.ok(!canTransition("completed", "recording"));
  assert.ok(!canTransition("not_recording", "completed"));
  assert.ok(!canTransition("paused", "completed"));
});

test("failure is reachable from any state and same-state is a no-op", () => {
  for (const state of MEETING_LIFECYCLE_STATES) {
    assert.ok(canTransition(state, "failed"), `${state} -> failed`);
    assert.ok(canTransition(state, state), `${state} -> ${state}`);
  }
});

test("assertTransition throws on illegal transitions", () => {
  assert.equal(assertTransition("recording", "paused"), "paused");
  assert.throws(() => assertTransition("completed", "recording"), /Illegal/);
});

test("isTerminal and isActive classify states", () => {
  assert.ok(isTerminal("completed"));
  assert.ok(!isTerminal("recording"));
  assert.ok(isActive("recording"));
  assert.ok(isActive("paused"));
  assert.ok(isActive("reconnecting"));
  assert.ok(!isActive("stopped"));
  assert.ok(!isActive("completed"));
});

test("auditActionForState returns audit names for meaningful transitions", () => {
  assert.equal(auditActionForState("recording"), "meeting_started");
  assert.equal(auditActionForState("paused"), "meeting_paused");
  assert.equal(auditActionForState("stopped"), "meeting_stopped");
  assert.equal(auditActionForState("failed"), "meeting_failed");
  assert.equal(auditActionForState("completed"), "meeting_completed");
  assert.equal(auditActionForState("requesting_permission"), null);
});
