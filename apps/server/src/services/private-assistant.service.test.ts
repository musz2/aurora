import test from "node:test";
import assert from "node:assert/strict";
import {
  detectQuestions,
  generateMockPrivateSuggestion,
  normalizeAssistantMode,
} from "./private-assistant.service.js";

test("detectQuestions extracts explicit and implicit transcript questions", () => {
  const questions = detectQuestions(
    "Status is green. What is the deployment risk? Can we ship Friday"
  );
  assert.equal(questions.length, 2);
  assert.equal(questions[0].question, "What is the deployment risk?");
  assert.equal(questions[1].question, "Can we ship Friday?");
});

test("normalizeAssistantMode falls back safely", () => {
  assert.equal(normalizeAssistantMode("Sales Call"), "Sales Call");
  assert.equal(normalizeAssistantMode("Unknown"), "Technical Meeting");
});

test("generateMockPrivateSuggestion is mode aware and private-ready", () => {
  const suggestion = generateMockPrivateSuggestion({
    mode: "Interview",
    question: "How do you handle conflict?",
  });
  assert.match(suggestion, /STAR-style/);
  assert.match(suggestion, /Suggested answer/);
});
