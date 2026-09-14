export const PRIME_BOOK_RANGES = ["3M", "6M", "1Y", "2Y", "5Y", "ALL"] as const;

export type PrimeBookRange = typeof PRIME_BOOK_RANGES[number];
export type PrimeBookFreshness = "fresh" | "stale" | "unavailable";

export type PrimeBookRawObservation = {
  date: string;
  provider: string;
  gross_leverage: number;
  net_leverage: number;
  long_short_ratio?: number;
  momentum_long_short_ratio?: number;
  source_url?: string;
  source_reference?: string;
  source_published_at: string;
  ingested_at: string;
  methodology: string;
  universe: string;
  expected_update_days?: number;
  source_kind?: "licensed-prime-book" | "public-form-pf";
  frequency?: "daily" | "weekly" | "monthly" | "quarterly";
};

export type PrimeBookPoint = PrimeBookRawObservation & {
  long_exposure: number;
  short_exposure: number;
  derived_long_short_ratio: number | null;
  display_long_short_ratio: number | null;
  ratio_difference: number | null;
  ratio_consistent: boolean | null;
};

export type PrimeBookMetricSummary = {
  value: number;
  change1W: number | null;
  change1M: number | null;
  change3M: number | null;
  change1Y: number | null;
  percentile: number;
};

export type PrimeBookProviderSummary = {
  provider: string;
  latestDate: string;
  observationCount: number;
};

export type PrimeBookResponse = {
  generatedAt: string;
  range: PrimeBookRange;
  provider: string | null;
  providers: PrimeBookProviderSummary[];
  points: PrimeBookPoint[];
  latest: PrimeBookPoint | null;
  metrics: {
    grossLeverage: PrimeBookMetricSummary | null;
    netLeverage: PrimeBookMetricSummary | null;
    longShortRatio: PrimeBookMetricSummary | null;
    momentumLongShortRatio: PrimeBookMetricSummary | null;
  };
  freshness: PrimeBookFreshness;
  errorCode?: "configuration-required" | "invalid-source-data" | "provider-not-found" | "source-failed";
  errorMessage?: string;
  dataQuality: {
    rejectedObservations: number;
    warnings: string[];
  };
  sourceMode: "licensed-prime-book" | "public-form-pf";
  licenseNote: string | null;
};

type PrimeBookPayload = {
  schemaVersion?: unknown;
  licenseNote?: unknown;
  observations?: unknown;
};

const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<Exclude<PrimeBookRange, "ALL">, number> = {
  "3M": 92,
  "6M": 183,
  "1Y": 366,
  "2Y": 731,
  "5Y": 1_827,
};
const RATIO_ABSOLUTE_TOLERANCE = 0.03;

