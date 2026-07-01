# Clean Saved Transcripts

_Last updated: 2026-07-02_

Every meeting/interview is saved in a clean, structured, professional format —
not raw live text. The **raw transcript is always preserved**; a **cleaned**
version is produced for readability. Cleanup improves readability only and never
changes the meaning of what speakers said.

## What's saved
- Meeting title, date/time, duration, and source (Live Meeting / Upload / Import)
- Participants and speaker labels (Speaker 1, Speaker 2, …) with host rename
- Readable timestamps
- Raw transcript and clean transcript
- Summary, key questions & answers, decisions/outcomes, action items, follow-ups
- Host-published answers (separate from the transcript)

## Cleanup behavior (deterministic, meaning-preserving)
Runs on every finalized meeting, even without an AI provider:
- removes isolated filler words (um, uh, …)
- fixes spacing and punctuation
- de-duplicates immediate repeated words
- applies sentence casing and terminal punctuation (a question-word opener → “?”)

It never rewrites aggressively and never invents information. If no AI provider
is configured, cleanup still runs deterministically and the AI summary / Q&A are
honestly marked as needing a provider rather than faked.

## On the meeting detail page
- **Clean / Raw** transcript toggle
- **Speaker rename** — click a speaker (e.g. `Speaker 1` → `Interviewer`); applies
  across the whole meeting and is used in exports
- Summary, key Q&A, decisions/outcomes, action items, and host-shared answers
- Copy and export buttons

## Saved transcript artifact & export
`GET /api/meetings/:id/saved-transcript` returns a structured artifact: raw
transcript, clean transcript, summary, derived Q&A, decisions, action items,
speaker map, and host-published answers.

Export formats: **Markdown**, TXT, JSON (fully structured), plus PDF, DOCX, SRT,
VTT. Exports include the header, summary, speaker list, clean transcript, key
Q&A, decisions/outcomes, action items, and host-published answers. Exports
**exclude** private prompts, private copilot drafts, and private notes.

## Safety
"Private" means host-only inside the authenticated dashboard — never hidden or
bypassed. Private assistant content never reaches the shared viewer or public
exports.
