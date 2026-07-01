# Aurora Integrations Status

_Last updated: 2026-07-02_

> **Aurora uses OAuth for integrations. Email passwords must never be stored,
> committed, logged, or used by the application.** Connections are made through
> each provider's OAuth consent screen using server-side environment variables.

Aurora supports **exactly five** integrations. No other providers are offered.

| Provider | Type | OAuth backend | Status |
| --- | --- | --- | --- |
| Zoom | Meeting Platform | Zoom OAuth | Connect + link detection/import |
| Google Meet | Meeting Platform | Google OAuth | Meet link detection/import via Google Calendar |
| Microsoft Teams | Meeting Platform | Microsoft OAuth | Teams link detection/import via Outlook Calendar |
| Google Calendar | Calendar | Google OAuth | Event sync + import |
| Outlook Calendar | Calendar | Microsoft OAuth | Event sync + import |

The owner/test account label used for setup is `khanshahbazahmed412@gmail.com`.
Its password is never used or requested — connect it through the provider OAuth
consent screen only.

---

## Google (Google Meet + Google Calendar)

- **Env variables:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REDIRECT_URI`, `GOOGLE_CALENDAR_SCOPES`
- **Default scopes:** `https://www.googleapis.com/auth/calendar.readonly`,
  `https://www.googleapis.com/auth/calendar.events.readonly`, `openid`, `email`
- **Redirect URI:** `<SERVER_URL>/api/integrations/oauth/google/callback`
- **Setup:** create an OAuth client in Google Cloud Console (Web application),
  add the redirect URI, enable the Google Calendar API, set the env vars.
- **What works:** OAuth connect, encrypted token storage, automatic refresh,
  fetching upcoming Google Calendar events, detecting Google Meet links
  (`hangoutLink`/description) and importing a meeting into Aurora.
- **Not yet:** automatic bot join into a Meet call (not implemented; not claimed).
- **Test checklist:** connect → complete Google consent → integration shows
  Connected → Calendar page lists live events → a Meet event shows a detected
  link → import creates an Aurora meeting.

## Microsoft (Microsoft Teams + Outlook Calendar)

- **Env variables:** `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`,
  `MICROSOFT_TENANT_ID` (or `common`), `MICROSOFT_REDIRECT_URI`,
  `MICROSOFT_GRAPH_SCOPES`
- **Default scopes:** `offline_access`, `Calendars.Read`, `User.Read`
- **Redirect URI:** `<SERVER_URL>/api/integrations/oauth/microsoft/callback`
- **Setup:** register an app in Entra ID (Azure AD), add a Web redirect URI,
  grant delegated Microsoft Graph `Calendars.Read`, set the env vars.
- **What works:** OAuth connect, encrypted token storage, automatic refresh,
  fetching Outlook `calendarView` events, detecting Teams links
  (`onlineMeeting.joinUrl`/body) and importing a meeting into Aurora.
- **Not yet:** automatic bot join into a Teams call (not implemented; not claimed).
- **Test checklist:** connect → complete Microsoft consent → Connected →
  Calendar page lists live events → a Teams event shows a detected link → import.

## Zoom

- **Env variables:** `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_REDIRECT_URI`,
  `ZOOM_SCOPES`
- **Default scopes:** `meeting:read`, `user:read`
- **Redirect URI:** `<SERVER_URL>/api/integrations/oauth/zoom/callback`
- **Setup:** create a Zoom OAuth app in the Zoom Marketplace, add the redirect
  URL, add the scopes, set the env vars.
- **What works:** OAuth connect, encrypted token storage, automatic refresh.
  Zoom meeting links are also detected from connected calendars and can be
  imported into Aurora.
- **Not yet:** automatic/bot join into a Zoom call (not implemented; not claimed).
- **Test checklist:** connect → complete Zoom consent → Connected → Test button
  verifies the token is present/refreshable.

---

## Connection states (honest)
Every integration reports one of: **Not configured** (server OAuth env vars
missing), **Connect / Needs approval** (configured, awaiting OAuth consent),
**Connected** (valid OAuth tokens stored), **Error/Failed** (last action failed),
and internally **Expired** (tokens past expiry — refreshed automatically on next
use). Aurora never shows a fake "Connected".

## Meeting import flow
1. Connect a calendar/meeting provider via OAuth.
2. Aurora fetches upcoming events (Google Calendar / Outlook Calendar).
3. Detected meeting links (Zoom / Google Meet / Teams) are surfaced.
4. The user imports an event → Aurora creates a meeting with the provider source
   and link stored.
Aurora does **not** auto-join meetings; that would require an explicit,
consent-safe implementation which is not part of this release.

## Security
- OAuth only — no email/passwords are stored, committed, logged, or used.
- OAuth tokens are encrypted at rest (AES-256-GCM) and refreshed server-side.
- Unsupported providers return HTTP 404 from the API and never appear in the UI,
  catalog, or docs.
