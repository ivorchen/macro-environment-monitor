import { describe, expect, it } from "vitest";

import { calculateNfciStatistics, loadNfciYtd, normalizeNfciPoints } from "./nfci";

describe("normalizeNfciPoints", () => {
  it("filters invalid values, preserves missing weeks, deduplicates, and orders observations", () => {
    expect(normalizeNfciPoints([
      { date: "2026-01-16", value: "-0.2" },
      { date: "2025-12-26", value: "-0.8" },
      { date: "2026-01-02", value: "-0.4" },
      { date: "2026-01-16", value: "-0.1" },
      { date: "2026-01-23", value: "." },
    ], 2026)).toEqual([
      { date: "2026-01-02", value: -0.4 },
      { date: "2026-01-16", value: -0.1 },
    ]);
  });
});

describe("calculateNfciStatistics", () => {
  it("calculates YTD and four-week statistics without interpolating missing weeks", () => {
    const statistics = calculateNfciStatistics([
      { date: "2026-01-02", value: -0.4 },
      { date: "2026-01-09", value: -0.3 },
      { date: "2026-01-30", value: -0.1 },
      { date: "2026-02-06", value: 0.1 },
    ]);
    expect(statistics).toMatchObject({
      latest: { date: "2026-02-06", value: 0.1 },
      ytdHigh: { date: "2026-02-06", value: 0.1 },
      ytdLow: { date: "2026-01-02", value: -0.4 },
      ytdChange: 0.5,
      fourWeekChange: 0.4,
      direction: "tightening",
    });
  });

  it("labels small four-week changes flat and handles insufficient history", () => {
    expect(calculateNfciStatistics([
      { date: "2026-01-02", value: -0.3 },
      { date: "2026-02-06", value: -0.29 },
    ])?.direction).toBe("flat");
    expect(calculateNfciStatistics([{ date: "2026-02-06", value: -0.29 }])?.fourWeekChange).toBeNull();
  });
});

describe("loadNfciYtd", () => {
  it("returns an explicit configuration state without a FRED key", async () => {
    const payload = await loadNfciYtd({ year: 2026, now: new Date("2026-08-30T12:00:00Z") });
    expect(payload).toMatchObject({
      freshness: "unavailable",
      errorCode: "configuration-required",
      points: [],
    });
  });

  it("fetches the complete requested-year window and marks old current-year data stale", async () => {
    const fetcher = async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("observation_start")).toBe("2026-01-01");
      expect(url.searchParams.get("observation_end")).toBe("2026-12-31");
      return new Response(JSON.stringify({
        observations: [
          { date: "2026-01-02", value: "-0.4" },
          { date: "2026-08-07", value: "-0.2" },
        ],
      }));
    };
    const payload = await loadNfciYtd({
      year: 2026,
      fredApiKey: "test",
      fetcher: fetcher as typeof fetch,
      now: new Date("2026-08-30T12:00:00Z"),
    });
    expect(payload.points).toHaveLength(2);
    expect(payload.freshness).toBe("stale");
    expect(payload.observationDate).toBe("2026-08-07");
  });
});
