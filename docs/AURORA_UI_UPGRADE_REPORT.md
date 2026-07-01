# Aurora UI Upgrade Report — Premium Meeting Intelligence Redesign (2026-07-02)

Branch: `chore/upgrade-loop-hygiene-build`

Aurora's web app was redesigned into a premium AI meeting command center:
warm off-white canvas, aurora indigo/violet accents, consistent cards and
elevation, polished motion, and mobile-first responsive behavior — with all
existing functionality (auth, billing, integrations, live meeting, transcripts,
Backup Assist, Offline Interview Pack) preserved and all builds/tests green.

---

## 1. Design system

**Tokens (`styles/theme.css`, `tailwind.config.js`)**
- Warm off-white base `#FAF9F7` (`bg-canvas` / `--background`), ink `#16161A`,
  muted `#6B6B70`, existing aurora indigo ramp kept.
- Elevation scale: `shadow-card` (resting), `shadow-lift` (hover), `shadow-modal`
  (overlays) — used everywhere instead of ad-hoc shadows.
- Motion tokens: `--ease-out/--ease-in` (expo-style curves), duration tokens
  (150/220/350ms).

**Motion library (CSS, transform/opacity only, no layout shift)**
- `page-enter` (route fade/slide), `animate-slide-up/-in-right/-in-left`,
  `animate-scale-in` (menus/modals), `animate-toast-in`.
- `live-dot` expanding red halo for recording, `thinking-dot` 3-dot AI wave,
  `transcript-line` reveal + brief `row-highlight` wash for new rows,
  `reconnect-sweep` shimmer for recovery banners, `.skeleton` shimmer loaders,
  `card-lift` hover elevation.
- Global `prefers-reduced-motion: reduce` kill-switch for all animations and
  transitions.

**Primitives (`components/ui`)**
- `Button`: press feedback (`active:scale-[0.98]`), `loading` prop with spinner
  + `aria-busy`, tightened variants.
- `StatusPill`: full connection vocabulary — live, processing, connected,
  reconnecting, stale, degraded, offline, ended, expired, ai — each with ring,
  tone, and pulse dot.
- New: `Skeleton`/`SkeletonCard`, `CopyButton` (copied state), `Tabs`, `Modal`
  (sheet on mobile, scale-in on desktop, Esc to close), `Drawer`, `ErrorState`
  (retry affordance). `Card` gains `interactive` (hover lift).
- `Toast`: `aria-live="polite"`, `role="status"`, toast-in animation.
- `LoadingBlock` upgraded to shimmer skeletons.

## 2. App shell + dashboard
- Sidebar nav grouped (primary / Knowledge / Workspace) with active-route left
  indicator bar and plan badge card; mobile drawer slides in with scrim.
- Top bar: global search with `/` shortcut (wired), gradient **Start meeting**
  CTA with live pulse, animated profile menu (scale-in, billing shortcut).
- Route transitions via `page-enter` keyed on pathname.
- Dashboard = command center: staggered quick actions (live, upload, ask,
  copilot), stat cards with tabular numerals, usage meter with skeleton state,
  recent meetings with hover lift, action items, upcoming, and a new
  **Workspace status** card (integration connected count + Backup Assist entry).

## 3. Live meeting (Host Console)
- Three-column layout preserved (controls/status/share ▸ live transcript ▸
  Private Copilot) with responsive `70dvh` panel heights on smaller screens.
- Reconnecting banner with recovery sweep animation while the socket retries.
- Consent + companion modals: backdrop blur + scale-in.
- Private Copilot: label is now exactly **“Private to host until shared.”**,
  Assist button shows an AI thinking 3-dot wave, private draft cards slide in.
- Transcript rows keep speaker grouping/timestamps and now flash-highlight on
  arrival.

## 4. Shared session (public viewer)
- Solid, readable, read-only — no transparent mode (confirmed absent).
- Distinct status pills for connected / reconnecting / stale (Delayed) /
  degraded (Backup mode) / offline / ended / expired.
- Reliability banner animates with the reconnect sweep; side cards slide up;
  warm canvas + card elevation everywhere.

## 5. Backup Assist + Offline Interview Pack
- Backup Assist: card elevation, slide-up entrance, AI thinking indicator while
  drafting, result card animates in. One-click actions unchanged.
- Offline Interview Pack: sheet/scale-in entrance; retains job selector, search,
  Most Asked / Senior Scenarios filters, interview flow card, per-question
  summary + full senior answer + key points + real project example + follow-up
  tip + copy buttons, and questions to ask the interviewer (always-ask +
  role-specific).

## 6. Clean Saved Transcript (meeting report)
- Professional report layout retained: header, metadata badges, share banner,
  Clean/Raw toggle, speaker map with rename, segment badges (decision/action/
  highlight), summary/actions/notes/activity/ask tabs, exports (PDF/DOCX/MD/TXT/
  SRT/VTT/JSON). Raw transcript always preserved.
- Segment action toolbar now visible on touch devices (was hover-only).
- Responsive transcript panel height.

## 7. Integrations
- Exactly five providers (Zoom, Google Meet, Microsoft Teams, Google Calendar,
  Outlook Calendar) grouped into Meeting Platforms / Calendars.
- Cards: provider icon, purpose, honest status, connect/disconnect/test, last
  synced, last error; hover lift. Copy: **“Aurora uses OAuth only. Email
  passwords are never used.”**

## 8. Billing
- Current plan + usage meters + billing period; payment-method card now shows
  accepted brands (Visa / Mastercard / Amex / JCB) and Stripe trust copy:
  payments processed securely by Stripe, Aurora never collects or stores card
  details. Plan cards (Free/Pro/Business/Enterprise) with hover lift, current
  ring, upgrade/manage/portal; invoice table gains an empty state.

## 9. Auth
- Login/signup/forgot-password: Aurora brand panel, show-password toggles,
  validation, inline errors, loading buttons with progress copy, honest
  password-reset messaging. Entrance animation; warm canvas.

## 10. Safety text cleanup
- Transparent Reader Mode: **does not exist in code** (verified by repo-wide
  search; docs reference it only as a historical removal record).
- Removed banned wording from all visible UI text (stealth / hidden / invisible
  / bypass / cheat / undetectable / screen-share safe / proctoring) — including
  Security page, Landing page, Host Console consent card, Copilot privacy-mode
  description, and the desktop connection settings. Replacements use
  consent-first, private-to-host, Backup Assist, Offline Interview Pack
  language. Server test `interview-packs.test.ts` continues to enforce that
  pack content contains no unsafe wording.
- Shared viewer remains read-only and never receives private copilot drafts,
  prompts, or notes (`sanitizePublicSession` allow-list unchanged).

---

## Verification

All green on 2026-07-02:

| Check | Result |
| --- | --- |
| `@aurora/shared` build | ✅ |
| `@aurora/server` typecheck + build | ✅ |
| `@aurora/server` test | ✅ 151 tests — 146 pass, 5 skipped, 0 fail |
| `@aurora/web` typecheck + build | ✅ |
| `@aurora/desktop` typecheck + build | ✅ |
| Console-error audit (15 routes, logged-in + public) | ✅ no errors* |

\* one transient 429 (API rate limiter) during rapid automated navigation;
`/pricing` re-checked in isolation — clean.

## Screenshots (`docs/ui-screenshots/`)

login, signup, dashboard, live-meeting, shared-session, saved-transcript,
offline-interview-pack, integrations, billing, mobile-shared-session,
mobile-live-meeting — captured from the running app (seeded demo workspace)
at 1440×900 desktop and iPhone 13 viewport.
