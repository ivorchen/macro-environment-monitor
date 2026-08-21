import { describe, expect, it, vi } from "vitest";

import { FEATURED_SOURCE_DEFINITIONS } from "../source-registry";
import { fetchBeaReadings } from "./bea";
import { fetchBlsReadings } from "./bls";
import { fetchBlsReadingsWithFredFallback } from "./bls-with-fred-fallback";
import { fetchCensusReadings } from "./census";
import { fetchFredReadings } from "./fred";
import { fetchNasdaqReadings } from "./nasdaq";
import { fetchTreasuryAuctionReading, fetchTreasuryReading } from "./treasury";

const now = new Date("2026-08-18T12:00:00Z");

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("public macro adapters", () => {
  it("normalizes the latest numeric FRED observation", async () => {
    const source = FEATURED_SOURCE_DEFINITIONS.find((item) => item.id === "rates-10y")!;
    const fetcher = vi.fn(async () =>
      jsonResponse({
        observations: [
          { date: "2026-08-17", value: "." },
          { date: "2026-08-14", value: "4.215" },
        ],
      }),
    ) as unknown as typeof fetch;

    const [reading] = await fetchFredReadings([source], "test-key", { fetcher, now });

    expect(reading.value).toBe(4.215);
    expect(reading.displayValue).toBe("4.21%");
    expect(reading.observationDate).toBe("2026-08-14");
    expect(reading.freshness).toBe("fresh");
  });

  it("formats ON RRP in the billions reported by FRED", async () => {
    const source = FEATURED_SOURCE_DEFINITIONS.find((item) => item.id === "liquidity-on-rrp")!;
    const fetcher = vi.fn(async () =>
      jsonResponse({ observations: [{ date: "2026-08-18", value: "0.317" }] }),
    ) as unknown as typeof fetch;

    const [reading] = await fetchFredReadings([source], "test-key", { fetcher, now });

    expect(reading.displayValue).toBe("$0.32B");
    expect(reading.unit).toBe("USD billions");
  });

  it("makes missing FRED configuration explicit without making a request", async () => {
    const source = FEATURED_SOURCE_DEFINITIONS.find((item) => item.id === "rates-10y")!;
    const fetcher = vi.fn() as unknown as typeof fetch;

    const [reading] = await fetchFredReadings([source], undefined, { fetcher, now });

    expect(reading.errorCode).toBe("configuration-required");
    expect(reading.freshness).toBe("unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("normalizes Treasury's TGA closing balance", async () => {
    const source = FEATURED_SOURCE_DEFINITIONS.find((item) => item.id === "liquidity-tga")!;
    const fetcher = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            record_date: "2026-08-17",
            account_type: "Treasury General Account (TGA) Closing Balance",
            open_today_bal: "932785",
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const reading = await fetchTreasuryReading(source, { fetcher, now });

    expect(reading.value).toBe(932785);
    expect(reading.displayValue).toBe("$932.8B");
    expect(reading.observationDate).toBe("2026-08-17");
  });

  it("normalizes the latest Treasury auction offering amount", async () => {
    const source = FEATURED_SOURCE_DEFINITIONS.find(
      (item) => item.id === "liquidity-treasury-issuance",
    )!;
    const fetchMock = vi.fn(async (_input: URL | RequestInfo) => {
      void _input;
      return jsonResponse({
        data: [
          {
            auction_date: "2026-08-17",
            security_type: "Bill",
            security_term: "26-Week",
            offering_amt: "68000000000",
          },
        ],
      });
    });
    const fetcher = fetchMock as unknown as typeof fetch;

    const reading = await fetchTreasuryAuctionReading(source, { fetcher, now });

    expect(reading.value).toBe(68_000_000_000);
    expect(reading.displayValue).toBe("$68B");
    expect(reading.observationDate).toBe("2026-08-17");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/v1/accounting/od/auctions_query",
    );
  });

  it("calculates Core PCE year over year from BEA NIPA line 25", async () => {
    const source = FEATURED_SOURCE_DEFINITIONS.find(
      (item) => item.id === "inflation-core-pce",
    )!;
    const fetcher = vi.fn(async () =>
      jsonResponse({
        BEAAPI: {
          Results: {
            Data: [
              { LineNumber: "25", TimePeriod: "2026M06", DataValue: "126.500" },
              { LineNumber: "25", TimePeriod: "2025M06", DataValue: "122.500" },
              { LineNumber: "1", TimePeriod: "2026M06", DataValue: "130.000" },
            ],
          },
        },
      }),
    ) as unknown as typeof fetch;

    const [reading] = await fetchBeaReadings([source], "test-bea-key", { fetcher, now });

    expect(reading.displayValue).toBe("3.27%");
    expect(reading.observationDate).toBe("2026-06-30");
    expect(reading.freshness).toBe("fresh");
  });

  it("normalizes Census seasonally adjusted advance retail sales", async () => {
    const source = FEATURED_SOURCE_DEFINITIONS.find(
      (item) => item.id === "growth-retail-sales",
    )!;
    const fetchMock = vi.fn(async (_input: URL | RequestInfo) => {
      void _input;
      return jsonResponse([
        [
          "cell_value",
          "time_slot_id",
          "time_slot_date",
          "category_code",
          "data_type_code",
          "seasonally_adj",
          "us",
        ],
        [
          "628400",
          "0",
          "2026-06-01 00:00:00.0",
          "44000",
          "SM",
          "yes",
          "1",
        ],
        ["625100", "2026-05", "2026-05", "44000", "SM", "yes", "1"],
      ]);
    });
    const fetcher = fetchMock as unknown as typeof fetch;

    const [reading] = await fetchCensusReadings([source], "test-census-key", {
      fetcher,
      now,
    });

    expect(reading.value).toBe(628_400);
    expect(reading.displayValue).toBe("$628.4B");
    expect(reading.observationDate).toBe("2026-06-30");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("key=test-census-key");
  });

  it("calculates 20-session breadth from common Nasdaq ETF dates", async () => {
    const source = FEATURED_SOURCE_DEFINITIONS.find(
      (item) => item.id === "breadth-equal-weight",
    )!;
    const dates = Array.from({ length: 21 }, (_, index) =>
      new Date(Date.UTC(2026, 7, 18 - index)).toISOString().slice(0, 10),
    );
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const symbol = new URL(String(input)).pathname.split("/").at(-2);
      return jsonResponse({
        data: {
          tradesTable: {
            rows: dates.map((date, index) => ({
              date: `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}`,
              close: String(symbol === "RSP" && index === 0 ? 110 : 100),
            })),
          },
        },
        status: { rCode: 200 },
      });
    }) as unknown as typeof fetch;

    const [reading] = await fetchNasdaqReadings([source], { fetcher, now });

    expect(reading.displayValue).toBe("10.00%");
    expect(reading.observationDate).toBe("2026-08-18");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("makes every newly keyed provider explicit when credentials are missing", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const bea = FEATURED_SOURCE_DEFINITIONS.filter((item) => item.adapter === "bea");
    const census = FEATURED_SOURCE_DEFINITIONS.filter((item) => item.adapter === "census");

    const readings = [
      ...(await fetchBeaReadings(bea, undefined, { fetcher, now })),
      ...(await fetchCensusReadings(census, undefined, { fetcher, now })),
    ];

    expect(readings.length).toBeGreaterThan(0);
    expect(readings.every((reading) => reading.errorCode === "configuration-required")).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("normalizes BLS levels and calculates the macro-relevant changes", async () => {
    const sources = FEATURED_SOURCE_DEFINITIONS.filter((item) => item.adapter === "bls");
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => {
      void _input;
      void _init;
      return jsonResponse({
        status: "REQUEST_SUCCEEDED",
        Results: {
          series: [
            {
              seriesID: "CUSR0000SA0L1E",
              data: [
                { year: "2026", period: "M07", value: "336.789" },
                { year: "2025", period: "M07", value: "326.123" },
              ],
            },
            {
              seriesID: "CES0000000001",
              data: [
                { year: "2026", period: "M07", value: "158858" },
                { year: "2026", period: "M06", value: "158785" },
              ],
            },
            {
              seriesID: "LNS14000000",
              data: [{ year: "2026", period: "M07", value: "4.1" }],
            },
          ],
        },
      });
    });
    const fetcher = fetchMock as unknown as typeof fetch;

    const readings = await fetchBlsReadings(sources, {
      fetcher,
      now,
      registrationKey: "test-bls-key",
    });

    expect(readings).toHaveLength(3);
    expect(readings.every((reading) => reading.observationDate === "2026-07-31")).toBe(true);
    expect(readings.every((reading) => reading.freshness === "fresh")).toBe(true);
    expect(readings.find((reading) => reading.id === "inflation-core-cpi")?.displayValue).toBe("3.27%");
    expect(readings.find((reading) => reading.id === "labor-payrolls")?.displayValue).toBe("+73K");
    expect(readings.find((reading) => reading.id === "labor-unemployment")?.displayValue).toBe("4.10%");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      registrationkey: "test-bls-key",
    });
  });

  it("falls back to equivalent FRED series when BLS reaches its daily allowance", async () => {
    const sources = FEATURED_SOURCE_DEFINITIONS.filter((item) => item.adapter === "bls");
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("api.bls.gov")) {
        return jsonResponse({
          status: "REQUEST_FAILED",
          message: ["The daily threshold has been reached."],
        });
      }

      const seriesId = new URL(url).searchParams.get("series_id");
      const observations = {
        CPILFESL: [
          { date: "2026-07-01", value: "340" },
          { date: "2025-07-01", value: "330" },
        ],
        PAYEMS: [
          { date: "2026-07-01", value: "158858" },
          { date: "2026-06-01", value: "158785" },
        ],
        UNRATE: [{ date: "2026-07-01", value: "4.1" }],
      }[seriesId as "CPILFESL" | "PAYEMS" | "UNRATE"];
      return jsonResponse({ observations });
    }) as unknown as typeof fetch;

    const readings = await fetchBlsReadingsWithFredFallback(sources, {
      fetcher,
      now,
      fredApiKey: "test-fred-key",
    });

    expect(readings).toHaveLength(3);
    expect(readings.every((reading) => reading.freshness === "fresh")).toBe(true);
    expect(readings.every((reading) => reading.providerShort === "FRED / BLS")).toBe(true);
    expect(readings.find((reading) => reading.id === "inflation-core-cpi")?.displayValue).toBe("3.03%");
    expect(readings.find((reading) => reading.id === "labor-payrolls")?.displayValue).toBe("+73K");
    expect(readings.find((reading) => reading.id === "labor-unemployment")?.displayValue).toBe("4.10%");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
