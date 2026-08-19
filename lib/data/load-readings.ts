import { fetchBlsReadings } from "./adapters/bls";
import { fetchFredReadings } from "./adapters/fred";
import { fetchTreasuryReading } from "./adapters/treasury";
import { FEATURED_SOURCE_DEFINITIONS } from "./source-registry";
import type { AdapterOptions, IndicatorApiResponse, IndicatorReading } from "./types";

export async function loadIndicatorReadings(
  options: AdapterOptions & { fredApiKey?: string } = {},
): Promise<IndicatorApiResponse> {
  const now = options.now ?? new Date();
  const fredSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "fred");
  const blsSources = FEATURED_SOURCE_DEFINITIONS.filter((source) => source.adapter === "bls");
  const treasurySource = FEATURED_SOURCE_DEFINITIONS.find((source) => source.adapter === "treasury");

  const [fredReadings, blsReadings, treasuryReading] = await Promise.all([
    fetchFredReadings(fredSources, options.fredApiKey, options),
    fetchBlsReadings(blsSources, options),
    treasurySource ? fetchTreasuryReading(treasurySource, options) : Promise.resolve(null),
  ]);

  const readings = [...fredReadings, ...blsReadings, treasuryReading]
    .filter((reading): reading is IndicatorReading => reading !== null)
    .sort((a, b) => {
      const aSource = FEATURED_SOURCE_DEFINITIONS.findIndex((source) => source.id === a.id);
      const bSource = FEATURED_SOURCE_DEFINITIONS.findIndex((source) => source.id === b.id);
      return aSource - bSource;
    });

  return {
    generatedAt: now.toISOString(),
    readings,
    summary: {
      fresh: readings.filter((reading) => reading.freshness === "fresh").length,
      stale: readings.filter((reading) => reading.freshness === "stale").length,
      unavailable: readings.filter((reading) => reading.freshness === "unavailable").length,
    },
  };
}
