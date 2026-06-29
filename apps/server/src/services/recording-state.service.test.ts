import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECORDING_STATES,
  isRecordingState,
  toRecordingState,
} from "./recording-state.service.js";

test("explicit lifecycle flags take precedence", () => {
  assert.equal(toRecordingState({ stopped: true, status: "RECORDING" }), "stopped");
  assert.equal(toRecordingState({ paused: true, status: "RECORDING" }), "paused");
  assert.equal(
    toRecordingState({ reconnecting: true, status: "RECORDING" }),
    "reconnecting"
  );
});

test("engine/transport hints map to connecting and failed", () => {
  assert.equal(toRecordingState({ engineState: "error" }), "failed");
  assert.equal(toRecordingState({ connecting: true }), "connecting");
  assert.equal(
    toRecordingState({ status: "RECORDING", engineState: "listening" }),
    "connecting"
  );
});

test("active recording maps to recording", () => {
  assert.equal(toRecordingState({ status: "RECORDING", engineState: "live" }), "recording");
  assert.equal(toRecordingState({ status: "RECORDING" }), "recording");
});

test("durable statuses map sensibly", () => {
  assert.equal(toRecordingState({ status: "SCHEDULED" }), "idle");
  assert.equal(toRecordingState({ status: "FAILED" }), "failed");
  assert.equal(toRecordingState({ status: "PROCESSING" }), "stopped");
  assert.equal(toRecordingState({}), "idle");
});

test("every produced state is a valid canonical state", () => {
  const inputs = [
    { stopped: true },
    { paused: true },
    { reconnecting: true },
    { connecting: true },
    { engineState: "error" },
    { status: "RECORDING", engineState: "live" },
    { status: "SCHEDULED" },
    {},
  ];
  for (const input of inputs) {
    const state = toRecordingState(input);
    assert.ok(isRecordingState(state), `not canonical: ${state}`);
    assert.ok((RECORDING_STATES as readonly string[]).includes(state));
  }
  assert.equal(isRecordingState("bogus"), false);
});
