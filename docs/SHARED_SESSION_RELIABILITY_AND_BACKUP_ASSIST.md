# Shared Session Reliability & Backup Assist

_Last updated: 2026-07-02_

> Backup Assist and Offline Interview Knowledge Packs are reliability and
> preparation/reference features. They use only public shared session content,
> manually entered viewer context, and built-in role guidance. They do not
> expose host private copilot data, private prompts, private notes, or workspace
> controls.

The public shared session at `/s/:shareId` is a clean, professional, read-only
view (there is no transparent/overlay mode). It is built to be resilient and
self-healing.

## Connection state machine
The viewer derives one of: `initializing`, `connected`, `receiving`, `stale`,
`reconnecting`, `offline`, `degraded`, `ended`, `failed`. The header shows a
matching status pill and, when relevant, a banner.

## WebSocket reconnect + polling fallback
- WebSocket is primary for live transcript and published content.
- On drop, the socket auto-reconnects with exponential backoff + jitter
  (1 → 2 → 5 → 10 → 15s, capped). The old socket is closed and its listeners
  stripped before a new one opens, so events never duplicate.
- Transcript segments and published answers are de-duplicated by id.
- If the socket isn't open, the viewer polls the public shared session every ~4s
  (public transcript + host-published answers/notes + public status only). Once
  the socket reopens, polling yields to it.

## Stale detection
- If the session is live but no update arrives for ~40s, or it's been connecting
  for >10s, the viewer marks it **stale**, shows "Transcript updates are delayed.
  Aurora is reconnecting automatically.", and keeps the last transcript visible.
- The viewer never sits on an infinite blank loader.

## Last-known-good cache
- A snapshot of the **public** transcript, published answers/notes, and status is
  cached in the browser (no secrets, no tokens).
- After a refresh or while reconnecting, the last transcript is shown with
  "Showing last saved transcript while reconnecting".
- The cache is cleared when the share expires/is revoked or the meeting ends, and
  it never bypasses an expired/invalid link (a 404 from the server always wins).

## Backup Assist
Appears automatically during stale/offline/degraded/failed states and via a
manual "Backup Assist" button. It offers a job/experience selector, a context
textarea, and quick actions (answer, senior talking points, simplify, follow-up,
summarize, action items, interview-style answer), plus Generate / Copy / Clear
and one-click **Open Offline Interview Pack**.

- Endpoint: `POST /api/shared/:shareId/backup-assist` (public; validates the
  share is active/unexpired/non-revoked; rate-limited 20/min per IP+shareId;
  caps context length).
- Uses only public data (viewer's typed text + public transcript + published
  notes). Never reads host private copilot data, never persists a private item,
  never publishes. The viewer stays read-only.
- Tries AI; if unavailable, returns an **offline knowledge-pack** answer so it
  always works.

## Offline Interview Knowledge Packs (Senior Answer Guide)
One-click ("Open Offline Interview Pack", next to Backup Assist), works fully
offline (no AI, no live transcript, no network once loaded), and stays usable
even when the connection is unstable. Content targets senior (10+ years)
candidates and is aligned with US hiring/recruiting expectations —
professional, confident, business-impact focused, and realistic (not
fresher-level or generic).

**Premium reading experience.** A sticky filter bar (job selector, search,
category tabs) with **Most Asked** and **Senior Scenarios** quick filters, plus
collapsible answer cards structured as:

- Question
- Best Senior Answer (full, US professional level)
- Quick Summary (2–3 lines)
- Key Points to Mention
- Real Project Example (10+ yr candidate)
- Follow-up Tip

with **Copy Full Answer / Copy Summary / Copy Key Points** buttons, and mobile
responsive typography.

**Interview Flow Summary** (per job pack): role overview, what US hiring managers
look for, how to position 10+ years, a strong opening pitch, strengths to
highlight, red flags to avoid, best projects to discuss.

**Questions to ask the interviewer**: the 5 common questions in every pack, plus
**role-specific** questions (e.g. DevOps: "What does your current deployment
pipeline look like?", "How mature is your monitoring, alerting, and incident
response?").

20+ job titles, each surfacing 30+ senior Q&A across categories (Intro/HR,
Technical, Scenario, Architecture, Troubleshooting, Behavioral, Leadership,
Project). Preparation / reference mode only — no host private data is accessed.

**Job titles:** Data Engineer, Data Analyst, Data Architect, DevOps Engineer,
Cloud Engineer, SRE, ServiceNow Developer, ServiceNow Administrator, Software
Engineer, Backend Engineer, Full Stack Engineer, Java Developer, Python
Developer, SAP Consultant, SAP FICO Consultant, SAP MM Consultant, SAP SD
Consultant, QA Automation Engineer, Business Analyst, Project Manager / Scrum
Master.

**Common questions to ask the interviewer (in every pack):**
1. What are the biggest priorities for this role in the first 90 days?
2. What are the main challenges the team is currently trying to solve?
3. How do you measure success for this position?
4. How does this role collaborate with other teams or stakeholders?
5. What does growth look like for someone who performs well in this role?
