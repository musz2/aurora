import type {
  ActionItem,
  Meeting,
  MeetingSummary,
  TranscriptSegment,
} from "@prisma/client";

export const serializeSegment = (s: TranscriptSegment) => ({
  id: s.id,
  meetingId: s.meetingId,
  speakerName: s.speakerName,
  text: s.text,
  startTime: s.startTime,
  endTime: s.endTime,
  confidence: s.confidence,
  createdAt: s.createdAt.toISOString(),
});

export const serializeSummary = (s: MeetingSummary) => ({
  id: s.id,
  overview: s.overview,
  keyPoints: s.keyPoints,
  decisions: s.decisions,
  followUpEmail: s.followUpEmail,
  createdAt: s.createdAt.toISOString(),
});

export const serializeActionItem = (
  a: ActionItem & { meeting?: { title: string } | null }
) => ({
  id: a.id,
  meetingId: a.meetingId,
  meetingTitle: a.meeting?.title,
  assigneeName: a.assigneeName,
  assigneeUserId: a.assigneeUserId,
  task: a.task,
  dueDate: a.dueDate ? a.dueDate.toISOString() : null,
  priority: a.priority,
  status: a.status,
  sourceText: a.sourceText,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

type MeetingWithRelations = Meeting & {
  summary?: MeetingSummary | null;
  segments?: TranscriptSegment[];
  actionItems?: (ActionItem & { meeting?: { title: string } | null })[];
};

export const serializeMeeting = (m: MeetingWithRelations) => ({
  id: m.id,
  workspaceId: m.workspaceId,
  title: m.title,
  description: m.description,
  source: m.source,
  status: m.status,
  startedAt: m.startedAt ? m.startedAt.toISOString() : null,
  endedAt: m.endedAt ? m.endedAt.toISOString() : null,
  duration: m.duration,
  recordingUrl: m.recordingUrl,
  tags: m.tags,
  participants: m.participants,
  shared: m.shared,
  shareId: m.shareId,
  publishedNotes: m.publishedNotes,
  createdById: m.createdById,
  createdAt: m.createdAt.toISOString(),
  updatedAt: m.updatedAt.toISOString(),
  summary: m.summary ? serializeSummary(m.summary) : undefined,
  segments: m.segments ? m.segments.map(serializeSegment) : undefined,
  actionItems: m.actionItems
    ? m.actionItems.map(serializeActionItem)
    : undefined,
});
