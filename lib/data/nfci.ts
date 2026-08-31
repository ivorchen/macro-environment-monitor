import {
  loadCachedProvider,
  type CacheResultStatus,
  type IndicatorDataCache,
} from "./cache";

export type NfciDirection = "tightening" | "loosening" | "flat";

export type NfciPoint = {
  date: string;
  value: number;
};

export type NfciStatistics = {
  latest: NfciPoint;
  ytdStart: NfciPoint;
  ytdHigh: NfciPoint;
  ytdLow: NfciPoint;
  ytdChange: number;
  fourWeekChange: number | null;
  direction: NfciDirection;
};

export type NfciYtdResponse = {
  generatedAt: string;
  year: number;
  seriesId: "NFCI";
  source: "Federal Reserve Bank of St. Louis (FRED)";
  sourceUrl: "https://fred.stlouisfed.org/series/NFCI";
  frequency: "weekly";
  points: NfciPoint[];
  statistics: NfciStatistics | null;
  observationDate: string | null;
  freshness: "fresh" | "stale" | "unavailable";
  errorCode?: "configuration-required" | "source-failed" | "missing-observation";
  errorMessage?: string;
  cache: {
    backend: "redis" | "none";
    status: CacheResultStatus;
  };
};

type FredHistoryPayload = {
  observations?: Array<{ date?: unknown; value?: unknown }>;
  error_message?: string;
};

const DAY_MS = 24 * 60 * 60 * 1_000;
const DIRECTION_EPSILON = 0.02;

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function normalizeNfciPoints(
  observations: Array<{ date?: unknown; value?: unknown }>,
  year: number,
): NfciPoint[] {
  const byDate = new Map<string, number>();
  for (const observation of observations) {
    const date = typeof observation.date === "string" ? observation.date : "";
    const value = Number(observation.value);
    if (!validDate(date) || !Number.isFinite(value) || Number(date.slice(0, 4)) !== year) continue;
    byDate.set(date, value);
  }
  return [...byDate]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateNfciStatistics(points: readonly NfciPoint[]): NfciStatistics | null {
  if (!points.length) return null;
  const latest = points.at(-1)!;
  const ytdStart = points[0];
  const ytdHigh = points.reduce((high, point) => (point.value > high.value ? point : high));
  const ytdLow = points.reduce((low, point) => (point.value < low.value ? point : low));
  const fourWeekTarget = Date.parse(`${latest.date}T00:00:00Z`) - 28 * DAY_MS;
  const fourWeekReference = [...points]
    .reverse()
    .find((point) => Date.parse(`${point.date}T00:00:00Z`) <= fourWeekTarget);
  const fourWeekChange = fourWeekReference ? latest.value - fourWeekReference.value : null;
  const direction = fourWeekChange === null || Math.abs(fourWeekChange) <= DIRECTION_EPSILON
    ? "flat"
    : fourWeekChange > 0
      ? "tightening"
      : "loosening";

  return {
    latest,
    ytdStart,
    ytdHigh,
    ytdLow,
    ytdChange: latest.value - ytdStart.value,
    fourWeekChange,
    direction,
  };
}

function unavailable(options: {
  now: Date;
  year: number;
  errorCode: NonNullable<NfciYtdResponse["errorCode"]>;
  errorMessage: string;
}): Omit<NfciYtdResponse, "cache"> {
  return {
    generatedAt: options.now.toISOString(),
    year: options.year,
    seriesId: "NFCI",
    source: "Federal Reserve Bank of St. Louis (FRED)",
    sourceUrl: "https://fred.stlouisfed.org/series/NFCI",
    frequency: "weekly",
    points: [],
    statistics: null,
    observationDate: null,
    freshness: "unavailable",
    errorCode: options.errorCode,
    errorMessage: options.errorMessage,
  };
}

async function fetchNfciHistory(options: {
  year: number;
  fredApiKey?: string;
  fetcher: typeof fetch;
  now: Date;
}): Promise<Omit<NfciYtdResponse, "cache">> {
  if (!options.fredApiKey) {
    return unavailable({
      now: options.now,
      year: options.year,
      errorCode: "configuration-required",
      errorMessage: "Add FRED_API_KEY to load the Chicago Fed NFCI history.",
    });
  }

  try {
    const url = new URL("https://api.stlouisfed.org/fred/series/observations");
    url.searchParams.set("series_id", "NFCI");
    url.searchParams.set("api_key", options.fredApiKey);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("sort_order", "asc");
    url.searchParams.set("observation_start", `${options.year}-01-01`);
    url.searchParams.set("observation_end", `${options.year}-12-31`);
    url.searchParams.set("limit", "1000");
    const response = await options.fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await response.json()) as FredHistoryPayload;
    if (!response.ok) {
      throw new Error(payload.error_message || `FRED returned ${response.status}.`);
    }

    const points = normalizeNfciPoints(payload.observations ?? [], options.year);
    const statistics = calculateNfciStatistics(points);
    if (!statistics) {
      return unavailable({
        now: options.now,
        year: options.year,
        errorCode: "missing-observation",
        errorMessage: `FRED returned no numeric NFCI observations for ${options.year}.`,
      });
    }
    const observationTime = Date.parse(`${statistics.latest.date}T00:00:00Z`);
    const historicalYear = options.year < options.now.getUTCFullYear();

    return {
      generatedAt: options.now.toISOString(),
      year: options.year,
      seriesId: "NFCI",
      source: "Federal Reserve Bank of St. Louis (FRED)",
      sourceUrl: "https://fred.stlouisfed.org/series/NFCI",
      frequency: "weekly",
      points,
      statistics,
      observationDate: statistics.latest.date,
      freshness: historicalYear || options.now.getTime() - observationTime <= 10 * DAY_MS
        ? "fresh"
        : "stale",
    };
  } catch (error) {
    return unavailable({
      now: options.now,
      year: options.year,
      errorCode: "source-failed",
      errorMessage: error instanceof Error ? error.message : "FRED NFCI request failed.",
    });
  }
}

export async function loadNfciYtd(options: {
  year?: number;
  fredApiKey?: string;
  cache?: IndicatorDataCache;
  fetcher?: typeof fetch;
  now?: Date;
} = {}): Promise<NfciYtdResponse> {
  const now = options.now ?? new Date();
  const year = options.year ?? now.getUTCFullYear();
  const result = await loadCachedProvider({
    cache: options.cache,
    cacheKey: `financial-conditions:nfci:${year}:v1`,
    ttlSeconds: year < now.getUTCFullYear() ? 7 * 24 * 60 * 60 : 6 * 60 * 60,
    loader: () => fetchNfciHistory({
      year,
      fredApiKey: options.fredApiKey,
      fetcher: options.fetcher ?? fetch,
      now,
    }),
    shouldCache: (payload) => payload.points.length > 0,
  });

  return {
    ...result.value,
    cache: {
      backend: options.cache?.backend ?? "none",
      status: result.status,
    },
  };
}
