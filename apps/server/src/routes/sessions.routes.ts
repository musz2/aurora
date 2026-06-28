import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, notFound } from "../utils/http.js";
import { sanitizePublicSession } from "../services/shared-viewer.service.js";

const router = Router();

/**
 * Public viewer endpoint — no auth. Returns ONLY safe, shared data:
 * status, shared transcript, published notes, and safe summary fields. Never
 * selects private assist suggestions, host controls, settings, or keys. Only
 * resolves if the session is shared.
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

    // All public-facing fields go through the sanitization service (allow-list).
    // This guarantees private assistant suggestions/notes can never leak here.
    res.json({ session: sanitizePublicSession(meeting, req.params.shareId) });
  })
);

export default router;
