import { createReading, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type FredResponse = {
  observations?: FredObservation[];
  error_message?: string;
};

type FredObservation = {
  date: string;
  value: string;
};

function numericObservations(observations: FredObservation[] | undefined) {
  return (observations ?? []).filter((observation) => {
    const value = Number(observation.value);
    return observation.value !== "." && Number.isFinite(value);
  });
}

function transformedValue(
  source: IndicatorSourceDefinition,
  observations: FredObservation[],
) {
  const latest = observations[0];
  if (!latest) return null;

  if (source.calculation === "period-change") {
    const previous = observations[1];
    return previous ? Number(latest.value) - Number(previous.value) : null;
  }

  if (source.calculation === "year-over-year-percent") {
    const latestDate = new Date(`${latest.date}T00:00:00Z`);
    const previousYear = observations.find((observation) => {
      const observationDate = new Date(`${observation.date}T00:00:00Z`);
      return (
        observationDate.getUTCFullYear() === latestDate.getUTCFullYear() - 1 &&
        observationDate.getUTCMonth() === latestDate.getUTCMonth()
      );
    });
    if (!previousYear || Number(previousYear.value) === 0) return null;
    return (Number(latest.value) / Number(previousYear.value) - 1) * 100;
  }

  return Number(latest.value);
}

export async function fetchFredReadings(
  sources: readonly IndicatorSourceDefinition[],
  apiKey: string | undefined,
  options: AdapterOptions = {},
): Promise<IndicatorReading[]> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;

  if (!apiKey) {
    return sources.map((source) =>
      unavailableReading(
        source,
        "configuration-required",
        "Add FRED_API_KEY to enable this source.",
        now,
      ),
    );
  }

  return Promise.all(
    sources.map(async (source) => {
      try {
        const url = new URL("https://api.stlouisfed.org/fred/series/observations");
        url.searchParams.set("series_id", source.seriesId ?? "");
        url.searchParams.set("api_key", apiKey);
        url.searchParams.set("file_type", "json");
        url.searchParams.set("sort_order", "desc");
        url.searchParams.set(
          "limit",
          source.calculation === "year-over-year-percent" ? "14" : "12",
        );

        const response = await fetcher(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
        });
        const payload = (await response.json()) as FredResponse;

        if (!response.ok) {
          throw new Error(payload.error_message || `FRED returned ${response.status}`);
        }

        const observations = numericObservations(payload.observations);
        const latest = observations[0];
        const value = transformedValue(source, observations);

        if (!latest || value === null) {
          return unavailableReading(source, "missing-observation", "FRED returned insufficient numeric observations for this calculation.", now);
        }

        return createReading(source, value, latest.date, now);
      } catch (error) {
        return unavailableReading(
          source,
          "source-failed",
          error instanceof Error ? error.message : "FRED request failed.",
          now,
        );
      }
    }),
  );
}
