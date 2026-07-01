import dotenv from "dotenv";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env (monorepo) then local overrides.
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config();

const DEV_ACCESS_SECRET = "dev-access-secret";
const DEV_REFRESH_SECRET = "dev-refresh-secret";

/**
 * In production, never run with the publicly-known dev JWT defaults. If real
 * secrets aren't provided we generate strong ephemeral ones at boot (and warn)
 * so the service still starts and passes health checks, instead of crash-looping.
 * Tokens won't survive a restart until a stable secret is configured.
 */
function resolveJwtSecret(value: string | undefined, devDefault: string, label: string): string {
  if (value && value !== devDefault) return value;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      `[env] ${label} is not set — generating an ephemeral secret for this boot. ` +
        `Set ${label} to a stable strong value so sessions survive restarts.`
    );
    return crypto.randomBytes(48).toString("hex");
  }
  return devDefault;
}

const uploadTranscriptionProvider: "deepgram" | "openai" =
  process.env.UPLOAD_TRANSCRIPTION_PROVIDER === "openai" ? "openai" : "deepgram";

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  JWT_SECRET: resolveJwtSecret(process.env.JWT_SECRET, DEV_ACCESS_SECRET, "JWT_SECRET"),
  JWT_REFRESH_SECRET: resolveJwtSecret(
    process.env.JWT_REFRESH_SECRET,
    DEV_REFRESH_SECRET,
    "JWT_REFRESH_SECRET"
  ),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY ?? "",
  UPLOAD_TRANSCRIPTION_PROVIDER: uploadTranscriptionProvider,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // Stripe Price IDs per paid plan (required for real checkout of that plan).
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO ?? "",
  STRIPE_PRICE_BUSINESS: process.env.STRIPE_PRICE_BUSINESS ?? "",
  // ----- Integrations (OAuth only — never email passwords) -----
  // Zoom
  ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID ?? "",
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET ?? "",
  ZOOM_REDIRECT_URI: process.env.ZOOM_REDIRECT_URI ?? "",
  ZOOM_SCOPES: process.env.ZOOM_SCOPES ?? "",
  // Google (Google Meet + Google Calendar)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ?? "",
  GOOGLE_CALENDAR_SCOPES: process.env.GOOGLE_CALENDAR_SCOPES ?? "",
  // Microsoft (Microsoft Teams + Outlook Calendar)
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID ?? "",
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET ?? "",
  MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI ?? "",
  MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID ?? "common",
  MICROSOFT_GRAPH_SCOPES: process.env.MICROSOFT_GRAPH_SCOPES ?? "",
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
  // Authorized OWNER/ADMIN allowlist (NOT an auth/OAuth bypass). The account must
  // still log in normally; this only marks operator accounts for admin/demo access.
  // Configured server-side; never exposed to the frontend bundle.
  OWNER_ADMIN_EMAIL: process.env.OWNER_ADMIN_EMAIL ?? "",
  // Legacy alias for OWNER_ADMIN_EMAIL (still honored).
  DEVELOPER_BYPASS_EMAILS: process.env.DEVELOPER_BYPASS_EMAILS ?? "",
  // Gate the owner/admin BILLING override. Set to "true" ONLY in local/staging/demo.
  // In production, leave unset so billing relies on real subscription status.
  ENABLE_OWNER_BILLING_OVERRIDE: process.env.ENABLE_OWNER_BILLING_OVERRIDE ?? "",
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
  // Configured web origins are always trusted. Localhost dev/preview hosts are
  // only trusted OUTSIDE production, so a production deploy accepts exactly the
  // origins it was configured with (FRONTEND_URL / WEB_URL / CORS_ALLOWED_ORIGINS).
  const base = [env.WEB_URL, env.FRONTEND_URL];
  if (!isProduction) {
    base.push("http://localhost:5173", "http://localhost:4173");
  }
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
  // Fatal: without a database the server cannot function. This is the only
  // condition that aborts startup, so a healthy DB always yields a bootable
  // server that can pass health checks.
  if (!env.DATABASE_URL) {
    throw new Error(
      "Invalid environment configuration:\n  • DATABASE_URL is required (Postgres connection string)."
    );
  }

  // Non-fatal warnings: surface security/config gaps without crash-looping the
  // deploy. JWT secrets are already auto-hardened in production (see env above).
  const warnings: string[] = [];
  if (isProduction) {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      warnings.push("Set stable JWT_SECRET + JWT_REFRESH_SECRET so sessions survive restarts.");
    }
    if (getAllowedOrigins().length === 0) {
      warnings.push("Set FRONTEND_URL (or CORS_ALLOWED_ORIGINS) to your web origin.");
    }
  }
  if (warnings.length > 0) {
    console.warn(
      "[env] Configuration warnings:\n" + warnings.map((w) => `  • ${w}`).join("\n")
    );
  }
}
