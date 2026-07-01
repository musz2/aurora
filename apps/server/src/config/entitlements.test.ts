import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isOwnerAdmin,
  isDeveloperBypassUser,
  ownerBillingOverrideActive,
} from "./entitlements.js";

const OWNER = "syedalicr4@gmail.com";

function clearEnv() {
  delete process.env.OWNER_ADMIN_EMAIL;
  delete process.env.DEVELOPER_BYPASS_EMAILS;
  delete process.env.ENABLE_OWNER_BILLING_OVERRIDE;
}

afterEach(clearEnv);

test("isOwnerAdmin matches OWNER_ADMIN_EMAIL (case-insensitive)", () => {
  clearEnv();
  process.env.OWNER_ADMIN_EMAIL = OWNER;
  assert.equal(isOwnerAdmin(OWNER), true);
  assert.equal(isOwnerAdmin("SyedAliCR4@Gmail.com"), true);
  assert.equal(isOwnerAdmin("someone.else@gmail.com"), false);
});

test("legacy DEVELOPER_BYPASS_EMAILS still recognized + alias works", () => {
  clearEnv();
  process.env.DEVELOPER_BYPASS_EMAILS = `other@x.com, ${OWNER}`;
  assert.equal(isOwnerAdmin(OWNER), true);
  assert.equal(isDeveloperBypassUser(OWNER), true);
});

test("no allowlist configured → nobody is owner/admin", () => {
  clearEnv();
  assert.equal(isOwnerAdmin(OWNER), false);
  assert.equal(ownerBillingOverrideActive(OWNER), false);
});

test("billing override needs allowlist AND an explicit gate", () => {
  clearEnv();
  // On allowlist but no gate → production-safe: no override.
  process.env.OWNER_ADMIN_EMAIL = OWNER;
  assert.equal(ownerBillingOverrideActive(OWNER), false);

  // Explicit gate enables it.
  process.env.ENABLE_OWNER_BILLING_OVERRIDE = "true";
  assert.equal(ownerBillingOverrideActive(OWNER), true);

  // Non-"true" values do not enable it.
  process.env.ENABLE_OWNER_BILLING_OVERRIDE = "1";
  assert.equal(ownerBillingOverrideActive(OWNER), false);
});

test("legacy bypass list marks owner/admin but does NOT grant billing override", () => {
  clearEnv();
  // The legacy var is still honored as an allowlist source...
  process.env.DEVELOPER_BYPASS_EMAILS = OWNER;
  assert.equal(isOwnerAdmin(OWNER), true);
  // ...but the billing override stays OFF until the explicit gate is set, so a
  // production deploy that only configures the allowlist never unlocks paid
  // features for free.
  assert.equal(ownerBillingOverrideActive(OWNER), false);
  process.env.ENABLE_OWNER_BILLING_OVERRIDE = "true";
  assert.equal(ownerBillingOverrideActive(OWNER), true);
});

test("a non-owner email never gets the override, even with the flag on", () => {
  clearEnv();
  process.env.OWNER_ADMIN_EMAIL = OWNER;
  process.env.ENABLE_OWNER_BILLING_OVERRIDE = "true";
  assert.equal(ownerBillingOverrideActive("someone.else@gmail.com"), false);
});
