import type { IndicatorReading, IndicatorSourceDefinition, ReadingFreshness } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function freshnessForDate(
  observationDate: string,
  staleAfterDays: number,
  now = new Date(),
): ReadingFreshness {
  const observedAt = new Date(`${observationDate}T00:00:00Z`);
  if (Number.isNaN(observedAt.getTime())) return "unavailable";
  const currentDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ageDays = Math.max(0, (currentDay - observedAt.getTime()) / DAY_MS);
  return ageDays > staleAfterDays ? "stale" : "fresh";
}

export function formatReadingValue(value: number, format: IndicatorSourceDefinition["format"]) {
  switch (format) {
    case "percent":
      return `${value.toFixed(2)}%`;
    case "index":
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    case "usd-billions":
      return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}B`;
    case "usd-millions-to-billions":
      return `$${(value / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}B`;
    case "usd-millions-to-trillions":
      return `$${(value / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}T`;
    case "signed-thousands":
      return `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}K`;
    case "thousands-to-millions":
      return `${(value / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
    default:
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
}

export function createReading(
  source: IndicatorSourceDefinition,
  value: number,
  observationDate: string,
  now = new Date(),
): IndicatorReading {
  return {
    id: source.id,
    pillarId: source.pillarId,
    indicator: source.indicator,
    provider: source.provider,
    providerShort: source.providerShort,
    value,
    displayValue: formatReadingValue(value, source.format),
    unit: source.unit,
    transformation: source.transformation,
    observationDate,
    fetchedAt: now.toISOString(),
    freshness: freshnessForDate(observationDate, source.staleAfterDays, now),
    sourceUrl: source.sourceUrl,
    seriesId: source.seriesId,
  };
}

export function unavailableReading(
  source: IndicatorSourceDefinition,
  errorCode: NonNullable<IndicatorReading["errorCode"]>,
  errorMessage: string,
  now = new Date(),
): IndicatorReading {
  return {
    id: source.id,
    pillarId: source.pillarId,
    indicator: source.indicator,
    provider: source.provider,
    providerShort: source.providerShort,
    value: null,
    displayValue: "Unavailable",
    unit: source.unit,
    transformation: source.transformation,
    observationDate: null,
    fetchedAt: now.toISOString(),
    freshness: "unavailable",
    sourceUrl: source.sourceUrl,
    seriesId: source.seriesId,
    errorCode,
    errorMessage,
  };
}
