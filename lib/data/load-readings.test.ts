import { describe, expect, it, vi } from "vitest";

import type { IndicatorDataCache } from "./cache";
import { loadIndicatorReadings } from "./load-readings";
import type { IndicatorReading } from "./types";

const now = new Date("2026-08-18T12:00:00Z");

function cachedReading(id: string, providerShort: string): IndicatorReading {
  return {
    id,
    pillarId: "test",
    indicator: id,
    provider: providerShort,
    providerShort,
    value: 1,
    displayValue: "1",
    unit: "test",
    transformation: "Test reading",
    observationDate: "2026-08-18",
    fetchedAt: now.toISOString(),
    freshness: "fresh",
    sourceUrl: "https://example.com",
    seriesId: id,
  };
}

function createCache(values: Record<string, IndicatorReading[]>): IndicatorDataCache {
  return {
    backend: "redis",
    async get<T>(key: string) {
      return key in values ? (values[key] as T) : null;
    },
    async set() {},
  };
}

describe("indicator provider configuration", () => {
  it("omits keyed providers while retaining credential-free Nasdaq indicators", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const response = await loadIndicatorReadings({
      cache: createCache({
        "readings:v1:bls": [],
        "readings:v2:treasury": [],
        "readings:v3:nasdaq": [cachedReading("breadth-equal-weight", "Nasdaq")],
        "readings:v1:polymarket": [cachedReading("rates-polymarket-september-fed", "Polymarket")],
      }),
      fetcher,
      now,
    });

    expect(response.readings.map((reading) => reading.id)).not.toEqual(
      expect.arrayContaining([
        "inflation-core-pce",
        "growth-retail-sales",
      ]),
    );
    expect(response.readings.map((reading) => reading.id)).toContain("breadth-equal-weight");
    expect(response.cache.hits).toEqual(["bls", "treasury", "nasdaq", "polymarket"]);
    expect(response.cache.bypassed).toEqual(["fred"]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("includes configured optional providers", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const response = await loadIndicatorReadings({
      beaApiKey: "bea-key",
      censusApiKey: "census-key",
      cache: createCache({
        "readings:v1:bls": [],
        "readings:v2:bea": [cachedReading("inflation-core-pce", "BEA")],
        "readings:v2:census": [cachedReading("growth-retail-sales", "Census")],
        "readings:v2:treasury": [],
        "readings:v3:nasdaq": [cachedReading("breadth-equal-weight", "Nasdaq")],
        "readings:v1:polymarket": [cachedReading("rates-polymarket-september-fed", "Polymarket")],
      }),
      fetcher,
      now,
    });

    expect(response.readings.map((reading) => reading.id)).toEqual(
      expect.arrayContaining([
        "inflation-core-pce",
        "growth-retail-sales",
        "breadth-equal-weight",
      ]),
    );
    expect(response.cache.hits).toEqual(["bls", "bea", "census", "treasury", "nasdaq", "polymarket"]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
