import { Router } from "express";
import {
  createMeetingSchema,
  transcriptSegmentSchema,
} from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { nanoid } from "nanoid";
import { asyncHandler, notFound, badRequest, paymentRequired } from "../utils/http.js";
import { PLANS, type PlanId } from "@aurora/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../config/entitlements.js";
import {
  serializeActionItem,
  serializeMeeting,
  serializePrivateAssistSuggestion,
  serializeSegment,
  serializeSummary,
} from "../utils/serializers.js";
import {
  extractActionItems,
  generateMeetingSummary,
  generateStructuredLiveSuggestion,
  type TranscriptLine,
} from "../services/ai.service.js";
import {
  normalizeAssistantMode,
  parseAssistantIntent,
  questionForAssistAction,
  detectQuestions,
  renderSuggestionText,
} from "../services/private-assistant.service.js";
import {
  broadcastPublishedAnswer,
  broadcastPublishedNote,
} from "../sockets/index.js";
import {
  trackUsage,
  canStartRecording,
  getActiveSessionCount,
  checkConcurrentAllowed,
} from "../services/usage.service.js";
import { writeAudit } from "../services/audit.service.js";
import {
  exportMeeting,
  exportResponseHeaders,
  type ExportFormat,
} from "../services/export.service.js";
import { finalizeMeeting } from "../services/meeting-finalization.service.js";
import {
  SpeakerNameError,
  validateRename,
} from "../services/speaker.service.js";
import {
  SegmentPatchError,
  buildSegmentUpdate,
} from "../services/transcript-segment.service.js";

const router = Router();
router.use(requireAuth);

const meetingInclude = {
  summary: true,
  segments: { orderBy: { startTime: "asc" as const } },
  actionItems: { include: { meeting: { select: { title: true } } } },
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, q } = req.query as { status?: string; q?: string };
    const meetings = await prisma.meeting.findMany({
      where: {
        workspaceId: req.auth!.workspaceId,
        ...(status ? { status: status as never } : {}),
        ...(q
          ? { title: { contains: q, mode: "insensitive" as const } }
          : {}),
      },
      include: { summary: true, actionItems: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ meetings: meetings.map(serializeMeeting) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createMeetingSchema.parse(req.body);
    const meeting = await prisma.meeting.create({
      data: {
        workspaceId: req.auth!.workspaceId,
        createdById: req.auth!.userId,
        title: data.title,
        description: data.description,
        source: data.source,
        status: "SCHEDULED",
      },
    });
    res.status(201).json({ meeting: serializeMeeting(meeting) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      include: meetingInclude,
    });
    if (!meeting) throw notFound("Meeting not found");
    res.json({ meeting: serializeMeeting(meeting) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { title, description, tags } = req.body as {
      title?: string;
      description?: string;
      tags?: string[];
    };
    const meeting = await prisma.meeting.updateMany({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(tags !== undefined ? { tags } : {}),
      },
    });
    if (meeting.count === 0) throw notFound("Meeting not found");
    const updated = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: meetingInclude,
    });
    res.json({ meeting: serializeMeeting(updated!) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await prisma.meeting.deleteMany({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
    });
    if (result.count === 0) throw notFound("Meeting not found");
    res.json({ ok: true });
  })
);

router.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    const workspaceId = req.auth!.workspaceId;

    // Enforce plan limits BEFORE flipping to RECORDING (LOOP 10):
    // 1. Concurrent live sessions (seat-based).
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) throw notFound("Workspace not found");
    const plan = PLANS[ws.plan as PlanId];
    const active = await getActiveSessionCount(workspaceId);
    const concurrent = checkConcurrentAllowed(plan, active);
    if (!concurrent.allowed) throw paymentRequired(concurrent.reason!);

    // 2. Monthly transcription-minute allowance (block once the cap is hit).
    const minutes = await canStartRecording(workspaceId, 1);
    if (!minutes.allowed) throw paymentRequired(minutes.reason!);

    const meeting = await prisma.meeting.updateMany({
      where: { id: req.params.id, workspaceId },
      data: { status: "RECORDING", startedAt: new Date() },
    });
    if (meeting.count === 0) throw notFound("Meeting not found");
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "meeting_started", {
      meetingId: req.params.id,
    });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/stop",
  asyncHandler(async (req, res) => {
    const existing = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
    });
    if (!existing) throw notFound("Meeting not found");
    const endedAt = new Date();
    const duration = existing.startedAt
      ? Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 1000)
      : existing.duration;
    await prisma.meeting.update({
      where: { id: existing.id },
      data: { status: "PROCESSING", endedAt, duration },
    });
    await trackUsage(
      req.auth!.workspaceId,
      req.auth!.userId,
      existing.id,
      Math.max(1, Math.round(duration / 60))
    );
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "meeting_stopped", {
      meetingId: existing.id,
      duration,
    });
    res.json({ ok: true, duration });
  })
);

