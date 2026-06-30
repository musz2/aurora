import { Router } from "express";
import { updateActionItemSchema } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, notFound, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../config/entitlements.js";
import { serializeActionItem } from "../utils/serializers.js";
import { extractActionItems } from "../services/ai.service.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, assignee } = req.query as {
      status?: string;
      assignee?: string;
    };
    const items = await prisma.actionItem.findMany({
      where: {
        meeting: { workspaceId: req.auth!.workspaceId },
        ...(status ? { status: status as never } : {}),
        ...(assignee
          ? {
              assigneeName: {
                contains: assignee,
                mode: "insensitive" as const,
              },
            }
          : {}),
      },
      include: { meeting: { select: { title: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
    res.json({ actionItems: items.map(serializeActionItem) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = updateActionItemSchema.parse(req.body);
    const existing = await prisma.actionItem.findFirst({
      where: { id: req.params.id, meeting: { workspaceId: req.auth!.workspaceId } },
    });
    if (!existing) throw notFound("Action item not found");
    const updated = await prisma.actionItem.update({
      where: { id: req.params.id },
      data: {
        ...(data.task !== undefined ? { task: data.task } : {}),
        ...(data.assigneeName !== undefined
          ? { assigneeName: data.assigneeName }
          : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.dueDate !== undefined
          ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
          : {}),
      },
      include: { meeting: { select: { title: true } } },
    });
    res.json({ actionItem: serializeActionItem(updated) });
  })
);

router.post(
  "/extract",
  requireFeature("ai_chat"),
  asyncHandler(async (req, res) => {
    const { meetingId } = req.body as { meetingId?: string };
    if (!meetingId) throw badRequest("meetingId is required");
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, workspaceId: req.auth!.workspaceId },
      include: { segments: { orderBy: { startTime: "asc" } } },
    });
    if (!meeting) throw notFound("Meeting not found");
    const items = await extractActionItems(
      meeting.segments.map((s) => ({ speakerName: s.speakerName, text: s.text })),
      { demoMode: meeting.demoMode }
    );
    const created = await prisma.$transaction(
      items.map((item) =>
        prisma.actionItem.create({
          data: {
            meetingId,
            assigneeName: item.assigneeName,
            task: item.task,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            priority: item.priority,
            sourceText: item.sourceText,
          },
          include: { meeting: { select: { title: true } } },
        })
      )
    );
    res.status(201).json({ actionItems: created.map(serializeActionItem) });
  })
);

export default router;
