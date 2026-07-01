import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOB_PACKS,
  COMMON_QA,
  QA_CATEGORIES,
  INTERVIEWER_QUESTIONS,
  packEntries,
  getJobPack,
  jobPackOptions,
} from "@aurora/shared";

/**
 * Invariants for the Offline Interview Knowledge Packs. These prove the packs
 * work fully offline (pure data), meet the senior-count bar, and always include
 * the common interviewer questions.
 */

test("there are 20+ job packs", () => {
  assert.ok(JOB_PACKS.length >= 20, `expected >=20 packs, got ${JOB_PACKS.length}`);
});

test("every pack surfaces 30+ senior Q&A entries (common + role-specific)", () => {
  for (const pack of JOB_PACKS) {
    const n = packEntries(pack).length;
    assert.ok(n >= 30, `${pack.title} has only ${n} entries`);
  }
});

test("every pack includes the 5 common interviewer questions", () => {
  assert.equal(INTERVIEWER_QUESTIONS.length, 5);
  for (const pack of JOB_PACKS) {
    const entries = packEntries(pack);
    const asked = entries.filter((e) => e.category === "Questions to Ask Interviewer");
    assert.ok(asked.length >= 5, `${pack.title} has ${asked.length} interviewer questions`);
    for (const q of INTERVIEWER_QUESTIONS) {
      assert.ok(
        entries.some((e) => e.question === q),
        `${pack.title} missing interviewer question: ${q}`
      );
    }
  }
});

test("every entry uses a valid category and has non-empty Q + A", () => {
  const valid = new Set<string>(QA_CATEGORIES);
  for (const pack of JOB_PACKS) {
    for (const e of packEntries(pack)) {
      assert.ok(valid.has(e.category), `invalid category ${e.category} in ${pack.title}`);
      assert.ok(e.question.trim().length > 0);
      assert.ok(e.answer.trim().length > 0);
    }
  }
});

test("packs contain no unsafe wording (stealth/hidden/bypass/cheat)", () => {
  const banned = ["stealth", "hidden", "invisible", "bypass", "cheat", "undetectable", "screen-share"];
  const blob = JSON.stringify({ JOB_PACKS, COMMON_QA }).toLowerCase();
  for (const w of banned) assert.ok(!blob.includes(w), `banned word present: ${w}`);
});

test("getJobPack + jobPackOptions are consistent", () => {
  const opts = jobPackOptions();
  assert.equal(opts.length, JOB_PACKS.length);
  for (const o of opts) assert.ok(getJobPack(o.id), `no pack for ${o.id}`);
});

test("packs are pure data — usable with no AI or network", () => {
  // Simply reading and composing entries must work synchronously.
  const pack = getJobPack("data-engineer");
  assert.ok(pack);
  const entries = packEntries(pack!);
  assert.ok(entries.length >= 30);
});
