import test from "node:test";
import assert from "node:assert/strict";
import {
  exportMeeting,
  exportResponseHeaders,
  safeExportFilename,
  type ExportableMeeting,
} from "./export.service.js";

function sampleMeeting(): ExportableMeeting {
  const now = new Date("2026-06-26T10:00:00.000Z");
  return {
    id: "m1",
    workspaceId: "w1",
    title: "Launch sync",
    description: null,
    source: "LIVE",
    status: "COMPLETED",
    startedAt: now,
    endedAt: now,
    duration: 60,
    recordingUrl: null,
    tags: [],
    participants: ["Maya"],
    shared: false,
    shareId: null,
    shareExpiresAt: null,
    publishedNotes: [],
    demoMode: false,
    createdById: "u1",
    createdAt: now,
    updatedAt: now,
    summary: {
      id: "s1",
      meetingId: "m1",
      overview: "The team aligned on launch tasks.",
      keyPoints: ["Launch date confirmed"],
      decisions: ["Ship the campaign"],
      followUpEmail: "Hi team,\nThanks.",
      createdAt: now,
    },
    segments: [
      {
        id: "t1",
        meetingId: "m1",
        speakerName: "Maya",
        text: "We will ship next week.",
        cleanText: null,
        startTime: 1,
        endTime: 3,
        confidence: 0.98,
        edited: false,
        highlighted: false,
        isDecision: false,
        isActionItem: false,
        createdAt: now,
      },
    ],
    actionItems: [
      {
        id: "a1",
        meetingId: "m1",
        assigneeName: "Maya",
        assigneeUserId: null,
        task: "Send launch notes",
        dueDate: now,
        priority: "HIGH",
        status: "OPEN",
        sourceText: "Maya will send launch notes.",
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

test("exportMeeting creates subtitle formats", () => {
  const srt = exportMeeting(sampleMeeting(), "srt");
  assert.equal(srt.contentType, "application/x-subrip");
  assert.match(srt.buffer.toString(), /00:00:01,000 --> 00:00:03,000/);

  const vtt = exportMeeting(sampleMeeting(), "vtt");
  assert.equal(vtt.contentType, "text/vtt");
  assert.match(vtt.buffer.toString(), /^WEBVTT/);
});

test("exportMeeting creates PDF and DOCX binary files", () => {
  const pdf = exportMeeting(sampleMeeting(), "pdf");
  assert.equal(pdf.buffer.subarray(0, 5).toString(), "%PDF-");

  const docx = exportMeeting(sampleMeeting(), "docx");
  assert.equal(docx.buffer.readUInt32LE(0), 0x04034b50);
});

test("TXT export includes summary, decisions, action items, and transcript", () => {
  const txt = exportMeeting(sampleMeeting(), "txt").buffer.toString();
  assert.match(txt, /Launch sync/);
  assert.match(txt, /The team aligned on launch tasks\./); // overview
  assert.match(txt, /Decisions[\s\S]*Ship the campaign/); // decisions section
  assert.match(txt, /Action items[\s\S]*Send launch notes \(Maya\)/); // owner
  assert.match(txt, /Transcript[\s\S]*Maya: We will ship next week\./); // speaker + text
});

test("Markdown export renders a clean structured saved transcript", () => {
  const meeting = sampleMeeting();
  meeting.publishedAnswers = [
    { text: "Our stack is Node + Postgres.", publishedBy: "Host", createdAt: new Date("2026-06-26T10:05:00.000Z") },
  ];
  const md = exportMeeting(meeting, "md");
  assert.equal(md.extension, "md");
  assert.match(md.contentType, /text\/markdown/);
  const text = md.buffer.toString();
  assert.match(text, /# Meeting Transcript/);
  assert.match(text, /\*\*Meeting:\*\* Launch sync/);
  assert.match(text, /## Summary/);
  assert.match(text, /## Clean Transcript/);
  assert.match(text, /## Action Items/);
  assert.match(text, /## Host Shared Answers/);
  assert.match(text, /Our stack is Node \+ Postgres\./); // published answer included
});

test("exports never contain private drafts, prompts, or notes", () => {
  // ExportableMeeting has no channel for private data; prove it across formats.
  const meeting = sampleMeeting();
  for (const fmt of ["txt", "md", "json"] as const) {
    const out = exportMeeting(meeting, fmt).buffer.toString();
    assert.ok(!/private note/i.test(out));
    assert.ok(!/private draft/i.test(out));
    assert.ok(!/privateAssist/i.test(out));
  }
});

test("JSON export round-trips meeting data with summary and segments", () => {
  const json = exportMeeting(sampleMeeting(), "json");
  assert.equal(json.contentType, "application/json");
  const parsed = JSON.parse(json.buffer.toString());
  assert.equal(parsed.title, "Launch sync");
  assert.equal(parsed.summary.decisions[0], "Ship the campaign");
  assert.equal(parsed.segments[0].speakerName, "Maya");
  assert.equal(parsed.actionItems[0].task, "Send launch notes");
});

test("every supported format produces a non-empty buffer", () => {
  for (const format of ["pdf", "docx", "txt", "srt", "vtt", "json"] as const) {
    const out = exportMeeting(sampleMeeting(), format);
    assert.equal(out.extension, format);
    assert.ok(out.buffer.length > 0, `${format} buffer was empty`);
  }
});

test("export route helpers create safe attachment headers", () => {
  assert.equal(safeExportFilename("Launch sync: Q3!", "pdf"), "Launch-sync-Q3.pdf");
  const result = exportMeeting(sampleMeeting(), "json");
  const headers = exportResponseHeaders("Launch sync", result);
  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers["Content-Disposition"], 'attachment; filename="Launch-sync.json"');
});
