import { describe, expect, it } from "vitest";

import { INITIAL_PILLARS } from "../macro";
import { INDICATOR_SOURCE_REGISTRY, sourceForIndicator } from "./source-registry";

describe("indicator source registry", () => {
  it("maps every indicator shown in the MVP", () => {
    const displayedIndicators = INITIAL_PILLARS.flatMap((pillar) =>
      pillar.indicators.map((indicator) => ({ pillarId: pillar.id, indicator })),
    );

    expect(INDICATOR_SOURCE_REGISTRY.length).toBeGreaterThanOrEqual(displayedIndicators.length);
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
    expect(
      licensed.every(
        (source) =>
          (source.integration === "licensed" && source.adapter === null) ||
          source.integration === "licensed" && source.adapter === null,
      ),
    ).toBe(true);
  });

  it("activates every provider required to close Phase 3", () => {
    expect(INDICATOR_SOURCE_REGISTRY.some((source) => source.adapter === "bea")).toBe(true);
    expect(INDICATOR_SOURCE_REGISTRY.some((source) => source.adapter === "census")).toBe(true);
    expect(
      INDICATOR_SOURCE_REGISTRY.some(
        (source) => source.id === "liquidity-treasury-issuance" && source.adapter === "treasury",
      ),
    ).toBe(true);
    expect(INDICATOR_SOURCE_REGISTRY.filter((source) => source.adapter === "nasdaq")).toHaveLength(4);
    expect(INDICATOR_SOURCE_REGISTRY.filter((source) => source.adapter === "polymarket")).toHaveLength(1);
  });
});
