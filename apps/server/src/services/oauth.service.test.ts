import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptTokens,
  encryptTokens,
  signOAuthState,
  tokenExpired,
  verifyOAuthState,
  type OAuthTokens,
} from "./oauth.service.js";

test("OAuth state is signed and verified for callback use", () => {
  const signed = signOAuthState({
    provider: "google",
    workspaceId: "workspace-1",
    userId: "user-1",
    returnTo: "http://localhost:5173/app/integrations",
  });
  const state = verifyOAuthState(signed);
  assert.equal(state.provider, "google");
  assert.equal(state.workspaceId, "workspace-1");
  assert.equal(state.userId, "user-1");
});

test("OAuth tokens are encrypted at rest and decrypt to the original payload", () => {
  const tokens: OAuthTokens = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    scope: "calendar drive",
  };
  const envelope = encryptTokens(tokens);
  assert.notEqual(envelope.encrypted.includes("access-token"), true);
  assert.deepEqual(decryptTokens(envelope), tokens);
});

test("tokenExpired respects expiry timestamps and skew", () => {
  assert.equal(
    tokenExpired({ accessToken: "a", expiresAt: new Date(Date.now() - 1000).toISOString() }),
    true
  );
  assert.equal(
    tokenExpired({ accessToken: "a", expiresAt: new Date(Date.now() + 3600_000).toISOString() }),
    false
  );
});
