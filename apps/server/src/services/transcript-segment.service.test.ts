import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FinalSegmentWindow,
  SegmentPatchError,
  buildSegmentUpdate,
  isDuplicateFinalSegment,
  normalizeSegmentText,
} from "./transcript-segment.service.js";

test("editing text trims, clamps, and marks edited", () => {
  const update = buildSegmentUpdate({ text: "  fixed transcript  " });
  assert.equal(update.text, "fixed transcript");
  assert.equal(update.edited, true);
});

test("flag toggles pass through as booleans", () => {
  assert.deepEqual(buildSegmentUpdate({ highlighted: true }), {
    highlighted: true,
  });
  assert.deepEqual(buildSegmentUpdate({ isDecision: true }), {
    isDecision: true,
  });
  assert.deepEqual(buildSegmentUpdate({ isActionItem: false }), {
    isActionItem: false,
  });
});

test("multiple fields merge into one update", () => {
  const update = buildSegmentUpdate({
    text: "Decision: ship Friday",
    isDecision: true,
    highlighted: true,
  });
  assert.equal(update.text, "Decision: ship Friday");
  assert.equal(update.edited, true);
  assert.equal(update.isDecision, true);
  assert.equal(update.highlighted, true);
});

test("invalid and empty patches are rejected", () => {
  assert.throws(() => buildSegmentUpdate({ text: "   " }), SegmentPatchError);
  assert.throws(() => buildSegmentUpdate({ text: 42 }), SegmentPatchError);
  assert.throws(
    () => buildSegmentUpdate({ highlighted: "yes" }),
    SegmentPatchError
  );
  assert.throws(() => buildSegmentUpdate({}), SegmentPatchError);
});

/* ------------------------- final segment dedup ------------------------- */

test("normalizeSegmentText collapses whitespace and lowercases", () => {
  assert.equal(normalizeSegmentText("  Ship   IT  Now "), "ship it now");
});

test("isDuplicateFinalSegment matches same speaker + text within window", () => {
  const recent = [{ speakerName: "Alex", text: "Ship it Friday.", startTime: 10 }];
  // Exact duplicate (case/space insensitive) close in time → duplicate.
  assert.equal(
    isDuplicateFinalSegment(
      { speakerName: "Alex", text: "ship it  friday.", startTime: 11 },
      recent
    ),
    true
  );
  // Same text but a different speaker → not a duplicate.
  assert.equal(
    isDuplicateFinalSegment(
      { speakerName: "Sam", text: "Ship it Friday.", startTime: 11 },
      recent
    ),
    false
  );
  // Same text far outside the time window → not a duplicate.
  assert.equal(
    isDuplicateFinalSegment(
      { speakerName: "Alex", text: "Ship it Friday.", startTime: 99 },
      recent
    ),
    false
  );
  // Different text → not a duplicate.
  assert.equal(
    isDuplicateFinalSegment(
      { speakerName: "Alex", text: "Hold the release.", startTime: 11 },
      recent
    ),
    false
  );
});

test("empty/whitespace finals are treated as duplicates (nothing to save)", () => {
  assert.equal(
    isDuplicateFinalSegment({ speakerName: "Alex", text: "   ", startTime: 1 }, []),
    true
  );
});

test("FinalSegmentWindow records new finals and rejects replays", () => {
  const win = new FinalSegmentWindow(3);
  assert.equal(win.isDuplicate({ speakerName: "A", text: "one", startTime: 1 }), false);
  // Replay of the same final → duplicate.
  assert.equal(win.isDuplicate({ speakerName: "A", text: "one", startTime: 1 }), true);
  // New finals are accepted.
  assert.equal(win.isDuplicate({ speakerName: "A", text: "two", startTime: 2 }), false);
  win.reset();
  // After reset, the previously-seen final is accepted again.
  assert.equal(win.isDuplicate({ speakerName: "A", text: "two", startTime: 2 }), false);
});
