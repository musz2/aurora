import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { writeAudit } from "../services/audit.service.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const wsId = req.auth!.workspaceId;
    const [meetings, users, audits, usage, retention] = await Promise.all([
      prisma.meeting.count({ where: { workspaceId: wsId } }),
      prisma.workspaceMember.count({ where: { workspaceId: wsId } }),
      prisma.auditLog.findMany({
        where: { workspaceId: wsId },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.usageRecord.aggregate({
        where: { workspaceId: wsId },
        _sum: { transcriptionMinutes: true },
      }),
      prisma.workspace.findUnique({
        where: { id: wsId },
        select: {
          requireConsent: true,
          allPartyConsent: true,
          visibleIndicator: true,
          dataRetentionDays: true,
        },
      }),
    ]);
    res.json({
      counts: { meetings, users },
      transcriptionMinutes: usage._sum.transcriptionMinutes ?? 0,
      retention,
      audits: audits.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  })
);

router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const logs = await prisma.auditLog.findMany({
      where: { workspaceId: req.auth!.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })) });
  })
);

router.post(
  "/retention/apply",
  asyncHandler(async (req, res) => {
    const ws = await prisma.workspace.findUnique({
      where: { id: req.auth!.workspaceId },
      select: { dataRetentionDays: true },
    });
    const days = ws?.dataRetentionDays ?? 0;
    if (days <= 0) return res.json({ deletedMeetings: 0, message: "Retention is disabled." });
    const cutoff = new Date(Date.now() - days * 86400000);
    const deleted = await prisma.meeting.deleteMany({
      where: { workspaceId: req.auth!.workspaceId, createdAt: { lt: cutoff } },
    });
    res.json({ deletedMeetings: deleted.count, cutoff: cutoff.toISOString() });
  })
);

router.get(
  "/user-data/export",
  asyncHandler(async (req, res) => {
    const [user, meetings, actionItems, chatMessages] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.auth!.userId },
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      prisma.meeting.findMany({
        where: { workspaceId: req.auth!.workspaceId, createdById: req.auth!.userId },
        include: { summary: true, segments: true, actionItems: true },
      }),
      prisma.actionItem.findMany({ where: { assigneeUserId: req.auth!.userId } }),
      prisma.chatMessage.findMany({ where: { userId: req.auth!.userId } }),
    ]);
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "data_export_requested", {
      scope: "user",
    });
    res.json({ exportedAt: new Date().toISOString(), user, meetings, actionItems, chatMessages });
  })
);

router.delete(
  "/user-data",
  asyncHandler(async (req, res) => {
    await prisma.$transaction([
      prisma.chatMessage.deleteMany({ where: { userId: req.auth!.userId } }),
      prisma.privateAssistSuggestion.deleteMany({ where: { userId: req.auth!.userId } }),
    ]);
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "data_delete_requested", {
      scope: "private_assistant_and_chat",
    });
    res.json({
      ok: true,
      message:
        "Private assistant suggestions and chat history deleted. Workspace meeting records remain under workspace retention controls.",
    });
  })
);

export default router;
