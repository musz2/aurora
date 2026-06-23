import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env, hasOpenAI, hasDeepgram, hasStripe, hasS3 } from "./config/env.js";
import { storage } from "./services/storage.service.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

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

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: [env.WEB_URL, "http://localhost:5173", "http://localhost:4173"],
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
        openai: hasOpenAI ? "live" : "mock",
        speech: hasDeepgram ? "live" : "simulated",
        stripe: hasStripe ? "live" : "placeholder",
        storage: hasS3 ? "s3" : "local",
      },
    });
  });

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
