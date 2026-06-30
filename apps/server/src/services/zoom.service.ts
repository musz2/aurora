import type { OAuthTokens } from "./oauth.service.js";
import { HttpError } from "../utils/http.js";

const ZOOM_API = "https://api.zoom.us/v2";

function auth(tokens: OAuthTokens) {
  return { Authorization: `Bearer ${tokens.accessToken}` };
}

export interface ZoomUserProfile {
  id: string;
  displayName: string;
  email: string;
  planType: string;
}

export interface ZoomMeetingItem {
  id: number;
  uuid: string;
  topic: string;
  startTime: string;
  duration: number;
  joinUrl: string;
}

/**
 * Fetch the authenticated Zoom user's profile.
 * Requires `user:read:user` scope.
 */
export async function fetchZoomUserProfile(tokens: OAuthTokens): Promise<ZoomUserProfile> {
  const res = await fetch(`${ZOOM_API}/users/me`, { headers: auth(tokens) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(502, `Zoom profile fetch failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return {
    id: String(json.id ?? ""),
    displayName: String(json.display_name ?? json.first_name ?? ""),
    email: String(json.email ?? ""),
    planType: String(json.plan_type ?? ""),
  };
}

/**
 * Fetch upcoming Zoom meetings for the authenticated user.
 * Requires `meeting:read:search` scope.
 */
export async function fetchZoomMeetings(tokens: OAuthTokens): Promise<ZoomMeetingItem[]> {
  const url = new URL(`${ZOOM_API}/users/me/meetings`);
  url.searchParams.set("type", "upcoming");
  url.searchParams.set("page_size", "10");
  const res = await fetch(url, { headers: auth(tokens) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(502, `Zoom meetings fetch failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { meetings?: Array<Record<string, unknown>> };
  return (json.meetings ?? []).map((m) => ({
    id: Number(m.id ?? 0),
    uuid: String(m.uuid ?? ""),
    topic: String(m.topic ?? "Untitled"),
    startTime: String(m.start_time ?? ""),
    duration: Number(m.duration ?? 0),
    joinUrl: String(m.join_url ?? ""),
  }));
}

/**
 * Check whether cloud recording APIs are available for this Zoom account/plan.
 * Basic-license accounts return 403/404. We do NOT fake availability.
 */
export async function checkZoomRecordingAccess(tokens: OAuthTokens): Promise<boolean> {
  const url = new URL(`${ZOOM_API}/users/me/recordings`);
  url.searchParams.set("page_size", "1");
  const res = await fetch(url, { headers: auth(tokens) });
  if (res.status === 403 || res.status === 404) return false;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[zoom] recording access check returned ${res.status}: ${body}`);
    return false;
  }
  return true;
}

export interface ZoomSyncResult {
  ok: boolean;
  profile: ZoomUserProfile | null;
  meetings: ZoomMeetingItem[];
  recordingAccess: boolean;
  message: string;
}

/**
 * Run a full Zoom sync: fetch user profile + meetings + recording status.
 * Returns a combined result; individual failures are reported in the message.
 */
export async function syncZoomAccount(tokens: OAuthTokens): Promise<ZoomSyncResult> {
  const errors: string[] = [];
  let profile: ZoomUserProfile | null = null;
  let meetings: ZoomMeetingItem[] = [];
  let recordingAccess = false;

  try {
    profile = await fetchZoomUserProfile(tokens);
    console.info(`[zoom] profile fetch success — ${profile.displayName} (${profile.email})`);
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "Profile fetch failed";
    errors.push(msg);
    console.warn(`[zoom] ${msg}`);
  }

  try {
    meetings = await fetchZoomMeetings(tokens);
    console.info(`[zoom] sync success — ${meetings.length} upcoming meeting(s) found`);
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "Meetings fetch failed";
    errors.push(msg);
    console.warn(`[zoom] ${msg}`);
  }

  try {
    recordingAccess = await checkZoomRecordingAccess(tokens);
    if (!recordingAccess) {
      console.info("[zoom] sync skipped: Recording import unavailable for this Zoom account/plan.");
    }
  } catch {
    /* non-fatal */
  }

  const message =
    errors.length > 0
      ? errors.join("; ")
      : recordingAccess
        ? `Connected as ${profile?.displayName ?? ""} (${profile?.email ?? ""}). ${meetings.length} upcoming meeting(s). Cloud recordings available.`
        : `Connected as ${profile?.displayName ?? ""} (${profile?.email ?? ""}). ${meetings.length} upcoming meeting(s). Recording import unavailable for this Zoom account/plan.`;

  return { ok: errors.length === 0, profile, meetings, recordingAccess, message };
}
