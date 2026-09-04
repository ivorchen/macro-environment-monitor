import type { IndicatorReading } from "./data/types";
import type { NfciYtdResponse } from "./data/nfci";
import type { Pillar, Score, Trend } from "./macro";

export type RiskZone = "defensive" | "cautious" | "mixed" | "supportive" | "euphoric";

export type RiskScoreComponent = {
  id: "liquidity" | "rates" | "inflation" | "labor" | "credit" | "breadth";
  weight: number;
  score: number | null;
  contribution: number | null;
  observationDate: string | null;
  inputsUsed: number;
  inputsExpected: number;
  rationale: string;
};

export type RiskScoreResponse = {
  generatedAt: string;
  methodologyVersion: "macro-risk-v1";
  score: number | null;
  zone: RiskZone | "unavailable";
  coverage: number;
  components: RiskScoreComponent[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 0) => Number(value.toFixed(digits));

function linearScore(value: number, low: number, high: number, lowScore: number, highScore: number) {
  if (low === high) return lowScore;
  return clamp(lowScore + ((value - low) / (high - low)) * (highScore - lowScore));
}

function available(readings: readonly IndicatorReading[], id: string) {
  const reading = readings.find((item) => item.id === id);
  return reading?.value !== null && reading?.freshness !== "unavailable" ? reading : undefined;
}

function latestDate(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function component(options: {
  id: RiskScoreComponent["id"];
  weight: number;
  values: Array<number | undefined>;
  dates: Array<string | null | undefined>;
  expected: number;
  rationale: (score: number, used: number) => string;
}): RiskScoreComponent {
  const values = options.values.filter((value): value is number => Number.isFinite(value));
  const score = values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  return {
    id: options.id,
    weight: options.weight,
    score,
    contribution: null,
    observationDate: latestDate(options.dates),
    inputsUsed: values.length,
    inputsExpected: options.expected,
    rationale: score === null ? "No eligible current inputs were available." : options.rationale(score, values.length),
  };
}

export function riskZone(score: number): RiskZone {
  if (score <= 20) return "defensive";
  if (score <= 40) return "cautious";
  if (score <= 60) return "mixed";
  if (score <= 80) return "supportive";
  return "euphoric";
}

export function calculateRiskScore(options: {
  readings: readonly IndicatorReading[];
  nfci?: NfciYtdResponse;
  generatedAt?: string;
}): RiskScoreResponse {
  const { readings } = options;
  const twoYear = available(readings, "rates-2y");
  const tenYear = available(readings, "rates-10y");
  const realYield = available(readings, "rates-real-10y");
  const coreCpi = available(readings, "inflation-core-cpi");
  const corePce = available(readings, "inflation-core-pce");
  const payrolls = available(readings, "labor-payrolls");
  const unemployment = available(readings, "labor-unemployment");
  const highYield = available(readings, "credit-hy-spreads");
  const regionalBanks = available(readings, "credit-regional-banks");
  const equalWeight = available(readings, "breadth-equal-weight");
  const smallLarge = available(readings, "breadth-small-large");
  const cyclicals = available(readings, "breadth-cyclicals-defensives");
  const nfci = options.nfci?.freshness !== "unavailable" ? options.nfci?.statistics : null;

  const components: RiskScoreComponent[] = [
    component({
      id: "liquidity",
      weight: 20,
      values: [
        nfci ? linearScore(nfci.latest.value, -0.8, 0.8, 92, 8) : undefined,
        nfci?.fourWeekChange === null || nfci?.fourWeekChange === undefined
          ? undefined
          : linearScore(nfci.fourWeekChange, -0.12, 0.12, 85, 15),
      ],
      dates: [options.nfci?.observationDate],
      expected: 2,
      rationale: (score) => score >= 60 ? "Financial conditions are loose or becoming easier." : score <= 40 ? "Financial conditions are tight or tightening." : "Financial conditions are close to neutral.",
    }),
    component({
      id: "rates",
      weight: 20,
      values: [
        realYield ? linearScore(realYield.value!, 0, 3, 88, 12) : undefined,
        twoYear && tenYear ? linearScore(tenYear.value! - twoYear.value!, -0.75, 1.25, 20, 82) : undefined,
      ],
      dates: [realYield?.observationDate, twoYear?.observationDate, tenYear?.observationDate],
      expected: 2,
      rationale: (score) => score >= 60 ? "Real yields and the curve are comparatively supportive." : score <= 40 ? "Real yields or curve structure remain restrictive." : "Rates send a balanced signal.",
    }),
    component({
      id: "inflation",
      weight: 15,
      values: [
        coreCpi ? linearScore(coreCpi.value!, 2, 4.5, 82, 12) : undefined,
        corePce ? linearScore(corePce.value!, 2, 4.5, 82, 12) : undefined,
      ],
      dates: [coreCpi?.observationDate, corePce?.observationDate],
      expected: 2,
      rationale: (score, used) => score >= 60 ? `${used} core inflation reading${used === 1 ? " is" : "s are"} near a supportive range.` : score <= 40 ? "Core inflation remains materially above a risk-supportive range." : "Inflation is moderating but not fully benign.",
    }),
    component({
      id: "labor",
      weight: 15,
      values: [
        payrolls ? linearScore(payrolls.value!, -100, 250, 10, 88) : undefined,
        unemployment ? linearScore(unemployment.value!, 3.4, 5.2, 82, 18) : undefined,
      ],
      dates: [payrolls?.observationDate, unemployment?.observationDate],
      expected: 2,
      rationale: (score) => score >= 60 ? "Employment growth and unemployment remain supportive." : score <= 40 ? "Labor readings point to meaningful downside risk." : "Labor is cooling without a decisive signal.",
    }),
    component({
      id: "credit",
      weight: 15,
      values: [
        highYield ? linearScore(highYield.value!, 2.5, 8, 88, 5) : undefined,
        regionalBanks ? linearScore(regionalBanks.value!, -10, 10, 12, 88) : undefined,
      ],
      dates: [highYield?.observationDate, regionalBanks?.observationDate],
      expected: 2,
      rationale: (score) => score >= 60 ? "Credit spreads and regional banks are confirming risk appetite." : score <= 40 ? "Credit or regional-bank performance signals stress." : "Tight spreads are offset by mixed bank performance.",
    }),
    component({
      id: "breadth",
      weight: 15,
      values: [equalWeight, smallLarge, cyclicals].map((reading) => reading ? linearScore(reading.value!, -10, 10, 10, 90) : undefined),
      dates: [equalWeight?.observationDate, smallLarge?.observationDate, cyclicals?.observationDate],
      expected: 3,
      rationale: (score) => score >= 60 ? "Equal weight, small caps, and cyclicals show broad participation." : score <= 40 ? "Participation is narrow across breadth proxies." : "Breadth is mixed across market segments.",
    }),
  ];

  const availableWeight = components.reduce((sum, item) => sum + (item.score === null ? 0 : item.weight), 0);
  const expectedInputs = components.reduce((sum, item) => sum + item.inputsExpected, 0);
  const usedInputs = components.reduce((sum, item) => sum + item.inputsUsed, 0);
  const score = availableWeight
    ? round(components.reduce((sum, item) => sum + (item.score === null ? 0 : item.score * item.weight), 0) / availableWeight)
    : null;
  const normalizedComponents = components.map((item) => ({
    ...item,
    contribution: item.score === null || !availableWeight ? null : round(item.score * item.weight / availableWeight, 1),
  }));

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    methodologyVersion: "macro-risk-v1",
    score,
    zone: score === null ? "unavailable" : riskZone(score),
    coverage: round((usedInputs / expectedInputs) * 100),
    components: normalizedComponents,
  };
}

export function componentScoreToPillarScore(score: number | null): Score {
  if (score === null) return 0;
  if (score >= 80) return 2;
  if (score >= 60) return 1;
  if (score >= 40) return 0;
  if (score >= 20) return -1;
  return -2;
}

export function applyRiskScoreToPillars(pillars: readonly Pillar[], components: readonly RiskScoreComponent[]): Pillar[] {
  const scores = new Map(components.map((item) => [item.id, item]));
  return pillars.map((pillar) => {
    const component = scores.get(pillar.id as RiskScoreComponent["id"]);
    if (!component) return { ...pillar, score: 0, trend: "Stable", change: "No automated scoring rule is configured for this pillar yet." };
    const score = componentScoreToPillarScore(component.score);
    const trend: Trend = score > 0 ? "Improving" : score < 0 ? "Deteriorating" : "Stable";
    return { ...pillar, score, trend, change: component.rationale };
  });
}
