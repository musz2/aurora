import { createServer } from "node:http";
import { createApp } from "./app.js";
import { attachSocketServer } from "./sockets/index.js";
import { env } from "./config/env.js";

const app = createApp();
const server = createServer(app);
attachSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`\n  Aurora.ai API ready`);
  console.log(`  → REST:      http://localhost:${env.PORT}/api`);
  console.log(`  → WebSocket: ws://localhost:${env.PORT}/ws`);
  console.log(`  → Health:    http://localhost:${env.PORT}/api/health\n`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
