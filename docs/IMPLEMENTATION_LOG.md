# Aurora Implementation Log

Chronological log of every change and command in this upgrade pass. Newest at top.

## Companion Mode + Owner-Reviewed Broadcast (all gates green)

Host-only second-device copilot with secure pairing (hashed token, expiry, revoke) +
owner-reviewed publish to viewers. No stealth/screen-share-hiding/proctoring-bypass/
secret-recording/hidden-overlay. See `COMPANION_MODE_AND_BROADCAST_REPORT.md`.

- Prisma `6_companion_and_published_answers`: `PublishedAnswer`, `CompanionPairing`.
- `services/companion.service.ts` + `routes/companion.routes.ts` (pair/revoke host-auth;
  session/ask/publish companion-token), mounted at `/api/companion`.
- Viewer exposes sanitized published answers only (`shared-viewer.service.ts`,
  `sessions.routes.ts`, shared `PublishedAnswerDto`).
- Web: `CompanionPage` (8 modes, ask/next/summarize, edit-before-publish, confirmed
  publish), Live Meeting "Open Companion Mode" QR pairing/revoke modal, viewer
  "Published by Host". Deps: `qrcode`, `@types/qrcode`.
- Tests 85 → **91** (companion service pure tests, host-auth + invalid-token integration,
  published-answer privacy). typecheck/build/lint green.

## Privacy Mode — safe shoulder-surfing protection (all gates green)

Implemented the **safe** Privacy Mode requests only. Explicitly **refused / not built**:
undetectable mode, screen-share bypass, proctoring bypass, hiding from monitoring/security
tools, and secret recording — these deceive other parties / bypass consent and violate
Aurora's product rules. Privacy Mode is shoulder-surfing protection; content stays fully
visible to screen share, recording, and monitoring.

- `apps/web/src/components/app/CopilotOverlay.tsx` — `privacyMode` + `onAutoHide` props;
  blur/lock of the answer with a "tap to reveal" / "hide again" control; re-lock on new
  suggestion + when Privacy Mode turns on; 30s inactivity auto-hide (resets on interaction);
  "Privacy" header chip. Documented as non-stealth.
- `apps/web/src/pages/app/CopilotPage.tsx` — Privacy Mode toggle (on by default) in the top
  bar; in-page Private Answer blur/lock + reveal; Private/Shared/Published `LabelChip`s;
  Meeting Memory "Published to viewers" section; Settings disclaimer that Privacy Mode is NOT
  stealth/screen-share/proctoring evasion. Kept visible REC indicator, consent gate, and
  confirmed Publish-to-Transcript.
- Gates: typecheck ✅ (4/4) · server tests ✅ 85/85 · build ✅ (server+web+desktop) · lint ✅.

## Loop 5 — Quality, testing, polish (all gates green)

- `apps/server/src/app.integration.test.ts` (new) — boots the real Express app on an
  ephemeral port and asserts: `/api/health` ok + honest service states; `/api/config`
  exposes capabilities/plans and **no secrets**; unknown share → 404 (no leak); protected
  route → 401; Stripe webhook → **503 when not configured** (never silently "received").
- `apps/server/src/services/stripe.service.test.ts`, `usage.service.test.ts` (Loop 4)
  cover billing-state + limit logic.
- Playwright scaffold: `apps/web/playwright.config.ts` (chromium + iPhone projects,
  auto-starts web dev server), `apps/web/e2e/smoke.spec.ts` (landing, login, pricing,
  invalid-share honesty, mobile no-overflow; authed flows as `test.fixme`), `e2e/README.md`,
  `test:e2e` script, `@playwright/test` devDep. **Honest note:** browser binaries are not
  installed in this environment, so E2E specs are scaffolded + documented, not run here.
- Server test total: **80 → 85**. typecheck/build green.

### Remaining (Loop 5)
- Run Playwright in CI (needs `playwright install` + seeded login + running API).
- Web-side unit tests (no web unit runner configured).

## Loop 4 — Billing, limits, integrations, deployment (all gates green)

