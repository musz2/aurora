import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  getAllowedOrigins,
  hasOpenAI,
  hasDeepgram,
  hasStripe,
  hasS3,
} from "./config/env.js";
import { storage } from "./services/storage.service.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { forbidden } from "./utils/http.js";

import authRoutes from "./routes/auth.routes.js";
import meetingsRoutes from "./routes/meetings.routes.js";
import actionItemsRoutes from "./routes/actionItems.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import searchRoutes from "./routes/search.routes.js";
import uploadsRoutes from "./routes/uploads.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import configRoutes from "./routes/config.routes.js";
import sessionsRoutes from "./routes/sessions.routes.js";
import calendarRoutes from "./routes/calendar.routes.js";
import adminRoutes from "./routes/admin.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));

  const allowedOrigins = getAllowedOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / server-to-server / curl (no Origin header) and
        // any explicitly allow-listed web origin. Block everything else with a
        // clear error instead of silently failing.
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Clean 403 with an actionable message (vs. a generic 500).
        return callback(
          forbidden(
            `Origin ${origin} is not allowed by CORS. Add it to FRONTEND_URL or CORS_ALLOWED_ORIGINS.`
          )
        );
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "5mb" }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);

  const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

  storage.ensureDir();
  app.use("/uploads", express.static(storage.localDir));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      services: {
        openai: hasOpenAI ? "live" : "not_configured",
        speech: hasDeepgram ? "live" : "not_configured",
        stripe: hasStripe ? "live" : "placeholder",
        storage: hasS3 ? "s3" : "local",
      },
    });
  });

  // Public (no auth): capability config + shared session viewer.
  app.use("/api/config", configRoutes);
  app.use("/api/sessions", sessionsRoutes);

  app.use("/api/auth", authLimiter, authRoutes);
  app.use("/api/meetings", meetingsRoutes);
  app.use("/api/action-items", actionItemsRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/uploads", uploadsRoutes);
  app.use("/api/workspace", workspaceRoutes);
  app.use("/api/integrations", integrationsRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/api/admin", adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
