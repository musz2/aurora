import Redis from "ioredis";
import { env } from "../config/env.js";

/**
 * Thin cache abstraction. Uses Redis when REDIS_URL is reachable, otherwise
 * falls back to an in-memory map so the app never crashes in local dev.
 */
class Cache {
  private redis: Redis | null = null;
  private mem = new Map<string, { value: string; expires: number }>();

  constructor() {
    if (env.REDIS_URL) {
      try {
        this.redis = new Redis(env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
        this.redis.on("error", () => {
          /* swallow — fall back to memory */
        });
        this.redis.connect().catch(() => {
          this.redis = null;
        });
      } catch {
        this.redis = null;
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.redis) {
      try {
        return await this.redis.get(key);
      } catch {
        /* fall through */
      }
    }
    const hit = this.mem.get(key);
    if (!hit) return null;
    if (hit.expires && hit.expires < Date.now()) {
      this.mem.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlSeconds = 0): Promise<void> {
    if (this.redis) {
      try {
        if (ttlSeconds > 0) await this.redis.set(key, value, "EX", ttlSeconds);
        else await this.redis.set(key, value);
        return;
      } catch {
        /* fall through */
      }
    }
    this.mem.set(key, {
      value,
      expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
    });
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch {
        /* ignore */
      }
    }
    this.mem.delete(key);
  }
}

export const cache = new Cache();
