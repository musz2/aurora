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
Email:    mustafa@aurora.ai
Password: password123
```
(Other seeded users: shaibaz@, ruknuddin@, haseebuddin@ — same password.)

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

## 🧪 Mock vs. real (API‑ready)

| Capability | Without keys (default) | With keys (production) |
| --- | --- | --- |
| Transcription | Realistic simulated engine | Deepgram/Whisper via the same stream interface |
| Summaries / chat / action items | Deterministic mock output | OpenAI |
| Payments | Plan switches instantly (demo) | Stripe Checkout/Portal |
| Storage | Local `apps/server/uploads` | S3‑compatible bucket |

The service layer is identical in both modes — only the adapter changes.

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