/**
 * Pause / resume are lifecycle signals. The durable status stays RECORDING (the
 * meeting is still "live" from the workspace's perspective); the ephemeral
 * paused/recording state lives on the socket/client. We record the audit trail.
 */
router.post(
  "/:id/pause",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "meeting_paused", {
      meetingId: meeting.id,
    });
    res.json({ ok: true, state: "paused" });
  })
);

router.post(
  "/:id/resume",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "RECORDING" },
    });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "meeting_resumed", {
      meetingId: meeting.id,
    });
    res.json({ ok: true, state: "recording" });
  })
);

/**
 * Finalize a stopped meeting: generate summary/action items/speaker breakdown,
 * persist them, mark COMPLETED, and return the full finalization payload for the
 * review screen. Honest about mock vs real AI via `finalization.source`.
 */
router.post(
  "/:id/finalize",
  requireFeature("advanced_summary"),
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      include: { segments: { orderBy: { startTime: "asc" } } },
    });
    if (!meeting) throw notFound("Meeting not found");

    await writeAudit(
      req.auth!.workspaceId,
      req.auth!.userId,
      "meeting_finalizing",
      { meetingId: meeting.id }
    );

    const vocab = await prisma.customVocabulary.findMany({
      where: { workspaceId: req.auth!.workspaceId },
      select: { term: true },
    });
    const transcript: TranscriptLine[] = meeting.segments.map((s) => ({
      speakerName: s.speakerName,
      text: s.text,
    }));

    let finalization;
    try {
      finalization = await finalizeMeeting({
        title: meeting.title,
        transcript,
        vocabulary: vocab.map((v) => v.term),
        demoMode: meeting.demoMode,
        durationSeconds: meeting.duration,
      });
    } catch (err) {
      await prisma.meeting
        .update({ where: { id: meeting.id }, data: { status: "FAILED" } })
        .catch(() => null);
      await writeAudit(
        req.auth!.workspaceId,
        req.auth!.userId,
        "meeting_failed",
        { meetingId: meeting.id, reason: (err as Error).message }
      );
      throw err;
    }

    const { summary, actionItems } = finalization;
    await prisma.$transaction(async (tx) => {
      await tx.meetingSummary.upsert({
        where: { meetingId: meeting.id },
        create: {
          meetingId: meeting.id,
          overview: summary.overview,
          keyPoints: summary.keyPoints,
          decisions: summary.decisions,
          followUpEmail: summary.followUpEmail,
        },
        update: {
          overview: summary.overview,
          keyPoints: summary.keyPoints,
          decisions: summary.decisions,
          followUpEmail: summary.followUpEmail,
        },
      });
      await tx.actionItem.deleteMany({ where: { meetingId: meeting.id } });
      for (const item of actionItems) {
        await tx.actionItem.create({
          data: {
            meetingId: meeting.id,
            assigneeName: item.assigneeName,
            task: item.task,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            priority: item.priority,
            sourceText: item.sourceText,
          },
        });
      }
      await tx.meeting.update({
        where: { id: meeting.id },
        data: { status: "COMPLETED" },
      });
    });

    await writeAudit(
      req.auth!.workspaceId,
      req.auth!.userId,
      "meeting_completed",
      { meetingId: meeting.id, source: finalization.source }
    );

    const full = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: meetingInclude,
    });
    res.json({
      meeting: serializeMeeting(full!),
      finalization: {
        source: finalization.source,
        mock: finalization.mock,
        label: finalization.label,
        speakerSummaries: finalization.speakerSummaries,
        questions: finalization.questions,
        durationSeconds: finalization.durationSeconds,
      },
    });
  })
);

/** Rename a speaker across all transcript segments of a meeting. */
router.post(
  "/:id/speakers/rename",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");

    let from: string;
    let to: string;
    try {
      ({ from, to } = validateRename(
        (req.body?.from as string) ?? "",
        (req.body?.to as string) ?? ""
      ));
    } catch (err) {
      if (err instanceof SpeakerNameError) throw badRequest(err.message);
      throw err;
    }

    const result = await prisma.transcriptSegment.updateMany({
      where: { meetingId: meeting.id, speakerName: from },
      data: { speakerName: to },
    });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "speaker_renamed", {
      meetingId: meeting.id,
      from,
      to,
      updated: result.count,
    });
    res.json({ ok: true, from, to, updated: result.count });
  })
);

