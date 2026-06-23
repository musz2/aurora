import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { storage } from "../services/storage.service.js";
import { serializeMeeting } from "../utils/serializers.js";
import {
  extractActionItems,
  generateMeetingSummary,
} from "../services/ai.service.js";
import { TranscriptSimulator } from "../services/transcript.simulator.js";
import { trackUsage } from "../services/usage.service.js";

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
  filename: string,
  originalName: string
) {
  // Create the meeting, generate a simulated transcript, then summarize.
  const meeting = await prisma.meeting.create({
    data: {
      workspaceId,
      createdById: userId,
      title: originalName.replace(/\.[^.]+$/, "") || "Imported recording",
      source: "UPLOAD",
      status: "PROCESSING",
      recordingUrl: storage.publicUrl(filename),
      startedAt: new Date(),
    },
  });

  const sim = new TranscriptSimulator();
  const lines: { speakerName: string; text: string }[] = [];
  while (sim.hasMore()) {
    const seg = sim.next();
    lines.push({ speakerName: seg.speakerName, text: seg.text });
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

  const [summary, items] = await Promise.all([
    generateMeetingSummary(meeting.title, lines),
    extractActionItems(lines),
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

  const duration = 600;
  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "COMPLETED", endedAt: new Date(), duration },
  });
  await trackUsage(workspaceId, userId, meeting.id, 10);

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
  const meeting = await processUpload(
    req.auth!.workspaceId,
    req.auth!.userId,
    req.file.filename,
    req.file.originalname
  );
  res.status(201).json({ meeting: serializeMeeting(meeting!) });
});

router.post("/audio", upload.single("file"), handler);
router.post("/video", upload.single("file"), handler);

export default router;
