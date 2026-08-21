import type { DailyInsightStore } from "./cache";

export type DailyMarketInsight = {
  reportDate: string;
  generatedAt: string;
  model: string;
  brief: string;
  detailed: {
    headline: string;
    overview: string;
    keySignals: string[];
    risks: string[];
    watchNext: string[];
  };
};

export type DailyMarketInsightResponse = {
  insight: DailyMarketInsight;
  cache: {
    backend: "redis";
    status: "hit" | "previous-day";
  };
};

export class MarketInsightError extends Error {
  constructor(
    message: string,
    readonly code: "configuration-required" | "report-unavailable" | "invalid-report",
  ) {
    super(message);
    this.name = "MarketInsightError";
  }
}

function reportDateInNewYork(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function marketInsightCacheKey(now: Date) {
  return `ai-market-insight:v1:${reportDateInNewYork(now)}`;
}

export const MARKET_INSIGHT_LATEST_CACHE_KEY = "ai-market-insight:v1:latest";

function requireText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new MarketInsightError(`The published report has an invalid ${field}.`, "invalid-report");
  }
  return value.trim();
}

function requireTextList(value: unknown, field: string, minimum: number) {
  if (!Array.isArray(value) || value.length < minimum) {
    throw new MarketInsightError(`The published report has an invalid ${field}.`, "invalid-report");
  }
  return value.map((item, index) => requireText(item, `${field}[${index}]`));
}

function validatePublishedInsight(value: unknown): DailyMarketInsight {
  if (!value || typeof value !== "object") {
    throw new MarketInsightError("The published report is not an object.", "invalid-report");
  }
  const report = value as Record<string, unknown>;
  if (!report.detailed || typeof report.detailed !== "object") {
    throw new MarketInsightError("The published report has no detailed analysis.", "invalid-report");
  }
  const detailed = report.detailed as Record<string, unknown>;
  const reportDate = requireText(report.reportDate, "reportDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new MarketInsightError("The published report has an invalid reportDate.", "invalid-report");
  }
  const generatedAt = requireText(report.generatedAt, "generatedAt");
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new MarketInsightError("The published report has an invalid generatedAt.", "invalid-report");
  }

  return {
    reportDate,
    generatedAt,
    model: requireText(report.model, "model"),
    brief: requireText(report.brief, "brief"),
    detailed: {
      headline: requireText(detailed.headline, "detailed.headline"),
      overview: requireText(detailed.overview, "detailed.overview"),
      keySignals: requireTextList(detailed.keySignals, "detailed.keySignals", 3),
      risks: requireTextList(detailed.risks, "detailed.risks", 2),
      watchNext: requireTextList(detailed.watchNext, "detailed.watchNext", 2),
    },
  };
}

export async function loadDailyMarketInsight(options: {
  store?: DailyInsightStore;
  now?: Date;
}): Promise<DailyMarketInsightResponse> {
  if (!options.store) {
    throw new MarketInsightError(
      "REDIS_URL is required for daily AI market insights.",
      "configuration-required",
    );
  }

  const current = await options.store.get<unknown>(marketInsightCacheKey(options.now ?? new Date()));
  if (current) {
    return {
      insight: validatePublishedInsight(current),
      cache: { backend: "redis", status: "hit" },
    };
  }

  const latest = await options.store.get<unknown>(MARKET_INSIGHT_LATEST_CACHE_KEY);
  if (latest) {
    return {
      insight: validatePublishedInsight(latest),
      cache: { backend: "redis", status: "previous-day" },
    };
  }

  throw new MarketInsightError(
    "No market insight has been published yet. Run the daily insight task or pnpm insight:publish.",
    "report-unavailable",
  );
}
