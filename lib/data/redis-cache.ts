import "server-only";

import { createClient } from "redis";

import type { IndicatorDataCache } from "./cache";

type IndicatorRedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
};

const globalForRedis = globalThis as typeof globalThis & {
  macroMonitorRedisClient?: Promise<IndicatorRedisClient>;
};

function redisClient(redisUrl: string) {
  if (!globalForRedis.macroMonitorRedisClient) {
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 2_000,
        reconnectStrategy: false,
      },
    });
    client.on("error", () => {
      // Cache failures are handled as misses so the source pipeline remains available.
    });
    globalForRedis.macroMonitorRedisClient = client.connect()
      .then(() => client as IndicatorRedisClient)
      .catch((error) => {
        globalForRedis.macroMonitorRedisClient = undefined;
        throw error;
      });
  }
  return globalForRedis.macroMonitorRedisClient;
}

export function createRedisIndicatorCache(
  redisUrl = process.env.REDIS_URL,
  keyPrefix = process.env.REDIS_KEY_PREFIX ?? "macro-monitor",
): IndicatorDataCache | undefined {
  if (!redisUrl) return undefined;

  return {
    backend: "redis",
    async get<T>(key: string) {
      try {
        const value = await (await redisClient(redisUrl)).get(`${keyPrefix}:${key}`);
        return value ? JSON.parse(value) as T : null;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      try {
        await (await redisClient(redisUrl)).set(`${keyPrefix}:${key}`, JSON.stringify(value), {
          EX: ttlSeconds,
        });
      } catch {
        // Redis is an optimization; source reads remain the availability fallback.
      }
    },
  };
}
