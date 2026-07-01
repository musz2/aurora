# Transparent Reader Mode & Clean Saved Transcripts

_Last updated: 2026-07-01_

Two features that make Aurora's shared sessions easier to read and its saved
meetings/interviews clean and professional.

---

## Transparent Reader Mode (shared session viewer)

> Transparent Reader Mode is a public read-only transcript display mode designed
> for readability and layout flexibility. It does not hide recording, bypass
> meeting tools, or expose private host assistant data.

Open any shared session at `/s/:shareId`. The viewer has two display modes:

- **Standard mode** (default): the normal light page.
- **Transparent reader mode**: glass panels (backdrop blur, adjustable opacity)
  so the transcript stays readable over different backgrounds and window layouts.

### How to use it
- Click **Transparent mode** / **Standard mode** in the top-right to switch.
- Or open a link directly with `?mode=transparent`, e.g.
  `/s/abc123?mode=transparent`. The query param changes the **UI only** — it
  never changes permissions or what data the server returns.
- Your choice (and the controls below) are remembered in your browser
  (localStorage).

### Readability controls (transparent mode)
- **Opacity:** 30% / 50% / 70% / 90%
- **Font size:** Small / Medium / Large
- **Theme:** Dark glass / Light glass
- **Layout:** Compact / Expanded

These are driven by CSS variables (`--viewer-opacity`, `--viewer-blur`,
`--viewer-font-size`, `--viewer-text-contrast`) so text remains legible over both
dark and light backgrounds.

### What the shared viewer shows — and never shows
Shows only:
- the live transcript,
- host-**published** answers (labelled “Host shared answer”, highlighted briefly
  when a new one arrives), and
- host-published notes / the public summary once published.

Never shows (enforced server-side by an allow-list, not just the UI):
- private copilot drafts,
- private prompts,
- private notes,
- internal AI reasoning,
- host controls, or workspace/admin data.

The viewer is always **read-only**.

---

## Clean Saved Transcripts (meetings & interviews)

Every meeting is saved in a clean, structured, professional format — not raw
live text. The **raw transcript is always preserved**; a **cleaned** version is
produced for readability.

### What cleanup does (and does not do)
Deterministic, meaning-preserving cleanup runs on every finalized meeting, even
without an AI provider:
- removes isolated filler words (um, uh, …),
- fixes spacing and punctuation,
- de-duplicates immediate repeated words,
- applies sentence casing and terminal punctuation (a question-word opener gets a
  “?”).

It never rewrites aggressively and never invents information. If no AI provider
is configured, cleanup still runs deterministically; the AI **summary / Q&A**
are honestly marked as needing a provider rather than faked.

### On the meeting detail page
- **Clean / Raw** toggle on the transcript.
- **Speaker rename** — click a speaker (e.g. `Speaker 1` → `Interviewer`); it
  applies across the whole meeting and is used in exports.
- Summary, decisions, action items, questions, and host-shared answers sections.

### Saved transcript artifact & export
`GET /api/meetings/:id/saved-transcript` returns a structured artifact:
raw transcript, clean transcript, summary, derived Q&A, decisions, action items,
speaker map, and host-published answers.

Export formats: **Markdown**, TXT, JSON (fully structured), plus PDF, DOCX, SRT,
VTT. Exports include the header, summary, speaker list, clean transcript, key
Q&A, decisions/outcomes, action items, and host-published answers. Exports
**exclude** private prompts, private copilot drafts, and private notes.

Example Markdown output:

```markdown
# Meeting Transcript
**Meeting:** Technical Interview
**Date:** 1 July 2026
**Duration:** 32 minutes
**Source:** Live Meeting
## Summary
...
## Speakers
- Speaker 1
- Speaker 2
## Clean Transcript
**Speaker 1 · 00:01**
Can you introduce yourself?
...
## Key Questions & Answers
...
## Decisions / Outcome
...
## Action Items
...
## Host Shared Answers
...
```

---

## Safety summary
Consent-first throughout. No stealth mode, hidden overlays, screen-share hiding,
monitoring/proctoring bypass, secret recording, or deceptive behavior. “Private”
means host-only inside the authenticated dashboard — never hidden or bypassed —
and private assistant content never reaches the shared viewer or public exports.
