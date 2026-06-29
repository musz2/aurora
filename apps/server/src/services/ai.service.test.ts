import { test } from "node:test";
import assert from "node:assert/strict";
import { hasOpenAI } from "../config/env.js";
import {
  extractActionItems,
  generateMeetingSummary,
  type TranscriptLine,
} from "./ai.service.js";

/**
 * These tests pin the honesty contract used by uploads/finalization:
 *   - demoMode → return labelled sample output, NEVER throw "not configured".
 *   - real mode + no OpenAI key → throw 503 (no faked provider output is saved).
 *
 * They are only meaningful when no OpenAI key is configured (the default for CI
 * and local mock mode), so they skip if a real key is present.
 */
const skip = hasOpenAI;

const transcript: TranscriptLine[] = [
  { speakerName: "Justin Carter", text: "Let's lock the launch date." },
  { speakerName: "Pat Reynolds", text: "I'll prep the proposal draft." },
];

test("demo summary returns sample output without OpenAI", { skip }, async () => {
  const summary = await generateMeetingSummary("Launch sync", transcript, [], {
    demoMode: true,
  });
  assert.ok(summary.overview.length > 0);
  assert.ok(Array.isArray(summary.keyPoints) && summary.keyPoints.length > 0);
  assert.ok(Array.isArray(summary.decisions));
  assert.ok(summary.followUpEmail.includes("Launch sync"));
});

test("demo action items return sample output without OpenAI", { skip }, async () => {
  const items = await extractActionItems(transcript, { demoMode: true });
  assert.ok(items.length > 0);
  for (const item of items) {
    assert.ok(typeof item.task === "string" && item.task.length > 0);
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(item.priority));
  }
});

test("real summary without OpenAI throws not-configured (no fake output)", { skip }, async () => {
  await assert.rejects(
    () => generateMeetingSummary("Launch sync", transcript, [], { demoMode: false }),
    /not configured/i
  );
});

test("real action items without OpenAI throw not-configured", { skip }, async () => {
  await assert.rejects(
    () => extractActionItems(transcript, { demoMode: false }),
    /not configured/i
  );
});

test("empty transcript in demo mode still returns mock summary", { skip }, async () => {
  const summary = await generateMeetingSummary("Empty", [], [], { demoMode: true });
  assert.ok(summary.overview.length > 0);
});
