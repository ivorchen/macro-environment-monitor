import { describe, expect, it } from "vitest";

import type { IndicatorReading } from "./data/types";
import { INITIAL_PILLARS } from "./macro";
import {
  compareLatestReviews,
  createWeeklyReviewSnapshot,
  parseReviewHistory,
  reviewToMarkdown,
  updateReviewOutcome,
  type WeeklyReviewInput,
} from "./review-history";

const reading: IndicatorReading = {
  id: "rates-10y",
  pillarId: "rates",
  indicator: "10Y yield",
  provider: "Federal Reserve Bank of St. Louis (FRED)",
  providerShort: "FRED",
  value: 4.25,
  displayValue: "4.25%",
  unit: "Percent",
  transformation: "Latest reported level",
  observationDate: "2026-08-14",
  fetchedAt: "2026-08-18T12:00:00.000Z",
  freshness: "fresh",
  sourceUrl: "https://fred.stlouisfed.org/series/DGS10",
  seriesId: "DGS10",
};

function reviewInput(overrides: Partial<WeeklyReviewInput> = {}): WeeklyReviewInput {
  return {
    id: "review-1",
    reviewDate: "2026-08-16",
    savedAt: "2026-08-16T12:00:00.000Z",
    totalScore: 4,
    regimeLabel: "Moderately supportive",
    posture: "Measured risk-on",
    pillars: INITIAL_PILLARS.map((pillar) => ({ ...pillar, indicators: [...pillar.indicators] })),
    drivers: { growth: "Stable", inflation: "Cooling", liquidity: "Expanding" },
    portfolio: {
      increaseExposure: "Breadth improves",
      reduceRisk: "Credit widens",
      favoredSectors: "Technology",
      pressuredSectors: "Defensives",
      invalidation: "HY OAS above 350 bps",
    },
    observations: ["Real yields eased."],
    completedChecks: ["2Y and 10Y Treasury yields"],
    indicatorReadings: [reading],
    hypothesis: {
      claim: "Disinflation supports duration.",
      mechanism: "Lower real yields reduce the discount rate.",
      horizon: "1–3 months",
      confirmation: "Credit and breadth improve.",
      invalidation: "Real yields make a new high.",
    },
    ...overrides,
  };
}

describe("weekly review history", () => {
  it("creates a versioned snapshot without retaining mutable input arrays", () => {
    const input = reviewInput();
    const snapshot = createWeeklyReviewSnapshot(input);

    input.observations[0] = "Changed later";
    input.pillars[0].score = -2;

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.observations[0]).toBe("Real yields eased.");
    expect(snapshot.pillars[0].score).toBe(1);
    expect(snapshot.outcome.rating).toBeNull();
  });

  it("compares the latest saved review with the prior snapshot", () => {
    const previous = createWeeklyReviewSnapshot(reviewInput());
    const current = createWeeklyReviewSnapshot(reviewInput({
      id: "review-2",
      reviewDate: "2026-08-23",
      savedAt: "2026-08-23T12:00:00.000Z",
      totalScore: 6,
      pillars: INITIAL_PILLARS.map((pillar) =>
        pillar.id === "rates" ? { ...pillar, score: 1 } : { ...pillar },
      ),
      indicatorReadings: [{ ...reading, value: 4.1, displayValue: "4.10%" }],
    }));

    const comparison = compareLatestReviews([previous, current]);

    expect(comparison?.scoreDelta).toBe(2);
    expect(comparison?.pillarChanges).toEqual([
      expect.objectContaining({ id: "rates", previousScore: 0, currentScore: 1 }),
    ]);
    expect(comparison?.indicatorChanges[0]).toEqual(expect.objectContaining({
      previousDisplayValue: "4.25%",
      currentDisplayValue: "4.10%",
    }));
  });

  it("adds an outcome without rewriting the captured evidence", () => {
    const review = createWeeklyReviewSnapshot(reviewInput());
    const updated = updateReviewOutcome(
      [review],
      review.id,
      { rating: 2, note: "Credit confirmed the thesis." },
      "2026-11-16T12:00:00.000Z",
    )[0];

    expect(updated.outcome.rating).toBe(2);
    expect(updated.outcome.evaluatedAt).toBe("2026-11-16T12:00:00.000Z");
    expect(updated.indicatorReadings).toEqual(review.indicatorReadings);
    expect(review.outcome.rating).toBeNull();
  });

  it("parses valid snapshots and exports a traceable Markdown summary", () => {
    const review = createWeeklyReviewSnapshot(reviewInput());
    const parsed = parseReviewHistory(JSON.stringify([{ invalid: true }, review]));
    const markdown = reviewToMarkdown(parsed[0]);

    expect(parsed).toHaveLength(1);
    expect(markdown).toContain("# Weekly Macro Review — 2026-08-16");
    expect(markdown).toContain("Disinflation supports duration.");
    expect(markdown).toContain("| 10Y yield | 4.25% | 2026-08-14 | FRED | fresh |");
    expect(markdown).toContain("Later source revisions do not rewrite this snapshot.");
  });
});
