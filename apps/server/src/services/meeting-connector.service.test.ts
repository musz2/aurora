import test from "node:test";
import assert from "node:assert/strict";
import { autoJoinMeeting } from "./meeting-connector.service.js";

test("autoJoinMeeting uses explicit mock mode without provider credentials", () => {
  delete process.env.ZOOM_CLIENT_ID;
  delete process.env.ZOOM_CLIENT_SECRET;
  const result = autoJoinMeeting({
    meetingId: "event-1",
    title: "Pipeline review",
    captureMode: "bot",
    participantIdentity: "Aurora Demo Assistant",
    link: {
      provider: "zoom",
      url: "https://zoom.us/j/123456789",
      meetingId: "123456789",
    },
  });
  assert.equal(result.mode, "mock");
  assert.equal(result.status, "pending_credentials");
  assert.equal(result.participantIdentity, "Aurora Demo Assistant");
  assert.equal(result.recordingIndicator, "visible");
});

test("desktop capture mode does not queue a bot participant", () => {
  const result = autoJoinMeeting({
    meetingId: "event-2",
    title: "Design review",
    captureMode: "desktop",
    link: {
      provider: "google-meet",
      url: "https://meet.google.com/abc-defg-hij",
    },
  });
  assert.equal(result.status, "requires_desktop_capture");
  assert.equal(result.captureMode, "desktop");
});
