import { Router } from "express";
import { PLANS } from "@aurora/shared";
import { hasOpenAI, hasDeepgram, hasStripe, hasS3 } from "../config/env.js";

const router = Router();

/**
 * Public capability endpoint. Reports *whether* services are configured —
 * never the keys themselves. The frontend uses this to show honest states
 * ("Live STT", "Simulated", "Billing not configured", etc.).
 */
router.get("/", (_req, res) => {
  res.json({
    services: {
      // AI summaries / chat / Q&A
      ai: hasOpenAI,
      // Live speech-to-text (Deepgram). When false, a simulated engine is used.
      liveTranscription: hasDeepgram,
      // Real payments. When false, billing is "not configured" (demo plan switch).
      billing: hasStripe,
      // Object storage. When false, local filesystem is used.
      storage: hasS3,
    },
    transcriptionEngine: hasDeepgram ? "deepgram" : "simulated",
    plans: PLANS,
  });
});

export default router;
