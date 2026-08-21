import { createReading, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type NasdaqHistoricalRow = {
  date?: string;
  close?: string;
};

type NasdaqHistoricalPayload = {
  data?: {
    tradesTable?: {
      rows?: NasdaqHistoricalRow[];
    };
  };
  status?: {
    rCode?: number;
    bCodeMessage?: Array<{ errorMessage?: string }>;
  };
};

export type NasdaqPrice = {
  date: string;
  close: number;
};

function isoDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

function priceRows(payload: NasdaqHistoricalPayload): NasdaqPrice[] {
  return (payload.data?.tradesTable?.rows ?? [])
    .map((row) => ({
      date: typeof row.date === "string" ? isoDate(row.date) : null,
      close:
        typeof row.close === "string"
          ? Number(row.close.replaceAll(/[$,]/g, ""))
          : Number.NaN,
    }))
    .filter(
      (row): row is NasdaqPrice =>
        typeof row.date === "string" && Number.isFinite(row.close),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

function responseError(payload: NasdaqHistoricalPayload, status: number) {
  return (
    payload.status?.bCodeMessage?.find((message) => message.errorMessage)?.errorMessage ??
    `Nasdaq returned ${status}.`
  );
}

export async function fetchNasdaqEtfHistory(
  symbol: string,
  options: AdapterOptions = {},
): Promise<NasdaqPrice[]> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 70);
  const url = new URL(
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical`,
  );
  url.searchParams.set("assetclass", "etf");
  url.searchParams.set("fromdate", from.toISOString().slice(0, 10));
  url.searchParams.set("limit", "60");

  const response = await fetcher(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "macro-environment-monitor/1.0 (local research)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  const payload = (await response.json()) as NasdaqHistoricalPayload;
  if (!response.ok || payload.status?.rCode !== 200) {
    throw new Error(responseError(payload, response.status));
  }
  return priceRows(payload);
}

function relativeReturn(first: NasdaqPrice[], second: NasdaqPrice[]) {
  const secondByDate = new Map(second.map((row) => [row.date, row.close]));
  const common = first
    .filter((row) => secondByDate.has(row.date))
    .map((row) => ({ date: row.date, first: row.close, second: secondByDate.get(row.date)! }));
  const latest = common[0];
  const base = common[20];
  if (!latest || !base || base.first === 0 || base.second === 0 || latest.second === 0) {
    return null;
  }
  return {
    date: latest.date,
    value: ((latest.first / base.first) / (latest.second / base.second) - 1) * 100,
  };
}

export async function fetchNasdaqReadings(
  sources: readonly IndicatorSourceDefinition[],
  options: AdapterOptions = {},
): Promise<IndicatorReading[]> {
  const now = options.now ?? new Date();
  const series = new Map<string, Promise<NasdaqPrice[]>>();
  const loadSymbol = (symbol: string) => {
    const existing = series.get(symbol);
    if (existing) return existing;
    const request = fetchNasdaqEtfHistory(symbol, options);
    series.set(symbol, request);
    return request;
  };

  return Promise.all(
    sources.map(async (source) => {
      const pair = source.seriesId?.split("/");
      if (!pair || pair.length !== 2) {
        return unavailableReading(
          source,
          "missing-observation",
          "No Nasdaq ETF pair is configured for this indicator.",
          now,
        );
      }
      try {
        const [first, second] = await Promise.all([
          loadSymbol(pair[0]),
          loadSymbol(pair[1]),
        ]);
        const result = relativeReturn(first, second);
        return result
          ? createReading(source, result.value, result.date, now)
          : unavailableReading(
              source,
              "missing-observation",
              "Nasdaq returned fewer than 21 common trading sessions for this pair.",
              now,
            );
      } catch (error) {
        return unavailableReading(
          source,
          "source-failed",
          error instanceof Error ? error.message : "Nasdaq market-data request failed.",
          now,
        );
      }
    }),
  );
}
