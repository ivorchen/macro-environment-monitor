import { fredFallbackForBlsSource } from "../source-registry";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";
import { fetchBlsReadings } from "./bls";
import { fetchFredReadings } from "./fred";

type BlsFallbackOptions = AdapterOptions & {
  blsApiKey?: string;
  fredApiKey?: string;
};

export async function fetchBlsReadingsWithFredFallback(
  sources: readonly IndicatorSourceDefinition[],
  options: BlsFallbackOptions = {},
): Promise<IndicatorReading[]> {
  const directReadings = await fetchBlsReadings(sources, {
    fetcher: options.fetcher,
    now: options.now,
    registrationKey: options.blsApiKey,
  });
  const unavailableIds = new Set(
    directReadings
      .filter((reading) => reading.freshness === "unavailable")
      .map((reading) => reading.id),
  );

  if (!options.fredApiKey || unavailableIds.size === 0) return directReadings;

  const fallbackSources = sources
    .filter((source) => unavailableIds.has(source.id))
    .map(fredFallbackForBlsSource)
    .filter((source): source is IndicatorSourceDefinition => source !== null);

  if (fallbackSources.length === 0) return directReadings;

  const fallbackReadings = await fetchFredReadings(fallbackSources, options.fredApiKey, {
    fetcher: options.fetcher,
    now: options.now,
  });
  const successfulFallbacks = new Map(
    fallbackReadings
      .filter((reading) => reading.freshness !== "unavailable")
      .map((reading) => [reading.id, reading]),
  );

  return directReadings.map((reading) => successfulFallbacks.get(reading.id) ?? reading);
}
