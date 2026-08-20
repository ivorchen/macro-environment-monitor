import { fetchBlsReadingsWithFredFallback } from "./adapters/bls-with-fred-fallback";
import { fetchFredReadings } from "./adapters/fred";
import { fetchTreasuryReading } from "./adapters/treasury";
import {
  PROVIDER_CACHE_TTL_SECONDS,
  loadCachedProvider,
  type CacheProvider,
  type CacheResultStatus,
  type IndicatorDataCache,
} from "./cache";
import { FEATURED_SOURCE_DEFINITIONS } from "./source-registry";
import type { AdapterOptions, IndicatorApiResponse, IndicatorReading } from "./types";

export async function loadIndicatorReadings(
  options: AdapterOptions & {
    fredApiKey?: string;
    blsApiKey?: string;
    cache?: IndicatorDataCache;
  } = {},
): Promise<IndicatorApiResponse> {
  const now = options.now ?? new Date();
  const fredSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "fred");
  const blsSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "bls");
  const treasurySource = FEATURED_SOURCE_DEFINITIONS.find((source) => source.adapter === "treasury");

  const [fredResult, blsResult, treasuryResult] = await Promise.all([
    loadCachedProvider({
      cache: options.fredApiKey ? options.cache : undefined,
      cacheKey: "readings:v1:fred",
      ttlSeconds: PROVIDER_CACHE_TTL_SECONDS.fred,
      loader: () => fetchFredReadings(fredSources, options.fredApiKey, options),
      shouldCache: (readings) => readings.every((reading) => reading.freshness !== "unavailable"),
    }),
    loadCachedProvider({
      cache: options.cache,
      cacheKey: "readings:v1:bls",
      ttlSeconds: PROVIDER_CACHE_TTL_SECONDS.bls,
      loader: () => fetchBlsReadingsWithFredFallback(blsSources, {
        fetcher: options.fetcher,
        now,
        fredApiKey: options.fredApiKey,
        blsApiKey: options.blsApiKey,
      }),
      shouldCache: (readings) => readings.every((reading) => reading.freshness !== "unavailable"),
    }),
    loadCachedProvider({
      cache: options.cache,
      cacheKey: "readings:v1:treasury",
      ttlSeconds: PROVIDER_CACHE_TTL_SECONDS.treasury,
      loader: () => treasurySource ? fetchTreasuryReading(treasurySource, options) : Promise.resolve(null),
      shouldCache: (reading) => reading !== null && reading.freshness !== "unavailable",
    }),
  ]);

  const providerStatuses: Array<{ provider: CacheProvider; status: CacheResultStatus }> = [
    { provider: "fred", status: fredResult.status },
    { provider: "bls", status: blsResult.status },
    { provider: "treasury", status: treasuryResult.status },
  ];

  const readings = [...fredResult.value, ...blsResult.value, treasuryResult.value]
    .filter((reading): reading is IndicatorReading => reading !== null)
    .sort((a, b) => {
      const aSource = FEATURED_SOURCE_DEFINITIONS.findIndex((source) => source.id === a.id);
      const bSource = FEATURED_SOURCE_DEFINITIONS.findIndex((source) => source.id === b.id);
      return aSource - bSource;
    });

  return {
    generatedAt: now.toISOString(),
    readings,
    cache: {
      backend: options.cache?.backend ?? "none",
      hits: providerStatuses.filter(({ status }) => status === "hit").map(({ provider }) => provider),
      misses: providerStatuses.filter(({ status }) => status === "miss").map(({ provider }) => provider),
      bypassed: providerStatuses.filter(({ status }) => status === "bypass").map(({ provider }) => provider),
    },
    summary: {
      fresh: readings.filter((reading) => reading.freshness === "fresh").length,
      stale: readings.filter((reading) => reading.freshness === "stale").length,
      unavailable: readings.filter((reading) => reading.freshness === "unavailable").length,
    },
  };
}
