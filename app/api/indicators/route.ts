import { NextResponse } from "next/server";

import { loadIndicatorReadings } from "@/lib/data/load-readings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await loadIndicatorReadings({ fredApiKey: process.env.FRED_API_KEY });
  const hasConfigurationError = payload.readings.some(
    (reading) => reading.errorCode === "configuration-required",
  );

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": hasConfigurationError
        ? "private, no-store"
        : "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
