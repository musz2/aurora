import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "./app.js";

/**
 * Integration smoke tests: boot the real Express app on an ephemeral port and hit
 * it over HTTP. Covers health, public config, viewer privacy (404 for unknown
 * share), auth gating, and the Stripe webhook honest-not-configured path. No keys
 * required — exercises the mock-mode surface end-to-end.
 */

let server: Server;
let base = "";

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("GET /api/health reports ok + honest service states", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status: string; services: Record<string, string> };
  assert.equal(body.status, "ok");
  // Without keys these are honest "not_configured"/"placeholder"/"local".
  assert.ok(["live", "not_configured"].includes(body.services.openai));
  assert.ok(["s3", "local"].includes(body.services.storage));
});

test("GET /api/config exposes capabilities + plans, never secrets", async () => {
  const res = await fetch(`${base}/api/config`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    services: Record<string, boolean>;
    plans: Record<string, unknown>;
  };
  assert.equal(typeof body.services.ai, "boolean");
  assert.ok(body.plans.BASIC);
  // No secret-looking keys leak into the public config.
  assert.ok(!JSON.stringify(body).match(/secret|api_key|sk_/i));
});

test("GET /api/sessions/:unknown returns 404 (no data leak)", async () => {
  const res = await fetch(`${base}/api/sessions/does-not-exist`);
  assert.equal(res.status, 404);
});

test("protected route without auth returns 401", async () => {
  const res = await fetch(`${base}/api/billing`);
  assert.equal(res.status, 401);
});

test("companion pair requires host auth", async () => {
  const res = await fetch(`${base}/api/companion/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingId: "x" }),
  });
  assert.equal(res.status, 401);
});

test("companion session rejects a missing/invalid token", async () => {
  const noToken = await fetch(`${base}/api/companion/session`);
  assert.equal(noToken.status, 401);
  const badToken = await fetch(`${base}/api/companion/session`, {
    headers: { "x-companion-token": "cmp_not_a_real_token" },
  });
  assert.equal(badToken.status, 401);
});

test("Stripe webhook is honest when not configured", async () => {
  const res = await fetch(`${base}/api/billing/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "checkout.session.completed" }),
  });
  // 503 (not configured) — never silently "received" without verification.
  assert.equal(res.status, 503);
});
