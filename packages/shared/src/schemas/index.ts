import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  workspaceName: z.string().min(2).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createMeetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  source: z
    .enum(["LIVE", "UPLOAD", "ZOOM", "MEET", "TEAMS"])
    .default("LIVE"),
});
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const transcriptSegmentSchema = z.object({
  speakerName: z.string().default("Speaker"),
  text: z.string().min(1),
  startTime: z.number().nonnegative().default(0),
  endTime: z.number().nonnegative().default(0),
  confidence: z.number().min(0).max(1).optional(),
});
export type TranscriptSegmentInput = z.infer<typeof transcriptSegmentSchema>;

export const chatSchema = z.object({
  message: z.string().min(1, "Ask a question"),
  meetingId: z.string().optional(),
  scope: z.enum(["current", "all"]).default("all"),
});
export type ChatInput = z.infer<typeof chatSchema>;

export const updateActionItemSchema = z.object({
  task: z.string().optional(),
  assigneeName: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
});
export type UpdateActionItemInput = z.infer<typeof updateActionItemSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const vocabularySchema = z.object({
  term: z.string().min(1),
  description: z.string().optional(),
});
export type VocabularyInput = z.infer<typeof vocabularySchema>;
