import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, cleanSegments } from "./transcript-cleanup.service.js";

test("cleanText removes isolated filler words but preserves meaning", () => {
  const out = cleanText("um so I think uh we should ship it");
  assert.ok(!/\bum\b/i.test(out));
  assert.ok(!/\buh\b/i.test(out));
  assert.match(out, /I think we should ship it/);
});

test("cleanText fixes spacing and punctuation", () => {
  assert.equal(cleanText("hello , world"), "Hello, world.");
  assert.equal(cleanText("yes.no way"), "Yes. No way.");
});

test("cleanText de-duplicates immediate repeated words", () => {
  assert.equal(cleanText("the the plan is is good"), "The plan is good.");
});

test("cleanText applies sentence casing and terminal punctuation", () => {
  // Statement gets a period.
  assert.equal(cleanText("we should ship it"), "We should ship it.");
  // Question-word opener gets a question mark (meaning-preserving, not invented).
  assert.equal(cleanText("can you introduce yourself"), "Can you introduce yourself?");
  const q = cleanText("what is your name?");
  assert.equal(q, "What is your name?");
});

test("cleanText preserves existing capitals (names) and questions", () => {
  const out = cleanText("yes. I am a Python developer");
  assert.match(out, /Python/); // not lowercased
  assert.match(out, /^Yes\. I am a Python developer\.$/);
});

test("cleanText never invents content and keeps it non-empty-safe", () => {
  assert.equal(cleanText(""), "");
  assert.equal(cleanText("   "), "");
  // A single meaningful word gets a period but no new words.
  assert.equal(cleanText("okay"), "Okay.");
});

test("cleanSegments preserves original text and order, adds cleanText", () => {
  const raw = [
    { speakerName: "Speaker 1", text: "um hello  there", startTime: 0 },
    { speakerName: "Speaker 2", text: "yes yes indeed", startTime: 3 },
  ];
  const cleaned = cleanSegments(raw);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].text, "um hello  there"); // original preserved
  assert.equal(cleaned[0].cleanText, "Hello there.");
  assert.equal(cleaned[1].cleanText, "Yes indeed.");
  assert.equal(cleaned[0].startTime, 0);
});
