import { createReading, unavailableReading } from "../freshness";
import type { AdapterOptions, IndicatorReading, IndicatorSourceDefinition } from "../types";

type TreasuryResponse = {
  data?: Array<{
    record_date: string;
    account_type: string;
    open_today_bal: string;
  }>;
};

const TREASURY_ENDPOINT =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance";

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
