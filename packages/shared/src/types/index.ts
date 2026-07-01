import type {
  ActionItemPriority,
  ActionItemStatus,
  MeetingSource,
  MeetingStatus,
  PlanId,
  WorkspaceRole,
} from "../constants/index.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
  workspaceId: string;
  workspaceName: string;
  plan: PlanId;
  developerBypass?: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface TranscriptSegmentDto {
  id: string;
  meetingId: string;
  speakerName: string;
  text: string;
  cleanText?: string | null;
  startTime: number;
  endTime: number;
  confidence: number | null;
  edited: boolean;
  highlighted: boolean;
  isDecision: boolean;
  isActionItem: boolean;
  createdAt: string;
}

export interface MeetingSummaryDto {
  id: string;
  overview: string;
  keyPoints: string[];
  decisions: string[];
  followUpEmail: string;
  createdAt: string;
}

export interface ActionItemDto {
  id: string;
  meetingId: string;
  meetingTitle?: string;
  assigneeName: string | null;
  assigneeUserId: string | null;
  task: string;
  dueDate: string | null;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  sourceText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateAssistSuggestionDto {
  id: string;
  meetingId: string;
  userId: string;
  question: string;
  suggestion: string;
  createdAt: string;
}

export interface SharedTranscriptSegmentDto {
  id: string;
  speakerName: string;
  text: string;
  startTime: number;
}

export interface SharedSessionSummaryDto {
  overview: string;
  keyPoints: string[];
  decisions: string[];
}

/** Owner-reviewed answer the host explicitly published for viewers. */
export interface PublishedAnswerDto {
  id: string;
  text: string;
  publishedBy: string;
  createdAt: string;
}

export interface PublicSessionDto {
  id: string;
  title: string;
  status: MeetingStatus;
  live: boolean;
  ended: boolean;
  startedAt: string | null;
  endedAt: string | null;
  participants: string[];
  publishedNotes: string[];
  publishedAnswers: PublishedAnswerDto[];
  segments: SharedTranscriptSegmentDto[];
  summary: SharedSessionSummaryDto | null;
}

export interface MeetingDto {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  source: MeetingSource;
  status: MeetingStatus;
  startedAt: string | null;
  endedAt: string | null;
  duration: number;
  recordingUrl: string | null;
  tags: string[];
  participants: string[];
  shared?: boolean;
  shareId?: string | null;
  publishedNotes?: string[];
  demoMode?: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  summary?: MeetingSummaryDto | null;
  segments?: TranscriptSegmentDto[];
  actionItems?: ActionItemDto[];
}

export interface ChatMessageDto {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { meetingId: string; meetingTitle: string; snippet: string }[];
  createdAt: string;
}

export interface UsageSummary {
  plan: PlanId;
  usedMinutes: number;
  limitMinutes: number;
  importsUsed: number;
  importsLimit: number;
  periodStart: string;
  periodEnd: string;
}
