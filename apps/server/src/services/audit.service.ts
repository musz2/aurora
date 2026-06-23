import { prisma } from "../lib/prisma.js";

export async function writeAudit(
  workspaceId: string,
  userId: string | null,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        action,
        metadata: (metadata ?? {}) as object,
      },
    });
  } catch (err) {
    console.warn("[audit] failed:", (err as Error).message);
  }
}
