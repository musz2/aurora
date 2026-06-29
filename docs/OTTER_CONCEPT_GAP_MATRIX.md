# Otter-Concept Gap Matrix

Aurora is an **original** product. This matrix tracks the _capability concept_ of a
shared meeting-intelligence tool — not any competitor's UI, code, copy, icons, or
assets. Status legend: ✅ done · 🟡 partial/mock · ⛔ missing.

| Capability | Status | Where | Gap / Plan |
| --- | --- | --- | --- |
| Live transcription | ✅ real (Deepgram) + 🟡 simulated fallback | `deepgram.service.ts`, `transcript.simulator.ts`, `sockets/index.ts` | ✅ Loop 2: reconnect-safe segment dedup + canonical recording states + interim/final handling |
| Recording state indicators | ✅ canonical (Loop 2) | `recording-state.service.ts`, sockets | idle/connecting/recording/paused/reconnecting/stopped/failed; consent-first kept |
| Speaker labels | ✅ | `speaker.service.ts` (tested), `summarizeSpeakers` | Rename persists across segments; speaker stats in finalization; unknown→"Speaker N" |
| Meeting summary | ✅ real + 🟡 demo fallback | `meeting-finalization.service.ts`, `ai.service.ts` | ✅ summary/decisions/follow-up/key-questions/speaker-stats covered + demo test |
| Action items | ✅ real + 🟡 demo fallback | `ai.service.ts` (tested) | — |
| Searchable history | ✅ + snippets/citations (Loop 2) | `search.routes.ts`, `search.service.ts` | Match-centered snippets + `references` array |
| Vector / embeddings | ⛔ (structure noted) | pgvector image present; schema comment documents column plan | Deferred; `embedding vector(1536)` + IVFFlat to add |
| Exports (PDF/DOCX/TXT/SRT/VTT/JSON) | ✅ all 6 (Loop 2 tests) | `export.service.ts` (tested) | Content + coverage tests added |
| Shared viewer | ✅ polling (optimized, Loop 2) | `sessions.routes.ts`, `ViewerPage.tsx` | Self-terminating poll + base-URL fix; SSE deferred (public/unauth) |
| Share revoke / expiry / audit | ✅ (Loop 2) | `meetings.routes.ts`, `sessions.routes.ts`, `shareExpiresAt` | Revoke rotates shareId; expiry enforced; `session_viewed` audit |
| Public data safety | ✅ | `shared-viewer.service.ts` (allow-list + Prisma select + `isShareActive`, tested) | Private-assistant leak test |
| Integrations | ✅ honest states + real paths | `integrations.service.ts`, `provider-api.service.ts` | Slack post / Drive export / HubSpot sync live; Email(SMTP) honest-not-implemented |
| Calendar connect | ✅ real state (Loop 1 fix) | `calendar.routes.ts`, `CalendarPage.tsx` | live Google/Microsoft event sync wired in `calendar.routes` |
| Billing | ✅ real Stripe + honest demo (Loop 4) | `billing.routes.ts`, `stripe.service.ts` | live Checkout/Portal/webhook when keys present; **no faked payments** |
| Usage limits | ✅ minutes + imports + concurrent (Loop 4) | `usage.service.ts` (tested) | import cap enforced on upload (402) |
| Upload batch transcription | ✅ real OpenAI Whisper + 🟡 demo + honest fallback (Loop 2) | `uploaded-transcription.provider.ts` | Deepgram prerecorded still unimplemented |
| Enterprise controls (consent, workspace settings) | ✅ | `workspace.routes.ts`, consent UI | Keep |

## Loop 1 changes affecting this matrix
- Calendar connect state is now backend-driven (no fake "Connected").
- Public viewer hardened with an explicit private-assistant-leak regression test.

## Loop 2 changes affecting this matrix
- Reconnect-safe transcript segment dedup; canonical recording-state enum.
- Share revoke (token rotation) + expiry + viewer-access audit logging.
- Real OpenAI Whisper upload path (guarded); export + search coverage; viewer polling fix.
</content>
