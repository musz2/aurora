# Aurora web — Playwright E2E

These are smoke tests for the web app. They are **scaffolding**: the public specs
run against just the web dev server; authenticated flows are marked `test.fixme`
until a seeded account + running API are wired in CI.

## Run locally

```bash
# 1. install a browser (one-time)
pnpm --filter @aurora/web exec playwright install chromium

# 2a. public smoke only (web dev server auto-starts)
pnpm --filter @aurora/web test:e2e

# 2b. against an already-running app (web + API)
E2E_BASE_URL=http://localhost:5173 pnpm --filter @aurora/web test:e2e
```

## Authenticated flows

To enable the `test.fixme` flows (dashboard, live/demo session, private copilot,
exports, integrations, billing):

1. Start the API: `pnpm --filter @aurora/server dev` (with a local Postgres).
2. Seed a demo account: `pnpm db:seed`.
3. Add a login helper (storageState) and change `test.fixme` → `test`.

These were intentionally left disabled rather than asserting green for flows that
cannot be verified in this environment (no browser binaries / no seeded session).
