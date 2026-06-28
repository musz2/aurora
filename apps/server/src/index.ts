import { createServer } from "node:http";
import { createApp } from "./app.js";
import { attachSocketServer } from "./sockets/index.js";
import { env, isProduction, validateEnv } from "./config/env.js";

// Fail fast on an invalid/insecure production configuration. In development this
// only warns. No external provider keys are ever required (mock mode works).
try {
  validateEnv();
} catch (err) {
  console.error(`[startup] ${(err as Error).message}`);
  process.exit(1);
}

const app = createApp();
const server = createServer(app);
attachSocketServer(server);

// Bind to 0.0.0.0 so the server is reachable inside containers (Railway/Docker).
server.listen(env.PORT, "0.0.0.0", () => {
  if (isProduction) {
    console.log(
      `Aurora.ai API listening on port ${env.PORT} (NODE_ENV=production)`
    );
  } else {
    console.log(`\n  Aurora.ai API ready`);
    console.log(`  → REST:      http://localhost:${env.PORT}/api`);
    console.log(`  → WebSocket: ws://localhost:${env.PORT}/ws`);
    console.log(`  → Health:    http://localhost:${env.PORT}/api/health\n`);
  }
});

const shutdown = (signal: string) => {
  console.log(`[shutdown] ${signal} received, closing server…`);
  server.close(() => process.exit(0));
  // Safety net: force-exit if connections don't drain promptly.
  setTimeout(() => process.exit(0), 10000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
