import { createReading, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

export type BlsAdapterOptions = AdapterOptions & {
  registrationKey?: string;
};

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

function numericMonthlyData(data: BlsDatum[] | undefined) {
  return (data ?? [])
    .filter((datum) => /^M\d{2}$/.test(datum.period) && Number.isFinite(Number(datum.value)))
    .sort((a, b) => observationDate(b).localeCompare(observationDate(a)));
}

function transformedValue(source: IndicatorSourceDefinition, data: BlsDatum[]) {
  const latest = data[0];
  if (!latest) return null;

  if (source.calculation === "period-change") {
    const previous = data[1];
    return previous ? Number(latest.value) - Number(previous.value) : null;
  }

  if (source.calculation === "year-over-year-percent") {
    const previousYear = data.find(
      (datum) =>
        Number(datum.year) === Number(latest.year) - 1 &&
        datum.period === latest.period,
    );
    if (!previousYear || Number(previousYear.value) === 0) return null;
    return (Number(latest.value) / Number(previousYear.value) - 1) * 100;
  }

  return Number(latest.value);
}

export async function fetchBlsReadings(
  sources: readonly IndicatorSourceDefinition[],
  options: BlsAdapterOptions = {},
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
        ...(options.registrationKey ? { registrationkey: options.registrationKey } : {}),
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
      const data = numericMonthlyData(series?.data);
      const latest = data[0];
      const value = transformedValue(source, data);

      if (!latest || value === null) {
        return unavailableReading(source, "missing-observation", "BLS returned insufficient data for this calculation.", now);
      }

      return createReading(source, value, observationDate(latest), now);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BLS request failed.";
    return sources.map((source) => unavailableReading(source, "source-failed", message, now));
  }
}
