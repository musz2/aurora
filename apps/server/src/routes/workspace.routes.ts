import { Router } from "express";
import bcrypt from "bcryptjs";
import { inviteMemberSchema, vocabularySchema } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, notFound } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../config/entitlements.js";
import { writeAudit } from "../services/audit.service.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const ws = await prisma.workspace.findUnique({
      where: { id: req.auth!.workspaceId },
      include: { subscription: true },
    });
    if (!ws) throw notFound("Workspace not found");
    res.json({ workspace: ws });
  })
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const {
      name,
      requireConsent,
      allPartyConsent,
      visibleIndicator,
      dataRetentionDays,
    } = req.body as Record<string, unknown>;
    const ws = await prisma.workspace.update({
      where: { id: req.auth!.workspaceId },
      data: {
        ...(typeof name === "string" ? { name } : {}),
        ...(typeof requireConsent === "boolean" ? { requireConsent } : {}),
        ...(typeof allPartyConsent === "boolean" ? { allPartyConsent } : {}),
        ...(typeof visibleIndicator === "boolean" ? { visibleIndicator } : {}),
        ...(typeof dataRetentionDays === "number" ? { dataRetentionDays } : {}),
      },
    });
    res.json({ workspace: ws });
  })
);

router.get(
  "/members",
  requireFeature("team_workspace"),
  asyncHandler(async (req, res) => {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: req.auth!.workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        user: m.user,
      })),
    });
  })
);

router.post(
  "/invite",
  requireFeature("team_workspace"),
  asyncHandler(async (req, res) => {
    const data = inviteMemberSchema.parse(req.body);
    const email = data.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Create a placeholder invited user with a random password.
      user = await prisma.user.create({
        data: {
          name: email.split("@")[0],
          email,
          passwordHash: await bcrypt.hash(`invite-${Date.now()}`, 10),
          role: data.role,
        },
      });
    }
    const member = await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: { userId: user.id, workspaceId: req.auth!.workspaceId },
      },
      create: {
        userId: user.id,
        workspaceId: req.auth!.workspaceId,
        role: data.role,
        status: "INVITED",
      },
      update: { role: data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "member.invite", {
      email,
    });
    res.status(201).json({ member });
  })
);

router.get(
  "/vocabulary",
  requireFeature("custom_vocabulary"),
  asyncHandler(async (req, res) => {
    const terms = await prisma.customVocabulary.findMany({
      where: { workspaceId: req.auth!.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ vocabulary: terms });
  })
);

router.post(
  "/vocabulary",
  requireFeature("custom_vocabulary"),
  asyncHandler(async (req, res) => {
    const data = vocabularySchema.parse(req.body);
    const term = await prisma.customVocabulary.create({
      data: { workspaceId: req.auth!.workspaceId, ...data },
    });
    res.status(201).json({ term });
  })
);

router.delete(
  "/vocabulary/:id",
  requireFeature("custom_vocabulary"),
  asyncHandler(async (req, res) => {
    const result = await prisma.customVocabulary.deleteMany({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
    });
    if (result.count === 0) throw notFound("Term not found");
    res.json({ ok: true });
  })
);

export default router;
