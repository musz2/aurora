import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasS3 } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

/**
 * Storage adapter. Uses the local filesystem in development. When S3 env vars
 * are present, `hasS3` is true and a production adapter (e.g. @aws-sdk/client-s3)
 * can be wired in here behind the same `save` interface.
 */
export const storage = {
  isS3: hasS3,
  ensureDir() {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  },
  localDir: UPLOAD_DIR,
  /** Returns a URL/path reference for a stored file. */
  publicUrl(filename: string): string {
    return `/uploads/${filename}`;
  },
};
