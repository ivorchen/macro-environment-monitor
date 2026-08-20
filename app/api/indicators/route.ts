import { NextResponse } from "next/server";

import { loadIndicatorReadings } from "@/lib/data/load-readings";
import {
  createRedisDailyRequestGate,
  createRedisIndicatorCache,
} from "@/lib/data/redis-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cache = createRedisIndicatorCache();
  const fmpRequestGate = createRedisDailyRequestGate("fmp", 40);
  const payload = await loadIndicatorReadings({
    fredApiKey: process.env.FRED_API_KEY,
    blsApiKey: process.env.BLS_API_KEY,
    beaApiKey: process.env.BEA_API_KEY,
    censusApiKey: process.env.CENSUS_API_KEY,
    fmpApiKey: process.env.FMP_API_KEY,
    fmpRequestGate,
    cache,
  });
  const hasConfigurationError = payload.readings.some(
    (reading) => reading.errorCode === "configuration-required",
  );

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": hasConfigurationError
        ? "private, no-store"
        : "public, s-maxage=900, stale-while-revalidate=1800",
      "X-Data-Cache": `${payload.cache.backend}; hits=${payload.cache.hits.join(",") || "none"}; misses=${payload.cache.misses.join(",") || "none"}`,
    },
  });
}