function isDate(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function derivePrimeBookExposure(grossLeverage: number, netLeverage: number) {
  const longExposure = (grossLeverage + netLeverage) / 2;
  const shortExposure = (grossLeverage - netLeverage) / 2;
  return {
    longExposure,
    shortExposure,
    longShortRatio: shortExposure > 0 ? longExposure / shortExposure : null,
  };
}

export function reconcilePrimeBookObservation(observation: PrimeBookRawObservation): PrimeBookPoint {
  const derived = derivePrimeBookExposure(observation.gross_leverage, observation.net_leverage);
  const ratioDifference = observation.long_short_ratio !== undefined && derived.longShortRatio !== null
    ? observation.long_short_ratio - derived.longShortRatio
    : null;
  return {
    ...observation,
    long_exposure: derived.longExposure,
    short_exposure: derived.shortExposure,
    derived_long_short_ratio: derived.longShortRatio,
    display_long_short_ratio: observation.long_short_ratio ?? derived.longShortRatio,
    ratio_difference: ratioDifference,
    ratio_consistent: ratioDifference === null ? null : Math.abs(ratioDifference) <= RATIO_ABSOLUTE_TOLERANCE,
  };
}

function normalizeObservation(value: unknown): PrimeBookRawObservation | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    !isDate(row.date)
    || typeof row.provider !== "string" || !row.provider.trim()
    || !finite(row.gross_leverage) || row.gross_leverage <= 0
    || !finite(row.net_leverage) || Math.abs(row.net_leverage) > row.gross_leverage
    || (row.long_short_ratio !== undefined && (!finite(row.long_short_ratio) || row.long_short_ratio <= 0))
    || (row.momentum_long_short_ratio !== undefined && (!finite(row.momentum_long_short_ratio) || row.momentum_long_short_ratio <= 0))
    || !isTimestamp(row.source_published_at)
    || !isTimestamp(row.ingested_at)
    || typeof row.methodology !== "string" || !row.methodology.trim()
    || typeof row.universe !== "string" || !row.universe.trim()
    || (!row.source_url && !row.source_reference)
  ) return null;

  if (row.source_url !== undefined) {
    try {
      if (new URL(String(row.source_url)).protocol !== "https:") return null;
    } catch {
      return null;
    }
  }

  return {
    date: row.date,
    provider: row.provider.trim(),
    gross_leverage: row.gross_leverage,
    net_leverage: row.net_leverage,
    ...(finite(row.long_short_ratio) ? { long_short_ratio: row.long_short_ratio } : {}),
    ...(finite(row.momentum_long_short_ratio) ? { momentum_long_short_ratio: row.momentum_long_short_ratio } : {}),
    ...(typeof row.source_url === "string" ? { source_url: row.source_url } : {}),
    ...(typeof row.source_reference === "string" ? { source_reference: row.source_reference } : {}),
    source_published_at: row.source_published_at,
    ingested_at: row.ingested_at,
    methodology: row.methodology.trim(),
    universe: row.universe.trim(),
    ...(finite(row.expected_update_days) && row.expected_update_days > 0
      ? { expected_update_days: row.expected_update_days }
      : {}),
    source_kind: row.source_kind === "public-form-pf" ? "public-form-pf" : "licensed-prime-book",
    frequency: row.frequency === "daily" || row.frequency === "monthly" || row.frequency === "quarterly"
      ? row.frequency
      : "weekly",
  };
}

function referenceValue(points: readonly PrimeBookPoint[], metric: keyof PrimeBookPoint, days: number) {
  const latest = points.at(-1);
  if (!latest) return null;
  const target = Date.parse(`${latest.date}T00:00:00Z`) - days * DAY_MS;
  const reference = [...points].reverse().find((point) => Date.parse(`${point.date}T00:00:00Z`) <= target);
  const value = reference?.[metric];
  return typeof value === "number" ? value : null;
}

function summarizeMetric(points: readonly PrimeBookPoint[], metric: keyof PrimeBookPoint): PrimeBookMetricSummary | null {
  const eligible = points.filter((point) => typeof point[metric] === "number");
  const latest = eligible.at(-1);
  const latestValue = latest?.[metric];
  if (!latest || typeof latestValue !== "number") return null;
  const values = eligible.map((point) => point[metric]).filter((value): value is number => typeof value === "number");
  const percentile = values.filter((value) => value <= latestValue).length / values.length * 100;
  const change = (days: number) => {
    const reference = referenceValue(eligible, metric, days);
    return reference === null ? null : latestValue - reference;
  };
  return {
    value: latestValue,
    change1W: change(7),
    change1M: change(30),
    change3M: change(90),
    change1Y: change(365),
    percentile,
  };
}

function unavailable(options: {
  now: Date;
  range: PrimeBookRange;
  provider: string | null;
  providers?: PrimeBookProviderSummary[];
  errorCode: NonNullable<PrimeBookResponse["errorCode"]>;
  errorMessage: string;
  rejectedObservations?: number;
  licenseNote?: string | null;
}): PrimeBookResponse {
  return {
    generatedAt: options.now.toISOString(),
    range: options.range,
    provider: options.provider,
    providers: options.providers ?? [],
    points: [],
    latest: null,
    metrics: { grossLeverage: null, netLeverage: null, longShortRatio: null, momentumLongShortRatio: null },
    freshness: "unavailable",
    errorCode: options.errorCode,
    errorMessage: options.errorMessage,
    dataQuality: { rejectedObservations: options.rejectedObservations ?? 0, warnings: [] },
    sourceMode: "licensed-prime-book",
    licenseNote: options.licenseNote ?? null,
  };
}

