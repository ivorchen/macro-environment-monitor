import { describe, expect, it } from "vitest";

import type { IndicatorReading } from "./data/types";
import { calculateRiskScore, componentScoreToPillarScore, riskZone } from "./risk-score";

function reading(id: string, value: number): IndicatorReading {
  return {
    id,
    pillarId: id.split("-")[0],
    indicator: id,
    provider: "test",
    providerShort: "test",
    value,
    displayValue: String(value),
    unit: "test",
    transformation: "test",
    observationDate: "2026-09-01",
    fetchedAt: "2026-09-02T00:00:00.000Z",
    freshness: "fresh",
    sourceUrl: "https://example.com",
    seriesId: id,
  };
}

describe("macro risk scoring", () => {
  it("maps a fully supportive input set to a high score", () => {
    const readings = [
      reading("rates-2y", 3.5), reading("rates-10y", 4.2), reading("rates-real-10y", 0.5),
      reading("inflation-core-cpi", 2.1), reading("inflation-core-pce", 2.2),
      reading("labor-payrolls", 180), reading("labor-unemployment", 3.7),
      reading("credit-hy-spreads", 2.8), reading("credit-regional-banks", 5),
      reading("breadth-equal-weight", 5), reading("breadth-small-large", 4), reading("breadth-cyclicals-defensives", 3),
    ];
    const result = calculateRiskScore({
      readings,
      nfci: {
        generatedAt: "2026-09-02T00:00:00.000Z", year: 2026, seriesId: "NFCI",
        source: "Federal Reserve Bank of St. Louis (FRED)", sourceUrl: "https://fred.stlouisfed.org/series/NFCI",
        frequency: "weekly", points: [], observationDate: "2026-08-28", freshness: "fresh",
        statistics: {
          latest: { date: "2026-08-28", value: -0.6 }, ytdStart: { date: "2026-01-02", value: -0.4 },
          ytdHigh: { date: "2026-02-01", value: -0.3 }, ytdLow: { date: "2026-08-28", value: -0.6 },
          ytdChange: -0.2, fourWeekChange: -0.08, direction: "loosening",
        },
        cache: { backend: "none", status: "bypass" },
      },
    });
    expect(result.score).toBeGreaterThan(70);
    expect(result.coverage).toBe(100);
    expect(result.components).toHaveLength(6);
  });

  it("reweights available components and reports reduced coverage", () => {
    const result = calculateRiskScore({ readings: [reading("credit-hy-spreads", 3)] });
    expect(result.score).not.toBeNull();
    expect(result.coverage).toBeLessThan(20);
    expect(result.components.find((item) => item.id === "credit")?.inputsUsed).toBe(1);
  });

  it("uses stable zones and pillar buckets", () => {
    expect(riskZone(20)).toBe("defensive");
    expect(riskZone(50)).toBe("mixed");
    expect(riskZone(81)).toBe("euphoric");
    expect(componentScoreToPillarScore(79)).toBe(1);
    expect(componentScoreToPillarScore(19)).toBe(-2);
  });
});
