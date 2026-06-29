import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORBIDDEN_SHARED_KEYS,
  assertNoPrivateLeak,
  isShareActive,
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
  publishedAnswers: [
    {
      id: "pa1",
      text: "We will ship the beta in July.",
      publishedBy: "Host",
      createdAt: new Date("2026-06-01T10:30:00.000Z"),
    },
  ],
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
    "publishedAnswers",
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

test("isShareActive honors revoke and expiry", () => {
  const now = new Date("2026-06-29T12:00:00.000Z");
  // Revoked → inactive regardless of expiry.
  assert.equal(isShareActive({ shared: false }, now), false);
  // Shared, no expiry → active.
  assert.equal(isShareActive({ shared: true }, now), true);
  // Shared, future expiry → active.
  assert.equal(
    isShareActive({ shared: true, shareExpiresAt: "2026-06-29T13:00:00.000Z" }, now),
    true
  );
  // Shared, past expiry → inactive.
  assert.equal(
    isShareActive({ shared: true, shareExpiresAt: "2026-06-29T11:00:00.000Z" }, now),
    false
  );
  // Accepts Date instances too.
  assert.equal(
    isShareActive({ shared: true, shareExpiresAt: new Date("2026-06-29T11:00:00.000Z") }, now),
    false
  );
});

test("published answers are exposed (sanitized) but drafts/context never are", () => {
  // Host-only fields that must NOT leak even alongside a published answer.
  const withDrafts: MeetingForSharing & Record<string, unknown> = {
    ...baseMeeting,
    privateAssistSuggestions: [{ suggestion: "draft answer", confidence: "high" }],
    privateNotes: ["secret note"],
  };
  const out = sanitizePublicSession(withDrafts, "public-token");
  assert.equal(out.publishedAnswers.length, 1);
  const answer = out.publishedAnswers[0];
  assert.deepEqual(Object.keys(answer).sort(), ["createdAt", "id", "publishedBy", "text"]);
  assert.equal(answer.text, "We will ship the beta in July.");
  assert.equal(answer.publishedBy, "Host");
  // No draft/notes/context/confidence anywhere in the payload.
  const serialized = JSON.stringify(out);
  assert.ok(!serialized.includes("draft answer"));
  assert.ok(!serialized.includes("secret note"));
  assert.ok(!serialized.includes("confidence"));
});

test("viewer payload never contains private assistant suggestions or notes", () => {
  // Source row deliberately carries private host-only assistant data. The public
  // viewer must structurally drop it — proving the Cluely-style copilot output
  // can never reach a shared viewer.
  const withPrivateAssist = {
    ...baseMeeting,
    privateAssistSuggestions: [
      { suggestion: "Pitch the enterprise tier now", confidence: "high" },
    ],
    privateNotes: ["Champion is the VP, not the manager"],
  };
  const out = sanitizePublicSession(withPrivateAssist, "public-token") as unknown as Record<
    string,
    unknown
  >;
  assert.ok(!("privateAssistSuggestions" in out));
  assert.ok(!("privateNotes" in out));
  // No nested value should carry the private suggestion text either.
  const serialized = JSON.stringify(out);
  assert.ok(!serialized.includes("Pitch the enterprise tier now"));
  assert.ok(!serialized.includes("Champion is the VP"));
  assert.doesNotThrow(() => assertNoPrivateLeak(out));
});
