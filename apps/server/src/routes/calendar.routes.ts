import { Router } from "express";
import { createMeetingSchema } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../config/entitlements.js";
import {
  buildMockCalendarEvents,
  detectEventMeetingLink,
  toCalendarMeeting,
  type CalendarEventInput,
} from "../services/calendar.service.js";
import { autoJoinMeeting } from "../services/meeting-connector.service.js";
import { serializeMeeting } from "../utils/serializers.js";
import { writeAudit } from "../services/audit.service.js";
import { getProviderTokens, markIntegrationResult } from "../services/integrations.service.js";
import {
  fetchGoogleCalendarEvents,
  fetchMicrosoftCalendarEvents,
} from "../services/provider-api.service.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/events",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    const ws = await prisma.workspace.findUnique({
      where: { id: req.auth!.workspaceId },
      select: { requireConsent: true },
    });
    const [googleTokens, microsoftTokens] = await Promise.all([
      getProviderTokens(req.auth!.workspaceId, "google-calendar"),
      getProviderTokens(req.auth!.workspaceId, "outlook-calendar"),
    ]);
    const liveEvents = [];
    const errors: string[] = [];
    if (googleTokens) {
      try {
        const events = await fetchGoogleCalendarEvents(googleTokens);
        liveEvents.push(...events.map((event) => ({ ...event, source: "google-calendar" })));
        await markIntegrationResult({
          workspaceId: req.auth!.workspaceId,
          provider: "google-calendar",
          ok: true,
          result: `Fetched ${events.length} Google Calendar events`,
        });
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "Google Calendar failed");
      }
    }
    if (microsoftTokens) {
      try {
        const events = await fetchMicrosoftCalendarEvents(microsoftTokens);
        liveEvents.push(...events.map((event) => ({ ...event, source: "outlook-calendar" })));
        await markIntegrationResult({
          workspaceId: req.auth!.workspaceId,
          provider: "outlook-calendar",
          ok: true,
          result: `Fetched ${events.length} Outlook Calendar events`,
        });
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "Outlook Calendar failed");
      }
    }
    if (liveEvents.length > 0) {
      return res.json({
        mode: "live",
        events: liveEvents.map((event) => ({
          ...event,
          consentRequired: ws?.requireConsent ?? true,
        })),
        errors,
        message: "Showing live calendar events from connected providers.",
      });
    }
    res.json({
      mode: "mock",
      events: buildMockCalendarEvents().map((event) => ({
        ...event,
        consentRequired: ws?.requireConsent ?? true,
        source: "mock",
      })),
      errors,
      message:
        "No live calendar is connected, so Aurora is showing mock events with real link detection.",
    });
  })
);

router.post(
  "/detect",
  asyncHandler(async (req, res) => {
    const event = req.body as CalendarEventInput;
    if (!event?.title) throw badRequest("title is required");
    res.json({
      event: toCalendarMeeting(event, true),
      meetingLink: detectEventMeetingLink(event),
    });
  })
);

router.post(
  "/schedule",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    const event = req.body?.event as CalendarEventInput | undefined;
    if (!event?.title) throw badRequest("event.title is required");
    const detected = toCalendarMeeting(event, true);
    const data = createMeetingSchema.parse({
      title: detected.title,
      description: detected.meetingLink?.url,
      source:
        detected.meetingLink?.provider === "zoom"
          ? "ZOOM"
          : detected.meetingLink?.provider === "teams"
            ? "TEAMS"
            : detected.meetingLink?.provider === "google-meet"
              ? "MEET"
              : "LIVE",
    });
    const meeting = await prisma.meeting.create({
      data: {
        workspaceId: req.auth!.workspaceId,
        createdById: req.auth!.userId,
        title: data.title,
        description: data.description,
        source: data.source,
        status: "SCHEDULED",
        startedAt: new Date(detected.startsAt),
        endedAt: detected.endsAt ? new Date(detected.endsAt) : null,
        participants: detected.attendees,
      },
    });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "calendar.schedule", {
      meetingId: meeting.id,
      provider: detected.meetingLink?.provider,
    });
    res.status(201).json({ meeting: serializeMeeting(meeting), detected });
  })
);

router.post(
  "/auto-join",
  requireFeature("integrations"),
  asyncHandler(async (req, res) => {
    const { event, captureMode } = req.body as {
      event?: CalendarEventInput;
      captureMode?: "bot" | "desktop";
    };
    if (!event?.title) throw badRequest("event.title is required");
    const detected = toCalendarMeeting(event, true);
    if (!detected.meetingLink) throw badRequest("No meeting link detected");
    const workspace = await prisma.workspace.findUnique({
      where: { id: req.auth!.workspaceId },
      select: { name: true },
    });
    const result = autoJoinMeeting({
      meetingId: detected.id,
      title: detected.title,
      link: detected.meetingLink,
      captureMode: captureMode ?? "bot",
      participantIdentity: `${workspace?.name ?? "Aurora"} Aurora Assistant`,
    });
    await writeAudit(req.auth!.workspaceId, req.auth!.userId, "meeting.auto_join", {
      provider: result.provider,
      mode: result.mode,
      captureMode: result.captureMode,
      readiness: result.status,
    });
    res.json({ result });
  })
);

export default router;
