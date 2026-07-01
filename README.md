# Aurora.ai — AI Meeting Assistant & Meeting Knowledge Platform

> Turn every meeting into searchable intelligence.

Aurora.ai records conversations, transcribes speech to text, generates AI
summaries, detects action items, lets you search and chat across your entire
meeting history, and provides a **consent-first** real‑time assistant during
live meetings.

Aurora separates real production behavior from demo behavior. Real meetings and
uploads return clear "not configured" errors when AI or speech providers are
missing. Demo sessions and demo uploads use sample data explicitly.

---

## ✨ Features

- **Live transcription** over WebSockets (Deepgram live STT; explicit demo mode)
- **Desktop capture MVP** with Electron, microphone capture, private overlay, and private copilot panel
- **Browser recording** with the MediaRecorder API and a visible recording indicator
- **Consent-first** flow — consent modal + always‑visible recording status (no stealth recording)
- **AI summaries** — overview, key points, decisions, follow‑up email
- **Action item detection** — assignee, task, due date, priority, source sentence
- **Aurora AI Chat** — ask questions across all meetings with cited sources
- **Cross-meeting search** — transcripts, summaries, decisions, action items
- **File import** — MP3, WAV, M4A, MP4 through an upload transcription provider interface
- **Calendar link detection** — Zoom, Google Meet, and Microsoft Teams links from event title, location, or description
- **Visible auto-join modes** — bot participant identity or no-bot desktop/browser capture mode
- **Exports** — PDF, DOCX, TXT, SRT, VTT, and JSON
- **Custom vocabulary**, speaker identification, audio‑playback UI
- **Team workspace** — members, roles, invitations
- **Integrations dashboard** — Zoom, Google Meet, Microsoft Teams, Google Calendar, Outlook Calendar (OAuth only)
- **Billing & plan limits** — Basic / Pro / Business / Enterprise with usage meters
- **Security & governance** — consent policies, data retention, audit log model, SSO/SCIM (UI)
- Premium landing site: cinematic video hero, features, use cases, integrations, pricing, security

---

## 🧱 Tech stack

**Web frontend** — React + Vite + TypeScript, Tailwind CSS, Framer Motion, Zustand,
TanStack Query, React Router, Lucide icons.

**Desktop** — Electron + React + Vite + TypeScript for live microphone capture
and a private overlay.

**Backend** — Node.js + Express + TypeScript, PostgreSQL, Prisma ORM, Redis
(optional, with in‑memory fallback), WebSockets, JWT auth (access + refresh),
role‑based access control.

**AI / Speech** — OpenAI for summaries, chat, action items, and emails when
configured; Deepgram live STT; upload transcription provider interface with
Deepgram/OpenAI stubs and explicit demo sample provider.

**Storage** — local filesystem adapter (dev) / S3‑compatible adapter (prod).

---

## 📁 Monorepo structure

```
aurora-ai/
  apps/
    web/        # React + Vite frontend
    server/     # Express + Prisma + WebSocket API
    desktop/    # Electron + React desktop capture app
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
| `pnpm db:migrate` | Apply Prisma migrations (dev) |
| `pnpm db:deploy` | Apply migrations in production (`migrate deploy`) |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Prisma Studio |

---

## ☁️ Deployment (Railway + Vercel)

Aurora is built to deploy as a **split app**: the API/WebSocket server on
**Railway** (with managed Postgres) and the web frontend on **Vercel**. It runs
fully in **mock/demo mode** with no external provider credentials — only a
database and JWT secrets are required.

### Overview

```
┌────────────┐     HTTPS / WSS      ┌─────────────────────┐
│  Vercel    │ ───────────────────▶ │  Railway            │
│  (web SPA) │   VITE_API_URL /     │  Express API + WS    │
│            │   VITE_WS_URL        │  Prisma → Postgres   │
└────────────┘                      └─────────────────────┘
```

### Backend on Railway

The repo ships [`railway.json`](./railway.json) and
[`apps/server/Dockerfile`](./apps/server/Dockerfile). Railway builds the image,
runs migrations, and starts the server.

1. **Create a project** → add a **PostgreSQL** plugin (Railway sets `DATABASE_URL`).
   Optionally add **Redis** (Railway sets `REDIS_URL`; if omitted, Aurora falls
   back to an in‑memory cache automatically).
2. **Deploy from repo.** `railway.json` selects the Dockerfile builder. No root
   directory change is needed (the Dockerfile builds from the repo root).
3. **Set env vars** (mock mode):
   - `NODE_ENV=production`
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` — strong random strings (required in prod)
   - `FRONTEND_URL=https://<your-vercel-app>.vercel.app`
   - `DATABASE_URL` — injected by the Postgres plugin
   - *(optional)* `CORS_ALLOWED_ORIGINS=https://preview-1.vercel.app,https://...`
