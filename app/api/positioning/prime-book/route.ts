import { NextRequest, NextResponse } from "next/server";

import { loadPrimeBook } from "@/lib/data/prime-book-server";
import { PRIME_BOOK_RANGES, type PrimeBookRange } from "@/lib/data/prime-book";
import { createRedisIndicatorCache } from "@/lib/data/redis-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedRange = request.nextUrl.searchParams.get("range") ?? "3M";
  if (!PRIME_BOOK_RANGES.includes(requestedRange as PrimeBookRange)) {
    return NextResponse.json({ error: `range must be one of ${PRIME_BOOK_RANGES.join(", ")}.` }, { status: 400 });
  }
  const provider = request.nextUrl.searchParams.get("provider")?.trim() || undefined;
  const payload = await loadPrimeBook({
    range: requestedRange as PrimeBookRange,
    provider,
    cache: createRedisIndicatorCache(),
  });
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": payload.freshness === "unavailable" ? "private, no-store" : "private, max-age=300",
    },
  });
}
