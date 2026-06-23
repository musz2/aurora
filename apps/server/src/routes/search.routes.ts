import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = ((req.query.q as string) ?? "").trim();
    if (!q) {
      return res.json({ meetings: [], segments: [], actionItems: [] });
    }
    const wsId = req.auth!.workspaceId;
    const ci = { contains: q, mode: "insensitive" as const };

    const [meetings, segments, actionItems, summaries] = await Promise.all([
      prisma.meeting.findMany({
        where: {
          workspaceId: wsId,
          OR: [{ title: ci }, { description: ci }],
        },
        select: { id: true, title: true, createdAt: true, status: true },
        take: 20,
      }),
      prisma.transcriptSegment.findMany({
        where: { meeting: { workspaceId: wsId }, text: ci },
        select: {
          id: true,
          text: true,
          speakerName: true,
          meetingId: true,
          meeting: { select: { title: true } },
        },
        take: 20,
      }),
      prisma.actionItem.findMany({
        where: { meeting: { workspaceId: wsId }, task: ci },
        select: {
          id: true,
          task: true,
          status: true,
          meetingId: true,
          meeting: { select: { title: true } },
        },
        take: 20,
      }),
      prisma.meetingSummary.findMany({
        where: {
          meeting: { workspaceId: wsId },
          OR: [{ overview: ci }, { decisions: { has: q } }],
        },
        select: {
          id: true,
          overview: true,
          meetingId: true,
          meeting: { select: { title: true } },
        },
        take: 20,
      }),
    ]);

    res.json({
      query: q,
      meetings: meetings.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
      segments,
      actionItems,
      summaries,
    });
  })
);

export default router;