4. **Start command** (already in `railway.json`) runs migrations then boots:
   ```
   pnpm --filter @aurora/server db:deploy && node apps/server/dist/index.js
   ```
5. **Health check**: `GET /api/health` (configured as the Railway healthcheck path).
6. *(optional)* Seed demo data once: in the Railway shell run
   `pnpm --filter @aurora/server db:seed`.

The server binds `0.0.0.0:$PORT` (Railway injects `PORT`).

### Frontend on Vercel

The repo ships [`apps/web/vercel.json`](./apps/web/vercel.json).

1. **Import the repo**, set **Root Directory = `apps/web`**.
2. Vercel uses `vercel.json` (Vite framework, SPA rewrite to `index.html`, and a
   monorepo-aware build that compiles `@aurora/shared` first).
3. **Set build-time env vars** (Project → Settings → Environment Variables):
   - `VITE_API_URL=https://<your-railway-app>.up.railway.app`
   - `VITE_WS_URL=wss://<your-railway-app>.up.railway.app/ws`
4. Deploy. After the first deploy, copy the Vercel URL into Railway’s
   `FRONTEND_URL` so CORS allows it.

### CORS & deployment URLs

The API allows requests from localhost (dev/preview) plus:

- **`FRONTEND_URL`** — your canonical web origin (the Vercel URL).
- **`CORS_ALLOWED_ORIGINS`** — optional comma-separated extra origins (preview
  deploys, custom domains).

Blocked origins get a clear error: *“Origin … is not allowed by CORS. Add it to
FRONTEND_URL or CORS_ALLOWED_ORIGINS.”*

### Database migration

```bash
# production (Railway runs this automatically on deploy)
pnpm --filter @aurora/server db:deploy
```

### Health check

```bash
curl https://<your-railway-app>.up.railway.app/api/health
# → { "status": "ok", "services": { "openai": "not_configured", ... } }
```

### What works in mock mode (no provider keys)

Dashboard, meetings list/detail, live + demo sessions, transcript segment
actions, finalization review, summaries/decisions/action items (clearly labeled
**demo/mock**), shared viewer, private host-only copilot, exports, and
integration **mock** action states.

### What needs real credentials later

| Capability | Var(s) |
| --- | --- |
| Real live transcription | `DEEPGRAM_API_KEY` |
| Real AI summaries / chat / live copilot | `OPENAI_API_KEY` |
| Real Zoom / Meet / Teams / calendar / CRM | provider OAuth vars (see `.env.example`) |
| Real billing | `STRIPE_*` |
| Cloud file storage | `S3_*` |

Until set, those paths return honest *“not configured”* errors — no faked
provider behavior.

### Provider approval notes (Zoom / Meet / Teams)

Real meeting-platform auto-join requires marketplace app review and OAuth
approval (Zoom Marketplace, Google Cloud OAuth consent, Microsoft Entra app
registration). Aurora never does stealth joining or hidden recording — the
recording indicator and consent flow stay visible. Auto/bot join is not
implemented and is never claimed; connected providers are used for calendar
sync and meeting-link import only.

### Troubleshooting

- **CORS error in the browser** → set `FRONTEND_URL` (and/or `CORS_ALLOWED_ORIGINS`)
  on the server to the exact web origin, then redeploy.
- **Server exits immediately in production** → the env validator refuses to boot
  without `DATABASE_URL` or with default JWT secrets; set them.
- **WebSocket won’t connect** → ensure `VITE_WS_URL` uses `wss://` in production
  and points at the Railway host.
- **Migrations didn’t apply** → run `pnpm --filter @aurora/server db:deploy`.
- **Docker build** → build from the repo root:
  `docker build -f apps/server/Dockerfile -t aurora-server .`

---

## 🔌 API overview

