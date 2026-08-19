import { describe, expect, it, vi } from "vitest";

import { FEATURED_SOURCE_DEFINITIONS } from "../source-registry";
import { fetchBlsReadings } from "./bls";
import { fetchFredReadings } from "./fred";
import { fetchTreasuryReading } from "./treasury";

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

  it("normalizes multiple BLS series from one deterministic response", async () => {
    const sources = FEATURED_SOURCE_DEFINITIONS.filter((item) => item.adapter === "bls");
    const fetcher = vi.fn(async () =>
      jsonResponse({
        status: "REQUEST_SUCCEEDED",
        Results: {
          series: sources.map((source, index) => ({
            seriesID: source.seriesId,
            data: [
              { year: "2026", period: "M07", value: String(index === 2 ? 4.2 : 300 + index) },
              { year: "2026", period: "M06", value: "100" },
            ],
          })),
        },
      }),
    ) as unknown as typeof fetch;

    const readings = await fetchBlsReadings(sources, { fetcher, now });

    expect(readings).toHaveLength(3);
    expect(readings.every((reading) => reading.observationDate === "2026-07-31")).toBe(true);
    expect(readings.every((reading) => reading.freshness === "fresh")).toBe(true);
  });
});
