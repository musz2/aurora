# Aurora.ai — AI Meeting Assistant & Meeting Knowledge Platform

> Turn every meeting into searchable intelligence.

Aurora.ai records conversations, transcribes speech to text, generates AI
summaries, detects action items, lets you search and chat across your entire
meeting history, and provides a **consent-first** real‑time assistant during
live meetings.

It runs fully out of the box: if no AI / speech API keys are present, Aurora
uses realistic **mock fallbacks** and a **simulated transcription engine**, so
you can demo every feature without external services.

---

## ✨ Features

- **Live transcription** over WebSockets (simulated engine, Deepgram/Whisper‑ready)
- **Browser recording** with the MediaRecorder API and a visible recording indicator
- **Consent-first** flow — consent modal + always‑visible recording status (no stealth recording)
- **AI summaries** — overview, key points, decisions, follow‑up email
- **Action item detection** — assignee, task, due date, priority, source sentence
- **Aurora AI Chat** — ask questions across all meetings with cited sources
- **Cross-meeting search** — transcripts, summaries, decisions, action items
- **File import** — MP3, WAV, M4A, MP4 → transcript + summary
- **Custom vocabulary**, speaker identification, audio‑playback UI
- **Team workspace** — members, roles, invitations
- **Integrations dashboard** — Zoom, Meet, Teams, Slack, Salesforce, HubSpot, Jira, Notion…
- **Billing & plan limits** — Basic / Pro / Business / Enterprise with usage meters
- **Security & governance** — consent policies, data retention, audit log model, SSO/SCIM (UI)
- Premium landing site: cinematic video hero, features, use cases, integrations, pricing, security

---

## 🧱 Tech stack

**Frontend** — React + Vite + TypeScript, Tailwind CSS, Framer Motion, Zustand,
TanStack Query, React Router, Lucide icons.

**Backend** — Node.js + Express + TypeScript, PostgreSQL, Prisma ORM, Redis
(optional, with in‑memory fallback), WebSockets, JWT auth (access + refresh),
role‑based access control.

**AI / Speech** — OpenAI (summaries, chat, action items, emails) with mock
fallback; Deepgram/Whisper‑ready transcription abstraction; pgvector‑ready schema.

**Storage** — local filesystem adapter (dev) / S3‑compatible adapter (prod).

---

## 📁 Monorepo structure

```
aurora-ai/
  apps/
    web/        # React + Vite frontend
    server/     # Express + Prisma + WebSocket API
  packages/
    shared/     # Shared types, zod schemas, plan constants, socket events
  docker-compose.yml
  .env.example
```

---

## 🚀 Getting started

### Prerequisites
- Node.js ≥ 20, pnpm ≥ 9, Docker

### 1. Install
```bash
pnpm install
```

### 2. Start infrastructure (Postgres + Redis)
```bash
docker compose up -d
```

### 3. Configure environment
```bash
cp .env.example .env
```
All AI/speech/payment keys are **optional** — leave them blank to use mock
fallbacks. The defaults already point at the Docker Postgres/Redis.

### 4. Database: generate client, migrate, seed
```bash
pnpm db:generate
pnpm db:migrate     # applies prisma/migrations
pnpm db:seed        # demo workspace, users, meetings, summaries, action items
```

### 5. Run everything
```bash
pnpm dev
```
- Web:    http://localhost:5173
- API:    http://localhost:4000/api
- Socket: ws://localhost:4000/ws
- Health: http://localhost:4000/api/health

### Demo login
```
Email:    justin@aurora.ai
Password: password123
```
(Other seeded demo users: pat@, emily@, rachel@aurora.ai — same password.)

---

## 📜 Scripts (root)

| Script | Description |
| --- | --- |
| `pnpm dev` | Run web + server in parallel |
| `pnpm build` | Build shared → server → web |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Prisma Studio |

---

## 🔌 API overview

