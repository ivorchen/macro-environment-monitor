import { createReading, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type CensusResponse = string[][];

function parseRows(payload: CensusResponse) {
  const [headers, ...rows] = payload;
  if (!headers) return [];
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

function normalizedDate(row: Record<string, string>) {
  const raw = row.time || row.time_slot_date || row.time_slot_id;
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(raw);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0))
    .toISOString()
    .slice(0, 10);
}

export async function fetchCensusReadings(
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
        "Add CENSUS_API_KEY to enable this source.",
        now,
      ),
    );
  }

  return Promise.all(
    sources.map(async (source) => {
      try {
        const url = new URL("https://api.census.gov/data/timeseries/eits/marts");
        url.searchParams.set(
          "get",
          "cell_value,time_slot_id,time_slot_date,category_code,data_type_code,seasonally_adj",
        );
        url.searchParams.set("time", `from ${now.getUTCFullYear() - 1} to ${now.getUTCFullYear()}`);
        url.searchParams.set("category_code", "44000");
        url.searchParams.set("data_type_code", "SM");
        url.searchParams.set("seasonally_adj", "yes");
        url.searchParams.set("for", "us:*");
        url.searchParams.set("key", apiKey);

        const response = await fetcher(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error(`Census returned ${response.status}`);

        const rows = parseRows((await response.json()) as CensusResponse)
          .map((row) => ({
            date: normalizedDate(row),
            value: Number(row.cell_value?.replaceAll(",", "")),
          }))
          .filter(
            (row): row is { date: string; value: number } =>
              row.date !== null && Number.isFinite(row.value),
          )
          .sort((a, b) => b.date.localeCompare(a.date));
        const latest = rows[0];

        return latest
          ? createReading(source, latest.value, latest.date, now)
          : unavailableReading(
              source,
              "missing-observation",
              "Census returned no seasonally adjusted retail-sales observation.",
              now,
            );
      } catch (error) {
        return unavailableReading(
          source,
          "source-failed",
          error instanceof Error ? error.message : "Census request failed.",
          now,
        );
      }
    }),
  );
}
