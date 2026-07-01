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
  questionForAssistAction,
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

test("Leadership Meeting is a supported mode with full structured guidance", () => {
  assert.ok(ASSISTANT_MODES.includes("Leadership Meeting"));
  assert.equal(normalizeAssistantMode("Leadership Meeting"), "Leadership Meeting");
  const s = buildStructuredSuggestion({
    mode: "Leadership Meeting",
    question: "Should we cut the Q3 roadmap?",
  });
  assert.equal(s.mode, "Leadership Meeting");
  assert.ok(s.answer.length > 0);
  assert.ok(s.talkingPoints.length >= 2);
  assert.ok(s.risk.length > 0);
});

test("questionForAssistAction: custom prompt wins, quick actions map, latest is null", () => {
  // Custom prompt always wins, even with an action type set.
  assert.equal(
    questionForAssistAction("summarize_2min", "Answer this for the client"),
    "Answer this for the client"
  );
  // Fixed quick actions map to a stable prompt.
  assert.match(questionForAssistAction("summarize_2min", "")!, /last 2 minutes/i);
  assert.match(questionForAssistAction("risks", undefined)!, /risks/i);
  assert.match(questionForAssistAction("action_items", "")!, /action items/i);
  assert.match(questionForAssistAction("talking_points", "")!, /talking points/i);
  assert.match(questionForAssistAction("follow_up", "")!, /follow-up/i);
  // answer_latest defers to transcript detection (null).
  assert.equal(questionForAssistAction("answer_latest", ""), null);
  // Unknown/no action with no prompt → a safe default (not null).
  assert.ok(questionForAssistAction(undefined, "")!.length > 0);
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
