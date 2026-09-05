import { loadCachedProvider, type CacheResultStatus, type IndicatorDataCache } from "./cache";

export type EconomicCalendarImportance = "high" | "medium";

export type EconomicCalendarCategory =
  | "employment-situation"
  | "consumer-price-index"
  | "producer-price-index"
  | "personal-income-outlays"
  | "gross-domestic-product"
  | "retail-sales"
  | "initial-jobless-claims"
  | "job-openings"
  | "industrial-production"
  | "housing-starts"
  | "new-home-sales"
  | "existing-home-sales";

export type EconomicCalendarEvent = {
  id: string;
  category: EconomicCalendarCategory;
  name: string;
  date: string;
  importance: EconomicCalendarImportance;
  sourceUrl: string;
};

export type EconomicCalendarResponse = {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  status: "ready" | "unavailable";
  events: EconomicCalendarEvent[];
  source: "FRED";
  sourceUrl: string;
  cache: { backend: "redis" | "none"; status: CacheResultStatus };
  errorMessage?: string;
};

type FredReleaseDate = {
  release_id?: number;
  release_name?: string;
  date?: string;
};

type FredReleaseDatesResponse = {
  release_dates?: FredReleaseDate[];
  error_message?: string;
};

type ReleaseRule = {
  category: EconomicCalendarCategory;
  names: readonly string[];
  importance: EconomicCalendarImportance;
};

const SOURCE_URL = "https://fred.stlouisfed.org/releases/calendar";
const WINDOW_DAYS = 21;
const MAX_EVENTS = 6;
const CACHE_TTL_SECONDS = 6 * 60 * 60;

const RELEASE_RULES: readonly ReleaseRule[] = [
  { category: "employment-situation", names: ["Employment Situation"], importance: "high" },
  { category: "consumer-price-index", names: ["Consumer Price Index"], importance: "high" },
  { category: "producer-price-index", names: ["Producer Price Index"], importance: "high" },
  { category: "personal-income-outlays", names: ["Personal Income and Outlays"], importance: "high" },
  { category: "gross-domestic-product", names: ["Gross Domestic Product"], importance: "high" },
  { category: "retail-sales", names: ["Advance Monthly Sales for Retail and Food Services"], importance: "high" },
  { category: "initial-jobless-claims", names: ["Unemployment Insurance Weekly Claims Report"], importance: "medium" },
  { category: "job-openings", names: ["Job Openings and Labor Turnover Survey"], importance: "high" },
  { category: "industrial-production", names: ["G.17 Industrial Production and Capacity Utilization"], importance: "medium" },
  { category: "housing-starts", names: ["New Residential Construction"], importance: "medium" },
  { category: "new-home-sales", names: ["New Residential Sales"], importance: "medium" },
  { category: "existing-home-sales", names: ["Existing Home Sales"], importance: "medium" },
];

const ruleByName = new Map(
  RELEASE_RULES.flatMap((rule) => rule.names.map((name) => [name, rule] as const)),
);

function newYorkDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function selectEconomicCalendarEvents(
  rows: readonly FredReleaseDate[],
  windowStart: string,
  windowEnd: string,
  limit = MAX_EVENTS,
) {
  const seen = new Set<string>();
  const events: EconomicCalendarEvent[] = [];

  for (const row of rows) {
    if (!row.release_name || !row.date || row.date < windowStart || row.date > windowEnd) continue;
    const rule = ruleByName.get(row.release_name);
    if (!rule) continue;
    const dedupeKey = `${rule.category}:${row.date}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    events.push({
      id: `${dedupeKey}:${row.release_id ?? "fred"}`,
      category: rule.category,
      name: row.release_name,
      date: row.date,
      importance: rule.importance,
      sourceUrl: row.release_id
        ? `https://fred.stlouisfed.org/release?rid=${row.release_id}`
        : SOURCE_URL,
    });
  }

  return events
    .sort((left, right) => left.date.localeCompare(right.date)
      || (left.importance === right.importance ? 0 : left.importance === "high" ? -1 : 1)
      || left.name.localeCompare(right.name))
    .slice(0, limit);
}

export async function loadEconomicCalendar(options: {
  apiKey?: string;
  cache?: IndicatorDataCache;
  fetcher?: typeof fetch;
  now?: Date;
} = {}): Promise<EconomicCalendarResponse> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;
  const apiKey = options.apiKey ?? process.env.FRED_API_KEY;
  const windowStart = newYorkDate(now);
  const windowEnd = addDays(windowStart, WINDOW_DAYS);
  const base = {
    generatedAt: now.toISOString(),
    windowStart,
    windowEnd,
    source: "FRED" as const,
    sourceUrl: SOURCE_URL,
  };

  if (!apiKey) {
    return {
      ...base,
      status: "unavailable",
      events: [],
      cache: { backend: options.cache?.backend ?? "none", status: "bypass" },
      errorMessage: "Add FRED_API_KEY to enable the live release calendar.",
    };
  }

  const result = await loadCachedProvider({
    cache: options.cache,
    cacheKey: `economic-calendar:v1:${windowStart}`,
    ttlSeconds: CACHE_TTL_SECONDS,
    loader: async () => {
      try {
        const url = new URL("https://api.stlouisfed.org/fred/releases/dates");
        url.searchParams.set("api_key", apiKey);
        url.searchParams.set("file_type", "json");
        url.searchParams.set("include_release_dates_with_no_data", "true");
        url.searchParams.set("realtime_start", windowStart);
        url.searchParams.set("realtime_end", windowEnd);
        url.searchParams.set("sort_order", "asc");
        url.searchParams.set("limit", "1000");

        const response = await fetcher(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
        });
        const payload = await response.json() as FredReleaseDatesResponse;
        if (!response.ok) throw new Error(payload.error_message || `FRED returned ${response.status}`);

        return {
          ...base,
          status: "ready" as const,
          events: selectEconomicCalendarEvents(payload.release_dates ?? [], windowStart, windowEnd),
        };
      } catch (error) {
        return {
          ...base,
          status: "unavailable" as const,
          events: [],
          errorMessage: error instanceof Error ? error.message : "FRED release calendar request failed.",
        };
      }
    },
    shouldCache: (value) => value.status === "ready",
  });

  return {
    ...result.value,
    cache: { backend: options.cache?.backend ?? "none", status: result.status },
  };
}