### Billing — real Stripe, no faked payments
- Added `stripe` dependency. `apps/server/src/services/stripe.service.ts` (new): lazy
  client (only when `STRIPE_SECRET_KEY` set), `priceIdForPlan` / `planForPriceId`, and a
  **pure** `resolveStripeEvent` (checkout.session.completed / subscription.updated /
  subscription.deleted → plan change).
- `apps/server/src/routes/billing.routes.ts` rewritten: live `/checkout` creates a real
  Stripe Checkout Session and **does NOT change the plan** (webhook applies it post-payment);
  live `/portal` opens the real Customer Portal; `billingWebhookHandler` verifies the
  signature and applies plan changes. Demo mode (no Stripe) switches plan directly, clearly
  labelled; demo invoices only shown when Stripe is off.
- `apps/server/src/app.ts` — Stripe webhook mounted with `express.raw` **before**
  `express.json` (signature needs the raw body); public (Stripe-signed).
- `apps/web/src/pages/app/BillingPage.tsx` — live checkout **redirects to Stripe** and no
  longer optimistically changes the plan; demo switches locally; "Manage in Stripe" opens
  the real portal.
- `apps/server/src/config/env.ts` + `.env.example` — `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS`.

### Usage limits
- `apps/server/src/services/usage.service.ts` — pure `checkImportAllowed`,
  `concurrentLimitForPlan`, `checkConcurrentAllowed`; async `canUpload`,
  `getActiveSessionCount`.
- `apps/server/src/routes/uploads.routes.ts` — enforces the lifetime import cap (402) before
  any processing.

### Integrations
- Verified honest states + real provider paths already present (Slack/Drive/HubSpot via
  `provider-api.service.ts`, OAuth with encryption + refresh). No fake "connected" state.
  Email export (SMTP) remains honest-not-implemented (documented).

### Deployment verified
- `railway.json` (Dockerfile build, `/api/health` healthcheck, `db:deploy` on start),
  `apps/web/vercel.json` (vite, SPA rewrites, frozen-lockfile install), `apps/server/Dockerfile`
  (server+shared only), CORS allow-list in `app.ts`, `/api/health` present. Lockfile updated
  with new deps so `--frozen-lockfile` stays valid.

### Tests: 70 → 80 (Stripe resolver + usage limits).

## Loop 3 — Private Copilot (assistant core + UI, all gates green)

### Server (structured, host-only assistant)
- `apps/server/src/services/private-assistant.service.ts` — rewritten: 7 modes (+General
  Meeting), `AssistantIntent` + `parseAssistantIntent` (answer / answer_now /
  summarize_recent / next_step), `StructuredSuggestion` (answer + talkingPoints +
  followUpQuestion + risk + nextStep + confidence), `buildStructuredSuggestion` (pure),
  `renderSuggestionText`, `AssistantContext`. `generateMockPrivateSuggestion` now renders
  from the structured builder.
- `apps/server/src/services/ai.service.ts` — added `generateStructuredLiveSuggestion`
  (real OpenAI JSON; demo/no-key → deterministic structured fallback; real meeting + no
  key → honest throw). Removed dead `mockLiveSuggestion`.
- `apps/server/src/sockets/index.ts` — `buildAssistantContext` (recent transcript + title
  + speakers + workspace vocabulary + host private notes), unified `suggest()` pipeline,
  structured `AI_SUGGESTION` payload (rendered string + `structured` + confidence + intent).
  Removed `hasOpenAI` branching.

### Web (Private Copilot UI)
- `apps/web/src/lib/copilot.ts` (new) — types, UI↔server mode mapping, answer depths
  (quick/strong/deep), local tone transforms (Shorten / Make Professional / Explain Simply).
- `apps/web/src/components/app/CopilotOverlay.tsx` (new) — floating collapsed/expanded
  overlay; collapsed pill "Aurora Private • <status> • ⌘⇧A"; detected question, answer
  depths, tone tools, Copy / Add to Private Notes, and **confirmed** Publish to Transcript.
