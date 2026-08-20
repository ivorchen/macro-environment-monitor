import { createReading, unavailableReading } from "../freshness";
import type { RequestGate } from "../cache";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type FmpPrice = {
  date?: string;
  close?: number;
};

type FmpResponse = FmpPrice[] | { historical?: FmpPrice[]; "Error Message"?: string };

const PAIRS: Readonly<Record<string, readonly [string, string]>> = {
  "credit-regional-banks": ["KRE", "SPY"],
  "breadth-equal-weight": ["RSP", "SPY"],
  "breadth-small-large": ["IWM", "SPY"],
  "breadth-cyclicals-defensives": ["XLI", "XLP"],
};

function priceRows(payload: FmpResponse) {
  const rows = Array.isArray(payload) ? payload : payload.historical ?? [];
  return rows
    .filter(
      (row): row is Required<Pick<FmpPrice, "date" | "close">> =>
        typeof row.date === "string" &&
        typeof row.close === "number" &&
        Number.isFinite(row.close),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

function relativeReturn(
  first: Required<Pick<FmpPrice, "date" | "close">>[],
  second: Required<Pick<FmpPrice, "date" | "close">>[],
) {
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

export async function fetchFmpReadings(
  sources: readonly IndicatorSourceDefinition[],
  apiKey: string | undefined,
  options: AdapterOptions & { requestGate?: RequestGate } = {},
): Promise<IndicatorReading[]> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;

  if (!apiKey) {
    return sources.map((source) =>
      unavailableReading(
        source,
        "configuration-required",
        "Add FMP_API_KEY to enable licensed market data.",
        now,
      ),
    );
  }

  const series = new Map<string, Promise<ReturnType<typeof priceRows>>>();
  const loadSymbol = (symbol: string) => {
    const existing = series.get(symbol);
    if (existing) return existing;
    const request = (async () => {
      const budget = await options.requestGate?.();
      if (budget && !budget.allowed) {
        throw new Error(`FMP daily request budget reached (${budget.limit}).`);
      }
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 70);
      const url = new URL("https://financialmodelingprep.com/stable/historical-price-eod/full");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("from", from.toISOString().slice(0, 10));
      url.searchParams.set("to", now.toISOString().slice(0, 10));
      url.searchParams.set("apikey", apiKey);
      const response = await fetcher(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      const payload = (await response.json()) as FmpResponse;
      if (!response.ok) throw new Error(`FMP returned ${response.status}`);
      if (!Array.isArray(payload) && payload["Error Message"]) {
        throw new Error(payload["Error Message"]);
      }
      return priceRows(payload);
    })();
    series.set(symbol, request);
    return request;
  };

  return Promise.all(
    sources.map(async (source) => {
      const pair = PAIRS[source.id];
      if (!pair) {
        return unavailableReading(
          source,
          "missing-observation",
          "No FMP market proxy is configured for this indicator.",
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
              "FMP returned fewer than 21 common trading sessions for this pair.",
              now,
            );
      } catch (error) {
        return unavailableReading(
          source,
          "source-failed",
          error instanceof Error ? error.message : "FMP request failed.",
          now,
        );
      }
    }),
  );
}
