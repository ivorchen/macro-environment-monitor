import { describe, expect, it } from "vitest";

import { freshnessForDate } from "./freshness";

describe("reading freshness", () => {
  const now = new Date("2026-08-18T12:00:00Z");

  it("marks observations inside the policy window fresh", () => {
    expect(freshnessForDate("2026-08-15", 4, now)).toBe("fresh");
  });

  it("marks observations outside the policy window stale", () => {
    expect(freshnessForDate("2026-08-10", 4, now)).toBe("stale");
  });
});
