import type { SourceAdapter } from "./types";

export type CacheBackend = "redis";
export type CacheProvider = SourceAdapter;
export type CacheResultStatus = "bypass" | "hit" | "miss";

export type RequestBudgetResult = {
  allowed: boolean;
  used: number;
  limit: number;
};

export type RequestGate = () => Promise<RequestBudgetResult>;

export type IndicatorDataCache = {
  backend: CacheBackend;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
};

export type DailyInsightStore = IndicatorDataCache;

export type CacheTelemetry = {
  backend: CacheBackend | "none";
  hits: CacheProvider[];
  misses: CacheProvider[];
  bypassed: CacheProvider[];
};

export const PROVIDER_CACHE_TTL_SECONDS: Record<CacheProvider, number> = {
  fred: 60 * 60,
  treasury: 60 * 60,
  bls: 12 * 60 * 60,
  bea: 12 * 60 * 60,
  census: 12 * 60 * 60,
  nasdaq: 6 * 60 * 60,
  polymarket: 15 * 60,
};

export async function loadCachedProvider<T>(options: {
  cache?: IndicatorDataCache;
  cacheKey: string;
  ttlSeconds: number;
  loader: () => Promise<T>;
  shouldCache: (value: T) => boolean;
}): Promise<{ value: T; status: CacheResultStatus }> {
  if (!options.cache) {
    return { value: await options.loader(), status: "bypass" };
  }

  const cached = await options.cache.get<T>(options.cacheKey);
  if (cached !== null) return { value: cached, status: "hit" };

  const value = await options.loader();
  if (options.shouldCache(value)) {
    await options.cache.set(options.cacheKey, value, options.ttlSeconds);
  }
  return { value, status: "miss" };
}
