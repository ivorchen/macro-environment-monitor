import type { DailyInsightStore } from "./cache";

export type MarketInsightContent = {
  brief: string;
  detailed: {
    headline: string;
    overview: string;
    keySignals: string[];
    risks: string[];
    watchNext: string[];
  };
};

export type DailyMarketInsight = MarketInsightContent & {
  reportDate: string;
  generatedAt: string;
  model: string;
  translations?: Partial<Record<"zh-CN" | "zh-TW", MarketInsightContent>>;
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

function validateContent(value: unknown, field = ""): MarketInsightContent {
  if (!value || typeof value !== "object") {
    throw new MarketInsightError(`The published report has invalid ${field || "content"}.`, "invalid-report");
  }
  const content = value as Record<string, unknown>;
  if (!content.detailed || typeof content.detailed !== "object") {
    throw new MarketInsightError(`The published report has no ${field ? `${field} ` : ""}detailed analysis.`, "invalid-report");
  }
  const detailed = content.detailed as Record<string, unknown>;
  const prefix = field ? `${field}.` : "";
  return {
    brief: requireText(content.brief, `${prefix}brief`),
    detailed: {
      headline: requireText(detailed.headline, `${prefix}detailed.headline`),
      overview: requireText(detailed.overview, `${prefix}detailed.overview`),
      keySignals: requireTextList(detailed.keySignals, `${prefix}detailed.keySignals`, 3),
      risks: requireTextList(detailed.risks, `${prefix}detailed.risks`, 2),
      watchNext: requireTextList(detailed.watchNext, `${prefix}detailed.watchNext`, 2),
    },
  };
}

function validatePublishedInsight(value: unknown): DailyMarketInsight {
  if (!value || typeof value !== "object") {
    throw new MarketInsightError("The published report is not an object.", "invalid-report");
  }
  const report = value as Record<string, unknown>;
  const content = validateContent(report);
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
    ...content,
    translations: report.translations && typeof report.translations === "object"
      ? Object.fromEntries(Object.entries(report.translations as Record<string, unknown>)
        .filter(([locale]) => locale === "zh-CN" || locale === "zh-TW")
        .map(([locale, localized]) => [locale, validateContent(localized, `translations.${locale}`)]))
      : undefined,
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
