import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReferences,
  buildSnippet,
  matchIndex,
} from "./search.service.js";

test("matchIndex is case-insensitive", () => {
  assert.equal(matchIndex("Ship the Release", "release"), 9);
  assert.equal(matchIndex("nothing here", "missing"), -1);
});

test("buildSnippet centers on the match with ellipses", () => {
  const text =
    "We talked at length about many things and eventually agreed to ship the release on Friday after the long review.";
  const snippet = buildSnippet(text, "ship the release", 16);
  assert.ok(snippet.includes("ship the release"));
  assert.ok(snippet.startsWith("…"));
  assert.ok(snippet.endsWith("…"));
});

test("buildSnippet falls back to head when there is no match", () => {
  const snippet = buildSnippet("alpha beta gamma", "zzz", 100);
  assert.equal(snippet, "alpha beta gamma");
});

test("buildReferences cites segments and summaries, de-duplicated", () => {
  const refs = buildReferences(
    "launch",
    [
      {
        meetingId: "m1",
        speakerName: "Alex",
        text: "The launch is on track for next week.",
        meeting: { title: "Standup" },
      },
      // Exact duplicate snippet/meeting → collapsed.
      {
        meetingId: "m1",
        speakerName: "Alex",
        text: "The launch is on track for next week.",
        meeting: { title: "Standup" },
      },
    ],
    [
      {
        meetingId: "m2",
        overview: "Reviewed the launch plan and risks.",
        meeting: { title: "Planning" },
      },
    ]
  );
  assert.equal(refs.length, 2);
  assert.equal(refs[0].type, "segment");
  assert.equal(refs[0].speakerName, "Alex");
  assert.ok(refs[0].snippet.toLowerCase().includes("launch"));
  assert.equal(refs[1].type, "summary");
  assert.equal(refs[1].meetingTitle, "Planning");
});
