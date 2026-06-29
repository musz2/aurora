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

/** Pure: is another upload import allowed under the plan's lifetime cap? */
export function checkImportAllowed(
  plan: PlanLimitsLike,
  importsUsed: number
): { allowed: boolean; reason?: string } {
  if (plan.lifetimeImports === -1) return { allowed: true };
  if (importsUsed >= plan.lifetimeImports) {
    return {
      allowed: false,
      reason: `Your plan includes ${plan.lifetimeImports} lifetime imports and you've used ${importsUsed}. Upgrade to import more.`,
    };
  }
  return { allowed: true };
}

/** Pure: max concurrent live sessions allowed for a plan (seat-based). */
export function concurrentLimitForPlan(plan: PlanLimitsLike): number {
  // Enterprise (seats === -1) is unbounded for practical purposes.
  if (plan.seats === -1) return Number.POSITIVE_INFINITY;
  return Math.max(1, plan.seats);
}

/** Pure: is starting another concurrent live session allowed? */
export function checkConcurrentAllowed(
  plan: PlanLimitsLike,
  activeSessions: number
): { allowed: boolean; reason?: string } {
  const limit = concurrentLimitForPlan(plan);
  if (activeSessions >= limit) {
    return {
      allowed: false,
      reason: `Your plan allows ${limit} concurrent live session${limit === 1 ? "" : "s"}. Finish an active session or upgrade.`,
    };
  }
  return { allowed: true };
}

interface PlanLimitsLike {
  lifetimeImports: number;
  seats: number;
}

/** Async: enforce the upload import cap for a workspace. */
export async function canUpload(
  workspaceId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) return { allowed: false, reason: "Workspace not found" };
  const plan = PLANS[ws.plan as PlanId];
  const importsUsed = await getImportsUsed(workspaceId);
  return checkImportAllowed(plan, importsUsed);
}

/** Count of currently-live (RECORDING) meetings in a workspace. */
export async function getActiveSessionCount(workspaceId: string): Promise<number> {
  return prisma.meeting.count({ where: { workspaceId, status: "RECORDING" } });
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
