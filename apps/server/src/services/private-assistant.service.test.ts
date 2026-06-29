import test from "node:test";
import assert from "node:assert/strict";
import {
  ASSISTANT_MODES,
  CONFIDENCE_LEVELS,
  buildStructuredSuggestion,
  detectQuestions,
  generateMockPrivateSuggestion,
  normalizeAssistantMode,
  parseAssistantIntent,
  renderSuggestionText,
} from "./private-assistant.service.js";

test("detectQuestions extracts explicit and implicit transcript questions", () => {
  const questions = detectQuestions(
    "Status is green. What is the deployment risk? Can we ship Friday"
  );
  assert.equal(questions.length, 2);
  assert.equal(questions[0].question, "What is the deployment risk?");
  assert.equal(questions[1].question, "Can we ship Friday?");
});

test("normalizeAssistantMode falls back safely and includes General Meeting", () => {
  assert.equal(normalizeAssistantMode("Sales Call"), "Sales Call");
  assert.equal(normalizeAssistantMode("General Meeting"), "General Meeting");
  assert.equal(normalizeAssistantMode("Unknown"), "Technical Meeting");
  assert.ok(ASSISTANT_MODES.includes("General Meeting"));
});

test("parseAssistantIntent recognizes special triggers", () => {
  assert.equal(parseAssistantIntent("Summarize the last 2 minutes"), "summarize_recent");
  assert.equal(parseAssistantIntent("What should I say next?"), "next_step");
  assert.equal(parseAssistantIntent("Give me the answer now"), "answer_now");
  assert.equal(parseAssistantIntent("How does pricing work?"), "answer");
});

test("buildStructuredSuggestion returns every response component", () => {
  const s = buildStructuredSuggestion({
    mode: "Interview",
    question: "How do you handle conflict?",
    context: { recentTranscript: "Alex: tell me about a conflict?" },
  });
  assert.ok(s.answer.length > 0);
  assert.ok(s.talkingPoints.length >= 2);
  assert.ok(s.followUpQuestion.length > 0);
  assert.ok(s.risk.length > 0);
  assert.ok(s.nextStep.length > 0);
  assert.ok((CONFIDENCE_LEVELS as readonly string[]).includes(s.confidence));
  assert.equal(s.mode, "Interview");
});

test("summarize_recent intent summarizes recent transcript", () => {
  const s = buildStructuredSuggestion({
    mode: "General Meeting",
    question: "summarize the last 2 minutes",
    intent: "summarize_recent",
    context: { recentTranscript: "Alex: we shipped the API.\nSam: migration is next." },
  });
  assert.equal(s.intent, "summarize_recent");
  assert.match(s.answer, /Recent recap/);
});

test("confidence rises with context and explicit questions", () => {
  const low = buildStructuredSuggestion({ mode: "General Meeting", question: "pricing" });
  const high = buildStructuredSuggestion({
    mode: "General Meeting",
    question: "What is the price?",
    context: { recentTranscript: "Customer: what does it cost?" },
  });
  assert.equal(low.confidence, "low");
  assert.equal(high.confidence, "high");
});

test("generateMockPrivateSuggestion renders a readable, mode-aware string", () => {
  const text = generateMockPrivateSuggestion({
    mode: "Interview",
    question: "How do you handle conflict?",
  });
  assert.match(text, /STAR-style/); // mode guidance
  assert.match(text, /Answer:/);
  assert.match(text, /Confidence:/);
});

test("renderSuggestionText includes all sections", () => {
  const text = renderSuggestionText(
    buildStructuredSuggestion({ mode: "Sales Call", question: "What is the ROI?" })
  );
  for (const label of ["Answer:", "Talking points:", "Follow-up:", "Risk:", "Next step:", "Confidence:"]) {
    assert.ok(text.includes(label), `missing ${label}`);
  }
});
