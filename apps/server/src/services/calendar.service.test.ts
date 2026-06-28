import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMockCalendarEvents,
  detectEventMeetingLink,
  detectMeetingLink,
} from "./calendar.service.js";

test("detectMeetingLink recognizes Zoom links and meeting ids", () => {
  const detected = detectMeetingLink("Join https://zoom.us/j/987654321?pwd=test.");
  assert.equal(detected?.provider, "zoom");
  assert.equal(detected?.meetingId, "987654321");
  assert.equal(detected?.url, "https://zoom.us/j/987654321?pwd=test");
});

test("detectEventMeetingLink checks title, location, and description", () => {
  const detected = detectEventMeetingLink({
    title: "Customer review",
    location: "https://meet.google.com/abc-defg-hij",
    description: null,
  });
  assert.equal(detected?.provider, "google-meet");
  assert.equal(detected?.meetingId, "abc-defg-hij");
});

test("mock calendar events are auto-join eligible when links are present", () => {
  const events = buildMockCalendarEvents(new Date("2026-06-26T10:00:00.000Z"));
  assert.equal(events.length, 3);
  assert.equal(events.every((event) => event.autoJoinEligible), true);
  assert.deepEqual(
    events.map((event) => event.meetingLink?.provider),
    ["zoom", "google-meet", "teams"]
  );
});
