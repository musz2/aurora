import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, badRequest, notFound } from "../utils/http.js";
import { isShareActive } from "../services/shared-viewer.service.js";
import { generateStructuredLiveSuggestion } from "../services/ai.service.js";
import {
  normalizeAssistantMode,
  parseAssistantIntent,
} from "../services/private-assistant.service.js";
import {
  backupQuestion,
  buildOfflineBackup,
  type BackupAssistResult,
} from "../services/backup-assist.service.js";

/**
 * PUBLIC shared-session support routes (no auth — the shareId is the token).
 *
 * Backup Assist is a reliability/preparation feature: it uses ONLY public shared
 * content, manually entered viewer context, and built-in role guidance. It never
 * reads host private copilot drafts, prompts, or notes, and never publishes.
 */
const router = Router();

const MAX_CONTEXT = 4000;

// Stricter rate limit than the global /api limiter — keyed by IP + shareId.
const backupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.params.shareId ?? ""}`,
});

router.post(
  "/:shareId/backup-assist",
  backupLimiter,
  asyncHandler(async (req, res) => {
    // 1. Validate the share link is active, unexpired, and not revoked.
    const meeting = await prisma.meeting.findFirst({
      where: { shareId: req.params.shareId, shared: true },
      select: { id: true, shared: true, shareExpiresAt: true, title: true, demoMode: true },
    });
    if (!meeting || !isShareActive(meeting)) {
      throw notFound("This shared session link is invalid, expired, or no longer shared.");
    }

    const body = (req.body ?? {}) as {
      manualContext?: string;
      jobType?: string;
      experienceLevel?: string;
      actionType?: string;
      publicTranscriptContext?: string;
      publicPublishedNotes?: string[];
    };
    const manualContext = (body.manualContext ?? "").toString();
    if (manualContext.length > MAX_CONTEXT) {
      throw badRequest(`Context is too long (max ${MAX_CONTEXT} characters).`);
    }

    const jobType = body.jobType;
    const experienceLevel = body.experienceLevel || "10+ years";
    const actionType = body.actionType;

    // 2. Assemble ONLY public grounding context: the viewer's typed/pasted text,
    //    plus the public transcript + published notes (what the viewer can see).
    const [recent, meetingNotes] = await Promise.all([
      prisma.transcriptSegment.findMany({
        where: { meetingId: meeting.id },
        orderBy: { startTime: "desc" },
        take: 8,
        select: { speakerName: true, text: true },
      }),
      prisma.meeting.findUnique({
        where: { id: meeting.id },
        select: { publishedNotes: true },
      }),
    ]);
    const publicTranscript = [
      ...recent.reverse().map((s) => `${s.speakerName}: ${s.text}`),
      (body.publicTranscriptContext ?? "").toString(),
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 6000);
    const publishedNotes = (body.publicPublishedNotes ?? meetingNotes?.publishedNotes ?? []).slice(0, 20);

    const question = backupQuestion(actionType, manualContext);
    const mode = normalizeAssistantMode(jobType);

    // 3. Try AI; on any failure (incl. not configured) use the offline packs so
    //    Backup Assist ALWAYS returns something useful.
    let result: BackupAssistResult;
    try {
      const { suggestion, configured } = await generateStructuredLiveSuggestion({
        question,
        mode,
        intent: parseAssistantIntent(question),
        context: {
          meetingTitle: meeting.title,
          recentTranscript: publicTranscript,
          privateNotes: [], // NEVER include private data
          vocabulary: publishedNotes,
        },
        demoMode: meeting.demoMode,
      });
      result = configured
        ? {
            answer: suggestion.answer,
            talkingPoints: suggestion.talkingPoints,
            followUpQuestion: suggestion.followUpQuestion,
            confidence: suggestion.confidence,
            providerStatus: "ai",
            createdAt: new Date().toISOString(),
          }
        : buildOfflineBackup({ jobType, experienceLevel, manualContext, actionType });
    } catch {
      result = buildOfflineBackup({ jobType, experienceLevel, manualContext, actionType });
    }

    // 4. Return — never persisted as a private copilot item, never published.
    res.json(result);
  })
);

export default router;
