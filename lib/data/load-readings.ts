import { fetchBeaReadings } from "./adapters/bea";
import { fetchBlsReadingsWithFredFallback } from "./adapters/bls-with-fred-fallback";
import { fetchCensusReadings } from "./adapters/census";
import { fetchFredReadings } from "./adapters/fred";
import { fetchNasdaqReadings } from "./adapters/nasdaq";
import { fetchPolymarketReadings } from "./adapters/polymarket";
import { fetchTreasuryReadings } from "./adapters/treasury";
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
    beaApiKey?: string;
    censusApiKey?: string;
    cache?: IndicatorDataCache;
  } = {},
): Promise<IndicatorApiResponse> {
  const now = options.now ?? new Date();
  const fredSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "fred");
  const blsSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "bls");
  const beaSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "bea");
  const censusSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "census");
  const treasurySources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "treasury");
  const nasdaqSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "nasdaq");
  const polymarketSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "polymarket");
  const skippedProvider = Promise.resolve({
    value: [] as IndicatorReading[],
    status: "bypass" as const,
  });

  const [fredResult, blsResult, beaResult, censusResult, treasuryResult, nasdaqResult, polymarketResult] = await Promise.all([
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
    options.beaApiKey
      ? loadCachedProvider({
          cache: options.cache,
          cacheKey: "readings:v2:bea",
          ttlSeconds: PROVIDER_CACHE_TTL_SECONDS.bea,
          loader: () => fetchBeaReadings(beaSources, options.beaApiKey, options),
          shouldCache: (readings) =>
            readings.every((reading) => reading.freshness !== "unavailable"),
        })
      : skippedProvider,
    options.censusApiKey
      ? loadCachedProvider({
          cache: options.cache,
          cacheKey: "readings:v2:census",
          ttlSeconds: PROVIDER_CACHE_TTL_SECONDS.census,
          loader: () => fetchCensusReadings(censusSources, options.censusApiKey, options),
          shouldCache: (readings) =>
            readings.every((reading) => reading.freshness !== "unavailable"),
        })
      : skippedProvider,
    loadCachedProvider({
      cache: options.cache,
      cacheKey: "readings:v2:treasury",
      ttlSeconds: PROVIDER_CACHE_TTL_SECONDS.treasury,
      loader: () => fetchTreasuryReadings(treasurySources, options),
      shouldCache: (readings) => readings.every((reading) => reading.freshness !== "unavailable"),
    }),
    loadCachedProvider({
      cache: options.cache,
      cacheKey: "readings:v3:nasdaq",
      ttlSeconds: PROVIDER_CACHE_TTL_SECONDS.nasdaq,
      loader: () => fetchNasdaqReadings(nasdaqSources, options),
      shouldCache: (readings) =>
        readings.every((reading) => reading.freshness !== "unavailable"),
    }),
    loadCachedProvider({
      cache: options.cache,
      cacheKey: "readings:v1:polymarket",
      ttlSeconds: PROVIDER_CACHE_TTL_SECONDS.polymarket,
      loader: () => fetchPolymarketReadings(polymarketSources, options),
      shouldCache: (readings) =>
        readings.every((reading) => reading.freshness !== "unavailable"),
    }),
  ]);

  const providerStatuses: Array<{ provider: CacheProvider; status: CacheResultStatus }> = [
    { provider: "fred", status: fredResult.status },
    { provider: "bls", status: blsResult.status },
    ...(options.beaApiKey ? [{ provider: "bea" as const, status: beaResult.status }] : []),
    ...(options.censusApiKey
      ? [{ provider: "census" as const, status: censusResult.status }]
      : []),
    { provider: "treasury", status: treasuryResult.status },
    { provider: "nasdaq", status: nasdaqResult.status },
    { provider: "polymarket", status: polymarketResult.status },
  ];

  const readings = [
    ...fredResult.value,
    ...blsResult.value,
    ...beaResult.value,
    ...censusResult.value,
    ...treasuryResult.value,
    ...nasdaqResult.value,
    ...polymarketResult.value,
  ]
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
