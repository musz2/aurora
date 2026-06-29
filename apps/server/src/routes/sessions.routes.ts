import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, notFound } from "../utils/http.js";
import {
  isShareActive,
  sanitizePublicSession,
} from "../services/shared-viewer.service.js";
import { writeAudit } from "../services/audit.service.js";

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
        // workspaceId is selected for server-side audit only; it is NEVER copied
        // into the public payload by sanitizePublicSession (allow-list).
        workspaceId: true,
        title: true,
        status: true,
        shared: true,
        shareExpiresAt: true,
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
    // Honor share revoke + expiry: a revoked or expired link must not resolve.
    if (!isShareActive(meeting)) throw notFound("This share link is no longer active");

    // Viewer access audit (no auth user — system-recorded against the workspace).
    await writeAudit(meeting.workspaceId, null, "session_viewed", {
      meetingId: meeting.id,
      shareId: req.params.shareId,
    });

    // All public-facing fields go through the sanitization service (allow-list).
    // This guarantees private assistant suggestions/notes can never leak here.
    res.json({ session: sanitizePublicSession(meeting, req.params.shareId) });
  })
);

export default router;
