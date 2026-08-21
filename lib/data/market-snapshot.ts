import {
  loadCachedProvider,
  type CacheResultStatus,
  type IndicatorDataCache,
  type RequestGate,
} from "./cache";
import { fetchNasdaqEtfHistory } from "./adapters/nasdaq";

export type MarketSnapshotItem = {
  id:
    | "spx"
    | "ndx"
    | "rsp"
    | "real-yield"
    | "hy-oas"
    | "vix"
    | "gold"
    | "jnk"
    | "btc";
  symbol: string;
  name: string;
  displayValue: string;
  displayMove: string;
  value: number | null;
  observationAt: string | null;
  provider: string;
  sourceUrl: string;
  status: "fresh" | "stale" | "unavailable";
  tone: "positive" | "negative" | "neutral";
  errorMessage?: string;
};

export type MarketSnapshotResponse = {
  generatedAt: string;
  markets: MarketSnapshotItem[];
  cache: {
    backend: "redis" | "none";
    status: CacheResultStatus;
  };
};

type NumericPoint = {
  value: number;
  previous: number;
  observationAt: string;
};

type PointResult = {
  point: NumericPoint | null;
  error?: string;
};

type FmpQuote = {
  price?: number;
  previousClose?: number;
  timestamp?: number;
};

type FredPayload = {
  observations?: Array<{ date: string; value: string }>;
  error_message?: string;
};

const FRED_SERIES = {
  spx: "SP500",
  ndx: "NASDAQ100",
  realYield: "DFII10",
  highYield: "BAMLH0A0HYM2",
  vix: "VIXCLS",
} as const;

function numeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function fetchFmpQuote(
  symbol: string,
  apiKey: string | undefined,
  requestGate: RequestGate | undefined,
  fetcher: typeof fetch,
): Promise<PointResult> {
  if (!apiKey) return { point: null, error: "FMP_API_KEY is not configured." };
  if (!requestGate) {
    return { point: null, error: "Redis quota protection is required for FMP requests." };
  }

  const budget = await requestGate();
  if (!budget.allowed) {
    return { point: null, error: `FMP daily request budget reached (${budget.limit}).` };
  }

  try {
    const url = new URL("https://financialmodelingprep.com/stable/quote");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", apiKey);
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    const body = await response.text();
    if (!response.ok) {
      const message = body.replaceAll(/\s+/g, " ").trim().slice(0, 180);
      return { point: null, error: message || `FMP returned ${response.status}.` };
    }
    const [quote] = JSON.parse(body) as FmpQuote[];
    if (!numeric(quote?.price) || !numeric(quote.previousClose)) {
      return { point: null, error: `FMP returned no quote for ${symbol}.` };
    }
    return {
      point: {
        value: quote.price,
        previous: quote.previousClose,
        observationAt: quote.timestamp
          ? new Date(quote.timestamp * 1_000).toISOString()
          : new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      point: null,
      error: error instanceof Error ? error.message : "FMP quote request failed.",
    };
  }
}

async function fetchFredPoint(
  seriesId: string,
  apiKey: string | undefined,
  fetcher: typeof fetch,
): Promise<PointResult> {
  if (!apiKey) return { point: null, error: "FRED_API_KEY is not configured." };

  try {
    const url = new URL("https://api.stlouisfed.org/fred/series/observations");
    url.searchParams.set("series_id", seriesId);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("sort_order", "desc");
    url.searchParams.set("limit", "8");
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await response.json()) as FredPayload;
    if (!response.ok) {
      return { point: null, error: payload.error_message || `FRED returned ${response.status}.` };
    }
    const observations = (payload.observations ?? [])
      .map((observation) => ({ ...observation, numericValue: Number(observation.value) }))
      .filter((observation) => Number.isFinite(observation.numericValue));
    const latest = observations[0];
    const previous = observations[1];
    if (!latest || !previous) {
      return { point: null, error: `FRED returned insufficient observations for ${seriesId}.` };
    }
    return {
      point: {
        value: latest.numericValue,
        previous: previous.numericValue,
        observationAt: latest.date,
      },
    };
  } catch (error) {
    return {
      point: null,
      error: error instanceof Error ? error.message : "FRED request failed.",
    };
  }
}

