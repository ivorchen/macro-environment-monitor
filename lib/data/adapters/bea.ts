import { createReading, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type BeaDatum = {
  DataValue?: string;
  LineNumber?: string;
  TimePeriod?: string;
};

type BeaResponse = {
  BEAAPI?: {
    Error?: { ErrorDetail?: { Description?: string } };
    Results?: {
      Data?: BeaDatum[];
      Error?: { ErrorDetail?: { Description?: string } };
    };
  };
};

function observationDate(timePeriod: string) {
  const match = /^(\d{4})M(\d{2})$/.exec(timePeriod);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0))
    .toISOString()
    .slice(0, 10);
}

function numericData(data: BeaDatum[] | undefined) {
  return (data ?? [])
    .filter((datum) => datum.LineNumber === "25" && observationDate(datum.TimePeriod ?? ""))
    .map((datum) => ({
      date: observationDate(datum.TimePeriod ?? "")!,
      value: Number(datum.DataValue?.replaceAll(",", "")),
    }))
    .filter((datum) => Number.isFinite(datum.value))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchBeaReadings(
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
        "Add BEA_API_KEY to enable this source.",
        now,
      ),
    );
  }

  try {
    const url = new URL("https://apps.bea.gov/api/data/");
    url.searchParams.set("UserID", apiKey);
    url.searchParams.set("method", "GetData");
    url.searchParams.set("datasetname", "NIPA");
    url.searchParams.set("TableName", "T20804");
    url.searchParams.set("Frequency", "M");
    url.searchParams.set(
      "Year",
      `${now.getUTCFullYear() - 1},${now.getUTCFullYear()}`,
    );
    url.searchParams.set("ResultFormat", "JSON");

    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await response.json()) as BeaResponse;
    const sourceError =
      payload.BEAAPI?.Results?.Error?.ErrorDetail?.Description ??
      payload.BEAAPI?.Error?.ErrorDetail?.Description;
    if (!response.ok || sourceError) {
      throw new Error(sourceError || `BEA returned ${response.status}`);
    }

    const observations = numericData(payload.BEAAPI?.Results?.Data);
    const latest = observations[0];
    const latestDate = latest ? new Date(`${latest.date}T00:00:00Z`) : null;
    const previousYear = latestDate
      ? observations.find((datum) => {
          const date = new Date(`${datum.date}T00:00:00Z`);
          return (
            date.getUTCFullYear() === latestDate.getUTCFullYear() - 1 &&
            date.getUTCMonth() === latestDate.getUTCMonth()
          );
        })
      : undefined;
    const value =
      latest && previousYear && previousYear.value !== 0
        ? (latest.value / previousYear.value - 1) * 100
        : null;

    return sources.map((source) =>
      latest && value !== null
        ? createReading(source, value, latest.date, now)
        : unavailableReading(
            source,
            "missing-observation",
            "BEA returned insufficient Core PCE observations for a year-over-year calculation.",
            now,
          ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "BEA request failed.";
    return sources.map((source) => unavailableReading(source, "source-failed", message, now));
  }
}
