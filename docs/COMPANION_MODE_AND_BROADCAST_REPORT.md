# Companion Mode + Owner-Reviewed Answer Broadcast

_Date: 2026-06-29. All acceptance gates green._

## Summary

Aurora Companion Mode lets a host run their **own** private copilot on a **second
device** (e.g. phone), paired with a **secure, expiring, revocable** token. The host
asks the assistant, reviews/edits the private answer, and — only on explicit,
confirmed action — **publishes** a final answer to the shared viewer, labelled
"Published by Host". Everything else stays private.

This is consent-first and **non-stealth**: no hidden overlay, no screen-share
hiding, no monitoring/proctoring bypass, no secret recording. Visible REC indicator,
consent acknowledgement, and host-only privacy are all preserved.

## How the owner publishes

1. On the live meeting page (while recording) → **Open Companion Mode** → a modal
   shows a private **QR + link** (token lives in the URL `#fragment`, never sent to
   the server on load) with an **expiry** and a **Revoke** button.
2. Host opens the link on their device → `/companion/:pairingId`. The page
   authenticates with the pairing token (`x-companion-token`).
3. Host picks a **mode** (Interview / Sales / Technical / Recruiting / Client /
   Standup / Demo / General), then **Ask AI**, **What should I say next?**, or
   **Summarize last 2 minutes**. The assistant returns a private structured answer
   (answer, talking points, follow-up, risk, next step, confidence).
4. Host **edits** the draft in a textarea, clicks **Publish to Viewer** → a
   **confirmation modal** appears → on confirm, only the final text is stored.

## How the viewer receives

- The viewer (`/s/:shareId`) shows a **"Published by Host"** card listing published
  answers (text + `publishedBy` + timestamp). They appear **only after** the host
  publishes — never before.
- Viewers **never** receive: draft answers, private notes, recent-transcript context,
  confidence, mode, or any unpublished assistant content. Enforced by (a) a dedicated
  `PublishedAnswer` table that stores only final text, (b) the Prisma `select`
  allow-list in the viewer route, and (c) the `sanitizePublicSession` allow-list
  chokepoint. Tests assert drafts/notes/context/confidence cannot appear.

## Files changed

**Server:** `prisma/schema.prisma` + `migrations/6_companion_and_published_answers`
(new `PublishedAnswer`, `CompanionPairing`); `services/companion.service.ts` (new);
`routes/companion.routes.ts` (new — pair/revoke host-auth; session/ask/publish
companion-token); `app.ts` (mount); `services/shared-viewer.service.ts` +
`routes/sessions.routes.ts` (expose sanitized published answers).
**Shared:** `types/index.ts` (`PublishedAnswerDto` + `publishedAnswers` on
`PublicSessionDto`).
**Web:** `pages/companion/CompanionPage.tsx` (new); `pages/app/LiveMeetingPage.tsx`
("Open Companion Mode" + QR pairing/revoke modal); `pages/viewer/ViewerPage.tsx`
("Published by Host"); `App.tsx` (route); deps `qrcode` + `@types/qrcode`.

## Tests

- **New:** `companion.service.test.ts` (pairing active/expiry/revoke, token hashing,
  TTL clamp); integration tests for **host-auth on /pair** and **invalid companion
  token on /session** (both 401); viewer-privacy test proving published answers are
  exposed (sanitized) while drafts/notes/context/confidence are not.
- **Updated:** viewer allow-list key assertion now includes `publishedAnswers`.
- Server tests: 85 → **91**, all pass. typecheck + build + lint green.

## Safety posture

Implemented: secure pairing (hashed token, expiry, revoke), host-only data,
owner-reviewed confirmed publish, viewer isolation, visible REC, consent, demo mode.
**Not implemented (declined):** stealth/undetectable mode, screen-share hiding,
monitoring/proctoring bypass, secret recording, hidden overlays.

## Remaining limits

- Companion `/ask` is HTTP request/response (not streamed); transcript context on the
  companion refreshes via a 6s poll.
- Demo-mode `/ask` returns the deterministic structured fallback (no key) — exercised
  via the assistant unit tests; the companion HTTP path itself isn't seeded in CI.
- Real OpenAI path for companion answers is unverifiable here without a key (guarded).

## Is Loop 4 safe?

Yes. Loop 4 (billing/limits/integrations/deployment) is untouched and still green:
real Stripe stays guarded with **no faked payments**, integrations show no fake
connected state, and all gates pass. Companion Mode adds only host-only + viewer-safe
surfaces and does not alter billing.
