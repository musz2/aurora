import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, notFound } from "../utils/http.js";

const router = Router();

/**
 * Public viewer endpoint — no auth. Returns ONLY safe, shared data:
 * status, shared transcript, and published notes. Never private AI answers,
 * host controls, settings, or keys. Only resolves if the session is shared.
 */
router.get(
  "/:shareId",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { shareId: req.params.shareId, shared: true },
      select: {
        id: true,
        title: true,
        status: true,
        startedAt: true,
        endedAt: true,
        participants: true,
        publishedNotes: true,
        segments: {
          orderBy: { startTime: "asc" },
          select: {
            id: true,
            speakerName: true,
            text: true,
            startTime: true,
          },
        },
        summary: {
          select: { overview: true, keyPoints: true, decisions: true },
        },
      },
    });
    if (!meeting) throw notFound("Session not found or not shared");

    const live = meeting.status === "RECORDING";
    res.json({
      session: {
        id: req.params.shareId,
        title: meeting.title,
        status: meeting.status,
        live,
        ended: meeting.status === "COMPLETED" || meeting.status === "FAILED",
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt,
        participants: meeting.participants,
        publishedNotes: meeting.publishedNotes,
        segments: meeting.segments,
        summary: live ? null : meeting.summary,
      },
    });
  })
);

export default router;
