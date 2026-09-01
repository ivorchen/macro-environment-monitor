import { freshnessForDate, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type RawMarket = {
  groupItemTitle?: unknown;
  outcomes?: unknown;
  outcomePrices?: unknown;
  updatedAt?: unknown;
};

type RawEvent = {
  slug?: unknown;
  updatedAt?: unknown;
  markets?: unknown;
};

type Direction = "cut" | "hold" | "hike";

function parsedStringArray(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function directionForTitle(value: unknown): Direction | null {
  if (typeof value !== "string") return null;
  const title = value.toLowerCase();
  if (title.includes("decrease")) return "cut";
  if (title.includes("no change")) return "hold";
  if (title.includes("increase")) return "hike";
  return null;
}

function yesPrice(market: RawMarket) {
  const outcomes = parsedStringArray(market.outcomes);
  const prices = parsedStringArray(market.outcomePrices);
  const yesIndex = outcomes?.findIndex((outcome) => outcome.toLowerCase() === "yes") ?? -1;
  if (!prices || yesIndex < 0) return null;
  const price = Number(prices[yesIndex]);
  return Number.isFinite(price) && price >= 0 && price <= 1 ? price : null;
}

function isoDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export async function fetchPolymarketReading(
  source: IndicatorSourceDefinition,
  options: AdapterOptions = {},
): Promise<IndicatorReading> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;

  try {
    const url = new URL("https://gamma-api.polymarket.com/events");
    url.searchParams.set("slug", source.seriesId ?? "");
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Polymarket Gamma API returned ${response.status}.`);

    const payload = await response.json() as unknown;
    const event = Array.isArray(payload) ? payload[0] as RawEvent | undefined : undefined;
    if (!event || event.slug !== source.seriesId || !Array.isArray(event.markets)) {
      return unavailableReading(source, "missing-observation", "The Polymarket event was not found.", now);
    }

    const totals: Record<Direction, number> = { cut: 0, hold: 0, hike: 0 };
    const observationDates: string[] = [];
    for (const raw of event.markets) {
      if (!raw || typeof raw !== "object") continue;
      const market = raw as RawMarket;
      const direction = directionForTitle(market.groupItemTitle);
      const price = yesPrice(market);
      if (!direction || price === null) continue;
      totals[direction] += price;
      const updatedDate = isoDate(market.updatedAt);
      if (updatedDate) observationDates.push(updatedDate);
    }

    const total = totals.cut + totals.hold + totals.hike;
    if (!(total > 0)) {
      return unavailableReading(source, "missing-observation", "The Polymarket event contained no valid outcome prices.", now);
    }

    const normalized = {
      cut: totals.cut / total * 100,
      hold: totals.hold / total * 100,
      hike: totals.hike / total * 100,
    };
    const leading = (Object.entries(normalized) as Array<[Direction, number]>)
      .sort((a, b) => b[1] - a[1])[0];
    const observationDate = observationDates.sort().at(-1) ?? isoDate(event.updatedAt);
    if (!leading || !observationDate) {
      return unavailableReading(source, "missing-observation", "The Polymarket event had no dated probability observation.", now);
    }

    const directionLabel: Record<Direction, string> = { cut: "Cut", hold: "Hold", hike: "Hike" };
    return {
      id: source.id,
      pillarId: source.pillarId,
      indicator: source.indicator,
      provider: source.provider,
      providerShort: source.providerShort,
      value: leading[1],
      displayValue: `${directionLabel[leading[0]]} ${leading[1].toFixed(1)}%`,
      unit: source.unit,
      transformation: `Normalized distribution: cut ${normalized.cut.toFixed(1)}%, hold ${normalized.hold.toFixed(1)}%, hike ${normalized.hike.toFixed(1)}%`,
      observationDate,
      fetchedAt: now.toISOString(),
      freshness: freshnessForDate(observationDate, source.staleAfterDays, now),
      sourceUrl: source.sourceUrl,
      seriesId: source.seriesId,
    };
  } catch (error) {
    return unavailableReading(
      source,
      "source-failed",
      error instanceof Error ? error.message : "Polymarket event retrieval failed.",
      now,
    );
  }
}

export async function fetchPolymarketReadings(
  sources: readonly IndicatorSourceDefinition[],
  options: AdapterOptions = {},
) {
  return Promise.all(sources.map((source) => fetchPolymarketReading(source, options)));
}
