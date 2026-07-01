import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature, developerLifetimeAccess } from "../config/entitlements.js";
import { storage } from "../services/storage.service.js";
import { serializeMeeting } from "../utils/serializers.js";
import {
  extractActionItems,
  generateMeetingSummary,
} from "../services/ai.service.js";
import { env } from "../config/env.js";
import { canUpload, trackUsage } from "../services/usage.service.js";
import { HttpError } from "../utils/http.js";
import { createUploadedTranscriptionProvider } from "../services/uploaded-transcription.provider.js";

const router = Router();
router.use(requireAuth);

storage.ensureDir();
const upload = multer({
  storage: multer.diskStorage({
    destination: storage.localDir,
    filename: (_req, file, cb) =>
      cb(null, `${nanoid()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const ALLOWED = [".mp3", ".wav", ".m4a", ".mp4"];

async function processUpload(
  workspaceId: string,
  userId: string,
  filePath: string,
  mimeType: string,
  filename: string,
  originalName: string,
  demoMode: boolean
) {
  const provider = createUploadedTranscriptionProvider(
    demoMode ? "demo" : "real",
    env.UPLOAD_TRANSCRIPTION_PROVIDER
  );

  const meeting = await prisma.meeting.create({
    data: {
      workspaceId,
      createdById: userId,
      title: originalName.replace(/\.[^.]+$/, "") || "Imported recording",
      source: "UPLOAD",
      status: "PROCESSING",
      recordingUrl: storage.publicUrl(filename),
      startedAt: new Date(),
      demoMode,
    },
  });

  try {
    const transcription = await provider.transcribe({
      filePath,
      mimeType,
      originalName,
    });
    const lines = transcription.segments.map((seg) => ({
      speakerName: seg.speakerName,
      text: seg.text,
    }));

    for (const seg of transcription.segments) {
      await prisma.transcriptSegment.create({
        data: {
          meetingId: meeting.id,
          speakerName: seg.speakerName,
          text: seg.text,
          startTime: seg.startTime,
          endTime: seg.endTime,
          confidence: seg.confidence,
        },
      });
    }

    // Demo uploads must finalize without OpenAI: pass the upload's demoMode
    // through so summary/action-item generation falls back to sample output
    // instead of throwing "not configured". Real uploads still require keys.
    const [summary, items] = await Promise.all([
      generateMeetingSummary(meeting.title, lines, [], { demoMode }),
      extractActionItems(lines, { demoMode }),
    ]);

    await prisma.meetingSummary.create({
      data: {
        meetingId: meeting.id,
        overview: summary.overview,
        keyPoints: summary.keyPoints,
        decisions: summary.decisions,
        followUpEmail: summary.followUpEmail,
      },
    });
    for (const item of items) {
      await prisma.actionItem.create({
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

    const duration = transcription.durationSeconds;
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "COMPLETED", endedAt: new Date(), duration },
    });
    await trackUsage(workspaceId, userId, meeting.id, Math.max(1, Math.ceil(duration / 60)));
  } catch (err) {
    await prisma.meeting
      .update({
        where: { id: meeting.id },
        data: { status: "FAILED", endedAt: new Date() },
      })
      .catch(() => null);
    throw err;
  }

  return prisma.meeting.findUnique({
    where: { id: meeting.id },
    include: {
      summary: true,
      segments: { orderBy: { startTime: "asc" } },
      actionItems: { include: { meeting: { select: { title: true } } } },
    },
  });
}

const handler = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest("No file uploaded");
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!ALLOWED.includes(ext)) {
    throw badRequest(`Unsupported format. Allowed: ${ALLOWED.join(", ")}`);
  }
  // Enforce the plan's lifetime import cap before doing any processing work.
  // Developer lifetime access (owner billing override) lifts this billing cap.
  if (!developerLifetimeAccess(req.auth!.email)) {
    const allowance = await canUpload(req.auth!.workspaceId);
    if (!allowance.allowed) {
      throw new HttpError(402, allowance.reason ?? "Upload limit reached.");
    }
  }
  const demoMode = req.body?.mode === "demo";
  const meeting = await processUpload(
    req.auth!.workspaceId,
    req.auth!.userId,
    req.file.path,
    req.file.mimetype,
    req.file.filename,
    req.file.originalname,
    demoMode
  );
  res.status(201).json({ meeting: serializeMeeting(meeting!) });
});

router.post("/audio", requireFeature("file_upload"), upload.single("file"), handler);
router.post("/video", requireFeature("file_upload"), upload.single("file"), handler);

export default router;
