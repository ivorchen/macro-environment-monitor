import { NextRequest, NextResponse } from "next/server";

import { loadConfiguredSenateTrades } from "@/lib/data/senate-server";
import { isSenateWindow } from "@/lib/data/senate-trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedWindow = request.nextUrl.searchParams.get("window");
  const window = isSenateWindow(requestedWindow) ? requestedWindow : "90D";
  const payload = await loadConfiguredSenateTrades(window);
  const party = request.nextUrl.searchParams.get("party")?.toLowerCase();
  const owner = request.nextUrl.searchParams.get("owner")?.toLowerCase();
  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  const transactionType = request.nextUrl.searchParams.get("type")?.toLowerCase();
  const transactions = payload.transactions.filter((transaction) =>
    (!party || party === "all" || transaction.partyAtTrade.toLowerCase() === party)
    && (!owner || owner === "all" || transaction.owner.toLowerCase() === owner)
    && (!ticker || transaction.canonicalTicker?.includes(ticker))
    && (!transactionType || transactionType === "all" || transaction.transactionType.toLowerCase() === transactionType),
  );

  return NextResponse.json({ ...payload, transactions }, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Data-Cache": `${payload.cache.backend}; status=${payload.cache.status}`,
      "X-Aggregation-Rule": payload.ruleVersion,
    },
  });
}
