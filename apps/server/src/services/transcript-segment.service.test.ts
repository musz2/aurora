import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SegmentPatchError,
  buildSegmentUpdate,
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
