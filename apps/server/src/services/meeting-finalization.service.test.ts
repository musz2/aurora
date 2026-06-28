import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractTranscriptQuestions,
  finalizationLabel,
  finalizationSource,
  summarizeSpeakers,
} from "./meeting-finalization.service.js";
import type { TranscriptLine } from "./ai.service.js";

const transcript: TranscriptLine[] = [
  { speakerName: "Alex", text: "Welcome everyone. How are we tracking on the launch?" },
  { speakerName: "Sam", text: "On track. We closed the API work yesterday." },
  { speakerName: "Alex", text: "Great. What about the migration risk?" },
  { speakerName: "Sam", text: "Low. I will confirm the rollback plan." },
];

test("finalizationSource prefers AI, falls back to mock only for demo", () => {
  assert.equal(finalizationSource({ hasAI: true, demoMode: false }), "ai");
  assert.equal(finalizationSource({ hasAI: true, demoMode: true }), "ai");
  assert.equal(finalizationSource({ hasAI: false, demoMode: true }), "mock");
  assert.equal(
    finalizationSource({ hasAI: false, demoMode: false }),
    "unavailable"
  );
});

test("finalizationLabel is honest about mock output", () => {
  assert.match(finalizationLabel("ai"), /Aurora AI/);
  assert.match(finalizationLabel("mock"), /mock|Demo/i);
  assert.match(finalizationLabel("mock"), /not real AI/i);
  assert.match(finalizationLabel("unavailable"), /not configured/i);
});

test("summarizeSpeakers counts participation and sorts by volume", () => {
  const speakers = summarizeSpeakers(transcript);
  assert.equal(speakers.length, 2);
  assert.equal(speakers[0].segmentCount, 2);
  assert.ok(Math.abs(speakers[0].share - 0.5) < 1e-9);
  // shares sum to 1
  const total = speakers.reduce((sum, s) => sum + s.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("summarizeSpeakers handles an empty transcript safely", () => {
  assert.deepEqual(summarizeSpeakers([]), []);
});

test("extractTranscriptQuestions pulls de-duplicated questions", () => {
  const questions = extractTranscriptQuestions(transcript);
  assert.ok(questions.some((q) => q.includes("tracking on the launch")));
  assert.ok(questions.some((q) => q.includes("migration risk")));
  // No non-question statements leak in
  assert.ok(questions.every((q) => q.endsWith("?")));
});
