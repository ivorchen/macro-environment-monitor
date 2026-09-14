import { describe, expect, it } from "vitest";

import { buildPrimeBookResponse, derivePrimeBookExposure, type PrimeBookRawObservation } from "./prime-book";

function observation(overrides: Partial<PrimeBookRawObservation> = {}): PrimeBookRawObservation {
  return {
    date: "2026-09-03",
    provider: "Licensed Provider A",
    gross_leverage: 3.04,
    net_leverage: 0.76,
    long_short_ratio: 1.67,
    source_reference: "Licensed weekly report, 2026-09-03",
    source_published_at: "2026-09-03T12:00:00Z",
    ingested_at: "2026-09-03T13:00:00Z",
    methodology: "Aggregated equity prime-book exposures",
    universe: "Provider A client sample",
    expected_update_days: 7,
    ...overrides,
  };
}

describe("derivePrimeBookExposure", () => {
  it("derives long, short, and L/S values from gross and net leverage", () => {
    const derived = derivePrimeBookExposure(3.04, 0.76);
    expect(derived.longExposure).toBeCloseTo(1.9);
    expect(derived.shortExposure).toBeCloseTo(1.14);
    expect(derived.longShortRatio).toBeCloseTo(1.67, 2);
  });
});

describe("buildPrimeBookResponse", () => {
  it("keeps incompatible providers separate and defaults to the latest series", () => {
    const response = buildPrimeBookResponse({
      payload: { observations: [
        observation({ provider: "Provider A", date: "2026-09-03" }),
        observation({ provider: "Provider B", date: "2026-09-05", methodology: "Different book", universe: "Provider B clients" }),
      ] },
      now: new Date("2026-09-06T12:00:00Z"),
    });
    expect(response.provider).toBe("Provider B");
    expect(response.points.every((point) => point.provider === "Provider B")).toBe(true);
    expect(response.providers).toHaveLength(2);
  });

  it("calculates changes and the percentile from the complete selected-provider history", () => {
    const response = buildPrimeBookResponse({
      payload: { observations: [
        observation({ date: "2026-05-01", gross_leverage: 2.0 }),
        observation({ date: "2026-06-01", gross_leverage: 2.5 }),
        observation({ date: "2026-08-01", gross_leverage: 3.0 }),
        observation({ date: "2026-09-03", gross_leverage: 2.8 }),
      ] },
      range: "3M",
      now: new Date("2026-09-04T12:00:00Z"),
    });
    expect(response.points.map((point) => point.date)).toEqual(["2026-08-01", "2026-09-03"]);
    expect(response.metrics.grossLeverage?.change1M).toBeCloseTo(-0.2);
    expect(response.metrics.grossLeverage?.change3M).toBeCloseTo(0.3);
    expect(response.metrics.grossLeverage?.percentile).toBe(75);
  });

  it("flags reported ratios outside rounding tolerance and stale observations", () => {
    const response = buildPrimeBookResponse({
      payload: { observations: [observation({ long_short_ratio: 2.1 })] },
      now: new Date("2026-09-20T12:00:01Z"),
    });
    expect(response.freshness).toBe("stale");
    expect(response.latest?.ratio_consistent).toBe(false);
    expect(response.dataQuality.warnings).toHaveLength(1);
  });

  it("does not manufacture observations when the manual source is empty", () => {
    expect(buildPrimeBookResponse({ payload: { observations: [] } })).toMatchObject({
      freshness: "unavailable",
      errorCode: "configuration-required",
      points: [],
    });
  });
});
