import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "@aurora/shared";
import {
  checkConcurrentAllowed,
  checkImportAllowed,
  concurrentLimitForPlan,
} from "./usage.service.js";

test("checkImportAllowed enforces the lifetime import cap", () => {
  // BASIC: 3 lifetime imports.
  assert.equal(checkImportAllowed(PLANS.BASIC, 0).allowed, true);
  assert.equal(checkImportAllowed(PLANS.BASIC, 2).allowed, true);
  const blocked = checkImportAllowed(PLANS.BASIC, 3);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? "", /lifetime imports/i);
});

test("checkImportAllowed allows unlimited plans", () => {
  // PRO: -1 (unlimited).
  assert.equal(checkImportAllowed(PLANS.PRO, 9999).allowed, true);
});

test("concurrentLimitForPlan is seat-based with an enterprise exception", () => {
  assert.equal(concurrentLimitForPlan(PLANS.BASIC), 1);
  assert.equal(concurrentLimitForPlan(PLANS.BUSINESS), 10);
  assert.equal(concurrentLimitForPlan(PLANS.ENTERPRISE), Number.POSITIVE_INFINITY);
});

test("checkConcurrentAllowed blocks once the seat limit is reached", () => {
  assert.equal(checkConcurrentAllowed(PLANS.BASIC, 0).allowed, true);
  const blocked = checkConcurrentAllowed(PLANS.BASIC, 1);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? "", /concurrent/i);
  assert.equal(checkConcurrentAllowed(PLANS.ENTERPRISE, 1000).allowed, true);
});
