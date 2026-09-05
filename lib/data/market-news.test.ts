import { describe, expect, it } from "vitest";

import { loadMarketNews, MarketNewsError } from "./market-news";

const feed = { generatedAt: "2026-09-04T13:00:00Z", items: [{ id: "abc", source: "Reuters", headline: "Markets rise", summary: "Stocks advanced.", publishedAt: "2026-09-04T12:00:00Z", url: "https://example.com/story", category: "Markets", translations: { "zh-CN": { headline: "市场上涨", summary: "股市走高。", category: "市场" }, "zh-TW": { headline: "市場上漲", summary: "股市走高。", category: "市場" } }, originatingReports: [{ id: "one", name: "Daily brief" }] }] };

describe("market-news loader", () => {
  it("loads and validates the Redis feed", async () => {
    const result = await loadMarketNews({ store: { backend: "redis", get: async <T>() => feed as T, set: async () => {} } });
    expect(result.feed.items[0].headline).toBe("Markets rise");
    expect(result.feed.items[0].translations["zh-TW"].headline).toBe("市場上漲");
  });

  it("reports unavailable configuration and content", async () => {
    await expect(loadMarketNews({})).rejects.toMatchObject({ code: "configuration-required" });
    await expect(loadMarketNews({ store: { backend: "redis", get: async () => null, set: async () => {} } })).rejects.toBeInstanceOf(MarketNewsError);
  });
});
