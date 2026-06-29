import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";

/**
 * Companion Mode pairing service.
 *
 * Companion Mode is the HOST's own second device (e.g. phone), paired with a
 * secure, expiring, revocable token. It is NOT a viewer feature: a valid pairing
 * grants host-only access to the private assistant for one meeting. The raw token
 * is returned once and never stored — only its SHA-256 hash is persisted.
 *
 * This is consent-first and non-stealth: it adds no hidden overlay, no screen
 * capture, and no monitoring/recording. It simply mirrors the host's existing
 * private copilot onto a second screen they control.
 */

const DEFAULT_TTL_MINUTES = 60;
const MAX_TTL_MINUTES = 12 * 60;

export interface PairingRecord {
  expiresAt: Date | string;
  revoked: boolean;
}

/** Pure: is a pairing currently usable (not revoked, not expired)? */
export function isPairingActive(
  pairing: PairingRecord | null | undefined,
  now: Date = new Date()
): boolean {
  if (!pairing || pairing.revoked) return false;
  const expires =
    pairing.expiresAt instanceof Date ? pairing.expiresAt : new Date(pairing.expiresAt);
  return expires.getTime() > now.getTime();
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function clampTtlMinutes(ttl: unknown): number {
  const n = Number(ttl);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TTL_MINUTES;
  return Math.min(Math.floor(n), MAX_TTL_MINUTES);
}

export interface CreatedPairing {
  pairingId: string;
  token: string;
  expiresAt: Date;
}

/** Create a pairing for a meeting, returning the raw token ONCE. */
export async function createPairing(params: {
  workspaceId: string;
  userId: string;
  meetingId: string;
  ttlMinutes?: number;
}): Promise<CreatedPairing> {
  const token = `cmp_${nanoid(32)}`;
  const ttl = clampTtlMinutes(params.ttlMinutes);
  const expiresAt = new Date(Date.now() + ttl * 60_000);
  const created = await prisma.companionPairing.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      meetingId: params.meetingId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });
  return { pairingId: created.id, token, expiresAt };
}

export interface ResolvedCompanion {
  pairingId: string;
  workspaceId: string;
  userId: string;
  meetingId: string;
}

/** Resolve a raw companion token to its (active) pairing, or null. */
export async function resolvePairing(token: string): Promise<ResolvedCompanion | null> {
  if (!token) return null;
  const pairing = await prisma.companionPairing
    .findUnique({ where: { tokenHash: hashToken(token) } })
    .catch(() => null);
  if (!isPairingActive(pairing)) return null;
  return {
    pairingId: pairing!.id,
    workspaceId: pairing!.workspaceId,
    userId: pairing!.userId,
    meetingId: pairing!.meetingId,
  };
}

/** Revoke all pairings for a meeting owned by the given user. */
export async function revokePairings(meetingId: string, userId: string): Promise<number> {
  const result = await prisma.companionPairing.updateMany({
    where: { meetingId, userId, revoked: false },
    data: { revoked: true },
  });
  return result.count;
}
