import { Router } from "express";
import {
  createMeetingSchema,
  transcriptSegmentSchema,
} from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { nanoid } from "nanoid";
import { asyncHandler, notFound, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import {
  serializeMeeting,
  serializeSegment,
} from "../utils/serializers.js";
import {
  extractActionItems,
  generateMeetingSummary,
  type TranscriptLine,
} from "../services/ai.service.js";
import { trackUsage } from "../services/usage.service.js";
import { writeAudit } from "../services/audit.service.js";

const router = Router();
router.use(requireAuth);

const meetingInclude = {
  summary: true,
  segments: { orderBy: { startTime: "asc" as const } },
  actionItems: { include: { meeting: { select: { title: true } } } },
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, q } = req.query as { status?: string; q?: string };
    const meetings = await prisma.meeting.findMany({
      where: {
        workspaceId: req.auth!.workspaceId,
        ...(status ? { status: status as never } : {}),
        ...(q
          ? { title: { contains: q, mode: "insensitive" as const } }
          : {}),
      },
      include: { summary: true, actionItems: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ meetings: meetings.map(serializeMeeting) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createMeetingSchema.parse(req.body);
    const meeting = await prisma.meeting.create({
      data: {
        workspaceId: req.auth!.workspaceId,
        createdById: req.auth!.userId,
        title: data.title,
        description: data.description,
        source: data.source,
        status: "SCHEDULED",
      },
    });
    res.status(201).json({ meeting: serializeMeeting(meeting) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      include: meetingInclude,
    });
    if (!meeting) throw notFound("Meeting not found");
    res.json({ meeting: serializeMeeting(meeting) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { title, description, tags } = req.body as {
      title?: string;
      description?: string;
      tags?: string[];
    };
    const meeting = await prisma.meeting.updateMany({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(tags !== undefined ? { tags } : {}),
      },
    });
    if (meeting.count === 0) throw notFound("Meeting not found");
    const updated = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: meetingInclude,
    });
    res.json({ meeting: serializeMeeting(updated!) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.meeting.deleteMany({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
    });
    if (result.count === 0) throw notFound("Meeting not found");
    res.json({ ok: true });
  })
);

router.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.updateMany({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      data: { status: "RECORDING", startedAt: new Date() },
    });
    if (meeting.count === 0) throw notFound("Meeting not found");
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "meeting.start", {
      meetingId: req.params.id,
    });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/stop",
  asyncHandler(async (req, res) => {
    const existing = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
    });
    if (!existing) throw notFound("Meeting not found");
    const endedAt = new Date();
    const duration = existing.startedAt
      ? Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 1000)
      : existing.duration;
    await prisma.meeting.update({
      where: { id: existing.id },
      data: { status: "PROCESSING", endedAt, duration },
    });
    await trackUsage(
      req.auth!.workspaceId,
      req.auth!.userId,
      existing.id,
      Math.max(1, Math.round(duration / 60))
    );
    res.json({ ok: true });
  })
);

router.post(
  "/:id/summarize",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      include: { segments: { orderBy: { startTime: "asc" } } },
    });
    if (!meeting) throw notFound("Meeting not found");

    const vocab = await prisma.customVocabulary.findMany({
      where: { workspaceId: req.auth!.workspaceId },
      select: { term: true },
    });
    const transcript: TranscriptLine[] = meeting.segments.map((s) => ({
      speakerName: s.speakerName,
      text: s.text,
    }));

    const [summary, items] = await Promise.all([
      generateMeetingSummary(
        meeting.title,
        transcript,
        vocab.map((v) => v.term)
      ),
      extractActionItems(transcript),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.meetingSummary.upsert({
        where: { meetingId: meeting.id },
        create: {
          meetingId: meeting.id,
          overview: summary.overview,
          keyPoints: summary.keyPoints,
          decisions: summary.decisions,
          followUpEmail: summary.followUpEmail,
        },
        update: {
          overview: summary.overview,
          keyPoints: summary.keyPoints,
          decisions: summary.decisions,
          followUpEmail: summary.followUpEmail,
        },
      });
      await tx.actionItem.deleteMany({ where: { meetingId: meeting.id } });
      for (const item of items) {
        await tx.actionItem.create({
          data: {
            meetingId: meeting.id,
            assigneeName: item.assigneeName,
            task: item.task,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            priority: item.priority,
            sourceText: item.sourceText,
          },
        });
      }
      await tx.meeting.update({
        where: { id: meeting.id },
        data: { status: "COMPLETED" },
      });
    });

    const full = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: meetingInclude,
    });
    res.json({ meeting: serializeMeeting(full!) });
  })
);

/* ----------------------------- Transcripts ----------------------------- */

router.get(
  "/:id/transcript",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const segments = await prisma.transcriptSegment.findMany({
      where: { meetingId: req.params.id },
      orderBy: { startTime: "asc" },
    });
    res.json({ segments: segments.map(serializeSegment) });
  })
);

router.post(
  "/:id/transcript",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const data = transcriptSegmentSchema.parse(req.body);
    const segment = await prisma.transcriptSegment.create({
      data: { meetingId: req.params.id, ...data },
    });
    res.status(201).json({ segment: serializeSegment(segment) });
  })
);

/* ----------------------------- Sharing ----------------------------- */

router.post(
  "/:id/share",
  asyncHandler(async (req, res) => {
    const enable = req.body?.shared !== false;
    const existing = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true, shareId: true },
    });
    if (!existing) throw notFound("Meeting not found");
    const shareId =
      existing.shareId ?? `s_${nanoid(12)}`;
    await prisma.meeting.update({
      where: { id: existing.id },
      data: { shared: enable, shareId: enable ? shareId : existing.shareId },
    });
    res.json({ shared: enable, shareId: enable ? shareId : null });
  })
);

router.post(
  "/:id/notes",
  asyncHandler(async (req, res) => {
    const note = (req.body?.note as string)?.trim();
    if (!note) throw badRequest("note is required");
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true, publishedNotes: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const publishedNotes = [...meeting.publishedNotes, note];
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { publishedNotes },
    });
    res.json({ publishedNotes });
  })
);

export default router;