async function fetchNasdaqPoint(
  symbol: string,
  fetcher: typeof fetch,
  now: Date,
): Promise<PointResult> {
  try {
    const rows = await fetchNasdaqEtfHistory(symbol, { fetcher, now });
    const latest = rows[0];
    const previous = rows[1];
    if (!latest || !previous) {
      return { point: null, error: `Nasdaq returned insufficient observations for ${symbol}.` };
    }
    return {
      point: {
        value: latest.close,
        previous: previous.close,
        observationAt: latest.date,
      },
    };
  } catch (error) {
    return {
      point: null,
      error: error instanceof Error ? error.message : "Nasdaq market-data request failed.",
    };
  }
}

function isStale(observationAt: string, now: Date) {
  const observation = new Date(
    observationAt.length === 10 ? `${observationAt}T00:00:00Z` : observationAt,
  );
  return now.getTime() - observation.getTime() > 4 * 24 * 60 * 60 * 1_000;
}

function moveTone(change: number, downIsGood = false): MarketSnapshotItem["tone"] {
  if (Math.abs(change) < 0.0001) return "neutral";
  const favorable = downIsGood ? change < 0 : change > 0;
  return favorable ? "positive" : "negative";
}

function marketItem(options: {
  id: MarketSnapshotItem["id"];
  symbol: string;
  name: string;
  result: PointResult;
  provider: string;
  sourceUrl: string;
  now: Date;
  format: "index" | "percent" | "currency";
  move: "percent" | "basis-points";
  downIsGood?: boolean;
}): MarketSnapshotItem {
  const point = options.result.point;
  if (!point) {
    return {
      id: options.id,
      symbol: options.symbol,
      name: options.name,
      displayValue: "Unavailable",
      displayMove: "—",
      value: null,
      observationAt: null,
      provider: options.provider,
      sourceUrl: options.sourceUrl,
      status: "unavailable",
      tone: "neutral",
      errorMessage: options.result.error,
    };
  }

  const change =
    options.move === "basis-points"
      ? (point.value - point.previous) * 100
      : ((point.value / point.previous) - 1) * 100;
  const valueDigits =
    options.format === "percent" ? 2 : point.value >= 1_000 ? 0 : 2;
  const displayValue = `${options.format === "currency" ? "$" : ""}${point.value.toLocaleString("en-US", {
    minimumFractionDigits: options.format === "percent" ? 2 : 0,
    maximumFractionDigits: valueDigits,
  })}${options.format === "percent" ? "%" : ""}`;
  const displayMove =
    options.move === "basis-points"
      ? `${change >= 0 ? "+" : "−"}${Math.abs(Math.round(change))} bp`
      : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`;

  return {
    id: options.id,
    symbol: options.symbol,
    name: options.name,
    displayValue,
    displayMove,
    value: point.value,
    observationAt: point.observationAt,
    provider: options.provider,
    sourceUrl: options.sourceUrl,
    status: isStale(point.observationAt, options.now) ? "stale" : "fresh",
    tone: moveTone(change, options.downIsGood),
  };
}

export function marketSnapshotCacheTtlSeconds(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const weekday = parts.weekday;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const marketWindow =
    weekday !== "Sat" && weekday !== "Sun" && minutes >= 9 * 60 + 30 && minutes <= 17 * 60;
  return marketWindow ? 55 * 60 : 6 * 60 * 60;
}

export async function loadMarketSnapshot(options: {
  fmpApiKey?: string;
  fredApiKey?: string;
  requestGate?: RequestGate;
  cache?: IndicatorDataCache;
  fetcher?: typeof fetch;
  now?: Date;
}): Promise<MarketSnapshotResponse> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;
  const result = await loadCachedProvider({
    cache: options.cache,
    cacheKey: "market-snapshot:v3",
    ttlSeconds: marketSnapshotCacheTtlSeconds(now),
    loader: async () => {
      const [
        fmpSpx,
        fmpVix,
        fmpGold,
        fmpBtc,
        nasdaqRsp,
        nasdaqJnk,
        fredSpx,
        fredNdx,
        fredRealYield,
        fredHighYield,
        fredVix,
      ] =
        await Promise.all([
          fetchFmpQuote("^GSPC", options.fmpApiKey, options.requestGate, fetcher),
          fetchFmpQuote("^VIX", options.fmpApiKey, options.requestGate, fetcher),
          fetchFmpQuote("GCUSD", options.fmpApiKey, options.requestGate, fetcher),
          fetchFmpQuote("BTCUSD", options.fmpApiKey, options.requestGate, fetcher),
          fetchNasdaqPoint("RSP", fetcher, now),
          fetchNasdaqPoint("JNK", fetcher, now),
          fetchFredPoint(FRED_SERIES.spx, options.fredApiKey, fetcher),
          fetchFredPoint(FRED_SERIES.ndx, options.fredApiKey, fetcher),
          fetchFredPoint(FRED_SERIES.realYield, options.fredApiKey, fetcher),
          fetchFredPoint(FRED_SERIES.highYield, options.fredApiKey, fetcher),
          fetchFredPoint(FRED_SERIES.vix, options.fredApiKey, fetcher),
        ]);
      const spx = fmpSpx.point ? fmpSpx : fredSpx;
      const vix = fmpVix.point ? fmpVix : fredVix;

      return {
        generatedAt: now.toISOString(),
        markets: [
          marketItem({ id: "spx", symbol: "SPX", name: "S&P 500", result: spx, provider: fmpSpx.point ? "FMP" : "FRED", sourceUrl: fmpSpx.point ? "https://financialmodelingprep.com/" : "https://fred.stlouisfed.org/series/SP500", now, format: "index", move: "percent" }),
          marketItem({ id: "ndx", symbol: "NDX", name: "Nasdaq 100", result: fredNdx, provider: "FRED", sourceUrl: "https://fred.stlouisfed.org/series/NASDAQ100", now, format: "index", move: "percent" }),
          marketItem({ id: "rsp", symbol: "RSP", name: "Equal weight", result: nasdaqRsp, provider: "Nasdaq", sourceUrl: "https://www.nasdaq.com/market-activity/etf/rsp/historical", now, format: "index", move: "percent" }),
          marketItem({ id: "real-yield", symbol: "DFII10", name: "10Y real yield", result: fredRealYield, provider: "FRED", sourceUrl: "https://fred.stlouisfed.org/series/DFII10", now, format: "percent", move: "basis-points", downIsGood: true }),
          marketItem({ id: "hy-oas", symbol: "HY OAS", name: "High yield", result: fredHighYield, provider: "FRED", sourceUrl: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2", now, format: "percent", move: "basis-points", downIsGood: true }),
          marketItem({ id: "vix", symbol: "VIX", name: "Volatility", result: vix, provider: fmpVix.point ? "FMP" : "FRED", sourceUrl: fmpVix.point ? "https://financialmodelingprep.com/" : "https://fred.stlouisfed.org/series/VIXCLS", now, format: "index", move: "percent", downIsGood: true }),
          marketItem({ id: "gold", symbol: "GCUSD", name: "Gold", result: fmpGold, provider: "FMP", sourceUrl: "https://site.financialmodelingprep.com/developer/docs/stable/commodities-quote", now, format: "currency", move: "percent" }),
          marketItem({ id: "jnk", symbol: "JNK", name: "High-yield ETF", result: nasdaqJnk, provider: "Nasdaq", sourceUrl: "https://www.nasdaq.com/market-activity/etf/jnk/historical", now, format: "currency", move: "percent" }),
          marketItem({ id: "btc", symbol: "BTC", name: "Bitcoin", result: fmpBtc, provider: "FMP", sourceUrl: "https://site.financialmodelingprep.com/developer/docs/stable/cryptocurrency-quote", now, format: "currency", move: "percent" }),
        ],
      };
    },
    shouldCache: (snapshot) => snapshot.markets.some((market) => market.value !== null),
  });

  return {
    ...result.value,
    cache: {
      backend: options.cache?.backend ?? "none",
      status: result.status,
    },
  };
}
