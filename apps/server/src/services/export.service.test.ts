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

test("export route helpers create safe attachment headers", () => {
  assert.equal(safeExportFilename("Launch sync: Q3!", "pdf"), "Launch-sync-Q3.pdf");
  const result = exportMeeting(sampleMeeting(), "json");
  const headers = exportResponseHeaders("Launch sync", result);
  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers["Content-Disposition"], 'attachment; filename="Launch-sync.json"');
});