export function buildPrimeBookResponse(options: {
  payload: unknown;
  range?: PrimeBookRange;
  provider?: string;
  now?: Date;
}): PrimeBookResponse {
  const now = options.now ?? new Date();
  const range = options.range ?? "3M";
  const payload = options.payload && typeof options.payload === "object" ? options.payload as PrimeBookPayload : {};
  const rawRows = Array.isArray(payload.observations) ? payload.observations : [];
  const rows = rawRows.map(normalizeObservation).filter((row): row is PrimeBookRawObservation => row !== null);
  const rejectedObservations = rawRows.length - rows.length;
  const licenseNote = typeof payload.licenseNote === "string" && payload.licenseNote.trim()
    ? payload.licenseNote.trim()
    : null;

  if (!rows.length) {
    return unavailable({
      now,
      range,
      provider: options.provider ?? null,
      errorCode: rawRows.length ? "invalid-source-data" : "configuration-required",
      errorMessage: rawRows.length
        ? "No valid provider observations passed the Prime Book ingestion contract."
        : "No licensed Prime Book observations are configured. Add reviewed provider data to the manual ingestion file.",
      rejectedObservations,
      licenseNote,
    });
  }

  const byProvider = new Map<string, PrimeBookRawObservation[]>();
  for (const row of rows) byProvider.set(row.provider, [...(byProvider.get(row.provider) ?? []), row]);
  const providers = [...byProvider].map(([provider, providerRows]) => ({
    provider,
    latestDate: providerRows.map((row) => row.date).sort().at(-1)!,
    observationCount: providerRows.length,
  })).sort((a, b) => b.latestDate.localeCompare(a.latestDate) || a.provider.localeCompare(b.provider));
  const selectedProvider = options.provider ?? providers[0].provider;
  const selectedRows = byProvider.get(selectedProvider);
  if (!selectedRows) {
    return unavailable({
      now,
      range,
      provider: selectedProvider,
      providers,
      errorCode: "provider-not-found",
      errorMessage: `No Prime Book series is configured for ${selectedProvider}.`,
      rejectedObservations,
      licenseNote,
    });
  }

  const completePoints = selectedRows.map(reconcilePrimeBookObservation).sort((a, b) => a.date.localeCompare(b.date));
  const latest = completePoints.at(-1)!;
  const cutoff = range === "ALL" ? Number.NEGATIVE_INFINITY : Date.parse(`${latest.date}T00:00:00Z`) - RANGE_DAYS[range] * DAY_MS;
  const points = completePoints.filter((point) => Date.parse(`${point.date}T00:00:00Z`) >= cutoff);
  const expectedUpdateDays = latest.expected_update_days ?? 7;
  const freshnessAge = now.getTime() - Date.parse(latest.source_published_at);
  const warnings = completePoints
    .filter((point) => point.ratio_consistent === false)
    .map((point) => `${point.provider} ${point.date}: reported L/S differs from the Gross/Net-derived value by more than ${RATIO_ABSOLUTE_TOLERANCE.toFixed(2)}.`);

  return {
    generatedAt: now.toISOString(),
    range,
    provider: selectedProvider,
    providers,
    points,
    latest,
    metrics: {
      grossLeverage: summarizeMetric(completePoints, "gross_leverage"),
      netLeverage: summarizeMetric(completePoints, "net_leverage"),
      longShortRatio: summarizeMetric(completePoints, "display_long_short_ratio"),
      momentumLongShortRatio: summarizeMetric(completePoints, "momentum_long_short_ratio"),
    },
    freshness: freshnessAge <= expectedUpdateDays * 2 * DAY_MS ? "fresh" : "stale",
    dataQuality: { rejectedObservations, warnings },
    sourceMode: latest.source_kind ?? "licensed-prime-book",
    licenseNote,
  };
}
