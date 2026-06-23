import OpenAI from "openai";
import { env, hasOpenAI } from "../config/env.js";

const client = hasOpenAI ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const MODEL = "gpt-4o-mini";

export interface SummaryResult {
  overview: string;
  keyPoints: string[];
  decisions: string[];
  followUpEmail: string;
}

export interface ExtractedActionItem {
  assigneeName: string | null;
  task: string;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  sourceText: string | null;
}

export interface TranscriptLine {
  speakerName: string;
  text: string;
}

function transcriptToText(transcript: TranscriptLine[]): string {
  return transcript.map((t) => `${t.speakerName}: ${t.text}`).join("\n");
}

async function chatJSON<T>(
  system: string,
  user: string,
  fallback: T
): Promise<T> {
  if (!client) return fallback;
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return fallback;
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn("[ai] falling back to mock:", (err as Error).message);
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API — always returns useful data, even with no API key.             */
/* -------------------------------------------------------------------------- */

export async function generateMeetingSummary(
  title: string,
  transcript: TranscriptLine[],
  vocabulary: string[] = []
): Promise<SummaryResult> {
  const text = transcriptToText(transcript);
  const fallback = mockSummary(title, transcript);
  if (!client || text.trim().length === 0) return fallback;

  return chatJSON<SummaryResult>(
    `You are Aurora, an expert meeting analyst. Produce a concise, professional meeting summary as JSON with keys:
"overview" (string, 2-4 sentences),
"keyPoints" (string[], 3-6 bullet points),
"decisions" (string[], decisions made),
"followUpEmail" (string, a ready-to-send follow up email).
${vocabulary.length ? `Domain vocabulary to spell correctly: ${vocabulary.join(", ")}.` : ""}`,
    `Meeting title: ${title}\n\nTranscript:\n${text}`,
    fallback
  );
}

export async function extractActionItems(
  transcript: TranscriptLine[]
): Promise<ExtractedActionItem[]> {
  const text = transcriptToText(transcript);
  const fallback = mockActionItems(transcript);
  if (!client || text.trim().length === 0) return fallback;

  const result = await chatJSON<{ items: ExtractedActionItem[] }>(
    `You are Aurora. Extract action items from the transcript as JSON: { "items": [{ "assigneeName": string|null, "task": string, "dueDate": string|null (ISO date), "priority": "LOW"|"MEDIUM"|"HIGH", "sourceText": string }] }. Only include real, actionable tasks.`,
    `Transcript:\n${text}`,
    { items: fallback }
  );
  return result.items ?? fallback;
}

export async function generateFollowUpEmail(
  title: string,
  summary: SummaryResult,
  actionItems: ExtractedActionItem[]
): Promise<string> {
  if (!client) return mockFollowUpEmail(title, summary, actionItems);
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are Aurora, a professional assistant. Write a concise, friendly follow-up email recapping the meeting and listing action items with owners.",
        },
        {
          role: "user",
          content: `Title: ${title}\nOverview: ${summary.overview}\nDecisions: ${summary.decisions.join("; ")}\nAction items: ${actionItems
            .map((a) => `${a.task} (${a.assigneeName ?? "unassigned"})`)
            .join("; ")}`,
        },
      ],
    });
    return (
      res.choices[0]?.message?.content ??
      mockFollowUpEmail(title, summary, actionItems)
    );
  } catch {
    return mockFollowUpEmail(title, summary, actionItems);
  }
}

export interface MeetingContext {
  meetingId: string;
  title: string;
  date: string;
  text: string;
}

export interface ChatAnswer {
  answer: string;
  citations: { meetingId: string; meetingTitle: string; snippet: string }[];
}

export async function answerMeetingQuestion(
  question: string,
  contexts: MeetingContext[]
): Promise<ChatAnswer> {
  const fallback = mockChatAnswer(question, contexts);
  if (!client || contexts.length === 0) return fallback;
  try {
    const corpus = contexts
      .map(
        (c) => `# Meeting: ${c.title} (${c.date}) [id:${c.meetingId}]\n${c.text}`
      )
      .join("\n\n");
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are Aurora, an assistant that answers questions strictly from the user's meeting transcripts and summaries. Be concise. If the answer is not in the meetings, say so.",
        },
        {
          role: "user",
          content: `Question: ${question}\n\nMeetings:\n${corpus}`,
        },
      ],
    });
    return {
      answer: res.choices[0]?.message?.content ?? fallback.answer,
      citations: fallback.citations,
    };
  } catch {
    return fallback;
  }
}

