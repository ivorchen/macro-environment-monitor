import { describe, expect, it, vi } from "vitest";

import { loadEconomicCalendar, selectEconomicCalendarEvents } from "./economic-calendar";

describe("economic calendar", () => {
  it("keeps only relevant releases, removes duplicates, and orders by date", () => {
    const events = selectEconomicCalendarEvents([
      { release_id: 200, release_name: "CBOE Market Statistics", date: "2026-09-05" },
      { release_id: 10, release_name: "Consumer Price Index", date: "2026-09-11" },
      { release_id: 180, release_name: "Unemployment Insurance Weekly Claims Report", date: "2026-09-10" },
      { release_id: 180, release_name: "Unemployment Insurance Weekly Claims Report", date: "2026-09-10" },
      { release_id: 50, release_name: "Employment Situation", date: "2026-09-04" },
      { release_id: 46, release_name: "Producer Price Index", date: "2026-09-03" },
    ], "2026-09-04", "2026-09-18");

    expect(events.map((event) => event.category)).toEqual([
      "employment-situation",
      "initial-jobless-claims",
      "consumer-price-index",
    ]);
  });

  it("returns a clear unavailable response when FRED is not configured", async () => {
    const response = await loadEconomicCalendar({ apiKey: "", now: new Date("2026-09-04T14:00:00Z") });
    expect(response.status).toBe("unavailable");
    expect(response.events).toEqual([]);
    expect(response.errorMessage).toContain("FRED_API_KEY");
  });

  it("loads upcoming releases from the official FRED endpoint", async () => {
    const fetcher = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      void input;
      return new Response(JSON.stringify({
        release_dates: [
          { release_id: 10, release_name: "Consumer Price Index", date: "2026-09-11" },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const response = await loadEconomicCalendar({
      apiKey: "test-key",
      fetcher: fetcher as typeof fetch,
      now: new Date("2026-09-04T14:00:00Z"),
    });

    expect(response.status).toBe("ready");
    expect(response.events[0]?.category).toBe("consumer-price-index");
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get("include_release_dates_with_no_data")).toBe("true");
    expect(url.searchParams.get("realtime_start")).toBe("2026-09-04");
    expect(url.searchParams.get("realtime_end")).toBe("2026-09-25");
  });
});
