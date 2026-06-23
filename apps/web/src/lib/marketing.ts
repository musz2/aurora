import {
  Mic,
  FileAudio,
  Users,
  Sparkles,
  ListChecks,
  MessageSquare,
  Search,
  Workflow,
  Monitor,
  Smartphone,
  Upload,
  BookMarked,
  Calendar,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  TrendingUp,
  UserSearch,
  Building2,
  Clapperboard,
  PhoneCall,
} from "lucide-react";

export const CORE_FEATURES = [
  { icon: Mic, title: "Live transcription", desc: "Real-time speech-to-text streaming with timestamps as the meeting happens." },
  { icon: FileAudio, title: "Audio playback", desc: "Replay any moment with synced transcript and speaker context." },
  { icon: Users, title: "Speaker identification", desc: "Automatically separate and label who said what." },
  { icon: Sparkles, title: "AI summaries", desc: "Overviews, key points, and decisions generated the moment a meeting ends." },
  { icon: ListChecks, title: "Action items", desc: "Tasks, owners, due dates, and priorities detected automatically." },
  { icon: MessageSquare, title: "Aurora AI Chat", desc: "Ask questions across every meeting with cited transcript sources." },
  { icon: Search, title: "Cross-meeting search", desc: "Find decisions, topics, and tasks across your entire history." },
  { icon: Workflow, title: "Meeting workflows", desc: "Route summaries and tasks into the tools your team already uses." },
  { icon: Monitor, title: "Desktop recording", desc: "Capture any meeting on macOS or Windows with a visible indicator." },
  { icon: Smartphone, title: "Mobile recording", desc: "Record in-person conversations from iOS and Android." },
  { icon: Upload, title: "File import", desc: "Bring existing MP3, WAV, M4A, and MP4 files into Aurora." },
  { icon: BookMarked, title: "Custom vocabulary", desc: "Teach Aurora your product names, acronyms, and domain terms." },
];

export const USE_CASES = [
  { icon: Briefcase, title: "Professionals", desc: "Never take manual notes again. Stay present and let Aurora capture everything." },
  { icon: GraduationCap, title: "Students & Education", desc: "Searchable lecture transcripts, summaries, and study-ready highlights." },
  { icon: TrendingUp, title: "Sales Teams", desc: "Capture objections, next steps, and pricing discussions into your CRM." },
  { icon: UserSearch, title: "Recruiters", desc: "Structured interview notes, scorecards, and candidate follow-ups." },
  { icon: Building2, title: "Enterprises", desc: "Governed, consent-first meeting intelligence with audit logs and SSO." },
  { icon: Clapperboard, title: "Media Teams", desc: "Turn interviews and recordings into transcripts and quotable highlights." },
  { icon: PhoneCall, title: "SDR Teams", desc: "Qualify faster with auto-logged calls, summaries, and action items." },
];

export const AI_AGENTS = [
  { title: "Meeting Agent", desc: "Summarizes, extracts tasks, and drafts follow-up emails for any meeting." },
  { title: "Sales Agent", desc: "Tracks objections, competitors, and next steps; syncs to CRM." },
  { title: "SDR Agent", desc: "Qualifies prospects and logs outcomes from every discovery call." },
  { title: "Recruiting Agent", desc: "Builds structured scorecards and candidate summaries." },
  { title: "Education Agent", desc: "Creates study notes, key concepts, and quizzes from lectures." },
  { title: "Media Agent", desc: "Generates transcripts, highlights, and shareable quotes." },
];

export const INTEGRATIONS = [
  { name: "Zoom", category: "Meetings", color: "#2D8CFF" },
  { name: "Google Meet", category: "Meetings", color: "#00897B" },
  { name: "Microsoft Teams", category: "Meetings", color: "#5059C9" },
  { name: "Google Calendar", category: "Calendar", color: "#4285F4" },
  { name: "Outlook Calendar", category: "Calendar", color: "#0078D4" },
  { name: "Slack", category: "Collaboration", color: "#4A154B" },
  { name: "Salesforce", category: "CRM", color: "#00A1E0" },
  { name: "HubSpot", category: "CRM", color: "#FF7A59" },
  { name: "ClickUp", category: "Tasks", color: "#7B68EE" },
  { name: "Asana", category: "Tasks", color: "#F06A6A" },
  { name: "Jira", category: "Tasks", color: "#0052CC" },
  { name: "Notion", category: "Docs", color: "#000000" },
  { name: "Google Drive", category: "Storage", color: "#1FA463" },
  { name: "Dropbox", category: "Storage", color: "#0061FF" },
  { name: "Zapier", category: "Automation", color: "#FF4A00" },
];

export const HOW_IT_WORKS = [
  { step: "1", title: "Sign up", desc: "Create your workspace in seconds." },
  { step: "2", title: "Connect calendar", desc: "Let Aurora know when meetings happen." },
  { step: "3", title: "Record meeting", desc: "Consent-first, with a visible indicator." },
  { step: "4", title: "Aurora transcribes", desc: "Live speech-to-text with timestamps." },
  { step: "5", title: "Identify speakers", desc: "Know exactly who said what." },
  { step: "6", title: "Summarize", desc: "Overviews, key points, and decisions." },
  { step: "7", title: "Detect tasks", desc: "Action items with owners and due dates." },
  { step: "8", title: "Ask AI Chat", desc: "Query across your meeting history." },
  { step: "9", title: "Share & export", desc: "Send notes anywhere your team works." },
];

export const PROBLEMS = [
  "People forget what was discussed",
  "Manual notes waste time",
  "Long meetings are hard to review",
  "Action items get missed",
  "Old decisions are hard to find",
  "Teams juggle too many tools",
];

export const SOLUTIONS = [
  { icon: Mic, title: "Records meetings", desc: "Consent-first capture across web, desktop, and mobile." },
  { icon: FileAudio, title: "Converts speech to text", desc: "Accurate, speaker-labeled transcripts in real time." },
  { icon: Sparkles, title: "Creates summaries", desc: "Key points and decisions, ready the moment you stop." },
  { icon: ListChecks, title: "Detects tasks", desc: "Action items with owners, dates, and priorities." },
  { icon: Search, title: "Makes meetings searchable", desc: "Find anything across your entire history instantly." },
  { icon: Workflow, title: "Integrates with work tools", desc: "Push notes and tasks where your team already works." },
];

export {
  ShieldCheck,
  Calendar,
};
