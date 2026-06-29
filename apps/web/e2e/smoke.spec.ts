import { test, expect } from "@playwright/test";

/**
 * Public-surface smoke tests (no backend/auth required) + responsive checks.
 * Authenticated flows are stubbed below as `test.fixme` so the structure is in
 * place; enable them once the API server is running and a test account is seeded
 * (see e2e/README.md).
 */

test("landing page renders and has primary navigation", async ({ page }) => {
  await page.goto("/");
  // The marketing nav should expose Pricing + a sign-in/get-started path.
  await expect(page.getByRole("link", { name: /pricing/i }).first()).toBeVisible();
  await expect(page).toHaveTitle(/aurora/i);
});

test("login page shows email + password fields", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).first()).toBeVisible();
  await expect(
    page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i)).first()
  ).toBeVisible();
});

test("pricing page lists plans", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByText(/basic/i).first()).toBeVisible();
  await expect(page.getByText(/pro/i).first()).toBeVisible();
});

test("invalid share link shows an honest not-found state", async ({ page }) => {
  await page.goto("/s/definitely-not-a-real-share-id");
  // Viewer should report the link is invalid/expired (never leak data).
  await expect(
    page.getByText(/invalid|expired|no longer shared|not.*active/i).first()
  ).toBeVisible({ timeout: 10_000 });
});

test("landing page is responsive on mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  // No horizontal overflow on mobile.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 2
  );
  expect(overflow).toBeTruthy();
});

/* ---- Authenticated flows (enable after seeding a test account) ---- */

test.fixme("dashboard loads after login", async () => {});
test.fixme("start live demo session shows transcript", async () => {});
test.fixme("private copilot overlay toggles with keyboard shortcut", async () => {});
test.fixme("export buttons download files", async () => {});
test.fixme("integrations page shows honest states", async () => {});
test.fixme("billing page shows demo-mode banner without Stripe", async () => {});
