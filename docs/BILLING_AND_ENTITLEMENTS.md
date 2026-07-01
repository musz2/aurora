# Billing & Entitlements

_Last updated: 2026-07-02_

Aurora gates paid capabilities by workspace plan (Basic / Pro / Business /
Enterprise). Feature access is enforced server-side by `requireFeature` /
`requirePlan`, and usage caps (monthly transcription minutes, concurrent live
sessions, lifetime uploads) are enforced at their route call sites. Everyone
follows normal billing/subscription rules — with one server-side exception below.

## Developer lifetime access (owner billing override)

An allow-listed owner/developer account can be granted **developer lifetime
access** — free access to all Aurora paid entitlements. This is a
**billing/entitlements override only**. It is **not** a security, authentication,
OAuth, or privacy bypass.

- **Account:** `syedalicr4@gmail.com` (configured via env; not hard-coded).
- **Activation requires BOTH:**
  1. the user's (lowercased) email is on the server-side allowlist
     (`DEVELOPER_BYPASS_EMAILS` or `OWNER_ADMIN_EMAIL`), and
  2. `ENABLE_OWNER_BILLING_OVERRIDE="true"`.
- Off by default. With the gate unset/false, this account pays normally.

### What it unlocks
All paid entitlements: every plan feature, unlimited/maximum meeting minutes,
AI copilot, exports, uploads, integrations, team/workspace features, premium
transcript features, backup assist, offline packs, and future paid modules.

### What it does NOT do
- It does **not** bypass login/authentication — the user must be authenticated.
- It does **not** bypass OAuth or provider consent.
- It does **not** bypass meeting consent/privacy rules.
- It does **not** grant access to other users' private data.
- It does **not** grant admin access unless separately authorized
  (`requireFeature("team_workspace")` still applies to admin surfaces per plan;
  admin is entitlement-gated like any other feature).
- It is **server-side only** and never exposed as a frontend bypass.

### Implementation
`apps/server/src/config/entitlements.ts`:
- `developerLifetimeAccess(email)` / `ownerEntitlementOverride(email)` — the
  internal entitlement override (true only when allow-listed AND gate on).
- `ownerBillingOverrideActive(email)` — canonical check (aliased above).
- `billingOverrideEnabled()` — whether the env gate is on.
- Email comparison is normalized to lowercase; empty/undefined email → false.

Applied at:
- `requireFeature` / `requirePlan` (all plan-gated features).
- `POST /api/meetings/:id/start` — skips concurrent + monthly-minute caps.
- `POST /api/uploads/*` — skips the lifetime upload cap.

### Env configuration
```
# Off by default (safe). To grant developer lifetime access:
ENABLE_OWNER_BILLING_OVERRIDE=true
DEVELOPER_BYPASS_EMAILS=syedalicr4@gmail.com
```
Server-side only. Never commit real values; set them in the host environment.

### Tests
`apps/server/src/config/entitlements.test.ts` verifies: the account is unlocked
only when the gate is true; not unlocked when false/unset; other emails pay
normally even with the gate on; case-insensitive email match; unauthenticated
(no email) never gets the override; and that the allowlist alone (without the
gate) never unlocks paid features.