export async function generateLiveSuggestion(
  question: string,
  transcriptContext: string
): Promise<string> {
  if (!client) return mockLiveSuggestion(question);
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's private live assistant helping the user during a meeting. Give a brief, helpful suggested answer (1-3 sentences). Never suggest hiding the recording.",
        },
        {
          role: "user",
          content: `Recent transcript:\n${transcriptContext}\n\nUser asks privately: ${question}`,
        },
      ],
    });
    return res.choices[0]?.message?.content ?? mockLiveSuggestion(question);
  } catch {
    return mockLiveSuggestion(question);
  }
}

/* -------------------------------------------------------------------------- */
/* Mock generators (used when OPENAI_API_KEY is absent or on error)            */
/* -------------------------------------------------------------------------- */

function mockSummary(title: string, transcript: TranscriptLine[]): SummaryResult {
  const speakers = [...new Set(transcript.map((t) => t.speakerName))];
  const snippet = transcript
    .slice(0, 3)
    .map((t) => t.text)
    .join(" ");
  return {
    overview: `In "${title}", ${speakers.join(", ") || "the team"} discussed the key topics raised during the session. ${snippet ? `The conversation opened around: "${snippet.slice(0, 140)}…"` : ""} The group aligned on next steps and ownership for follow-up work.`,
    keyPoints: [
      "Reviewed current progress and blockers across the team.",
      "Aligned on priorities for the upcoming sprint.",
      "Discussed timelines and resourcing for key deliverables.",
      "Agreed to circulate notes and confirm owners afterward.",
    ],
    decisions: [
      "Proceed with the proposed plan and revisit in the next sync.",
      "Assign clear owners to each open action item.",
    ],
    followUpEmail: mockFollowUpEmail(
      title,
      {
        overview: "",
        keyPoints: [],
        decisions: [],
        followUpEmail: "",
      },
      mockActionItems(transcript)
    ),
  };
}

function mockActionItems(transcript: TranscriptLine[]): ExtractedActionItem[] {
  const speakers = [...new Set(transcript.map((t) => t.speakerName))];
  const a = speakers[0] ?? "Mustafa Ali";
  const b = speakers[1] ?? "Shaibaz Ansari";
  const inDays = (d: number) =>
    new Date(Date.now() + d * 86400000).toISOString();
  return [
    {
      assigneeName: a,
      task: "Share the finalized meeting notes with all participants.",
      dueDate: inDays(1),
      priority: "HIGH",
      sourceText: "We agreed to circulate notes afterward.",
    },
    {
      assigneeName: b,
      task: "Prepare the draft proposal for review before the next sync.",
      dueDate: inDays(3),
      priority: "MEDIUM",
      sourceText: "Let's have the draft ready for the next meeting.",
    },
    {
      assigneeName: a,
      task: "Confirm timelines and resourcing for the key deliverable.",
      dueDate: inDays(5),
      priority: "MEDIUM",
      sourceText: "We need to confirm the timeline.",
    },
  ];
}

function mockFollowUpEmail(
  title: string,
  _summary: SummaryResult,
  actionItems: ExtractedActionItem[]
): string {
  const items = actionItems
    .map((a) => `  • ${a.task}${a.assigneeName ? ` — ${a.assigneeName}` : ""}`)
    .join("\n");
  return `Subject: Recap & next steps — ${title}

Hi team,

Thanks for joining ${title}. Here's a quick recap and the action items we agreed on:

Action items:
${items}

Aurora has saved the full transcript and summary to the workspace — let me know if anything looks off.

Best,
Aurora.ai`;
}

function mockChatAnswer(
  question: string,
  contexts: MeetingContext[]
): ChatAnswer {
  const top = contexts.slice(0, 2);
  if (contexts.length === 0) {
    return {
      answer:
        "I couldn't find any meetings matching that yet. Record or upload a meeting and I'll be able to answer across your history.",
      citations: [],
    };
  }
  return {
    answer: `Based on your meetings, here's what I found regarding "${question}": the most relevant discussion appears in "${top[0]?.title}". The team covered the topic and assigned follow-up owners. Open the meeting for the full transcript and decisions.`,
    citations: top.map((c) => ({
      meetingId: c.meetingId,
      meetingTitle: c.title,
      snippet: c.text.slice(0, 160) + (c.text.length > 160 ? "…" : ""),
    })),
  };
}

function mockLiveSuggestion(question: string): string {
  return `Suggested response: Acknowledge the point about "${question.slice(
    0,
    60
  )}", share the relevant context from earlier in the meeting, and propose a concrete next step with an owner and a date.`;
}