router.post(
  "/:id/summarize",
  requireFeature("advanced_summary"),
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      include: { segments: { orderBy: { startTime: "asc" } } },
    });
    if (!meeting) throw notFound("Meeting not found");

    const vocab = await prisma.customVocabulary.findMany({
      where: { workspaceId: req.auth!.workspaceId },
      select: { term: true },
    });
    const transcript: TranscriptLine[] = meeting.segments.map((s) => ({
      speakerName: s.speakerName,
      text: s.text,
    }));

    let summary;
    let items;
    try {
      [summary, items] = await Promise.all([
        generateMeetingSummary(
          meeting.title,
          transcript,
          vocab.map((v) => v.term),
          { demoMode: meeting.demoMode }
        ),
        extractActionItems(transcript, { demoMode: meeting.demoMode }),
      ]);
    } catch (err) {
      await prisma.meeting
        .update({ where: { id: meeting.id }, data: { status: "FAILED" } })
        .catch(() => null);
      throw err;
    }

    await prisma.$transaction(async (tx) => {
      await tx.meetingSummary.upsert({
        where: { meetingId: meeting.id },
        create: {
          meetingId: meeting.id,
          overview: summary.overview,
          keyPoints: summary.keyPoints,
          decisions: summary.decisions,
          followUpEmail: summary.followUpEmail,
        },
        update: {
          overview: summary.overview,
          keyPoints: summary.keyPoints,
          decisions: summary.decisions,
          followUpEmail: summary.followUpEmail,
        },
      });
      await tx.actionItem.deleteMany({ where: { meetingId: meeting.id } });
      for (const item of items) {
        await tx.actionItem.create({
          data: {
            meetingId: meeting.id,
            assigneeName: item.assigneeName,
            task: item.task,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            priority: item.priority,
            sourceText: item.sourceText,
          },
        });
      }
      await tx.meeting.update({
        where: { id: meeting.id },
        data: { status: "COMPLETED" },
      });
    });

    const full = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: meetingInclude,
    });
    res.json({ meeting: serializeMeeting(full!) });
  })
);

/**
 * Save an edited summary from the finalization review screen. Upserts the
 * summary so the host can correct AI/mock output before saving the meeting.
 */
router.put(
  "/:id/summary",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");

    const body = req.body as {
      overview?: string;
      keyPoints?: string[];
      decisions?: string[];
      followUpEmail?: string;
    };
    const overview = (body.overview ?? "").toString();
    const keyPoints = Array.isArray(body.keyPoints)
      ? body.keyPoints.map((k) => String(k)).filter(Boolean)
      : [];
    const decisions = Array.isArray(body.decisions)
      ? body.decisions.map((d) => String(d)).filter(Boolean)
      : [];
    const followUpEmail = (body.followUpEmail ?? "").toString();

    const summary = await prisma.meetingSummary.upsert({
      where: { meetingId: meeting.id },
      create: { meetingId: meeting.id, overview, keyPoints, decisions, followUpEmail },
      update: { overview, keyPoints, decisions, followUpEmail },
    });
    res.json({ summary: serializeSummary(summary) });
  })
);

/* ----------------------------- Transcripts ----------------------------- */

router.get(
  "/:id/transcript",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const segments = await prisma.transcriptSegment.findMany({
      where: { meetingId: req.params.id },
      orderBy: { startTime: "asc" },
    });
    res.json({ segments: segments.map(serializeSegment) });
  })
);

router.post(
  "/:id/transcript",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const data = transcriptSegmentSchema.parse(req.body);
    const segment = await prisma.transcriptSegment.create({
      data: { meetingId: req.params.id, ...data },
    });
    res.status(201).json({ segment: serializeSegment(segment) });
  })
);

/**
 * Update a single transcript segment: edit text, highlight it, or mark it as a
 * decision / action item. Used by the transcript segment actions UI on both the
 * live page and meeting detail.
 */
router.patch(
  "/:id/transcript/:segmentId",
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");

    let update;
    try {
      update = buildSegmentUpdate(req.body ?? {});
    } catch (err) {
      if (err instanceof SegmentPatchError) throw badRequest(err.message);
      throw err;
    }

    const result = await prisma.transcriptSegment.updateMany({
      where: { id: req.params.segmentId, meetingId: meeting.id },
      data: update,
    });
    if (result.count === 0) throw notFound("Transcript segment not found");

    const segment = await prisma.transcriptSegment.findUnique({
      where: { id: req.params.segmentId },
    });
    res.json({ segment: serializeSegment(segment!) });
  })
);

