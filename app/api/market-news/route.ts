import { NextResponse } from "next/server";

import { loadMarketNews, MarketNewsError } from "@/lib/data/market-news";
import { createRedisDailyInsightStore } from "@/lib/data/redis-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await loadMarketNews({ store: createRedisDailyInsightStore() });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store", "X-Market-News-Cache": payload.cache.status },
    });
  } catch (error) {
    const known = error instanceof MarketNewsError ? error : null;
    const status = known?.code === "configuration-required" ? 503 : known?.code === "feed-unavailable" ? 404 : 500;
    return NextResponse.json(
      { error: known?.message ?? "The published market-news feed could not be loaded.", code: known?.code ?? "invalid-feed" },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
