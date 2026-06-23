import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (monorepo) then local overrides.
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-access-secret",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY ?? "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "",
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? "",
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? "",
  S3_BUCKET: process.env.S3_BUCKET ?? "",
  WEB_URL: process.env.WEB_URL ?? "http://localhost:5173",
  SERVER_URL: process.env.SERVER_URL ?? "http://localhost:4000",
};

export const hasOpenAI = Boolean(env.OPENAI_API_KEY);
export const hasDeepgram = Boolean(env.DEEPGRAM_API_KEY);
export const hasStripe = Boolean(env.STRIPE_SECRET_KEY);
export const hasS3 = Boolean(env.S3_ENDPOINT && env.S3_BUCKET);