router.get(
  "/:id/private-suggestions",
  requireFeature("ai_chat"),
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");

    const suggestions = await prisma.privateAssistSuggestion.findMany({
      where: {
        meetingId: meeting.id,
        userId: req.auth!.userId,
        question: { not: "Private note" },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      suggestions: suggestions.map(serializePrivateAssistSuggestion),
    });
  })
);

router.get(
  "/:id/private-notes",
  requireFeature("ai_chat"),
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const notes = await prisma.privateAssistSuggestion.findMany({
      where: {
        meetingId: meeting.id,
        userId: req.auth!.userId,
        question: "Private note",
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ notes: notes.map(serializePrivateAssistSuggestion) });
  })
);

router.post(
  "/:id/private-notes",
  requireFeature("ai_chat"),
  asyncHandler(async (req, res) => {
    const text = (req.body?.text as string)?.trim();
    if (!text) throw badRequest("text is required");
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const note = await prisma.privateAssistSuggestion.create({
      data: {
        meetingId: meeting.id,
        userId: req.auth!.userId,
        question: "Private note",
        suggestion: text,
      },
    });
    res.status(201).json({ note: serializePrivateAssistSuggestion(note) });
  })
);

router.post(
  "/:id/action-items",
  asyncHandler(async (req, res) => {
    const task = (req.body?.task as string)?.trim();
    if (!task) throw badRequest("task is required");
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const item = await prisma.actionItem.create({
      data: {
        meetingId: meeting.id,
        task,
        assigneeName: (req.body?.assigneeName as string | undefined) ?? null,
        priority: "MEDIUM",
        sourceText: (req.body?.sourceText as string | undefined) ?? task,
      },
      include: { meeting: { select: { title: true } } },
    });
    res.status(201).json({ actionItem: serializeActionItem(item) });
  })
);

/**
 * Same-page Private Copilot: generate a private answer draft from the live
 * transcript + meeting mode + optional custom prompt / quick action. The draft
 * is host-only — persisted as a private assistant item and NEVER shared until
 * the host explicitly publishes it via /publish-answer.
 */
router.post(
  "/:id/assist",
  requireFeature("ai_chat"),
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true, title: true, demoMode: true, workspaceId: true },
    });
    if (!meeting) throw notFound("Meeting not found");

    const mode = normalizeAssistantMode(req.body?.mode as string | undefined);
    const actionType = req.body?.actionType as string | undefined;
    const customPrompt = (req.body?.customPrompt as string | undefined) ?? "";

    const [recent, vocab] = await Promise.all([
      prisma.transcriptSegment.findMany({
        where: { meetingId: meeting.id },
        orderBy: { startTime: "desc" },
        take: 10,
        select: { speakerName: true, text: true },
      }),
      prisma.customVocabulary.findMany({
        where: { workspaceId: meeting.workspaceId },
        select: { term: true },
        take: 50,
      }),
    ]);
    const ordered = recent.reverse();
    const recentTranscript = ordered.map((s) => `${s.speakerName}: ${s.text}`).join("\n");

    if (!recentTranscript && !customPrompt.trim()) {
      throw badRequest("No transcript or prompt yet — start speaking or type a prompt.");
    }

    // Resolve the question: custom prompt > fixed quick action > latest question.
    let question = questionForAssistAction(actionType, customPrompt);
    if (question === null) {
      const detected = detectQuestions(ordered.map((s) => s.text).join(" "));
      question = detected.length
        ? detected[detected.length - 1].question
        : "What is the best thing to say next in this discussion?";
    }

    const intent = parseAssistantIntent(question);
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

    // Persist as a PRIVATE assistant item (host-only; never shared).
    await prisma.privateAssistSuggestion
      .create({
        data: {
          meetingId: meeting.id,
          userId: req.auth!.userId,
          question: suggestion.question,
          suggestion: renderSuggestionText(suggestion),
        },
      })
      .catch(() => null);

    res.json({ suggestion, configured });
  })
);

/**
 * Publish a reviewed private answer to the shared session. Only the final text
 * is stored (no draft/prompt/context/reasoning) as a PublishedAnswer, then
 * broadcast to connected viewers so the shared link updates instantly.
 */
