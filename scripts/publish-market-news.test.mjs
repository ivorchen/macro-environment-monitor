import { describe, expect, it } from "vitest";

import { canonicalizeUrl, normalizeMarketNewsBundle, redisKeys } from "./publish-market-news.mjs";

const bundle = {
  generatedAt: "2026-09-04T13:00:00Z",
  reports: [
    { id: "6a84e4fc-826c-83ea-a057-082f2a1911a8", name: "Daily Tech & Market Brief", generatedAt: "2026-09-04T12:00:00Z", content: "Full report one", items: [{ source: "Reuters", headline: "Markets rise", summary: "Stocks advanced.", publishedAt: "2026-09-04T11:00:00Z", url: "https://example.com/story?utm_source=test", category: "Markets", translations: { "zh-CN": { headline: "市场上涨", summary: "股市走高。", category: "市场" }, "zh-TW": { headline: "市場上漲", summary: "股市走高。", category: "市場" } } }] },
    { id: "6a84e64f-e168-83ea-89dd-a80503d9c92b", name: "US Stocks Macro Monitoring", generatedAt: "2026-09-04T12:05:00Z", content: "Full report two", items: [{ source: "Reuters", headline: "Markets rise", summary: "The same development.", publishedAt: "2026-09-04T11:00:00Z", url: "https://example.com/story", category: "Markets", translations: { "zh-CN": { headline: "市场上涨", summary: "同一事件。", category: "市场" }, "zh-TW": { headline: "市場上漲", summary: "同一事件。", category: "市場" } } }] },
  ],
};

describe("market-news publisher", () => {
  it("canonicalizes tracking parameters and deduplicates while retaining both origins", () => {
    const result = normalizeMarketNewsBundle(bundle);
    expect(result.feed.items).toHaveLength(1);
    expect(result.feed.items[0].url).toBe("https://example.com/story");
    expect(result.feed.items[0].originatingReports).toHaveLength(2);
    expect(result.feed.items[0].translations["zh-CN"].headline).toBe("市场上涨");
    expect(result.reports[0].content).toBe("Full report one");
  });

  it("rejects non-HTTPS and missing citation URLs", () => {
    expect(() => canonicalizeUrl("http://example.com/story")).toThrow("HTTPS");
    expect(() => canonicalizeUrl("")).toThrow();
  });

  it("builds feed and report fallback keys", () => {
    expect(redisKeys(bundle.generatedAt, "test:")).toEqual({ feed: "test:market-news:v1:latest", reports: "test:market-news-reports:v1:2026-09-04", latestReports: "test:market-news-reports:v1:latest" });
  });
});
