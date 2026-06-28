import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SPEAKER_PALETTE,
  SpeakerNameError,
  normalizeSpeakerName,
  speakerAvatar,
  speakerColor,
  speakerInitials,
  validateRename,
} from "./speaker.service.js";

test("normalizeSpeakerName trims and collapses whitespace", () => {
  assert.equal(normalizeSpeakerName("  Alex   Kim  "), "Alex Kim");
  assert.throws(() => normalizeSpeakerName("   "), SpeakerNameError);
});

test("speakerInitials produces up to two uppercase initials", () => {
  assert.equal(speakerInitials("Alex Kim"), "AK");
  assert.equal(speakerInitials("Alex"), "AL");
  assert.equal(speakerInitials("madonna"), "MA");
  assert.equal(speakerInitials("   "), "?");
});

test("speakerColor is deterministic and within the palette", () => {
  const a = speakerColor("Speaker 1");
  const b = speakerColor("Speaker 1");
  assert.equal(a, b);
  assert.ok((SPEAKER_PALETTE as readonly string[]).includes(a));
});

test("speakerAvatar bundles initials and color", () => {
  const avatar = speakerAvatar("Pat Reynolds");
  assert.equal(avatar.initials, "PR");
  assert.ok((SPEAKER_PALETTE as readonly string[]).includes(avatar.color));
});

test("validateRename normalizes and rejects no-op renames", () => {
  assert.deepEqual(validateRename(" Speaker 1 ", "Alex"), {
    from: "Speaker 1",
    to: "Alex",
  });
  assert.throws(() => validateRename("Alex", "Alex"), SpeakerNameError);
  assert.throws(() => validateRename("Alex", "  "), SpeakerNameError);
});
