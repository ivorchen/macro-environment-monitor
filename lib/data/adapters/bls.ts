import { createReading, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type BlsDatum = {
  year: string;
  period: string;
  value: string;
};

type BlsResponse = {
  status?: string;
  message?: string[];
  Results?: {
    series?: Array<{
      seriesID: string;
      data: BlsDatum[];
    }>;
  };
};

function observationDate(datum: BlsDatum) {
  const month = Number(datum.period.slice(1));
  const periodEnd = new Date(Date.UTC(Number(datum.year), month, 0));
  return periodEnd.toISOString().slice(0, 10);
}

export async function fetchBlsReadings(
  sources: readonly IndicatorSourceDefinition[],
  options: AdapterOptions = {},
): Promise<IndicatorReading[]> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;

  try {
    const response = await fetcher("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        seriesid: sources.map((source) => source.seriesId),
        startyear: String(now.getUTCFullYear() - 1),
        endyear: String(now.getUTCFullYear()),
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) throw new Error(`BLS returned ${response.status}`);
    const payload = (await response.json()) as BlsResponse;
    if (payload.status !== "REQUEST_SUCCEEDED") {
      throw new Error(payload.message?.join(" ") || "BLS request was not successful.");
    }

    return sources.map((source) => {
      const series = payload.Results?.series?.find((item) => item.seriesID === source.seriesId);
      const latest = series?.data
        .filter((datum) => /^M\d{2}$/.test(datum.period) && Number.isFinite(Number(datum.value)))
        .sort((a, b) => observationDate(b).localeCompare(observationDate(a)))[0];

      if (!latest) {
        return unavailableReading(source, "missing-observation", "BLS returned no monthly observation.", now);
      }

      return createReading(source, Number(latest.value), observationDate(latest), now);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BLS request failed.";
    return sources.map((source) => unavailableReading(source, "source-failed", message, now));
  }
}
