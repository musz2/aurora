import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSavedTranscript,
  renderSavedTranscriptMarkdown,
  formatTimestamp,
  type SavedTranscriptInput,
} from "./saved-transcript.service.js";

const input: SavedTranscriptInput = {
  title: "Technical Interview",
  source: "Live Meeting",
  durationSeconds: 32 * 60,
  dateISO: "2026-07-01T10:00:00.000Z",
  segments: [
    { speakerName: "Speaker 1", text: "can you introduce yourself", startTime: 1 },
    {
      speakerName: "Speaker 2",
      text: "yes I am a Python developer building backend APIs",
      startTime: 6,
    },
  ],
  summary: {
    overview: "The meeting focused on the candidate's backend experience.",
    keyPoints: ["Python backend", "API design"],
    decisions: ["Follow-up technical round recommended"],
  },
  actionItems: [{ task: "Schedule next interview", assigneeName: "Recruiter", dueDate: "2026-07-06" }],
  publishedAnswers: [
    { text: "Shared explanation of our stack", publishedBy: "Host", createdAt: "2026-07-01T10:10:00.000Z" },
  ],
};

test("formatTimestamp renders mm:ss and hh:mm:ss", () => {
  assert.equal(formatTimestamp(6), "00:06");
  assert.equal(formatTimestamp(75), "01:15");
  assert.equal(formatTimestamp(3661), "01:01:01");
});

test("buildSavedTranscript keeps raw + adds clean transcript, preserving meaning", () => {
  const t = buildSavedTranscript(input);
  assert.equal(t.rawTranscript[0].text, "can you introduce yourself"); // raw preserved
  assert.equal(t.cleanTranscript[0].text, "Can you introduce yourself?"); // cleaned
  assert.deepEqual(t.speakers, ["Speaker 1", "Speaker 2"]);
  assert.equal(t.durationLabel, "32 minutes");
});

test("buildSavedTranscript derives Q&A from question + next speaker's answer", () => {
  const t = buildSavedTranscript(input);
  assert.equal(t.qna.length, 1);
  assert.match(t.qna[0].question, /introduce yourself/i);
  assert.match(t.qna[0].answer, /Python developer/i);
  assert.equal(t.qna[0].timestamp, "00:01");
});

test("buildSavedTranscript prefers persisted cleanText when present", () => {
  const t = buildSavedTranscript({
    ...input,
    segments: [{ speakerName: "Speaker 1", text: "raw msgs", cleanText: "Curated clean line.", startTime: 0 }],
  });
  assert.equal(t.cleanTranscript[0].text, "Curated clean line.");
  assert.equal(t.rawTranscript[0].text, "raw msgs");
});

test("markdown render includes all sections and host-shared answers", () => {
  const md = renderSavedTranscriptMarkdown(buildSavedTranscript(input));
  assert.match(md, /# Meeting Transcript/);
  assert.match(md, /\*\*Meeting:\*\* Technical Interview/);
  assert.match(md, /## Summary/);
  assert.match(md, /## Clean Transcript/);
  assert.match(md, /## Key Questions & Answers/);
  assert.match(md, /## Decisions \/ Outcome/);
  assert.match(md, /## Action Items/);
  assert.match(md, /## Host Shared Answers/);
  assert.match(md, /Schedule next interview \(Recruiter\) due 2026-07-06/);
});

test("saved transcript never contains private fields (structural guarantee)", () => {
  // The builder only accepts summary/segments/actionItems/publishedAnswers —
  // there is no channel for private drafts/notes. Prove none leak into markdown.
  const md = renderSavedTranscriptMarkdown(buildSavedTranscript(input));
  assert.ok(!/private/i.test(md));
  assert.ok(!/draft/i.test(md));
});

test("markdown is honest when AI summary is missing", () => {
  const md = renderSavedTranscriptMarkdown(
    buildSavedTranscript({ ...input, summary: null })
  );
  assert.match(md, /No summary available.*AI provider/i);
});
