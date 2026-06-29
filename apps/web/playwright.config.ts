import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke config for Aurora web.
 *
 * Run locally with a browser install:
 *   pnpm --filter @aurora/web exec playwright install chromium
 *   pnpm --filter @aurora/web test:e2e
 *
 * The public smoke specs render client-side and need only the web dev server
 * (started automatically below). Authenticated flows additionally need the API
 * server running and a seeded account (see e2e/README.md).
 */
const PORT = Number(process.env.E2E_PORT ?? 5173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
