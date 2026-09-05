import type { DailyInsightStore } from "./cache";

export const MARKET_NEWS_LATEST_CACHE_KEY = "market-news:v1:latest";

export type MarketNewsItem = {
  id: string;
  source: string;
  headline: string;
  summary: string;
  publishedAt: string;
  url: string;
  category: string;
  translations: Record<"zh-CN" | "zh-TW", {
    headline: string;
    summary: string;
    category: string;
  }>;
  originatingReports: Array<{ id: string; name: string }>;
};

export type MarketNewsFeed = {
  generatedAt: string;
  items: MarketNewsItem[];
};

export type MarketNewsResponse = {
  feed: MarketNewsFeed;
  cache: { backend: "redis"; status: "hit" };
};

export class MarketNewsError extends Error {
  constructor(
    message: string,
    readonly code: "configuration-required" | "feed-unavailable" | "invalid-feed",
  ) {
    super(message);
    this.name = "MarketNewsError";
  }
}

function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new MarketNewsError(`The market-news feed has an invalid ${field}.`, "invalid-feed");
  }
  return value.trim();
}

export function validateMarketNewsFeed(value: unknown): MarketNewsFeed {
  if (!value || typeof value !== "object") {
    throw new MarketNewsError("The market-news feed is not an object.", "invalid-feed");
  }
  const feed = value as Record<string, unknown>;
  const generatedAt = text(feed.generatedAt, "generatedAt");
  if (Number.isNaN(Date.parse(generatedAt)) || !Array.isArray(feed.items)) {
    throw new MarketNewsError("The market-news feed has invalid metadata.", "invalid-feed");
  }

  const items = feed.items.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") {
      throw new MarketNewsError(`The market-news feed has an invalid items[${index}].`, "invalid-feed");
    }
    const item = candidate as Record<string, unknown>;
    const publishedAt = text(item.publishedAt, `items[${index}].publishedAt`);
    const url = text(item.url, `items[${index}].url`);
    if (Number.isNaN(Date.parse(publishedAt))) {
      throw new MarketNewsError(`The market-news feed has an invalid items[${index}].publishedAt.`, "invalid-feed");
    }
    try {
      if (new URL(url).protocol !== "https:") throw new Error();
    } catch {
      throw new MarketNewsError(`The market-news feed has an invalid items[${index}].url.`, "invalid-feed");
    }
    if (!Array.isArray(item.originatingReports) || item.originatingReports.length === 0) {
      throw new MarketNewsError(`The market-news feed has no origin for items[${index}].`, "invalid-feed");
    }
    return {
      id: text(item.id, `items[${index}].id`),
      source: text(item.source, `items[${index}].source`),
      headline: text(item.headline, `items[${index}].headline`),
      summary: text(item.summary, `items[${index}].summary`),
      publishedAt: new Date(publishedAt).toISOString(),
      url,
      category: text(item.category, `items[${index}].category`),
      translations: Object.fromEntries(["zh-CN", "zh-TW"].map((locale) => {
        const translations = item.translations as Record<string, unknown> | undefined;
        const localized = translations?.[locale];
        if (!localized || typeof localized !== "object") {
          throw new MarketNewsError(`The market-news feed has no ${locale} translation for items[${index}].`, "invalid-feed");
        }
        const record = localized as Record<string, unknown>;
        return [locale, {
          headline: text(record.headline, `items[${index}].translations.${locale}.headline`),
          summary: text(record.summary, `items[${index}].translations.${locale}.summary`),
          category: text(record.category, `items[${index}].translations.${locale}.category`),
        }];
      })) as MarketNewsItem["translations"],
      originatingReports: item.originatingReports.map((origin, originIndex) => {
        if (!origin || typeof origin !== "object") {
          throw new MarketNewsError(`The market-news feed has an invalid origin ${originIndex}.`, "invalid-feed");
        }
        const record = origin as Record<string, unknown>;
        return { id: text(record.id, "origin.id"), name: text(record.name, "origin.name") };
      }),
    };
  });

  return { generatedAt: new Date(generatedAt).toISOString(), items };
}

export async function loadMarketNews(options: { store?: DailyInsightStore }): Promise<MarketNewsResponse> {
  if (!options.store) {
    throw new MarketNewsError("REDIS_URL is required for market news.", "configuration-required");
  }
  const value = await options.store.get<unknown>(MARKET_NEWS_LATEST_CACHE_KEY);
  if (!value) {
    throw new MarketNewsError("No market-news feed has been published yet.", "feed-unavailable");
  }
  return { feed: validateMarketNewsFeed(value), cache: { backend: "redis", status: "hit" } };
}
