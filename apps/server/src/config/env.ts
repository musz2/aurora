import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (monorepo) then local overrides.
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config();

const uploadTranscriptionProvider: "deepgram" | "openai" =
  process.env.UPLOAD_TRANSCRIPTION_PROVIDER === "openai" ? "openai" : "deepgram";

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-access-secret",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY ?? "",
  UPLOAD_TRANSCRIPTION_PROVIDER: uploadTranscriptionProvider,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID ?? "",
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET ?? "",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ?? "",
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID ?? "",
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET ?? "",
  MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI ?? "",
  MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID ?? "common",
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID ?? "",
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET ?? "",
  SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI ?? "",
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ?? "",
  SLACK_DEFAULT_CHANNEL_ID: process.env.SLACK_DEFAULT_CHANNEL_ID ?? "",
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "",
  DROPBOX_CLIENT_ID: process.env.DROPBOX_CLIENT_ID ?? "",
  DROPBOX_CLIENT_SECRET: process.env.DROPBOX_CLIENT_SECRET ?? "",
  HUBSPOT_ACCESS_TOKEN:
    process.env.HUBSPOT_ACCESS_TOKEN ?? process.env.HUBSPOT_PRIVATE_APP_TOKEN ?? "",
  HUBSPOT_CLIENT_ID: process.env.HUBSPOT_CLIENT_ID ?? "",
  HUBSPOT_CLIENT_SECRET: process.env.HUBSPOT_CLIENT_SECRET ?? "",
  HUBSPOT_REDIRECT_URI: process.env.HUBSPOT_REDIRECT_URI ?? "",
  HUBSPOT_PRIVATE_APP_TOKEN: process.env.HUBSPOT_PRIVATE_APP_TOKEN ?? "",
  SALESFORCE_CLIENT_ID: process.env.SALESFORCE_CLIENT_ID ?? "",
  SALESFORCE_CLIENT_SECRET: process.env.SALESFORCE_CLIENT_SECRET ?? "",
  NOTION_API_KEY: process.env.NOTION_API_KEY ?? "",
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID ?? "",
  JIRA_BASE_URL: process.env.JIRA_BASE_URL ?? "",
  JIRA_EMAIL: process.env.JIRA_EMAIL ?? "",
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN ?? "",
  ASANA_ACCESS_TOKEN: process.env.ASANA_ACCESS_TOKEN ?? "",
  ASANA_PROJECT_ID: process.env.ASANA_PROJECT_ID ?? "",
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "",
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? "",
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? "",
  S3_BUCKET: process.env.S3_BUCKET ?? "",
  WEB_URL: process.env.WEB_URL ?? "http://localhost:5173",
  SERVER_URL: process.env.SERVER_URL ?? "http://localhost:4000",
  // Deployment URL config. FRONTEND_URL is the canonical production web origin
  // (Vercel); CORS_ALLOWED_ORIGINS is an optional comma-separated allow-list.
  FRONTEND_URL: process.env.FRONTEND_URL ?? process.env.WEB_URL ?? "",
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS ?? "",
};

export const isProduction = env.NODE_ENV === "production";

export const hasOpenAI = Boolean(env.OPENAI_API_KEY);
export const hasDeepgram = Boolean(env.DEEPGRAM_API_KEY);
export const hasStripe = Boolean(env.STRIPE_SECRET_KEY);
export const hasS3 = Boolean(env.S3_ENDPOINT && env.S3_BUCKET);

/**
 * Origins the API accepts cross-origin requests from. Always includes the local
 * dev/preview hosts, plus FRONTEND_URL and any comma-separated entries in
 * CORS_ALLOWED_ORIGINS. Mock-mode deployments work with just FRONTEND_URL set.
 */
export function getAllowedOrigins(): string[] {
  const base = [
    env.WEB_URL,
    env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:4173",
  ];
  const extra = env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  return [...new Set([...base, ...extra].filter(Boolean))];
}

/**
 * Fail-fast validation for required configuration. In production we refuse to
 * boot with a missing database or default auth secrets (a security risk). In
 * development we only warn so the app stays easy to run. No external provider
 * keys are ever required — the app runs fully in mock/demo mode without them.
 */
export function validateEnv(): void {
  const problems: string[] = [];
  if (!env.DATABASE_URL) {
    problems.push("DATABASE_URL is required (Postgres connection string).");
  }
  if (isProduction) {
    if (env.JWT_SECRET === "dev-access-secret") {
      problems.push("JWT_SECRET must be set to a strong secret in production.");
    }
    if (env.JWT_REFRESH_SECRET === "dev-refresh-secret") {
      problems.push("JWT_REFRESH_SECRET must be set to a strong secret in production.");
    }
    if (getAllowedOrigins().length === 0) {
      problems.push("Set FRONTEND_URL (or CORS_ALLOWED_ORIGINS) to your web origin in production.");
    }
  }

  if (problems.length === 0) return;
  const message =
    "Invalid environment configuration:\n" +
    problems.map((p) => `  • ${p}`).join("\n");
  if (isProduction) {
    // Refuse to start with an insecure/incomplete production config.
    throw new Error(message);
  }
  console.warn(`[env] ${message}\n[env] Continuing in development mode.`);
}
