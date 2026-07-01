import test from "node:test";
import assert from "node:assert/strict";
import {
  INTEGRATION_CATALOG,
  INTEGRATION_ENV_VARS,
  SUPPORTED_INTEGRATIONS,
  isSupportedIntegration,
} from "@aurora/shared";
import { env } from "../config/env.js";
import { buildOAuthUrl } from "./oauth.service.js";
import { OAUTH_PROVIDER } from "./integrations.service.js";
import { detectMeetingLink } from "./calendar.service.js";

const REMOVED = [
  "slack",
  "hubspot",
  "dropbox",
  "salesforce",
  "notion",
  "jira",
  "asana",
  "zapier",
  "google-drive",
  "email-export",
];

test("catalog contains exactly the five supported integrations", () => {
  assert.equal(INTEGRATION_CATALOG.length, 5);
  assert.deepEqual(
    INTEGRATION_CATALOG.map((i) => i.provider).sort(),
    [...SUPPORTED_INTEGRATIONS].sort()
  );
  for (const e of INTEGRATION_CATALOG) assert.ok(isSupportedIntegration(e.provider));
});

test("removed providers are not supported", () => {
  for (const p of REMOVED) assert.equal(isSupportedIntegration(p), false, `${p} should be unsupported`);
});

test("catalog only groups into Meeting Platforms and Calendars", () => {
  const cats = new Set(INTEGRATION_CATALOG.map((i) => i.category));
  assert.deepEqual([...cats].sort(), ["Calendars", "Meeting Platforms"]);
});

test("OAUTH_PROVIDER maps only supported providers", () => {
  assert.deepEqual(Object.keys(OAUTH_PROVIDER).sort(), [...SUPPORTED_INTEGRATIONS].sort());
});

test("integration env vars are OAuth-only — no email/password vars", () => {
  assert.deepEqual(Object.keys(INTEGRATION_ENV_VARS).sort(), [...SUPPORTED_INTEGRATIONS].sort());
  for (const v of Object.values(INTEGRATION_ENV_VARS).flat()) {
    assert.ok(!/PASS|PASSWORD|SMTP|EMAIL/i.test(v), `password/email-like env var: ${v}`);
    assert.ok(/CLIENT_ID|CLIENT_SECRET|REDIRECT_URI/.test(v), `unexpected non-OAuth var: ${v}`);
  }
});

test("OAuth URL generation works for Google, Microsoft, and Zoom", () => {
  const saved = { ...env };
  try {
    env.GOOGLE_CLIENT_ID = "gid";
    env.GOOGLE_CLIENT_SECRET = "gsec";
    env.GOOGLE_REDIRECT_URI = "https://app.test/cb/google";
    const g = buildOAuthUrl("google", { provider: "google", workspaceId: "w", userId: "u" });
    assert.match(g, /accounts\.google\.com\/o\/oauth2/);
    assert.match(g, /client_id=gid/);
    assert.match(g, /redirect_uri=https%3A%2F%2Fapp\.test/);
    assert.match(g, /state=/);

    env.MICROSOFT_CLIENT_ID = "mid";
    env.MICROSOFT_CLIENT_SECRET = "msec";
    env.MICROSOFT_REDIRECT_URI = "https://app.test/cb/ms";
    const m = buildOAuthUrl("microsoft", { provider: "microsoft", workspaceId: "w", userId: "u" });
    assert.match(m, /login\.microsoftonline\.com/);
    assert.match(m, /client_id=mid/);

    env.ZOOM_CLIENT_ID = "zid";
    env.ZOOM_CLIENT_SECRET = "zsec";
    env.ZOOM_REDIRECT_URI = "https://app.test/cb/zoom";
    const z = buildOAuthUrl("zoom", { provider: "zoom", workspaceId: "w", userId: "u" });
    assert.match(z, /zoom\.us\/oauth\/authorize/);
    assert.match(z, /client_id=zid/);
  } finally {
    Object.assign(env, saved);
  }
});

test("missing provider config throws an honest error (no fake connect)", () => {
  const saved = env.GOOGLE_CLIENT_ID;
  try {
    env.GOOGLE_CLIENT_ID = "";
    assert.throws(
      () => buildOAuthUrl("google", { provider: "google", workspaceId: "w", userId: "u" }),
      /not configured/i
    );
  } finally {
    env.GOOGLE_CLIENT_ID = saved;
  }
});

test("meeting link detection works for Zoom, Google Meet, and Teams", () => {
  assert.equal(detectMeetingLink("Join: https://zoom.us/j/123456789")?.provider, "zoom");
  assert.equal(detectMeetingLink("https://zoom.us/j/123456789")?.meetingId, "123456789");
  assert.equal(detectMeetingLink("Link https://meet.google.com/abc-defg-hij")?.provider, "google-meet");
  assert.equal(
    detectMeetingLink("Teams: https://teams.microsoft.com/l/meetup-join/19%3ameeting_x")?.provider,
    "teams"
  );
});
