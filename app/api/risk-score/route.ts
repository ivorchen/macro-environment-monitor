import { NextResponse } from "next/server";

import { createRedisIndicatorCache } from "@/lib/data/redis-cache";
import { loadIndicatorReadings } from "@/lib/data/load-readings";
import { loadNfciYtd } from "@/lib/data/nfci";
import { calculateRiskScore } from "@/lib/risk-score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const cache = createRedisIndicatorCache();
  const [indicators, nfci] = await Promise.all([
    loadIndicatorReadings({
      fredApiKey: process.env.FRED_API_KEY,
      blsApiKey: process.env.BLS_API_KEY,
      beaApiKey: process.env.BEA_API_KEY,
      censusApiKey: process.env.CENSUS_API_KEY,
      cache,
      now,
    }),
    loadNfciYtd({ fredApiKey: process.env.FRED_API_KEY, cache, now }),
  ]);
  const payload = calculateRiskScore({ readings: indicators.readings, nfci, generatedAt: now.toISOString() });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      "X-Methodology-Version": payload.methodologyVersion,
    },
  });
}
