"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SectorViewResponse } from "@/lib/data/sector-view";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function signed(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function scoreColor(score: number | null) {
  if (score === null) return "#718096";
  if (score >= 60) return "#3dd6a0";
  if (score <= 40) return "#ff6b6b";
  return "#f2c14e";
}

export function SectorViewPanel() {
  const { t } = useI18n();
  const [payload, setPayload] = useState<SectorViewResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/sectors", { cache: "no-store" });
      if (!response.ok) throw new Error(`Sector view returned ${response.status}`);
      setPayload(await response.json() as SectorViewResponse);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <section className="sector-view">
      <div className="mb-8">
        <div>
          <p className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-primary">{t("sectors.eyebrow").toUpperCase()}</p>
          <h2 className="font-display text-4xl tracking-[-0.04em] sm:text-5xl">{t("sectors.title")}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t("sectors.description")}</p>
        </div>
      </div>

      {status === "loading" && !payload && (
        <div className="grid min-h-56 place-items-center rounded-xl border border-border bg-card">
          <LoaderCircle className="size-6 animate-spin text-primary" aria-label={t("sectors.loading")} />
        </div>
      )}
      {status === "error" && !payload && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">{t("sectors.error")}</div>
      )}

      {payload && (
        <>
          <div className="sector-summary mb-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
            {[
              [t("sectors.available"), payload.sectors.filter((item) => item.score !== null).length],
              [t("sectors.leaders"), payload.sectors.filter((item) => item.score !== null && item.score >= 60).length],
              [t("sectors.laggards"), payload.sectors.filter((item) => item.score !== null && item.score <= 40).length],
              [t("sectors.benchmark"), payload.benchmark],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-card p-4 text-card-foreground">
                <p className="text-[9px] font-bold tracking-[.14em] text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {payload.sectors.map((sector) => (
              <Card key={sector.id} className="sector-card border-border bg-card text-card-foreground shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] font-bold tracking-[.15em] text-muted-foreground">{sector.symbol}</p>
                      <h3 className="mt-1 text-base font-semibold">{sector.name}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-semibold tracking-[-.05em]" style={{ color: scoreColor(sector.score) }}>{sector.score ?? "—"}</p>
                      <Badge variant="outline" className="mt-1 border-border bg-transparent text-[9px] text-muted-foreground">
                        {sector.trend === "unavailable" ? t("common.unavailable") : t(`sectors.${sector.trend}` as MessageKey)}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-[width]" style={{ width: `${sector.score ?? 0}%`, backgroundColor: scoreColor(sector.score) }} />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-[10px]">
                    <div><p className="text-muted-foreground">{t("sectors.oneDay")}</p><p className={cn("mt-1 font-semibold", (sector.oneDayReturn ?? 0) >= 0 ? "text-[#3dd6a0]" : "text-[#ff7777]")}>{signed(sector.oneDayReturn)}</p></div>
                    <div><p className="text-muted-foreground">{t("sectors.twentyDay")}</p><p className={cn("mt-1 font-semibold", (sector.twentyDayReturn ?? 0) >= 0 ? "text-[#3dd6a0]" : "text-[#ff7777]")}>{signed(sector.twentyDayReturn)}</p></div>
                    <div><p className="text-muted-foreground">{t("sectors.relative")}</p><p className={cn("mt-1 flex items-center gap-1 font-semibold", (sector.relativeTwentyDayReturn ?? 0) >= 0 ? "text-[#3dd6a0]" : "text-[#ff7777]")}>{(sector.relativeTwentyDayReturn ?? 0) >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{signed(sector.relativeTwentyDayReturn)}</p></div>
                  </div>
                  <p className="mt-4 text-[9px] text-muted-foreground">RSI 14: {sector.rsi14 ?? "—"} · {t("sectors.volatility")}: {sector.annualizedVolatility20 === null ? "—" : `${sector.annualizedVolatility20}%`} · {sector.observationDate ?? t("common.noObservation")}</p>
                  {sector.errorMessage && <p className="mt-2 text-[9px] text-destructive">{sector.errorMessage}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-[10px] leading-5 text-muted-foreground">{t("sectors.methodology")}</p>
        </>
      )}
    </section>
  );
}
