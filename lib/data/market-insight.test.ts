import { describe, expect, it } from "vitest";

import type { DailyInsightStore } from "./cache";
import {
  loadDailyMarketInsight,
  MARKET_INSIGHT_LATEST_CACHE_KEY,
  marketInsightCacheKey,
  type DailyMarketInsight,
} from "./market-insight";

function createStore(initial: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(initial));
  const store: DailyInsightStore = {
    backend: "redis",
    async get<T>(key: string) {
      return (values.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T) {
      values.set(key, value);
    },
  };
  return { store, values };
}

const report: DailyMarketInsight = {
  reportDate: "2026-08-20",
  generatedAt: "2026-08-20T11:30:00.000Z",
  model: "codex-scheduled-task",
  brief: "Credit remains calm, but real yields keep the macro signal from becoming fully supportive.",
  detailed: {
    headline: "Cross-asset signals remain mixed",
    overview: "The latest available readings show constructive credit and restrictive real yields.",
    keySignals: ["Credit is calm.", "Real yields are restrictive.", "Breadth is mixed."],
    risks: ["Releases can be revised.", "Volatility could break higher."],
    watchNext: ["Watch the next credit close.", "Compare breadth with SPX."],
  },
};

describe("published daily market insight", () => {
  it("loads the date-specific report from Redis", async () => {
    const now = new Date("2026-08-20T15:00:00.000Z");
    const { store } = createStore({ [marketInsightCacheKey(now)]: report });

    const result = await loadDailyMarketInsight({ store, now });

    expect(result).toEqual({
      insight: report,
      cache: { backend: "redis", status: "hit" },
    });
  });

  it("uses the New York calendar date for the daily key", () => {
    expect(marketInsightCacheKey(new Date("2026-08-20T03:30:00.000Z"))).toBe(
      "ai-market-insight:v1:2026-08-19",
    );
  });

  it("falls back to the latest published report before today's task runs", async () => {
    const { store } = createStore({ [MARKET_INSIGHT_LATEST_CACHE_KEY]: report });

    const result = await loadDailyMarketInsight({
      store,
      now: new Date("2026-08-21T12:00:00.000Z"),
    });

    expect(result.insight).toEqual(report);
    expect(result.cache.status).toBe("previous-day");
  });

  it("returns an actionable error when no report has been published", async () => {
    const { store } = createStore();

    await expect(loadDailyMarketInsight({ store }))
      .rejects.toMatchObject({ code: "report-unavailable" });
  });
});