- `apps/web/src/pages/app/CopilotPage.tsx` (new) — dark premium page (#05070D, glass
  panels rgba(12,16,28,0.82), Inter): 3 columns (Live Context / Private Answer / Meeting
  Memory), tabs (Private Assist / Live Transcript / Smart Notes / Action Items / Search
  Memory / Settings), 5 modes, status machine (Listening / Question Detected / Preparing
  Answer / Ready), Cmd/Ctrl+Shift+A shortcut, consent-first start, visible REC indicator,
  Private/Shared labels. Self-contained socket session (demo + real).
- `apps/web/src/App.tsx`, `DashboardLayout.tsx` — `/app/copilot` route + "Private Copilot"
  nav item.
- `apps/web/src/components/app/AssistantPanel.tsx` + `LiveMeetingPage.tsx` — added General
  Meeting mode, optional `confidence`, confidence badge, pre-wrapped structured text.

### Tests
- `private-assistant.service.test.ts` rewritten/expanded (intent parsing, structured
  completeness, summarize intent, confidence scaling, render sections, General Meeting).
  Server tests 65 → **70**, all pass.

### Gates
- `pnpm typecheck` ✅ · `pnpm --filter @aurora/server test` ✅ 70/70 · `pnpm build` ✅
  (server + web + desktop) · `pnpm lint` ✅ (no real linters configured).

### Still pending
- Prior-relevant-meeting context for the assistant; Playwright E2E for the Copilot (Loop 5);
  web-side unit tests (no web test runner configured yet).

## Loop 2 — Otter-style meeting engine (complete, all gates green)

### New commands
- `pnpm exec prisma migrate deploy` → applied `5_share_expiry`
- `pnpm exec prisma generate` → regenerated client
- `pnpm typecheck` ✅ · `pnpm --filter @aurora/server test` ✅ 65/65 · `pnpm build` ✅

### Files changed
- `apps/server/src/services/transcript-segment.service.ts` — added pure final-segment
  dedup: `normalizeSegmentText`, `isDuplicateFinalSegment`, `FinalSegmentWindow`.
- `apps/server/src/services/recording-state.service.ts` (new) — canonical
  `RECORDING_STATES` (idle/connecting/recording/paused/reconnecting/stopped/failed) +
  pure `toRecordingState` mapper + `isRecordingState`.
- `apps/server/src/sockets/index.ts` — reconnect-safe dedup in `persistFinal` (in-session
  window + DB recent-finals check; duplicates are skipped, not broadcast); canonical
  `recordingState` attached to all `MEETING_STATUS`/`MEETING_LIFECYCLE` emissions via new
  `sendStatus`/`sendLifecycle` helpers; reset dedup window on demo (re)start.
- `apps/server/prisma/schema.prisma` + `prisma/migrations/5_share_expiry/migration.sql` —
  added nullable `Meeting.shareExpiresAt`.
- `apps/server/src/services/shared-viewer.service.ts` — added pure `isShareActive`
  (honors revoke + expiry).
- `apps/server/src/routes/sessions.routes.ts` — enforce `isShareActive` (revoked/expired
  links 404); write `session_viewed` audit (null user, workspace-scoped); select
  `workspaceId` for audit only (never copied to payload).
- `apps/server/src/routes/meetings.routes.ts` — `/:id/share` now supports `expiresInHours`,
  writes `meeting_shared` / `meeting_share_revoked` audits, and **rotates the shareId on
  revoke** so old links die permanently.
- `apps/server/src/services/audit.service.ts` — registered `meeting_shared`,
  `meeting_share_revoked`, `session_viewed`.
- `apps/server/src/services/search.service.ts` (new) — pure `buildSnippet`,
  `matchIndex`, `buildReferences` (citation-like sources).
- `apps/server/src/routes/search.routes.ts` — attach match-centered `snippet` to segment
  hits + a top-level `references` array (backward-compatible additions).
- `apps/server/src/services/uploaded-transcription.provider.ts` — implemented a **real**
  OpenAI Whisper (`verbose_json`) batch path, guarded by `hasOpenAI`; honest single-speaker
  labelling (no faked diarization); demo path unchanged; Deepgram still honest 501.
