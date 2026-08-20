import { createReading, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type TreasuryResponse = {
  data?: Array<{
    record_date: string;
    account_type: string;
    open_today_bal: string;
  }>;
};

type TreasuryAuctionsResponse = {
  data?: Array<{
    auction_date?: string;
    offering_amt?: string;
    security_term?: string;
    security_type?: string;
  }>;
};

const TREASURY_ENDPOINT =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance";
const TREASURY_AUCTIONS_ENDPOINT =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query";

export async function fetchTreasuryReading(
  source: IndicatorSourceDefinition,
  options: AdapterOptions = {},
): Promise<IndicatorReading> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;

  try {
    const url = new URL(TREASURY_ENDPOINT);
    url.searchParams.set("fields", "record_date,account_type,open_today_bal");
    url.searchParams.set(
      "filter",
      "account_type:eq:Treasury General Account (TGA) Closing Balance",
    );
    url.searchParams.set("sort", "-record_date");
    url.searchParams.set("page[size]", "1");

    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) throw new Error(`Treasury Fiscal Data returned ${response.status}`);
    const payload = (await response.json()) as TreasuryResponse;
    const latest = payload.data?.[0];
    const value = Number(latest?.open_today_bal);

    if (!latest || !Number.isFinite(value)) {
      return unavailableReading(source, "missing-observation", "Treasury returned no TGA closing balance.", now);
    }

    return createReading(source, value, latest.record_date, now);
  } catch (error) {
    return unavailableReading(
      source,
      "source-failed",
      error instanceof Error ? error.message : "Treasury Fiscal Data request failed.",
      now,
    );
  }
}

export async function fetchTreasuryAuctionReading(
  source: IndicatorSourceDefinition,
  options: AdapterOptions = {},
): Promise<IndicatorReading> {
  const now = options.now ?? new Date();
  const fetcher = options.fetcher ?? fetch;

  try {
    const url = new URL(TREASURY_AUCTIONS_ENDPOINT);
    url.searchParams.set(
      "fields",
      "auction_date,security_type,security_term,offering_amt",
    );
    url.searchParams.set("filter", `auction_date:lte:${now.toISOString().slice(0, 10)}`);
    url.searchParams.set("sort", "-auction_date");
    url.searchParams.set("page[size]", "1");

    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Treasury Fiscal Data returned ${response.status}`);
    const payload = (await response.json()) as TreasuryAuctionsResponse;
    const latest = payload.data?.[0];
    const value = Number(latest?.offering_amt?.replaceAll(",", ""));

    if (!latest?.auction_date || !Number.isFinite(value)) {
      return unavailableReading(
        source,
        "missing-observation",
        "Treasury returned no completed auction offering amount.",
        now,
      );
    }

    return createReading(source, value, latest.auction_date, now);
  } catch (error) {
    return unavailableReading(
      source,
      "source-failed",
      error instanceof Error ? error.message : "Treasury auctions request failed.",
      now,
    );
  }
}

export async function fetchTreasuryReadings(
  sources: readonly IndicatorSourceDefinition[],
  options: AdapterOptions = {},
) {
  return Promise.all(
    sources.map((source) =>
      source.id === "liquidity-treasury-issuance"
        ? fetchTreasuryAuctionReading(source, options)
        : fetchTreasuryReading(source, options),
    ),
  );
}
