import type { PrimeBookRawObservation } from "../prime-book";

export const OFR_FORM_PF_PROVIDER = "OFR / SEC Form PF public aggregate";
export const OFR_FORM_PF_SOURCE_URL = "https://www.financialresearch.gov/hedge-fund-monitor/datasets/fpf/";

const SERIES = {
  nav: "FPF-ALLQHF_NAV_SUM",
  longEquity: "FPF-ASSETCLASS_EQUITIES_LGNE_SUM",
  shortEquity: "FPF-ASSETCLASS_EQUITIES_SGNE_SUM",
} as const;

type OfrSeries = {
  metadata?: {
    mnemonic?: unknown;
    schedule?: { last_update?: unknown };
  };
  timeseries?: { aggregation?: unknown };
};

type OfrPayload = OfrSeries[];

function normalizeSeriesPoints(value: unknown) {
  const points = new Map<string, number>();
  if (!Array.isArray(value)) return points;
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const [date, rawValue] = item;
    const numberValue = Number(rawValue);
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(numberValue) || numberValue <= 0) continue;
    points.set(date, numberValue);
  }
  return points;
}

function normalizeLastUpdate(value: unknown, fallback: Date) {
  if (typeof value !== "string") return fallback.toISOString();
  const timestamp = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return Number.isNaN(Date.parse(timestamp)) ? fallback.toISOString() : new Date(timestamp).toISOString();
}

export function normalizeOfrFormPfPayload(payload: unknown, now = new Date()): PrimeBookRawObservation[] {
  if (!payload || typeof payload !== "object") return [];
  const seriesList: OfrPayload = Array.isArray(payload)
    ? payload
    : Object.entries(payload as Record<string, OfrSeries>).map(([mnemonic, series]) => ({
      ...series,
      metadata: { ...series.metadata, mnemonic: series.metadata?.mnemonic ?? mnemonic },
    }));
  const byMnemonic = new Map<string, OfrSeries>();
  for (const series of seriesList) {
    const mnemonic = series.metadata?.mnemonic;
    if (typeof mnemonic === "string") byMnemonic.set(mnemonic, series);
  }

  const navSeries = byMnemonic.get(SERIES.nav);
  const longSeries = byMnemonic.get(SERIES.longEquity);
  const shortSeries = byMnemonic.get(SERIES.shortEquity);
  if (!navSeries || !longSeries || !shortSeries) return [];

  const nav = normalizeSeriesPoints(navSeries.timeseries?.aggregation);
  const long = normalizeSeriesPoints(longSeries.timeseries?.aggregation);
  const short = normalizeSeriesPoints(shortSeries.timeseries?.aggregation);
  const sourcePublishedAt = normalizeLastUpdate(
    navSeries.metadata?.schedule?.last_update
      ?? longSeries.metadata?.schedule?.last_update
      ?? shortSeries.metadata?.schedule?.last_update,
    now,
  );

  return [...nav.entries()].flatMap(([date, netAssets]) => {
    const longExposure = long.get(date);
    const shortExposure = short.get(date);
    if (longExposure === undefined || shortExposure === undefined || shortExposure <= 0) return [];
    return [{
      date,
      provider: OFR_FORM_PF_PROVIDER,
      gross_leverage: (longExposure + shortExposure) / netAssets,
      net_leverage: (longExposure - shortExposure) / netAssets,
      long_short_ratio: longExposure / shortExposure,
      source_url: OFR_FORM_PF_SOURCE_URL,
      source_published_at: sourcePublishedAt,
      ingested_at: now.toISOString(),
      methodology: "Aggregate long and short equity notional exposure divided by aggregate net assets; derived from SEC Form PF questions 9, 26, and 30.",
      universe: "Qualifying Hedge Funds filing Form PF; aggregated, rounded, and masked by OFR. Includes U.S. and foreign-listed equities and equity-index derivatives.",
      expected_update_days: 95,
      source_kind: "public-form-pf" as const,
      frequency: "quarterly" as const,
    }];
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchOfrFormPfObservations(options: {
  fetcher?: typeof fetch;
  now?: Date;
} = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  // OFR's endpoint expects literal comma separators and does not accept URLSearchParams' %2C encoding.
  const url = `https://data.financialresearch.gov/hf/v1/series/multifull?mnemonics=${Object.values(SERIES).join(",")}`;
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`OFR Hedge Fund Monitor returned ${response.status}.`);
  const observations = normalizeOfrFormPfPayload(await response.json(), now);
  if (!observations.length) throw new Error("OFR returned no complete Form PF equity-positioning observations.");
  return observations;
}
