import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_AUDIT_ACTIONS, createAuditPayload } from "./audit.service.js";

test("required audit action names are present", () => {
  for (const action of [
    "meeting_started",
    "meeting_paused",
    "meeting_resumed",
    "meeting_stopped",
    "meeting_finalizing",
    "meeting_completed",
    "meeting_failed",
    "speaker_renamed",
    "transcript_exported",
    "integration_connected",
    "integration_action_sent",
    "data_export_requested",
    "data_delete_requested",
  ]) {
    assert.ok(
      (REQUIRED_AUDIT_ACTIONS as readonly string[]).includes(action),
      `expected audit action "${action}" to be required`
    );
  }
});

test("createAuditPayload preserves workspace, user, action, and metadata", () => {
  assert.deepEqual(
    createAuditPayload("workspace-1", "user-1", "transcript_exported", {
      format: "pdf",
    }),
    {
      workspaceId: "workspace-1",
      userId: "user-1",
      action: "transcript_exported",
      metadata: { format: "pdf" },
    }
  );
});
