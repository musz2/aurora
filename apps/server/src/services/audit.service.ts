import { prisma } from "../lib/prisma.js";

export const REQUIRED_AUDIT_ACTIONS = [
  "meeting_started",
  "meeting_paused",
  "meeting_resumed",
  "meeting_stopped",
  "meeting_finalizing",
  "meeting_completed",
  "meeting_failed",
  "speaker_renamed",
  "transcript_exported",
  "integration_connected",
  "integration_action_sent",
  "data_export_requested",
  "data_delete_requested",
] as const;

export type RequiredAuditAction = (typeof REQUIRED_AUDIT_ACTIONS)[number];

export function createAuditPayload(
  workspaceId: string,
  userId: string | null,
  action: string,
  metadata?: Record<string, unknown>
) {
  return {
    workspaceId,
    userId,
    action,
    metadata: (metadata ?? {}) as object,
  };
}

export async function writeAudit(
  workspaceId: string,
  userId: string | null,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: createAuditPayload(workspaceId, userId, action, metadata),
    });
  } catch (err) {
    console.warn("[audit] failed:", (err as Error).message);
  }
}
