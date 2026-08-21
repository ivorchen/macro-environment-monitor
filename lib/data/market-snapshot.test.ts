import { describe, expect, it, vi } from "vitest";

import { loadMarketSnapshot, marketSnapshotCacheTtlSeconds } from "./market-snapshot";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("market snapshot", () => {
  it("combines entitled FMP quotes with daily FRED observations", async () => {
    const now = new Date("2026-08-19T15:00:00Z");
    const requestGate = vi.fn(async () => ({ allowed: true, used: 1, limit: 40 }));
    const fredValues: Record<string, [string, string]> = {
      SP500: ["7708.03", "7691.76"],
      NASDAQ100: ["29742.60", "29525.48"],
      DFII10: ["2.41", "2.44"],
      BAMLH0A0HYM2: ["2.75", "2.74"],
      VIXCLS: ["14.89", "15.84"],
    };
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.hostname === "financialmodelingprep.com") {
        const symbol = url.searchParams.get("symbol");
        const quotes: Record<string, { price: number; previousClose: number }> = {
          "^GSPC": { price: 7708.03, previousClose: 7691.76 },
          "^VIX": { price: 14.89, previousClose: 15.84 },
          GCUSD: { price: 2525.4, previousClose: 2510.2 },
          BTCUSD: { price: 62150.25, previousClose: 60800.5 },
        };
        return jsonResponse([{ ...quotes[symbol ?? ""], timestamp: 1787170381 }]);
      }
      if (url.hostname === "api.nasdaq.com") {
        const symbol = url.pathname.split("/").at(-2);
        const [latest, previous] =
          symbol === "JNK" ? [95.77, 95.55] : [190.5, 189.25];
        return jsonResponse({
          data: {
            tradesTable: {
              rows: [
                { date: "08/18/2026", close: String(latest) },
                { date: "08/17/2026", close: String(previous) },
              ],
            },
          },
          status: { rCode: 200 },
        });
      }
      const [latest, previous] = fredValues[url.searchParams.get("series_id") ?? ""];
      return jsonResponse({
        observations: [
          { date: "2026-08-18", value: latest },
          { date: "2026-08-17", value: previous },
        ],
      });
    });
    const fetcher = fetchMock as unknown as typeof fetch;

    const response = await loadMarketSnapshot({
      fmpApiKey: "fmp-key",
      fredApiKey: "fred-key",
      requestGate,
      fetcher,
      now,
    });

    expect(response.markets.find((market) => market.id === "spx")).toMatchObject({
      displayValue: "7,708",
      provider: "FMP",
      status: "fresh",
    });
    expect(response.markets.find((market) => market.id === "ndx")).toMatchObject({
      displayValue: "29,743",
      provider: "FRED",
    });
    expect(response.markets.find((market) => market.id === "real-yield")?.displayMove).toBe(
      "−3 bp",
    );
    expect(response.markets.find((market) => market.id === "rsp")).toMatchObject({
      value: 190.5,
      provider: "Nasdaq",
      status: "fresh",
    });
    expect(response.markets.find((market) => market.id === "gold")).toMatchObject({
      displayValue: "$2,525",
      provider: "FMP",
      status: "fresh",
    });
    expect(response.markets.find((market) => market.id === "jnk")).toMatchObject({
      displayValue: "$95.77",
      provider: "Nasdaq",
      status: "fresh",
    });
    expect(response.markets.find((market) => market.id === "btc")).toMatchObject({
      displayValue: "$62,150",
      provider: "FMP",
      status: "fresh",
    });
    expect(requestGate).toHaveBeenCalledTimes(4);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("financialmodelingprep.com"),
      ),
    ).toHaveLength(4);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/quote/RSP/"))).toBe(true);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/quote/JNK/"))).toBe(true);
  });

  it("uses a shorter cache window during U.S. market hours", () => {
    expect(marketSnapshotCacheTtlSeconds(new Date("2026-08-19T15:00:00Z"))).toBe(
      55 * 60,
    );
    expect(marketSnapshotCacheTtlSeconds(new Date("2026-08-19T02:00:00Z"))).toBe(
      6 * 60 * 60,
    );
  });
});
