"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Landmark, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SenateTradesResponse } from "@/lib/data/senate-trades";

export function SenateWeeklySummary() {
  const [payload, setPayload] = useState<SenateTradesResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/senate-trades?window=90D", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Senate summary failed.");
        return response.json() as Promise<SenateTradesResponse>;
      })
      .then((nextPayload) => {
        if (active) setPayload(nextPayload);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="mb-4 border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <p className="mb-2 text-[9px] font-extrabold tracking-[.18em] text-[#6f7d78]">DESCRIPTIVE CONTEXT · 90-DAY TRANSACTION WINDOW</p>
          <CardTitle className="font-display text-2xl">Senate disclosure watch</CardTitle>
        </div>
        <Landmark className="size-5 text-[#6f7d78]" />
      </CardHeader>
      <CardContent>
        {!payload && !failed && <LoaderCircle className="size-4 animate-spin text-[#718079]" aria-label="Loading Senate summary" />}
        {(failed || payload?.status === "unavailable") && (
          <p className="flex items-center gap-2 text-xs text-[#955147]"><AlertTriangle className="size-4" /> {payload?.errorMessage ?? "Senate disclosure context could not be loaded."}</p>
        )}
        {payload && payload.status !== "unavailable" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-[9px] font-bold tracking-[.12em] text-[#74817b]">TOP BIPARTISAN BUYS</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {payload.bipartisan.slice(0, 5).map((item) => <Badge key={item.ticker} variant="outline">{item.ticker} · D{item.democraticBuyers}/R{item.republicanBuyers}</Badge>)}
                {!payload.bipartisan.length && <span className="text-xs text-[#74817b]">None in the selected window.</span>}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-[.12em] text-[#74817b]">PARTY LEADERS</p>
              <p className="mt-2 text-xs leading-5">Democratic: {payload.popularByParty.Democratic[0]?.ticker ?? "None"}</p>
              <p className="text-xs leading-5">Republican: {payload.popularByParty.Republican[0]?.ticker ?? "None"}</p>
              <p className="text-xs leading-5">Independent/Other: {payload.popularByParty["Independent/Other"][0]?.ticker ?? "None"}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-[.12em] text-[#74817b]">FILING LAG</p>
              <p className="mt-2 font-display text-2xl">{payload.overview.medianDisclosureLagDays ?? "—"} days</p>
              <p className="mt-1 text-[10px] leading-4 text-[#74817b]">Median among eligible purchases. Ownership and amount ranges remain visible in the Senate tab.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
