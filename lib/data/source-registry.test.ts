import { describe, expect, it } from "vitest";

import { INITIAL_PILLARS } from "../macro";
import { INDICATOR_SOURCE_REGISTRY, sourceForIndicator } from "./source-registry";

describe("indicator source registry", () => {
  it("maps every indicator shown in the MVP", () => {
    const displayedIndicators = INITIAL_PILLARS.flatMap((pillar) =>
      pillar.indicators.map((indicator) => ({ pillarId: pillar.id, indicator })),
    );

    expect(INDICATOR_SOURCE_REGISTRY).toHaveLength(displayedIndicators.length);
    for (const displayed of displayedIndicators) {
      expect(sourceForIndicator(displayed.pillarId, displayed.indicator)).toBeDefined();
    }
  });

  it("documents provenance, freshness, and revision behavior for every source", () => {
    for (const source of INDICATOR_SOURCE_REGISTRY) {
      expect(source.sourceUrl).toMatch(/^https:\/\//);
      expect(source.staleAfterDays).toBeGreaterThan(0);
      expect(source.revisionPolicy.length).toBeGreaterThan(20);
      expect(source.transformation.length).toBeGreaterThan(3);
    }
  });

  it("keeps proprietary requirements isolated", () => {
    const licensed = INDICATOR_SOURCE_REGISTRY.filter(
      (source) => source.classification === "licensed-market-data",
    );

    expect(licensed.length).toBeGreaterThan(0);
    expect(licensed.every((source) => source.integration === "licensed")).toBe(true);
    expect(licensed.every((source) => source.adapter === null)).toBe(true);
  });
});
