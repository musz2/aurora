/**
 * Background processing worker (scaffold).
 *
 * In production, recording uploads and post-meeting summarization would be
 * enqueued (e.g. BullMQ on Redis) and processed here so the API stays responsive.
 * For the demo, summarization runs inline in the request handlers. This file
 * documents the intended worker boundary and can be wired to a queue later.
 */
import { prisma } from "../lib/prisma.js";
import {
  extractActionItems,
  generateMeetingSummary,
} from "../services/ai.service.js";

export async function processMeeting(meetingId: string): Promise<void> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { segments: { orderBy: { startTime: "asc" } } },
  });
  if (!meeting) return;

  const lines = meeting.segments.map((s) => ({
    speakerName: s.speakerName,
    text: s.text,
  }));
  const [summary, items] = await Promise.all([
    generateMeetingSummary(meeting.title, lines, [], {
      demoMode: meeting.demoMode,
    }),
    extractActionItems(lines, { demoMode: meeting.demoMode }),
  ]);

  await prisma.meetingSummary.upsert({
    where: { meetingId },
    create: { meetingId, ...summary },
    update: { ...summary },
  });
  await prisma.actionItem.deleteMany({ where: { meetingId } });
  for (const item of items) {
    await prisma.actionItem.create({
      data: {
        meetingId,
        assigneeName: item.assigneeName,
        task: item.task,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        priority: item.priority,
        sourceText: item.sourceText,
      },
    });
  }
  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "COMPLETED" },
  });
}
