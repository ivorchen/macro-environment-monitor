import "server-only";

import { createClient } from "redis";

import type { DailyInsightStore, IndicatorDataCache, RequestGate } from "./cache";

type IndicatorRedisClient = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options: { EX: number; NX?: boolean },
  ): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
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

export function createRedisDailyInsightStore(
  redisUrl = process.env.REDIS_URL,
  keyPrefix = process.env.REDIS_KEY_PREFIX ?? "macro-monitor",
): DailyInsightStore | undefined {
  if (!redisUrl) return undefined;

  const key = (value: string) => `${keyPrefix}:${value}`;
  return {
    backend: "redis",
    async get<T>(cacheKey: string) {
      const value = await (await redisClient(redisUrl)).get(key(cacheKey));
      return value ? JSON.parse(value) as T : null;
    },
    async set<T>(cacheKey: string, value: T, ttlSeconds: number) {
      await (await redisClient(redisUrl)).set(key(cacheKey), JSON.stringify(value), {
        EX: ttlSeconds,
      });
    },
  };
}

export function createRedisDailyRequestGate(
  namespace: string,
  limit: number,
  redisUrl = process.env.REDIS_URL,
  keyPrefix = process.env.REDIS_KEY_PREFIX ?? "macro-monitor",
): RequestGate | undefined {
  if (!redisUrl) return undefined;

  return async () => {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const key = `${keyPrefix}:request-budget:${namespace}:${date}`;
      const client = await redisClient(redisUrl);
      const used = await client.incr(key);
      if (used === 1) await client.expire(key, 48 * 60 * 60);
      return { allowed: used <= limit, used, limit };
    } catch {
      // Fail closed: an unavailable quota ledger must never cause unbounded provider calls.
      return { allowed: false, used: limit, limit };
    }
  };
}