`/api/auth` (signup, login, logout, refresh, me) ·
`/api/meetings` (CRUD, start, stop, summarize, transcript) ·
`/api/action-items` (list, update, extract) ·
`/api/ai` (chat, summarize, follow-up-email) ·
`/api/search` · `/api/uploads` (audio/video) ·
`/api/workspace` (members, invite, vocabulary) ·
`/api/integrations` · `/api/billing` · `/api/dashboard`

**WebSocket events** — client: `meeting:start`, `meeting:stop`,
`transcript:audio-chunk`, `ai:ask-live`; server: `meeting:status`,
`transcript:segment`, `transcript:partial`, `ai:suggestion`, `ai:error`,
`recording:warning`.

---

## 🔐 Environment variables

See [`.env.example`](./.env.example). Summary:

| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection |
| `REDIS_URL` | ➖ | Falls back to in‑memory cache |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | ✅ | Token signing |
| `OPENAI_API_KEY` | ➖ | Mock AI used if empty |
| `DEEPGRAM_API_KEY` | ➖ | Simulated transcription if empty |
| `STRIPE_SECRET_KEY` | ➖ | Billing placeholder if empty |
| `S3_*` | ➖ | Local storage if empty |

---

## 🧪 Real vs. honest "not configured"

| Capability | Without keys | With keys (production) |
| --- | --- | --- |
| Live transcription | Real sessions show an honest "STT not configured" error; **Play demo** streams sample data | Real microphone → Deepgram `nova-2` live STT |
| Summaries / chat / Q&A | "AI not configured" states (no fabricated output) | OpenAI |
| Payments | "Billing not configured" (demo plan switch) | Stripe Checkout/Portal |
| Storage | Local `apps/server/uploads` | S3‑compatible bucket |
| Integrations | "Not configured / Coming soon" cards | Official OAuth APIs |

The live session **never** falls back to demo transcript during a real recording.

### Live transcription (Deepgram)

`DEEPGRAM_API_KEY` is read from the **root `.env`** into the server. `/api/config`
reports `liveTranscription: true` only when it's set. Pipeline:

```
mic → MicLevelMeter → MediaRecorder (audio/webm;codecs=opus, 150ms) →
binary WS frames → server → Deepgram live (nova-2, interim_results,
endpointing:200, vad_events) → interim/final events → transcript UI → viewer
```

Audio chunks are **buffered until Deepgram's `Open` event** and then flushed, so
the WebM/Opus header (in the first chunk) is never lost — this was the cause of
the earlier "disconnected / DG events 0" issue. A KeepAlive ping prevents idle
disconnects. In dev, the host console shows a debug panel (packets sent/received,
Deepgram state + close reason, DG events, last interim/final).

### Integration env vars (optional)

Cards show **Not configured** until the matching vars are set (see `.env.example`):

| Integration | Env vars |
| --- | --- |
| Google Meet / Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Teams / Outlook | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| Zoom | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` |
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` |
| Notion | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` |
| HubSpot | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` |
| Salesforce | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` |
| Zapier / Webhooks | `ZAPIER_WEBHOOK_URL` |
| Email export | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` |

---

## 🛡️ Ethics & privacy

Aurora is **consent-first by design**. It never records in stealth: a visible
recording indicator is always shown and consent acknowledgement is required
before every recording. There is no hidden monitoring or platform‑indicator
bypass.

---

## 🔭 Next production steps

- Add real OpenAI + Deepgram keys and wire audio chunks to the speech stream
- Move post‑meeting summarization to a Redis/BullMQ worker (`workers/processing.worker.ts`)
- Add pgvector embeddings to `TranscriptSegment` for semantic search
- Real Stripe Checkout + webhooks; real SSO/SCIM providers
- S3 storage adapter + signed URLs for recording playback
- E2E tests + CI

---

## ⚠️ Limitations

- Transcription and AI output are simulated unless keys are provided.
- Audio playback, Stripe, SSO/SCIM, and OAuth logins are UI placeholders wired to be production‑ready.
- The web bundle is single‑chunk; code‑splitting is a straightforward enhancement.
