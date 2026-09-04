import { describe, expect, it } from "vitest";

import { calculateRsi14, calculateSectorMetrics } from "./sector-view";
import type { NasdaqPrice } from "./adapters/nasdaq";

function history(multiplier = 1): NasdaqPrice[] {
  return Array.from({ length: 30 }, (_, index) => ({
    date: `2026-08-${String(30 - index).padStart(2, "0")}`,
    close: (130 - index) * multiplier,
  }));
}

describe("sector view", () => {
  it("calculates ETF momentum and relative strength", () => {
    const metrics = calculateSectorMetrics(history(1.1), history(1));
    expect(metrics).not.toBeNull();
    expect(metrics?.twentyDayReturn).toBeGreaterThan(0);
    expect(metrics?.relativeTwentyDayReturn).toBeCloseTo(0, 2);
    expect(metrics?.score).toBeGreaterThan(50);
  });

  it("requires enough history and bounds RSI", () => {
    expect(calculateSectorMetrics(history().slice(0, 10), history())).toBeNull();
    expect(calculateRsi14(history())).toBe(95);
  });
});
