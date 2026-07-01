import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, badRequest, notFound, unauthorized } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { writeAudit } from "../services/audit.service.js";
import {
  createPairing,
  resolvePairing,
  revokePairings,
  type ResolvedCompanion,
} from "../services/companion.service.js";
import { generateStructuredLiveSuggestion } from "../services/ai.service.js";
import { broadcastPublishedAnswer } from "../sockets/index.js";
import {
  normalizeAssistantMode,
  parseAssistantIntent,
} from "../services/private-assistant.service.js";

const router = Router();

/* ----------------------- Host-authenticated: pair/revoke ----------------------- */

router.post(
  "/pair",
  requireAuth,
  asyncHandler(async (req, res) => {
    const meetingId = (req.body?.meetingId as string)?.trim();
    if (!meetingId) throw badRequest("meetingId is required");
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const pairing = await createPairing({
      workspaceId: req.auth!.workspaceId,
      userId: req.auth!.userId,
      meetingId,
      ttlMinutes: req.body?.ttlMinutes,
    });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "companion_paired", {
      meetingId,
      pairingId: pairing.pairingId,
      expiresAt: pairing.expiresAt.toISOString(),
    });
    res.status(201).json({
      pairingId: pairing.pairingId,
      token: pairing.token, // returned once; never retrievable again
      expiresAt: pairing.expiresAt.toISOString(),
    });
  })
);

router.post(
  "/revoke",
  requireAuth,
  asyncHandler(async (req, res) => {
    const meetingId = (req.body?.meetingId as string)?.trim();
    if (!meetingId) throw badRequest("meetingId is required");
    const revoked = await revokePairings(meetingId, req.auth!.userId);
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "companion_revoked", {
      meetingId,
      revoked,
    });
    res.json({ ok: true, revoked });
  })
);

/* ---------------------- Companion-token middleware + routes ---------------------- */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      companion?: ResolvedCompanion;
    }
  }
}

const requireCompanion = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token =
      (req.headers["x-companion-token"] as string | undefined) ??
      (req.query.token as string | undefined);
    const companion = token ? await resolvePairing(token) : null;
    if (!companion) {
      return next(unauthorized("Companion link is invalid, expired, or revoked"));
    }
    req.companion = companion;
    next();
  }
);

/** Host-only context for the paired device. Never returns viewer-only payloads. */
router.get(
  "/session",
  requireCompanion,
  asyncHandler(async (req, res) => {
    const { meetingId, userId } = req.companion!;
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, title: true, status: true, demoMode: true },
    });
    if (!meeting) throw notFound("Meeting not found");

    const [segments, notes, suggestions] = await Promise.all([
      prisma.transcriptSegment.findMany({
        where: { meetingId },
        orderBy: { startTime: "desc" },
        take: 12,
        select: { id: true, speakerName: true, text: true },
      }),
      prisma.privateAssistSuggestion.findMany({
        where: { meetingId, userId, question: "Private note" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, suggestion: true },
      }),
      prisma.privateAssistSuggestion.findMany({
        where: { meetingId, userId, question: { not: "Private note" } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, question: true, suggestion: true },
      }),
    ]);

    res.json({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        status: meeting.status,
        demoMode: meeting.demoMode,
      },
      transcript: segments.reverse(),
      privateNotes: notes.map((n) => ({ id: n.id, text: n.suggestion })),
      recentSuggestions: suggestions,
    });
  })
);

/** Generate a private structured suggestion for the host on the companion device. */
router.post(
  "/ask",
  requireCompanion,
  asyncHandler(async (req, res) => {
    const { meetingId } = req.companion!;
    const question = (req.body?.question as string)?.trim();
    if (!question) throw badRequest("question is required");
    const mode = normalizeAssistantMode(req.body?.mode as string | undefined);
    const intent = parseAssistantIntent(question);

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { title: true, demoMode: true, workspaceId: true },
    });
    if (!meeting) throw notFound("Meeting not found");

    const [recent, vocab] = await Promise.all([
      prisma.transcriptSegment.findMany({
        where: { meetingId },
        orderBy: { startTime: "desc" },
        take: 6,
        select: { speakerName: true, text: true },
      }),
      prisma.customVocabulary.findMany({
        where: { workspaceId: meeting.workspaceId },
        select: { term: true },
        take: 50,
      }),
    ]);
    const recentTranscript = recent
      .reverse()
      .map((s) => `${s.speakerName}: ${s.text}`)
      .join("\n");

    const { suggestion, configured } = await generateStructuredLiveSuggestion({
      question,
      mode,
      intent,
      context: {
        meetingTitle: meeting.title,
        recentTranscript,
        vocabulary: vocab.map((v) => v.term),
      },
      demoMode: meeting.demoMode,
    });
    // Draft answers stay private — they are NOT persisted to PublishedAnswer here.
    res.json({ suggestion, configured });
  })
);

/**
 * Owner-reviewed publish: the host has reviewed/edited a private answer and
 * explicitly publishes it. ONLY the final text is stored (no draft/context/notes/
 * confidence) and becomes visible to viewers, labelled "Published by Host".
 */
router.post(
  "/publish",
  requireCompanion,
  asyncHandler(async (req, res) => {
    const { meetingId, workspaceId, userId } = req.companion!;
    const text = (req.body?.text as string)?.trim();
    if (!text) throw badRequest("text is required");
    const published = await prisma.publishedAnswer.create({
      data: { meetingId, text, publishedBy: "Host" },
    });
    const dto = {
      id: published.id,
      text: published.text,
      publishedBy: published.publishedBy,
      createdAt: published.createdAt.toISOString(),
    };
    broadcastPublishedAnswer(meetingId, dto);
    await writeAudit(workspaceId, userId, "companion_published_answer", {
      meetingId,
      publishedAnswerId: published.id,
    });
    res.status(201).json({ published: dto });
  })
);

export default router;
