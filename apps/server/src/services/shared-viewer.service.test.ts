import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORBIDDEN_SHARED_KEYS,
  assertNoPrivateLeak,
  sanitizePublicSession,
  type MeetingForSharing,
} from "./shared-viewer.service.js";

const baseMeeting: MeetingForSharing & Record<string, unknown> = {
  id: "m1",
  title: "Q3 Planning",
  status: "COMPLETED",
  startedAt: new Date("2026-06-01T10:00:00.000Z"),
  endedAt: new Date("2026-06-01T11:00:00.000Z"),
  shared: true,
  participants: ["Alex", "Sam"],
  publishedNotes: ["Kickoff next week"],
  segments: [
    { id: "s1", speakerName: "Alex", text: "Hello", startTime: 0 },
    { id: "s2", speakerName: "Sam", text: "Hi", startTime: 2 },
  ],
  summary: {
    overview: "We planned Q3.",
    keyPoints: ["Roadmap set"],
    decisions: ["Ship in July"],
  },
  // Private / sensitive fields that must never leak:
  recordingUrl: "https://storage/secret.mp3",
  createdById: "user-1",
  workspaceId: "ws-1",
  shareId: "secret-share",
  privateAssistSuggestions: [{ suggestion: "say this privately" }],
  privateNotes: ["my private note"],
};

test("sanitizePublicSession exposes only shared-safe fields", () => {
  const out = sanitizePublicSession(baseMeeting, "public-token") as unknown as Record<
    string,
    unknown
  >;
  assert.deepEqual(Object.keys(out).sort(), [
    "ended",
    "endedAt",
    "id",
    "live",
    "participants",
    "publishedNotes",
    "segments",
    "startedAt",
    "status",
    "summary",
    "title",
  ]);
  assert.equal(out.id, "public-token");
  assert.equal(out.live, false);
  assert.equal(out.ended, true);
});

test("sanitizePublicSession never leaks any forbidden key", () => {
  const out = sanitizePublicSession(baseMeeting, "public-token") as unknown as Record<
    string,
    unknown
  >;
  for (const key of FORBIDDEN_SHARED_KEYS) {
    assert.ok(!(key in out), `forbidden key leaked: ${key}`);
  }
  assert.doesNotThrow(() => assertNoPrivateLeak(out));
});

test("segments are stripped to id/speaker/text/startTime only", () => {
  const out = sanitizePublicSession(baseMeeting, "public-token");
  for (const seg of out.segments) {
    assert.deepEqual(Object.keys(seg).sort(), [
      "id",
      "speakerName",
      "startTime",
      "text",
    ]);
  }
});

test("summary is hidden while the session is live", () => {
  const live = sanitizePublicSession(
    { ...baseMeeting, status: "RECORDING" },
    "public-token"
  );
  assert.equal(live.live, true);
  assert.equal(live.summary, null);
});

test("assertNoPrivateLeak throws when a forbidden key is present", () => {
  assert.throws(
    () => assertNoPrivateLeak({ recordingUrl: "x" }),
    /leaked private field/
  );
});