- `apps/web/src/pages/viewer/ViewerPage.tsx` — fixed split-deploy bug (use `API_BASE_URL`),
  stop polling once session ends / link invalid, documented polling-vs-SSE choice.

### Tests added/updated
- `transcript-segment.service.test.ts` (+5 dedup), `recording-state.service.test.ts` (new,
  5), `search.service.test.ts` (new, 4), `shared-viewer.service.test.ts` (+1 share
  revoke/expiry), `meeting-finalization.service.test.ts` (+1 demo finalize),
  `export.service.test.ts` (+3 content/coverage). Net 47 → 65.

### Still mock/demo only
- Live STT simulated without `DEEPGRAM_API_KEY`; billing demo without Stripe; many
  integrations mock until creds. Deepgram prerecorded upload transcription unimplemented.

### Remaining risks
- Real OpenAI/Deepgram/OAuth paths unverifiable here (no keys); guarded + unit-tested.

See `LOOP_2_TEST_REPORT.md` for the full test matrix.

## Environment setup (2026-06-29)

Commands run:
- `rm -rf node_modules apps/*/node_modules packages/*/node_modules`
- `corepack enable`
- `pnpm install` → ✅ 433 packages, exit 0
- `docker compose up -d` → redis/db ports already bound by a sibling project; a
  compatible Postgres + Redis are already listening on 5432/6379, used as-is.
- `pnpm db:generate` → ✅ Prisma Client v5.22.0
- `prisma migrate status` → ✅ 5 migrations applied, DB up to date
- `pnpm typecheck` → ✅
- `pnpm --filter @aurora/server test` → ✅ 41/41
- `pnpm build` → ✅ shared + server + web + desktop

Docs created: `AURORA_PRODUCT_AUDIT.md`, `OTTER_CONCEPT_GAP_MATRIX.md`,
`PRIVATE_ASSISTANT_GAP_MATRIX.md`, `IMPLEMENTATION_LOG.md`.

## Loop 1 — critical correctness fixes (complete, all checks green)

### Fixes
1. **Demo upload finalization without OpenAI**
   - `apps/server/src/routes/uploads.routes.ts`: `generateMeetingSummary` /
     `extractActionItems` now receive `{ demoMode }` (was hardcoded
     `{ demoMode: false }`). Demo uploads finalize with sample output; real uploads
     still require keys.
2. **Split-deploy config fetch**
   - `apps/web/src/lib/useConfig.ts`: replaced raw `axios.get("/api/config")` with
     the shared `api` client (`api.get("/config")`) so it honors `VITE_API_URL` for
     split Vercel(web) + Railway(api) deploys.
3. **Fake calendar "connected" state removed**
   - `apps/web/src/pages/app/CalendarPage.tsx`: removed local
     `connected = { google: true }` state. Connection state is now derived from the
     backend `/integrations` query (`state === "CONNECTED"`), and "Connect" routes
     through the real `/integrations/:provider/connect` OAuth flow (opens authUrl or
     reports honest mock/needs-approval message). Added a pointer to Integrations.
4. **Public viewer privacy verified + hardened**
   - Confirmed `sessions.routes.ts` (Prisma `select` allow-list) + `sanitizePublicSession`
     (allow-list chokepoint) — double protection. Added a regression test.

### Tests added / run
- New `apps/server/src/services/ai.service.test.ts` (5 tests): demo mode returns
  sample summary/action-items without OpenAI; real mode throws not-configured;
  empty-transcript demo still returns mock. Guarded with `{ skip: hasOpenAI }`.
- Extended `apps/server/src/services/shared-viewer.service.test.ts` (+1 test):
  proves `privateAssistSuggestions` / `privateNotes` (and their text) never appear
  in the public viewer payload.

### Verification (2026-06-29)
- `pnpm typecheck` → ✅ all 4 projects
- `pnpm --filter @aurora/server test` → ✅ 47/47 (was 41; +6 new, 0 skipped)
- `pnpm build` → ✅ shared + server + web + desktop

### Remaining risk
- Real OpenAI upload finalization path is not exercised in CI (no key); only the
  demo path and the not-configured branch are covered by tests.
</content>
