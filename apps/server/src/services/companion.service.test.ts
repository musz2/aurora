import { test } from "node:test";
import assert from "node:assert/strict";
import { clampTtlMinutes, hashToken, isPairingActive } from "./companion.service.js";

test("isPairingActive honors revoke and expiry", () => {
  const now = new Date("2026-06-29T12:00:00.000Z");
  assert.equal(isPairingActive(null, now), false);
  assert.equal(
    isPairingActive({ revoked: true, expiresAt: "2026-06-29T13:00:00.000Z" }, now),
    false
  );
  assert.equal(
    isPairingActive({ revoked: false, expiresAt: "2026-06-29T13:00:00.000Z" }, now),
    true
  );
  assert.equal(
    isPairingActive({ revoked: false, expiresAt: "2026-06-29T11:00:00.000Z" }, now),
    false
  );
  assert.equal(
    isPairingActive({ revoked: false, expiresAt: new Date("2026-06-29T11:00:00.000Z") }, now),
    false
  );
});

test("hashToken is deterministic, non-reversible-looking, and token-specific", () => {
  const a = hashToken("cmp_abc");
  assert.equal(a, hashToken("cmp_abc"));
  assert.notEqual(a, hashToken("cmp_xyz"));
  assert.equal(a.length, 64); // sha-256 hex
  assert.ok(!a.includes("cmp_abc"));
});

test("clampTtlMinutes applies defaults and an upper bound", () => {
  assert.equal(clampTtlMinutes(undefined), 60);
  assert.equal(clampTtlMinutes(0), 60);
  assert.equal(clampTtlMinutes(-5), 60);
  assert.equal(clampTtlMinutes(30), 30);
  assert.equal(clampTtlMinutes(99999), 12 * 60);
});