`/api/auth` (signup, login, logout, refresh, me) ·
`/api/meetings` (CRUD, start, stop, summarize, transcript) ·
`/api/action-items` (list, update, extract) ·
`/api/ai` (chat, summarize, follow-up-email) ·
`/api/search` · `/api/uploads` (audio/video) · `/api/calendar` ·
`/api/workspace` (members, invite, vocabulary) ·
`/api/integrations` · `/api/billing` · `/api/dashboard` · `/api/admin`

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
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | ✅ | Token signing (must be non-default in production) |
| `FRONTEND_URL` | ✅ (prod) | Canonical web origin for CORS (your Vercel URL) |
| `CORS_ALLOWED_ORIGINS` | ➖ | Extra allowed origins, comma-separated |
| `OPENAI_API_KEY` | ➖ | Required for real AI output; demo mode can use samples |
| `DEEPGRAM_API_KEY` | ➖ | Required for real live STT / Deepgram upload provider |
| `UPLOAD_TRANSCRIPTION_PROVIDER` | ➖ | `deepgram` or `openai`; defaults to `deepgram` |
| `VITE_API_URL`, `VITE_WS_URL` | ➖ | Web build-time API/WebSocket endpoints for split deployments |
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
| Calendar detection | Mock calendar events with real Zoom/Meet/Teams link detection | Google Calendar / Outlook Calendar APIs |
| Exports | Local generated Markdown/PDF/DOCX/TXT/SRT/VTT/JSON | Same export service |
| Integrations | "Not configured" until OAuth env vars are set | Provider OAuth (Zoom, Google, Microsoft) — no passwords |

The live session **never** falls back to demo transcript during a real recording.

### Live transcription (Deepgram)

`DEEPGRAM_API_KEY` is read by the server from local environment variables.
`/api/config` reports `liveTranscription: true` only when it's set. Pipeline:

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

### Integrations (OAuth only)

Aurora supports **exactly five** integrations, all via provider OAuth — Zoom,
Google Meet, Microsoft Teams (meeting platforms) and Google Calendar, Outlook
Calendar (calendars). **Email passwords are never stored, committed, logged, or
used.** Cards show **Connected**, **Not configured**, **Connect / Needs
approval**, or **Error**. Aurora never shows a fake connected state. See
`docs/INTEGRATIONS_STATUS.md` for full setup.

| Integration | Env vars |
| --- | --- |
| Google Meet + Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_CALENDAR_SCOPES` |
| Microsoft Teams + Outlook Calendar | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`, `MICROSOFT_TENANT_ID`, `MICROSOFT_GRAPH_SCOPES` |
| Zoom | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_REDIRECT_URI`, `ZOOM_SCOPES` |

### OAuth setup

Set these callback URLs in each provider app:

| Provider | Callback URL |
| --- | --- |
| Google | `<SERVER_URL>/api/integrations/oauth/google/callback` |
| Microsoft | `<SERVER_URL>/api/integrations/oauth/microsoft/callback` |
| Zoom | `<SERVER_URL>/api/integrations/oauth/zoom/callback` |

Default scopes (override via the `*_SCOPES` env vars): Google —
`calendar.readonly`, `calendar.events.readonly`, `openid`, `email`; Microsoft —
`offline_access`, `Calendars.Read`, `User.Read`; Zoom — `meeting:read`,
`user:read`. Tokens are encrypted at rest and refreshed automatically.

### Configured vs not configured

If a provider's OAuth credentials are missing, its card shows **Not configured**
and calendars fall back to mock events with real link detection. When
credentials exist but OAuth consent has not been completed, Aurora
shows **Needs approval**. When OAuth or a supported private token is present,
Aurora can make live calls and stores provider tokens encrypted in the existing
integration metadata.

### Provider approval required

Bot joining is never stealth. Zoom, Google Meet, and Microsoft Teams bot flows
require provider app permissions, marketplace/admin approval where applicable,
and a visible Aurora participant identity. Until those approvals are complete,
Aurora exposes bot join preparation states such as `pending_credentials` and
`ready_to_join`, plus no-bot desktop/browser capture.

---

## 🛡️ Ethics & privacy

Aurora is **consent-first by design**. It never records in stealth: a visible
recording indicator is always shown and consent acknowledgement is required
before every recording. There is no hidden monitoring or platform‑indicator
bypass.

### Private real-time assistant

Aurora includes a host-only private copilot for live meetings. It detects
questions in the live transcript, generates private suggested answers, and lets
the host ask Aurora privately in these modes: Interview, Sales Call, Technical
Meeting, Client Call, Daily Standup, and Recruiting.

Private assistant output and private notes are never returned by the public
shared-session API. Shared viewers can only see transcript segments, summary
fields, and notes the host manually publishes. The host can explicitly copy a
suggestion, save it as a private note, publish it to shared notes, publish it to
the transcript, or convert it into a follow-up task.

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
