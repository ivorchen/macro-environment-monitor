import { createReading, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type FredResponse = {
  observations?: Array<{
    date: string;
    value: string;
  }>;
  error_message?: string;
};

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
        url.searchParams.set("limit", "12");

        const response = await fetcher(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
        });
        const payload = (await response.json()) as FredResponse;

        if (!response.ok) {
          throw new Error(payload.error_message || `FRED returned ${response.status}`);
        }

        const latest = payload.observations?.find((observation) => {
          const value = Number(observation.value);
          return observation.value !== "." && Number.isFinite(value);
        });

        if (!latest) {
          return unavailableReading(source, "missing-observation", "FRED returned no numeric observation.", now);
        }

        return createReading(source, Number(latest.value), latest.date, now);
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
