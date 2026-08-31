import { NextRequest, NextResponse } from "next/server";

import { loadNfciYtd } from "@/lib/data/nfci";
import { createRedisIndicatorCache } from "@/lib/data/redis-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const now = new Date();
  const requestedYear = Number(request.nextUrl.searchParams.get("year") ?? now.getUTCFullYear());
  if (!Number.isInteger(requestedYear) || requestedYear < 1971 || requestedYear > now.getUTCFullYear()) {
    return NextResponse.json(
      { error: "year must be between 1971 and the current UTC year." },
      { status: 400 },
    );
  }

  const payload = await loadNfciYtd({
    year: requestedYear,
    fredApiKey: process.env.FRED_API_KEY,
    cache: createRedisIndicatorCache(),
    now,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": payload.freshness === "unavailable"
        ? "private, no-store"
        : "public, s-maxage=21600, stale-while-revalidate=43200",
      "X-Data-Cache": `${payload.cache.backend}; status=${payload.cache.status}`,
    },
  });
}
