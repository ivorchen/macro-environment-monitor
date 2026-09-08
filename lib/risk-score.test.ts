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
      reading("growth-industrial-production-yoy", 4), reading("earnings-reported-profits-yoy", 15), reading("positioning-vix", 12),
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
    expect(result.components).toHaveLength(9);
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

  it("keeps missing proxies unavailable and counts all nine pillars in coverage", () => {
    const result = calculateRiskScore({ readings: [] });
    expect(result.score).toBeNull();
    expect(result.coverage).toBe(0);
    expect(result.components).toHaveLength(9);
    expect(result.components.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
    expect(result.components.every(c => c.score === null)).toBe(true);
  });

  it("scores proxy direction and preserves source dates without inventing positions", () => {
    const result = calculateRiskScore({ readings: [reading("growth-industrial-production-yoy", -5), reading("earnings-reported-profits-yoy", 20), reading("positioning-vix", 40)] });
    expect(result.components.find(c => c.id === "growth")?.score).toBe(10);
    expect(result.components.find(c => c.id === "earnings")?.score).toBe(90);
    expect(result.components.find(c => c.id === "positioning")?.score).toBe(10);
    expect(result.components.find(c => c.id === "positioning")?.rationale).toContain("not measured investor positioning");
    expect(result.components[0].observationDate).toBe("2026-09-01");
  });
});
