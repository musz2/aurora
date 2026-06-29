# Aurora Product Audit

_Audit date: 2026-06-29. Auditor: engineering pass on the existing repository._

Aurora is a pnpm monorepo: `@aurora/server` (Express + Prisma + Postgres/pgvector,
WebSocket sockets), `@aurora/web` (React + Vite + Tailwind + React Query), an
`@aurora/desktop` (Electron) shell, and `@aurora/shared` (types, schemas, plan and
integration constants).

The product has two halves, exactly as intended:

1. **Otter-style shared meeting product** — live transcription, summaries, action
   items, speaker labels, searchable history, exports, a public shared viewer,
   integrations, billing/limits.
2. **Cluely-style private host assistant** — a host-only live copilot
   (`private-assistant.service.ts`) whose output is never published to the shared
   viewer unless the host explicitly publishes a note.

The codebase is deliberately **honest about mock vs. real**: with no provider keys,
demo sessions/uploads use clearly-labelled sample output and real sessions return
`503 not configured` instead of faking a provider. This audit preserves that
property.

## Baseline state (verified 2026-06-29)

| Check | Command | Result |
| --- | --- | --- |
| Dependencies | clean `rm -rf node_modules … && pnpm install` | ✅ installs (433 pkgs) |
| Prisma client | `pnpm db:generate` | ✅ generated (v5.22.0) |
| Migrations | `prisma migrate status` | ✅ 5 migrations, DB up to date |
| Typecheck | `pnpm typecheck` | ✅ all 4 projects clean |
| Server tests | `pnpm --filter @aurora/server test` | ✅ 41/41 pass |
| Build | `pnpm build` | ✅ shared + server + web + desktop |

Infra note: a sibling project already binds host ports 5432/6379, so
`docker compose up -d` for this repo cannot rebind them — but a compatible Postgres
(`aurora/aurora/aurora`) and Redis are already listening on those ports, so the app
works against them unchanged.

## What is already implemented (real)

- **Auth**: JWT access/refresh with rotation + refresh interceptor on the web client.
- **Live transcription pipeline**: WebSocket sockets (`sockets/index.ts`), Deepgram
  live service (`deepgram.service.ts`) with a simulated fallback engine
  (`transcript.simulator.ts`).
- **Meeting finalization**: `meeting-finalization.service.ts` (tested) produces
  summary / decisions / action items with an AI-not-configured fallback path.
- **Speaker service**: initials, deterministic color, rename validation (tested).
- **Public viewer safety**: `shared-viewer.service.ts` is an allow-list chokepoint
  with a `FORBIDDEN_SHARED_KEYS` assertion, and the viewer route also uses a Prisma
  `select` allow-list — double protection (tested).
- **Private assistant**: `private-assistant.service.ts` (host-only, tested).
- **Exports**: `export.service.ts` supports TXT/JSON/SRT/VTT/Markdown variants (tested).
- **Integrations**: `integrations.service.ts` with honest per-provider states
  (`CONNECTED` only on real OAuth/private-token), OAuth service (tested).
- **Billing**: `billing.routes.ts` with demo/real plan switching keyed off Stripe config.
- **Usage limits**: `usage.service.ts`.
- **Config capability endpoint**: `/api/config` reports which services are configured.

## What is mock/demo only (by design, honest)

- AI summaries/action-items/chat/live-suggestions → sample output **only** when a
  session/upload is explicitly `demoMode`, otherwise `503 not configured`.
- Live transcription → simulated engine when `DEEPGRAM_API_KEY` is absent.
- Billing → demo plan switch when Stripe keys absent.
- Many integrations → `MOCK_MODE`/`NOT_CONFIGURED` until env credentials present.
- Calendar `/events` → mock events (with real link detection) until a calendar
  provider is OAuth-connected.

## What was broken (found this pass)

1. **Demo uploads could not finalize without OpenAI** — `uploads.routes.ts` passed
   `demoMode` to the transcription provider but **hardcoded `{ demoMode: false }`**
   into `generateMeetingSummary` / `extractActionItems`, so a demo upload threw
   `503` at summary time. (Fixed in Loop 1.)
2. **Split-deploy config fetch broken** — `useConfig.ts` called `/api/config` via a
   raw relative `axios.get`, ignoring `VITE_API_URL`. On a split Vercel(web) +
   Railway(api) deploy it hit the Vercel origin, which has no `/api`. (Fixed in Loop 1.)
3. **Fake calendar "connected" state** — `CalendarPage.tsx` seeded
   `connected = { google: true }` in local React state and "Connect" just flipped
   local state, with no backend confirmation. (Fixed in Loop 1.)

## Loop 2 outcomes (Otter-style engine hardening, 2026-06-29)

Implemented + verified (server tests 47 → 65, all gates green):
- Reconnect-safe transcript **segment deduplication** (in-session window + DB recent-finals check).
- **Canonical recording states** (idle/connecting/recording/paused/reconnecting/stopped/failed).
- **Share revoke** (rotates shareId so old links die) + **share expiry** (`shareExpiresAt`,
  enforced in the viewer) + **viewer-access audit** (`session_viewed`).
- **Real OpenAI Whisper** batch upload transcription (guarded by `hasOpenAI`, honest
  single-speaker labelling, honest fallback) — demo upload still works keyless.
- Search **snippets + citation-like references**; export **content/coverage tests** for all
  6 formats; viewer **split-deploy fix** + self-terminating polling.

## Loop 3–5 outcomes (2026-06-29)

- **Loop 3 (Private Copilot):** 7 modes, intent parsing, structured 6-part responses +
  confidence, full host-only context, demo fallback; new dark-premium Copilot UI (floating
  overlay + 3-column page + tabs + keyboard shortcut + consent-first + confirmed publish).
- **Loop 4 (Billing/limits/integrations/deploy):** real Stripe Checkout/Portal/webhook
  (guarded; **no faked payments** — plan changes only via verified webhook), honest demo
  billing, usage limits (minutes/imports/concurrent) with upload import cap enforced, verified
  integrations honesty + real Slack/Drive/HubSpot paths, verified Railway/Vercel/Docker/CORS/health.
- **Loop 5 (Quality):** app-level integration tests (health/config/viewer-404/auth-401/webhook-503),
  Stripe + usage unit tests, Playwright scaffold (run instructions documented; not executed here).
- Server tests: 41 (baseline) → **85**. typecheck + build green throughout.

## What is missing for Otter-style quality (gap → `OTTER_CONCEPT_GAP_MATRIX.md`)

Remaining after Loop 2: SSE/WebSocket push for the shared viewer (deferred — public,
unauthenticated; polling optimized instead), embedding/vector semantic search (structure
documented in `schema.prisma`), Deepgram **prerecorded** (diarized) upload transcription.

## What is missing for safe Cluely-style assistant (gap → `PRIVATE_ASSISTANT_GAP_MATRIX.md`)

Highlights: explicit meeting **modes**, more trigger types ("summarize last 2 min",
"what should I say next"), structured response format (answer / talking points /
risk / next step / confidence), and a demo-mode fallback for live suggestions (today
`generateLiveSuggestion` has no demo path — `mockLiveSuggestion` exists but is unused).

## Remaining risks

- Real provider paths (Deepgram live, OpenAI, OAuth providers, Stripe) cannot be
  end-to-end verified here without live credentials; they are guarded by honest
  not-configured branches and unit tests, not live calls.
- Upload batch transcription against a real provider depends on
  `UPLOAD_TRANSCRIPTION_PROVIDER` + keys; only the demo path is exercised in CI.
- Playwright E2E is not yet wired (Loop 5).
</content>
</invoke>
