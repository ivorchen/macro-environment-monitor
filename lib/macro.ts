export type Score = -2 | -1 | 0 | 1 | 2;
export type Trend = "Improving" | "Stable" | "Deteriorating";

export type Pillar = {
  id: string;
  area: string;
  priority: "Highest" | "High" | "Standard";
  score: Score;
  trend: Trend;
  question: string;
  change: string;
  indicators: string[];
};

export const INITIAL_PILLARS: Pillar[] = [
  {
    id: "liquidity",
    area: "Liquidity",
    priority: "Highest",
    score: 1,
    trend: "Improving",
    question: "Is net USD liquidity expanding or contracting?",
    change: "Dollar pressure eased while risk proxies remained constructive.",
    indicators: ["Fed balance sheet", "TGA", "ON RRP", "Bank reserves", "Broad USD", "Financial conditions"],
  },
  {
    id: "rates",
    area: "Fed / Rates",
    priority: "High",
    score: 0,
    trend: "Stable",
    question: "Are yields moving because of growth, inflation, or term premium?",
    change: "The curve was little changed; real yields remain the key constraint.",
    indicators: ["Fed funds path", "Sep Fed decision", "2Y yield", "10Y yield", "10Y real yield", "2s10s", "Term premium"],
  },
  {
    id: "inflation",
    area: "Inflation",
    priority: "High",
    score: 1,
    trend: "Improving",
    question: "Is inflation cooling enough to permit easier policy?",
    change: "Core inflation momentum moderated without a sharp growth break.",
    indicators: ["Core CPI", "Core PCE", "PPI", "Shelter", "Wages / ECI", "Breakevens"],
  },
  {
    id: "growth",
    area: "Growth",
    priority: "High",
    score: 0,
    trend: "Deteriorating",
    question: "Is activity accelerating, stable, or slowing?",
    change: "Survey data softened, while hard activity data stayed resilient.",
    indicators: ["GDP / nowcast", "ISM manufacturing", "ISM services", "Retail sales", "Industrial production", "Housing"],
  },
  {
    id: "labor",
    area: "Labor",
    priority: "Standard",
    score: 0,
    trend: "Deteriorating",
    question: "Is labor cooling gradually or deteriorating rapidly?",
    change: "Hiring cooled, but claims have not confirmed recessionary stress.",
    indicators: ["Payrolls", "Unemployment", "Jobless claims", "JOLTS", "Quits", "Temporary help"],
  },
  {
    id: "credit",
    area: "Credit",
    priority: "High",
    score: 1,
    trend: "Stable",
    question: "Are credit markets confirming the equity message?",
    change: "High-yield spreads remained contained as equities advanced.",
    indicators: ["HY spreads", "IG spreads", "Default outlook", "Lending standards", "Regional banks", "Funding stress"],
  },
  {
    id: "earnings",
    area: "Earnings",
    priority: "High",
    score: 1,
    trend: "Improving",
    question: "Is performance supported by earnings or multiple expansion?",
    change: "Forward EPS revisions improved, led by technology investment.",
    indicators: ["Forward EPS", "Revision breadth", "Revenue growth", "Forward P/E", "Equity risk premium", "FCF yield"],
  },
  {
    id: "breadth",
    area: "Breadth",
    priority: "High",
    score: -1,
    trend: "Deteriorating",
    question: "Is participation broadening or becoming more fragile?",
    change: "Equal-weight and small caps lagged the headline indexes.",
    indicators: ["Equal weight", "% above 200D", "Advance-decline", "New highs / lows", "Small vs large", "Cyclicals vs defensives"],
  },
  {
    id: "positioning",
    area: "Positioning",
    priority: "Standard",
    score: 1,
    trend: "Stable",
    question: "Is positioning an amplifier or a source of asymmetry?",
    change: "Volatility stayed orderly; sentiment is constructive but not euphoric.",
    indicators: ["VIX curve", "Put / call", "AAII", "Fund flows", "CTA positioning", "CFTC futures"],
  },
];

export const SCORE_OPTIONS: { value: Score; label: string }[] = [
  { value: 2, label: "Strongly supportive" },
  { value: 1, label: "Supportive" },
  { value: 0, label: "Neutral" },
  { value: -1, label: "Cautious" },
  { value: -2, label: "Hostile" },
];

export function totalScore(pillars: Pick<Pillar, "score">[]) {
  return pillars.reduce((sum, pillar) => sum + pillar.score, 0);
}

export function regimeFromScore(score: number) {
  if (score >= 9) return { label: "Strongly supportive", posture: "Risk-on", tone: "positive" as const };
  if (score >= 3) return { label: "Moderately supportive", posture: "Measured risk-on", tone: "positive" as const };
  if (score >= -2) return { label: "Neutral / mixed", posture: "Balanced", tone: "neutral" as const };
  if (score >= -8) return { label: "Hostile", posture: "Reduce risk", tone: "negative" as const };
  return { label: "Strongly hostile", posture: "Capital preservation", tone: "negative" as const };
}

export function scoreLabel(score: Score) {
  return SCORE_OPTIONS.find((option) => option.value === score)?.label ?? "Neutral";
}
