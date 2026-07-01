import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveJobPackId,
  findOfflineEntry,
  buildOfflineBackup,
  backupQuestion,
} from "./backup-assist.service.js";

test("resolveJobPackId matches by id and by title", () => {
  assert.equal(resolveJobPackId("data-engineer"), "data-engineer");
  assert.equal(resolveJobPackId("Data Engineer"), "data-engineer");
  assert.equal(resolveJobPackId("python"), "python-developer");
  assert.equal(resolveJobPackId(""), undefined);
  assert.equal(resolveJobPackId("nonexistent-role-xyz"), undefined);
});

test("findOfflineEntry returns a relevant entry by keyword overlap", () => {
  const e = findOfflineEntry("data-engineer", "how do you handle schema evolution in pipelines");
  assert.ok(e);
  assert.match(e!.question.toLowerCase(), /schema/);
});

test("findOfflineEntry works with no job type (falls back to common)", () => {
  const e = findOfflineEntry(undefined, "tell me about yourself");
  assert.ok(e);
  assert.match(e!.question.toLowerCase(), /yourself/);
});

test("buildOfflineBackup ALWAYS returns a usable answer without AI", () => {
  const r = buildOfflineBackup({
    jobType: "Backend Engineer",
    experienceLevel: "10+ years",
    manualContext: "how would you design an idempotent API",
  });
  assert.equal(r.providerStatus, "offline");
  assert.ok(r.answer.length > 0);
  assert.ok(r.talkingPoints.length >= 1);
  assert.ok(r.followUpQuestion.length > 0);
  assert.ok(["low", "medium", "high"].includes(r.confidence));
});

test("buildOfflineBackup handles empty context gracefully", () => {
  const r = buildOfflineBackup({ jobType: "SRE", manualContext: "" });
  assert.ok(r.answer.length > 0);
  assert.equal(r.providerStatus, "offline");
});

test("backupQuestion maps action types to prompts", () => {
  assert.match(backupQuestion("talking_points", "REST design"), /talking points/i);
  assert.match(backupQuestion("simplify", "CAP theorem"), /simply/i);
  assert.match(backupQuestion("follow_up", "microservices"), /follow-up/i);
  assert.match(backupQuestion("interview_answer", "leadership"), /interview-style/i);
  assert.equal(backupQuestion("answer", "explain indexing"), "explain indexing");
});

test("offline backup never surfaces private wording", () => {
  const r = buildOfflineBackup({ jobType: "Java Developer", manualContext: "garbage collection tuning" });
  const blob = JSON.stringify(r).toLowerCase();
  assert.ok(!blob.includes("private note"));
  assert.ok(!blob.includes("private draft"));
  assert.ok(!blob.includes("private prompt"));
});
