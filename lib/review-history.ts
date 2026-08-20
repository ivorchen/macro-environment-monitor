import type { IndicatorReading } from "./data/types";
import type { Pillar, Score, Trend } from "./macro";

export const REVIEW_HISTORY_STORAGE_KEY = "macro-monitor-history-v1";

export type OutcomeRating = -2 | -1 | 0 | 1 | 2 | null;

export type ReviewDrivers = {
  growth: string;
  inflation: string;
  liquidity: string;
};

export type ReviewPortfolio = {
  increaseExposure: string;
  reduceRisk: string;
  favoredSectors: string;
  pressuredSectors: string;
  invalidation: string;
};

export type HypothesisDraft = {
  claim: string;
  mechanism: string;
  horizon: string;
  confirmation: string;
  invalidation: string;
};

export type ReviewOutcome = {
  rating: OutcomeRating;
  note: string;
  evaluatedAt: string | null;
};

export type PillarSnapshot = {
  id: string;
  area: string;
  score: Score;
  trend: Trend;
  change: string;
};

export type WeeklyReviewSnapshot = {
  schemaVersion: 1;
  id: string;
  reviewDate: string;
  savedAt: string;
  totalScore: number;
  regimeLabel: string;
  posture: string;
  pillars: PillarSnapshot[];
  drivers: ReviewDrivers;
  portfolio: ReviewPortfolio;
  observations: string[];
  completedChecks: string[];
  indicatorReadings: IndicatorReading[];
  hypothesis: HypothesisDraft;
  outcome: ReviewOutcome;
};

export type WeeklyReviewInput = {
  id: string;
  reviewDate: string;
  savedAt: string;
  totalScore: number;
  regimeLabel: string;
  posture: string;
  pillars: Pillar[];
  drivers: ReviewDrivers;
  portfolio: ReviewPortfolio;
  observations: string[];
  completedChecks: string[];
  indicatorReadings: IndicatorReading[];
  hypothesis: HypothesisDraft;
};

export type ReviewComparison = {
  current: WeeklyReviewSnapshot;
  previous: WeeklyReviewSnapshot;
  scoreDelta: number;
  regimeChanged: boolean;
  pillarChanges: Array<{
    id: string;
    area: string;
    currentScore: Score;
    previousScore: Score;
    delta: number;
  }>;
  indicatorChanges: Array<{
    id: string;
    indicator: string;
    currentDisplayValue: string;
    previousDisplayValue: string;
  }>;
};

export function createWeeklyReviewSnapshot(input: WeeklyReviewInput): WeeklyReviewSnapshot {
  return {
    schemaVersion: 1,
    id: input.id,
    reviewDate: input.reviewDate,
    savedAt: input.savedAt,
    totalScore: input.totalScore,
    regimeLabel: input.regimeLabel,
    posture: input.posture,
    pillars: input.pillars.map(({ id, area, score, trend, change }) => ({
      id,
      area,
      score,
      trend,
      change,
    })),
    drivers: { ...input.drivers },
    portfolio: { ...input.portfolio },
    observations: [...input.observations],
    completedChecks: [...input.completedChecks],
    indicatorReadings: input.indicatorReadings.map((reading) => ({ ...reading })),
    hypothesis: { ...input.hypothesis },
    outcome: {
      rating: null,
      note: "",
      evaluatedAt: null,
    },
  };
}

export function sortReviewHistory(history: WeeklyReviewSnapshot[]) {
  return [...history].sort((a, b) => {
    const dateOrder = b.reviewDate.localeCompare(a.reviewDate);
    return dateOrder || b.savedAt.localeCompare(a.savedAt);
  });
}

export function compareLatestReviews(history: WeeklyReviewSnapshot[]): ReviewComparison | null {
  const [current, previous] = sortReviewHistory(history);
  if (!current || !previous) return null;

  const previousPillars = new Map(previous.pillars.map((pillar) => [pillar.id, pillar]));
  const pillarChanges = current.pillars.flatMap((pillar) => {
    const prior = previousPillars.get(pillar.id);
    if (!prior || prior.score === pillar.score) return [];
    return [{
      id: pillar.id,
      area: pillar.area,
      currentScore: pillar.score,
      previousScore: prior.score,
      delta: pillar.score - prior.score,
    }];
  });

  const previousReadings = new Map(previous.indicatorReadings.map((reading) => [reading.id, reading]));
  const indicatorChanges = current.indicatorReadings.flatMap((reading) => {
    const prior = previousReadings.get(reading.id);
    if (!prior || prior.value === reading.value) return [];
    return [{
      id: reading.id,
      indicator: reading.indicator,
      currentDisplayValue: reading.displayValue,
      previousDisplayValue: prior.displayValue,
    }];
  });

  return {
    current,
    previous,
    scoreDelta: current.totalScore - previous.totalScore,
    regimeChanged: current.regimeLabel !== previous.regimeLabel,
    pillarChanges,
    indicatorChanges,
  };
}

