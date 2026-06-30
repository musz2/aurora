import { Router } from "express";
import bcrypt from "bcryptjs";
import { loginSchema, signupSchema, PLANS } from "@aurora/shared";
import { isDeveloperBypassUser } from "../config/entitlements.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, badRequest, unauthorized } from "../utils/http.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function buildAuthUser(userId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { workspace: true, user: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member) return null;
  return {
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    avatarUrl: member.user.avatarUrl,
    role: member.role,
    workspaceId: member.workspaceId,
    workspaceName: member.workspace.name,
    plan: member.workspace.plan,
  };
}

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const data = signupSchema.parse(req.body);
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) throw badRequest("An account with that email already exists");

    const passwordHash = await bcrypt.hash(data.password, 10);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          passwordHash,
          role: "OWNER",
        },
      });
      const workspace = await tx.workspace.create({
        data: {
          name: data.workspaceName ?? `${data.name.split(" ")[0]}'s Workspace`,
          plan: "BASIC",
        },
      });
      await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      await tx.billingSubscription.create({
        data: { workspaceId: workspace.id, plan: "BASIC", status: "ACTIVE" },
      });
      return { user, workspace };
    });

    const authUser = await buildAuthUser(result.user.id);
    const payload = {
      userId: result.user.id,
      workspaceId: result.workspace.id,
      role: "OWNER",
      email: result.user.email,
      plan: authUser?.plan ?? "BASIC",
    };
    res.status(201).json({
      user: authUser,
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (!user) throw unauthorized("Invalid email or password");
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) throw unauthorized("Invalid email or password");

    const authUser = await buildAuthUser(user.id);
    if (!authUser) throw unauthorized("No workspace found for this user");

    const payload = {
      userId: user.id,
      workspaceId: authUser.workspaceId,
      role: authUser.role,
      email: user.email,
      plan: authUser.plan,
    };
    res.json({
      user: authUser,
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken as string | undefined;
    if (!token) throw badRequest("Missing refresh token");
    try {
      const payload = verifyRefreshToken(token);
      const authUser = await buildAuthUser(payload.userId);
      if (!authUser) throw unauthorized();
      const next = {
        userId: payload.userId,
        workspaceId: authUser.workspaceId,
        role: authUser.role,
        email: authUser.email,
        plan: authUser.plan,
      };
      res.json({
        user: authUser,
        accessToken: signAccessToken(next),
        refreshToken: signRefreshToken(next),
      });
    } catch {
      throw unauthorized("Invalid refresh token");
    }
  })
);

router.post("/logout", (_req, res) => {
  // Stateless JWT — client discards tokens. Endpoint kept for symmetry.
  res.json({ ok: true });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authUser = await buildAuthUser(req.auth!.userId);
    if (!authUser) throw unauthorized();
    res.json({
      user: { ...authUser, developerBypass: isDeveloperBypassUser(authUser.email) },
      plan: PLANS[authUser.plan],
    });
  })
);

export default router;
