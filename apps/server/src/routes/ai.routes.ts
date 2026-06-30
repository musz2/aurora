import { Router } from "express";
import { chatSchema } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, notFound, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../config/entitlements.js";
import {
  answerMeetingQuestion,
  generateFollowUpEmail,
  generateMeetingSummary,
  type MeetingContext,
} from "../services/ai.service.js";

const router = Router();
router.use(requireAuth);

router.post(
  "/chat",
  requireFeature("ai_chat"),
  asyncHandler(async (req, res) => {
    const data = chatSchema.parse(req.body);

    const where =
      data.scope === "current" && data.meetingId
        ? { id: data.meetingId, workspaceId: req.auth!.workspaceId }
        : { workspaceId: req.auth!.workspaceId };

    const meetings = await prisma.meeting.findMany({
      where,
      include: { segments: { orderBy: { startTime: "asc" } }, summary: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const contexts: MeetingContext[] = meetings.map((m) => ({
      meetingId: m.id,
      title: m.title,
      date: m.createdAt.toISOString().slice(0, 10),
      text:
        (m.summary?.overview ? m.summary.overview + "\n" : "") +
        m.segments.map((s) => `${s.speakerName}: ${s.text}`).join("\n"),
    }));

    const result = await answerMeetingQuestion(data.message, contexts);

    await prisma.chatMessage.createMany({
      data: [
        {
          userId: req.auth!.userId,
          workspaceId: req.auth!.workspaceId,
          meetingId: data.meetingId ?? null,
          role: "user",
          content: data.message,
        },
        {
          userId: req.auth!.userId,
          workspaceId: req.auth!.workspaceId,
          meetingId: data.meetingId ?? null,
          role: "assistant",
          content: result.answer,
        },
      ],
    });

    res.json({
      answer: result.answer,
      citations: result.citations,
    });
  })
);

router.post(
  "/summarize",
  requireFeature("advanced_summary"),
  asyncHandler(async (req, res) => {
    const { meetingId } = req.body as { meetingId?: string };
    if (!meetingId) throw badRequest("meetingId is required");
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, workspaceId: req.auth!.workspaceId },
      include: { segments: { orderBy: { startTime: "asc" } } },
    });
    if (!meeting) throw notFound("Meeting not found");
    const summary = await generateMeetingSummary(
      meeting.title,
      meeting.segments.map((s) => ({ speakerName: s.speakerName, text: s.text })),
      [],
      { demoMode: meeting.demoMode }
    );
    res.json({ summary });
  })
);

router.post(
  "/follow-up-email",
  requireFeature("advanced_summary"),
  asyncHandler(async (req, res) => {
    const { meetingId } = req.body as { meetingId?: string };
    if (!meetingId) throw badRequest("meetingId is required");
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, workspaceId: req.auth!.workspaceId },
      include: { summary: true, actionItems: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const email = await generateFollowUpEmail(
      meeting.title,
      {
        overview: meeting.summary?.overview ?? "",
        keyPoints: meeting.summary?.keyPoints ?? [],
        decisions: meeting.summary?.decisions ?? [],
        followUpEmail: meeting.summary?.followUpEmail ?? "",
      },
      meeting.actionItems.map((a) => ({
        assigneeName: a.assigneeName,
        task: a.task,
        dueDate: a.dueDate?.toISOString() ?? null,
        priority: a.priority,
        sourceText: a.sourceText,
      })),
      { demoMode: meeting.demoMode }
    );
    res.json({ email });
  })
);

export default router;
