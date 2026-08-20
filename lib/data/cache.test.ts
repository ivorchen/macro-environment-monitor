import { describe, expect, it, vi } from "vitest";

import { loadCachedProvider, type IndicatorDataCache } from "./cache";

function testCache(initial: unknown = null) {
  let stored = initial;
  const get = vi.fn(async () => stored) as IndicatorDataCache["get"];
  const set = vi.fn(async (_key: string, value: unknown) => {
    stored = value;
  }) as IndicatorDataCache["set"];
  return { backend: "redis" as const, get, set };
}

describe("provider data cache", () => {
  it("returns a Redis hit without calling the upstream loader", async () => {
    const cache = testCache([{ value: 4.2 }]);
    const loader = vi.fn(async () => [{ value: 4.3 }]);

    const result = await loadCachedProvider({
      cache,
      cacheKey: "readings:v1:fred",
      ttlSeconds: 3_600,
      loader,
      shouldCache: () => true,
    });

    expect(result).toEqual({ value: [{ value: 4.2 }], status: "hit" });
    expect(loader).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("stores a successful miss with the provider TTL", async () => {
    const cache = testCache();

    const result = await loadCachedProvider({
      cache,
      cacheKey: "readings:v1:bls",
      ttlSeconds: 43_200,
      loader: async () => [{ freshness: "fresh" }],
      shouldCache: (readings) => readings.every((reading) => reading.freshness === "fresh"),
    });

    expect(result.status).toBe("miss");
    expect(cache.set).toHaveBeenCalledWith(
      "readings:v1:bls",
      [{ freshness: "fresh" }],
      43_200,
    );
  });

  it("does not cache failed provider payloads", async () => {
    const cache = testCache();

    await loadCachedProvider({
      cache,
      cacheKey: "readings:v1:treasury",
      ttlSeconds: 3_600,
      loader: async () => ({ freshness: "unavailable" }),
      shouldCache: (reading) => reading.freshness !== "unavailable",
    });

    expect(cache.set).not.toHaveBeenCalled();
  });

  it("bypasses cache cleanly when Redis is not configured", async () => {
    const result = await loadCachedProvider({
      cacheKey: "readings:v1:fred",
      ttlSeconds: 3_600,
      loader: async () => "direct",
      shouldCache: () => true,
    });

    expect(result).toEqual({ value: "direct", status: "bypass" });
  });
});
