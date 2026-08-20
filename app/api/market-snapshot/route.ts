import { NextResponse } from "next/server";

import { loadMarketSnapshot } from "@/lib/data/market-snapshot";
import {
  createRedisDailyRequestGate,
  createRedisIndicatorCache,
} from "@/lib/data/redis-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await loadMarketSnapshot({
    fmpApiKey: process.env.FMP_API_KEY,
    fredApiKey: process.env.FRED_API_KEY,
    requestGate: createRedisDailyRequestGate("fmp", 40),
    cache: createRedisIndicatorCache(),
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Data-Cache": `${payload.cache.backend}; status=${payload.cache.status}`,
    },
  });
}