export function updateReviewOutcome(
  history: WeeklyReviewSnapshot[],
  id: string,
  outcome: Pick<ReviewOutcome, "rating" | "note">,
  evaluatedAt: string,
) {
  return history.map((review) =>
    review.id === id
      ? {
          ...review,
          outcome: {
            ...outcome,
            evaluatedAt: outcome.rating === null && !outcome.note.trim() ? null : evaluatedAt,
          },
        }
      : review,
  );
}

function isWeeklyReviewSnapshot(value: unknown): value is WeeklyReviewSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WeeklyReviewSnapshot>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.id === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.reviewDate ?? "") &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.totalScore === "number" &&
    Array.isArray(candidate.pillars) &&
    Array.isArray(candidate.indicatorReadings) &&
    typeof candidate.hypothesis === "object" &&
    typeof candidate.outcome === "object"
  );
}

export function parseReviewHistory(raw: string | null) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? sortReviewHistory(value.filter(isWeeklyReviewSnapshot))
      : [];
  } catch {
    return [];
  }
}

export function outcomeRatingLabel(rating: OutcomeRating) {
  switch (rating) {
    case 2:
      return "Confirmed";
    case 1:
      return "Mostly right";
    case 0:
      return "Mixed";
    case -1:
      return "Mostly wrong";
    case -2:
      return "Invalidated";
    default:
      return "Not reviewed";
  }
}

function tableCell(value: string | number) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function reviewToMarkdown(review: WeeklyReviewSnapshot, previous?: WeeklyReviewSnapshot) {
  const scoreDelta = previous ? review.totalScore - previous.totalScore : null;
  const deltaText = scoreDelta === null ? "First saved review" : `${scoreDelta >= 0 ? "+" : ""}${scoreDelta} vs ${previous?.reviewDate}`;
  const lines = [
    `# Weekly Macro Review — ${review.reviewDate}`,
    "",
    `- **Saved:** ${review.savedAt}`,
    `- **Regime:** ${review.regimeLabel} (${review.posture})`,
    `- **Score:** ${review.totalScore} / 18 (${deltaText})`,
    `- **Growth:** ${review.drivers.growth}`,
    `- **Inflation:** ${review.drivers.inflation}`,
    `- **Liquidity:** ${review.drivers.liquidity}`,
    "",
    "## Scorecard",
    "",
    "| Pillar | Score | Trend | What changed |",
    "| --- | ---: | --- | --- |",
    ...review.pillars.map((pillar) =>
      `| ${tableCell(pillar.area)} | ${pillar.score > 0 ? "+" : ""}${pillar.score} | ${tableCell(pillar.trend)} | ${tableCell(pillar.change)} |`,
    ),
    "",
    "## Decision journal",
    "",
    `- **Claim:** ${review.hypothesis.claim}`,
    `- **Mechanism:** ${review.hypothesis.mechanism}`,
    `- **Horizon:** ${review.hypothesis.horizon}`,
    `- **Confirmation:** ${review.hypothesis.confirmation}`,
    `- **Invalidation:** ${review.hypothesis.invalidation}`,
    `- **Outcome:** ${outcomeRatingLabel(review.outcome.rating)}`,
    `- **Outcome note:** ${review.outcome.note || "Not evaluated"}`,
    "",
    "## Portfolio conditions",
    "",
    `- **Increase exposure if:** ${review.portfolio.increaseExposure}`,
    `- **Reduce risk if:** ${review.portfolio.reduceRisk}`,
    `- **Sectors favored:** ${review.portfolio.favoredSectors}`,
    `- **Sectors under pressure:** ${review.portfolio.pressuredSectors}`,
    `- **Key invalidation:** ${review.portfolio.invalidation}`,
    "",
    "## Important changes",
    "",
    ...(review.observations.length
      ? review.observations.map((observation) => `- ${observation}`)
      : ["- No observations recorded."]),
    "",
    "## Authoritative readings captured at save time",
    "",
    "| Indicator | Value | Observation date | Source | Freshness |",
    "| --- | ---: | --- | --- | --- |",
    ...review.indicatorReadings.map((reading) =>
      `| ${tableCell(reading.indicator)} | ${tableCell(reading.displayValue)} | ${reading.observationDate ?? "Unavailable"} | ${tableCell(reading.providerShort)} | ${reading.freshness} |`,
    ),
    "",
    "> This export preserves the values retrieved when the review was saved. Later source revisions do not rewrite this snapshot.",
  ];

  return `${lines.join("\n")}\n`;
}
