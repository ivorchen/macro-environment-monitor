"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Landmark, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SenateTradesResponse } from "@/lib/data/senate-trades";
import { useI18n } from "@/lib/i18n";

export function SenateWeeklySummary() {
  const { t } = useI18n();
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
          <p className="mb-2 text-[9px] font-extrabold tracking-[.18em] text-[#6f7d78]">{t("senate.summaryEyebrow").toUpperCase()}</p>
          <CardTitle className="font-display text-2xl">{t("senate.summaryTitle")}</CardTitle>
        </div>
        <Landmark className="size-5 text-[#6f7d78]" />
      </CardHeader>
      <CardContent>
        {!payload && !failed && <LoaderCircle className="size-4 animate-spin text-[#718079]" aria-label={t("senate.summaryLoading")} />}
        {(failed || payload?.status === "unavailable") && (
          <p className="flex items-center gap-2 text-xs text-[#955147]"><AlertTriangle className="size-4" /> {payload?.errorMessage ?? t("senate.summaryError")}</p>
        )}
        {payload && payload.status !== "unavailable" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-[9px] font-bold tracking-[.12em] text-[#74817b]">{t("senate.topBipartisan").toUpperCase()}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {payload.bipartisan.slice(0, 5).map((item) => <Badge key={item.ticker} variant="outline">{item.ticker} · D{item.democraticBuyers}/R{item.republicanBuyers}</Badge>)}
                {!payload.bipartisan.length && <span className="text-xs text-[#74817b]">{t("senate.noneWindow")}</span>}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-[.12em] text-[#74817b]">{t("senate.partyLeaders").toUpperCase()}</p>
              <p className="mt-2 text-xs leading-5">{t("senate.democratic")}: {payload.popularByParty.Democratic[0]?.ticker ?? t("senate.none")}</p>
              <p className="text-xs leading-5">{t("senate.republican")}: {payload.popularByParty.Republican[0]?.ticker ?? t("senate.none")}</p>
              <p className="text-xs leading-5">{t("senate.independent")}: {payload.popularByParty["Independent/Other"][0]?.ticker ?? t("senate.none")}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-[.12em] text-[#74817b]">{t("senate.filingLag").toUpperCase()}</p>
              <p className="mt-2 font-display text-2xl">{payload.overview.medianDisclosureLagDays === null ? "—" : t("senate.daysValue", { count: payload.overview.medianDisclosureLagDays })}</p>
              <p className="mt-1 text-[10px] leading-4 text-[#74817b]">{t("senate.summaryLagHelp")}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
