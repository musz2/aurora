import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOB_PACKS,
  COMMON_QA,
  QA_CATEGORIES,
  INTERVIEWER_QUESTIONS,
  INTERVIEW_FLOWS,
  ROLE_QUESTIONS,
  packEntries,
  mostAskedEntries,
  isSeniorScenario,
  entryView,
  getJobPack,
  getInterviewFlow,
  getRoleQuestions,
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
  const blob = JSON.stringify({ JOB_PACKS, COMMON_QA, INTERVIEW_FLOWS, ROLE_QUESTIONS }).toLowerCase();
  for (const w of banned) assert.ok(!blob.includes(w), `banned word present: ${w}`);
});

test("every pack has a complete Interview Flow Summary", () => {
  for (const pack of JOB_PACKS) {
    const flow = getInterviewFlow(pack.id);
    assert.ok(flow, `no interview flow for ${pack.id}`);
    assert.ok(flow!.overview.length > 0, `${pack.id} flow overview empty`);
    assert.ok(flow!.openingPitch.length > 0, `${pack.id} opening pitch empty`);
    assert.ok(flow!.positioningExperience.length > 0);
    assert.ok(flow!.hiringManagersLookFor.length >= 3, `${pack.id} lookFor too few`);
    assert.ok(flow!.strengthsToHighlight.length >= 3);
    assert.ok(flow!.redFlagsToAvoid.length >= 3);
    assert.ok(flow!.bestProjectsToDiscuss.length >= 2);
  }
});

test("every pack has 3+ role-specific interviewer questions", () => {
  for (const pack of JOB_PACKS) {
    assert.ok(getRoleQuestions(pack.id).length >= 3, `${pack.id} has too few role questions`);
  }
});

test("entryView always fills summary + followUpTip (no fabrication needed)", () => {
  for (const pack of JOB_PACKS) {
    for (const e of packEntries(pack)) {
      const v = entryView(e);
      assert.ok(v.summary.trim().length > 0, `empty summary in ${pack.id}`);
      assert.ok(v.followUpTip.trim().length > 0, `empty followUpTip in ${pack.id}`);
    }
  }
});

test("Most Asked and Senior Scenario filters return entries for every pack", () => {
  for (const pack of JOB_PACKS) {
    assert.ok(mostAskedEntries(pack).length >= 3, `${pack.id} most-asked too few`);
    const scenarios = packEntries(pack).filter(isSeniorScenario);
    assert.ok(scenarios.length >= 3, `${pack.id} senior scenarios too few`);
  }
});

test("common Q&A ships enriched answers with examples + follow-ups", () => {
  const enriched = COMMON_QA.filter((e) => e.example && e.followUpTip);
  assert.ok(enriched.length >= 4, "expected several fully-enriched common entries");
  const mostAsked = COMMON_QA.filter((e) => e.mostAsked);
  assert.ok(mostAsked.length >= 4, "expected common most-asked entries");
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
