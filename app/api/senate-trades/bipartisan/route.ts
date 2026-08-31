import { NextRequest, NextResponse } from "next/server";

import { loadConfiguredSenateTrades } from "@/lib/data/senate-server";
import { isSenateWindow } from "@/lib/data/senate-trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedWindow = request.nextUrl.searchParams.get("window");
  const window = isSenateWindow(requestedWindow) ? requestedWindow : "90D";
  const payload = await loadConfiguredSenateTrades(window);
  return NextResponse.json({
    generatedAt: payload.generatedAt,
    window: payload.window,
    windowStart: payload.windowStart,
    status: payload.status,
    freshness: payload.freshness,
    ruleVersion: payload.ruleVersion,
    bipartisan: payload.bipartisan,
    quality: payload.quality,
    errorCode: payload.errorCode,
    errorMessage: payload.errorMessage,
  }, { headers: { "Cache-Control": "private, no-store", "X-Aggregation-Rule": payload.ruleVersion } });
}
