import { PLANS, type PlanId } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";

function periodStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getUsedMinutes(workspaceId: string): Promise<number> {
  const records = await prisma.usageRecord.findMany({
    where: { workspaceId, createdAt: { gte: periodStart() } },
    select: { transcriptionMinutes: true },
  });
  return records.reduce((sum, r) => sum + r.transcriptionMinutes, 0);
}

export async function getImportsUsed(workspaceId: string): Promise<number> {
  return prisma.meeting.count({
    where: { workspaceId, source: "UPLOAD" },
  });
}

export async function canStartRecording(
  workspaceId: string,
  estimatedMinutes: number
): Promise<{ allowed: boolean; reason?: string }> {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) return { allowed: false, reason: "Workspace not found" };
  const plan = PLANS[ws.plan as PlanId];
  if (plan.monthlyMinutes === -1) return { allowed: true };
  const used = await getUsedMinutes(workspaceId);
  if (used + estimatedMinutes > plan.monthlyMinutes) {
    return {
      allowed: false,
      reason: `Monthly limit of ${plan.monthlyMinutes} minutes reached. Upgrade your plan to continue.`,
    };
  }
  return { allowed: true };
}

export async function trackUsage(
  workspaceId: string,
  userId: string | null,
  meetingId: string | null,
  minutes: number
): Promise<void> {
  await prisma.usageRecord.create({
    data: { workspaceId, userId, meetingId, transcriptionMinutes: minutes },
  });
}

export async function getUsageSummary(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { subscription: true },
  });
  const plan = PLANS[(ws?.plan ?? "BASIC") as PlanId];
  const usedMinutes = await getUsedMinutes(workspaceId);
  const importsUsed = await getImportsUsed(workspaceId);
  const start = periodStart();
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return {
    plan: plan.id,
    usedMinutes: Math.round(usedMinutes),
    limitMinutes: plan.monthlyMinutes,
    importsUsed,
    importsLimit: plan.lifetimeImports,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}
