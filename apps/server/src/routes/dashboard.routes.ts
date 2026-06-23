import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { getUsageSummary } from "../services/usage.service.js";
import { serializeMeeting, serializeActionItem } from "../utils/serializers.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const wsId = req.auth!.workspaceId;
    const [recent, upcoming, myItems, usage, counts] = await Promise.all([
      prisma.meeting.findMany({
        where: { workspaceId: wsId, status: { in: ["COMPLETED", "PROCESSING"] } },
        include: { summary: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.meeting.findMany({
        where: { workspaceId: wsId, status: "SCHEDULED" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.actionItem.findMany({
        where: {
          meeting: { workspaceId: wsId },
          status: { not: "DONE" },
        },
        include: { meeting: { select: { title: true } } },
        orderBy: { dueDate: "asc" },
        take: 6,
      }),
      getUsageSummary(wsId),
      prisma.meeting.count({ where: { workspaceId: wsId } }),
    ]);

    res.json({
      recentMeetings: recent.map(serializeMeeting),
      upcomingMeetings: upcoming.map(serializeMeeting),
      myActionItems: myItems.map(serializeActionItem),
      usage,
      totalMeetings: counts,
    });
  })
);

router.get(
  "/usage",
  asyncHandler(async (req, res) => {
    res.json({ usage: await getUsageSummary(req.auth!.workspaceId) });
  })
);

export default router;
