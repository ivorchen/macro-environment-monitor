import { NextResponse } from "next/server";

import { createRedisIndicatorCache } from "@/lib/data/redis-cache";
import { loadSectorView } from "@/lib/data/sector-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await loadSectorView({ cache: createRedisIndicatorCache() });
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=21600",
      "X-Data-Cache": `${payload.cache.backend}; status=${payload.cache.status}`,
    },
  });
}