router.post(
  "/:id/publish-answer",
  asyncHandler(async (req, res) => {
    const text = (req.body?.text as string)?.trim();
    if (!text) throw badRequest("text is required");
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: { name: true },
    });
    const published = await prisma.publishedAnswer.create({
      data: { meetingId: meeting.id, text, publishedBy: user?.name || "Host" },
    });
    const dto = {
      id: published.id,
      text: published.text,
      publishedBy: published.publishedBy,
      createdAt: published.createdAt.toISOString(),
    };
    broadcastPublishedAnswer(meeting.id, dto);
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "published_answer", {
      meetingId: meeting.id,
      publishedAnswerId: published.id,
    });
    res.status(201).json({ published: dto });
  })
);

/** Audit activity scoped to a single meeting (host/workspace only). */
router.get(
  "/:id/audit",
  requireFeature("team_workspace"),
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const logs = await prisma.auditLog.findMany({
      where: { workspaceId: req.auth!.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const scoped = logs
      .filter(
        (l) =>
          (l.metadata as { meetingId?: string } | null)?.meetingId ===
          meeting.id
      )
      .slice(0, 50)
      .map((l) => ({
        id: l.id,
        action: l.action,
        metadata: l.metadata,
        createdAt: l.createdAt.toISOString(),
      }));
    res.json({ logs: scoped });
  })
);

/* ----------------------------- Sharing ----------------------------- */

router.post(
  "/:id/share",
  asyncHandler(async (req, res) => {
    const enable = req.body?.shared !== false;
    const existing = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true, shareId: true },
    });
    if (!existing) throw notFound("Meeting not found");

    // Optional expiry window. `expiresInHours` (number) sets a future expiry;
    // omitting it (or passing null) keeps the link non-expiring.
    const expiresInHours = Number(req.body?.expiresInHours);
    const shareExpiresAt =
      enable && Number.isFinite(expiresInHours) && expiresInHours > 0
        ? new Date(Date.now() + expiresInHours * 3600_000)
        : null;

    if (enable) {
      // Rotate to a fresh token only when there is none, so existing valid links
      // stay stable; a revoke (below) is what invalidates a link.
      const shareId = existing.shareId ?? `s_${nanoid(12)}`;
      await prisma.meeting.update({
        where: { id: existing.id },
        data: { shared: true, shareId, shareExpiresAt },
      });
      await writeAudit(req.auth!.workspaceId, req.auth!.userId, "meeting_shared", {
        meetingId: existing.id,
        expiresAt: shareExpiresAt?.toISOString() ?? null,
      });
      return res.json({
        shared: true,
        shareId,
        shareExpiresAt: shareExpiresAt?.toISOString() ?? null,
      });
    }

    // Revoke: disable sharing AND rotate the token so any previously shared URL
    // is permanently dead, and clear any expiry.
    await prisma.meeting.update({
      where: { id: existing.id },
      data: { shared: false, shareId: `s_${nanoid(12)}`, shareExpiresAt: null },
    });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "meeting_share_revoked", {
      meetingId: existing.id,
    });
    res.json({ shared: false, shareId: null, shareExpiresAt: null });
  })
);

router.get(
  "/:id/export",
  requireFeature("exports"),
  asyncHandler(async (req, res) => {
    const format = ((req.query.format as string) ?? "txt").toLowerCase() as ExportFormat;
    if (!["pdf", "docx", "txt", "srt", "vtt", "json"].includes(format)) {
      throw badRequest("Unsupported export format");
    }
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      include: {
        summary: true,
        segments: { orderBy: { startTime: "asc" } },
        actionItems: true,
      },
    });
    if (!meeting) throw notFound("Meeting not found");
    const result = exportMeeting(meeting, format);
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "transcript_exported", {
      meetingId: meeting.id,
      format,
    });
    const headers = exportResponseHeaders(meeting.title, result);
    res.setHeader("Content-Type", headers["Content-Type"]);
    res.setHeader("Content-Disposition", headers["Content-Disposition"]);
    res.send(result.buffer);
  })
);

router.post(
  "/:id/notes",
  asyncHandler(async (req, res) => {
    const note = (req.body?.note as string)?.trim();
    if (!note) throw badRequest("note is required");
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, workspaceId: req.auth!.workspaceId },
      select: { id: true, publishedNotes: true },
    });
    if (!meeting) throw notFound("Meeting not found");
    const publishedNotes = [...meeting.publishedNotes, note];
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { publishedNotes },
    });
    broadcastPublishedNote(meeting.id, note);
    res.json({ publishedNotes });
  })
);

export default router;
