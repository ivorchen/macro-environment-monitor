import { NextResponse } from "next/server";

import {
  loadDailyMarketInsight,
  MarketInsightError,
} from "@/lib/data/market-insight";
import { createRedisDailyInsightStore } from "@/lib/data/redis-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await loadDailyMarketInsight({
      store: createRedisDailyInsightStore(),
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-AI-Insight-Cache": payload.cache.status,
      },
    });
  } catch (error) {
    const knownError = error instanceof MarketInsightError ? error : null;
    const status = knownError?.code === "configuration-required"
      ? 503
      : knownError?.code === "report-unavailable"
        ? 404
        : 500;
    return NextResponse.json(
      {
        error: knownError?.message ?? "The published daily market insight could not be loaded.",
        code: knownError?.code ?? "invalid-report",
      },
      {
        status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
