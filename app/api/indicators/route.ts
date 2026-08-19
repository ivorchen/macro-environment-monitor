import { NextResponse } from "next/server";

import { loadIndicatorReadings } from "@/lib/data/load-readings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await loadIndicatorReadings({ fredApiKey: process.env.FRED_API_KEY });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
