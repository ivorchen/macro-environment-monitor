import { NextRequest, NextResponse } from "next/server";

import { loadConfiguredSenateTrades } from "@/lib/data/senate-server";
import { isSenateWindow } from "@/lib/data/senate-trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ticker: string }> },
) {
  const requestedWindow = request.nextUrl.searchParams.get("window");
  const window = isSenateWindow(requestedWindow) ? requestedWindow : "90D";
  const ticker = (await context.params).ticker.trim().toUpperCase().replaceAll(".", "-");
  if (!/^[A-Z][A-Z0-9-]{0,9}$/.test(ticker)) {
    return NextResponse.json({ error: "Ticker format is invalid." }, { status: 400 });
  }
  const payload = await loadConfiguredSenateTrades(window);
  const transactions = payload.transactions.filter((transaction) => transaction.canonicalTicker === ticker);
  const aggregate = payload.bipartisan.find((item) => item.ticker === ticker)
    ?? Object.values(payload.popularByParty).flat().find((item) => item.ticker === ticker)
    ?? null;
  return NextResponse.json({
    generatedAt: payload.generatedAt,
    window: payload.window,
    windowStart: payload.windowStart,
    status: payload.status,
    freshness: payload.freshness,
    ruleVersion: payload.ruleVersion,
    ticker,
    aggregate,
    transactions,
    errorCode: payload.errorCode,
    errorMessage: payload.errorMessage,
  }, { headers: { "Cache-Control": "private, no-store", "X-Aggregation-Rule": payload.ruleVersion } });
}
