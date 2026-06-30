import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { signAccessToken } from "./utils/jwt.js";
import { prisma } from "./lib/prisma.js";

/**
 * Integration smoke tests: boot the real Express app on an ephemeral port and hit
 * it over HTTP. Covers health, public config, viewer privacy (404 for unknown
 * share), auth gating, Stripe webhook honest-not-configured path, and subscription
 * enforcement. No keys required — exercises the mock-mode surface end-to-end.
 *
 * Subscription tests create real DB users so we can verify entitlement enforcement.
 */

let server: Server;
let base = "";

/* ---------- Helpers for subscription tests ---------- */

interface TestSession {
  token: string;
  workspaceId: string;
  userId: string;
}

/**
 * Create a real user + workspace in the DB, sign a JWT, return the session.
 * `plan` sets the workspace plan; `email` overrides the user email for bypass
 * testing.
 */
async function createTestSession(plan: string, email?: string): Promise<TestSession> {
  const uid = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const wsId = `ws_${uid}`;
  const userEmail = email ?? `${uid}@test.com`;

  // Clean up any leftover user from a previous run with the same email.
  const existing = await prisma.user.findUnique({ where: { email: userEmail.toLowerCase() } });
  if (existing) {
    await prisma.workspaceMember.deleteMany({ where: { userId: existing.id } });
    await prisma.workspace.deleteMany({ where: { id: existing.id } });
    // Also cascade via any meetings/usage created — but for tests we just skip.
    await prisma.user.delete({ where: { id: existing.id } }).catch(() => null);
  }

  await prisma.user.create({
    data: {
      id: uid,
      name: "Test User",
      email: userEmail,
      passwordHash: "$2a$10$notreal",
      role: "OWNER",
    },
  });
  await prisma.workspace.create({
    data: { id: wsId, name: "Test", plan: plan as never },
  });
  await prisma.workspaceMember.create({
    data: { userId: uid, workspaceId: wsId, role: "OWNER", status: "ACTIVE" },
  });

  const token = signAccessToken({
    userId: uid,
    workspaceId: wsId,
    role: "OWNER",
    email: userEmail,
    plan,
  });
  return { token, workspaceId: wsId, userId: uid };
}

async function authHeaders(session: TestSession): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" };
}

before(async () => {
  process.env.DEVELOPER_BYPASS_EMAILS = "syedalicr4@gmail.com";
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

/* ---------- Subscription enforcement tests ---------- */

test("normal BASIC user without subscription is blocked from paid AI endpoint", async () => {
  const session = await createTestSession("BASIC");
  const res = await fetch(`${base}/api/ai/chat`, {
    method: "POST",
    headers: await authHeaders(session),
    body: JSON.stringify({ message: "hello", scope: "all" }),
  });
  assert.equal(res.status, 402);
  const body = (await res.json()) as { error: string };
  assert.ok(body.error.includes("PRO"), `Expected PRO upgrade message, got: ${body.error}`);
});

test("subscribed PRO user can access paid AI endpoint", async () => {
  const session = await createTestSession("PRO");
  // This will likely return a 200 or 400 (bad request) because there are no
  // meetings in the DB. Both are acceptable — what matters is it does NOT return
  // 402 (payment required) or 401 (unauthorized).
  const res = await fetch(`${base}/api/ai/chat`, {
    method: "POST",
    headers: await authHeaders(session),
    body: JSON.stringify({ message: "hello", scope: "all" }),
  });
  assert.notEqual(res.status, 402, "PRO user should not get payment required");
  assert.notEqual(res.status, 401, "PRO user should not be unauthorized");
});

test("developer bypass user syedalicr4@gmail.com can access paid AI endpoint (no sub needed)", async () => {
  const session = await createTestSession("BASIC", "syedalicr4@gmail.com");
  const res = await fetch(`${base}/api/ai/chat`, {
    method: "POST",
    headers: await authHeaders(session),
    body: JSON.stringify({ message: "hello", scope: "all" }),
  });
  // Must NOT be blocked (no 402).
  assert.notEqual(res.status, 402, "Developer bypass user should not get payment required");
});

test("different Gmail cannot bypass subscription check", async () => {
  const session = await createTestSession("BASIC", "someone.else@gmail.com");
  const res = await fetch(`${base}/api/ai/chat`, {
    method: "POST",
    headers: await authHeaders(session),
    body: JSON.stringify({ message: "hello", scope: "all" }),
  });
  // Different Gmail with BASIC should be blocked.
  assert.equal(res.status, 402, "Different Gmail on BASIC should be blocked");
});
