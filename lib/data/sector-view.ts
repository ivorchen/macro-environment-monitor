import { fetchNasdaqEtfHistory, type NasdaqPrice } from "./adapters/nasdaq";
import { loadCachedProvider, type CacheResultStatus, type IndicatorDataCache } from "./cache";

export type SectorTrend = "leading" | "improving" | "mixed" | "weakening" | "lagging";

export type SectorViewItem = {
  id: string;
  symbol: string;
  name: string;
  score: number | null;
  trend: SectorTrend | "unavailable";
  oneDayReturn: number | null;
  fiveDayReturn: number | null;
  twentyDayReturn: number | null;
  relativeTwentyDayReturn: number | null;
  rsi14: number | null;
  annualizedVolatility20: number | null;
  observationDate: string | null;
  sourceUrl: string;
  errorMessage?: string;
};

export type SectorViewResponse = {
  generatedAt: string;
  methodologyVersion: "sector-etf-risk-v1";
  benchmark: "SPY";
  sectors: SectorViewItem[];
  cache: { backend: "redis" | "none"; status: CacheResultStatus };
};

const SECTORS = [
  ["technology", "XLK", "Technology"],
  ["communication", "XLC", "Communication Services"],
  ["consumer-discretionary", "XLY", "Consumer Discretionary"],
  ["financials", "XLF", "Financials"],
  ["industrials", "XLI", "Industrials"],
  ["energy", "XLE", "Energy"],
  ["materials", "XLB", "Materials"],
  ["real-estate", "XLRE", "Real Estate"],
  ["health-care", "XLV", "Health Care"],
  ["consumer-staples", "XLP", "Consumer Staples"],
  ["utilities", "XLU", "Utilities"],
] as const;

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const percentReturn = (latest: number, base: number) => ((latest / base) - 1) * 100;
const scaledReturn = (value: number) => clamp(50 + value * 4);

export function calculateRsi14(rows: readonly NasdaqPrice[]) {
  if (rows.length < 15) return null;
  const chronological = [...rows.slice(0, 15)].reverse();
  let gains = 0;
  let losses = 0;
  for (let index = 1; index < chronological.length; index += 1) {
    const change = chronological[index].close - chronological[index - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 95;
  const relativeStrength = (gains / 14) / (losses / 14);
  return round(clamp(100 - (100 / (1 + relativeStrength)), 5, 95), 1);
}

function realizedVolatility20(rows: readonly NasdaqPrice[]) {
  if (rows.length < 21) return null;
  const returns = rows.slice(0, 21).map((row, index, values) => index === values.length - 1 ? null : Math.log(row.close / values[index + 1].close)).filter((value): value is number => value !== null);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100, 1);
}

export function calculateSectorMetrics(rows: readonly NasdaqPrice[], benchmarkRows: readonly NasdaqPrice[]) {
  if (rows.length < 21 || benchmarkRows.length < 21) return null;
  const benchmarkByDate = new Map(benchmarkRows.map((row) => [row.date, row.close]));
  const common = rows.filter((row) => benchmarkByDate.has(row.date));
  if (common.length < 21) return null;
  const latest = common[0];
  const oneDayReturn = percentReturn(latest.close, common[1].close);
  const fiveDayReturn = percentReturn(latest.close, common[5].close);
  const twentyDayReturn = percentReturn(latest.close, common[20].close);
  const benchmarkReturn = percentReturn(benchmarkByDate.get(latest.date)!, benchmarkByDate.get(common[20].date)!);
  const relativeTwentyDayReturn = twentyDayReturn - benchmarkReturn;
  const rsi14 = calculateRsi14(rows);
  const annualizedVolatility20 = realizedVolatility20(rows);
  const momentumScore = scaledReturn((fiveDayReturn * 0.4) + (twentyDayReturn * 0.6));
  const relativeScore = scaledReturn(relativeTwentyDayReturn);
  const rsiScore = rsi14 ?? 50;
  const volatilityScore = annualizedVolatility20 === null ? 50 : clamp(90 - annualizedVolatility20 * 1.8);
  const score = round(momentumScore * 0.4 + relativeScore * 0.35 + rsiScore * 0.15 + volatilityScore * 0.1, 0);

  return {
    score,
    oneDayReturn: round(oneDayReturn),
    fiveDayReturn: round(fiveDayReturn),
    twentyDayReturn: round(twentyDayReturn),
    relativeTwentyDayReturn: round(relativeTwentyDayReturn),
    rsi14,
    annualizedVolatility20,
    observationDate: latest.date,
  };
}

function trendFromScore(score: number): SectorTrend {
  if (score >= 75) return "leading";
  if (score >= 60) return "improving";
  if (score >= 40) return "mixed";
  if (score >= 25) return "weakening";
  return "lagging";
}

export async function loadSectorView(options: {
  cache?: IndicatorDataCache;
  fetcher?: typeof fetch;
  now?: Date;
} = {}): Promise<SectorViewResponse> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;
  const result = await loadCachedProvider({
    cache: options.cache,
    cacheKey: "sector-view:v1",
    ttlSeconds: 6 * 60 * 60,
    loader: async () => {
      const benchmark = await fetchNasdaqEtfHistory("SPY", { fetcher, now });
      const sectors = await Promise.all(SECTORS.map(async ([id, symbol, name]): Promise<SectorViewItem> => {
        try {
          const rows = await fetchNasdaqEtfHistory(symbol, { fetcher, now });
          const metrics = calculateSectorMetrics(rows, benchmark);
          if (!metrics) throw new Error(`Nasdaq returned fewer than 21 common sessions for ${symbol}.`);
          return {
            id,
            symbol,
            name,
            ...metrics,
            trend: trendFromScore(metrics.score),
            sourceUrl: `https://www.nasdaq.com/market-activity/etf/${symbol.toLowerCase()}/historical`,
          };
        } catch (error) {
          return {
            id, symbol, name, score: null, trend: "unavailable",
            oneDayReturn: null, fiveDayReturn: null, twentyDayReturn: null,
            relativeTwentyDayReturn: null, rsi14: null, annualizedVolatility20: null,
            observationDate: null,
            sourceUrl: `https://www.nasdaq.com/market-activity/etf/${symbol.toLowerCase()}/historical`,
            errorMessage: error instanceof Error ? error.message : "Sector history failed.",
          };
        }
      }));
      return {
        generatedAt: now.toISOString(),
        methodologyVersion: "sector-etf-risk-v1" as const,
        benchmark: "SPY" as const,
        sectors: sectors.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
      };
    },
    shouldCache: (value) => value.sectors.some((sector) => sector.score !== null),
  });
  const namesById = new Map<string, string>(SECTORS.map(([id, , name]) => [id, name]));
  return {
    ...result.value,
    sectors: result.value.sectors.map((sector) => ({
      ...sector,
      name: namesById.get(sector.id) ?? sector.name,
    })),
    cache: { backend: options.cache?.backend ?? "none", status: result.status },
  };
}
