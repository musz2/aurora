# Private Assistant Gap Matrix (safe Cluely-style copilot)

The private assistant is a **host-only** live copilot. It is **consent-first** and
**never stealthy**: visible recording indicators remain, and its output is never
shown to the shared viewer unless the host explicitly publishes a note. No
invisibility, no hidden recording, no detection evasion — those are out of scope and
will not be built.

Status legend: ✅ done · 🟡 partial · ⛔ missing.

| Capability | Status | Where | Gap / Plan |
| --- | --- | --- | --- |
| Host-only delivery | ✅ | `private-assistant.service.ts` (tested) | Viewer endpoints proven isolated |
| Manual "Ask AI" | ✅ | `generateStructuredLiveSuggestion`, `AssistantPanel`, `CopilotPage` | — |
| Live suggestion demo fallback | ✅ (Loop 3) | `generateStructuredLiveSuggestion` falls back to `buildStructuredSuggestion` in demo | dead `mockLiveSuggestion` removed |
| Meeting modes (7) | ✅ (Loop 3) | `ASSISTANT_MODES` + `MODE_GUIDANCE` (incl. General Meeting) | UI modes map via `toAssistantMode` |
| Trigger: auto-detected questions | ✅ | `detectQuestions` → socket `maybeSuggestFromTranscript` | — |
| Trigger: keyboard ask | ✅ (Loop 3) | `CopilotPage` Cmd/Ctrl+Shift+A toggles overlay | — |
| Trigger: "summarize last 2 min" | ✅ (Loop 3) | `parseAssistantIntent` → `summarize_recent` | quick-action button |
| Trigger: "what should I say next" | ✅ (Loop 3) | `parseAssistantIntent` → `next_step` | quick-action button |
| Trigger: "give me the answer now" | ✅ (Loop 3) | `parseAssistantIntent` → `answer_now` | quick-action button |
| Structured response (answer / talking points / follow-up / risk / next step / confidence) | ✅ (Loop 3) | `StructuredSuggestion`, `buildStructuredSuggestion` (tested) | rendered in overlay + panel |
| Context: recent transcript | ✅ | socket `buildAssistantContext` | — |
| Context: title / speakers / mode / private notes / vocabulary | ✅ (Loop 3) | `buildAssistantContext` assembles full object | prior-meeting context still deferred |
| Privacy: never auto-publish | ✅ | publish is explicit + **confirmed** host action | overlay confirm dialog |
| Privacy: viewer isolation test | ✅ | `shared-viewer.service.test.ts` | — |
| No stealth/invisibility | ✅ (enforced) | system prompt forbids hiding recording | Will not implement |

## Loop 1 changes affecting this matrix
- Added an explicit regression test proving the public viewer payload cannot contain
  `privateAssistSuggestions` / `privateNotes`.

## Loop 3 changes affecting this matrix
- 7 modes; intent parsing (auto/answer_now/summarize_recent/next_step); structured
  6-part response + confidence; full host-only context assembly; demo fallback wired
  (real meetings still throw honestly without a key).
- New **Private Copilot UI**: floating overlay (collapsed/expanded), 3-column page
  (Live Context / Private Answer / Meeting Memory), tabs, modes, keyboard shortcut,
  consent-first start, visible recording indicator, confirmed Publish-to-Transcript.
</content>
