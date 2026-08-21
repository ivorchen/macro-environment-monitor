"use client";

import { useEffect, useState } from "react";
import { Activity, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MarketSnapshotResponse } from "@/lib/data/market-snapshot";
import { cn } from "@/lib/utils";

function formatObservation(value: string | null) {
  if (!value) return "No observation";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: value.length === 10 ? undefined : "numeric",
    minute: value.length === 10 ? undefined : "2-digit",
    timeZone: value.length === 10 ? "UTC" : "America/New_York",
    timeZoneName: value.length === 10 ? undefined : "short",
  }).format(date);
}

export function MarketSnapshotPanel() {
  const [payload, setPayload] = useState<MarketSnapshotResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/market-snapshot", { cache: "no-store" });
        if (!response.ok) throw new Error(`Market snapshot returned ${response.status}`);
        const nextPayload = (await response.json()) as MarketSnapshotResponse;
        if (active) {
          setPayload(nextPayload);
          setStatus("ready");
        }
      } catch {
        if (active) setStatus("error");
      }
    };

    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5 * 60 * 1_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section className="mt-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">
            CROSS-ASSET CONFIRMATION
          </p>
          <h3 className="font-display text-3xl">Market snapshot</h3>
        </div>
        <div className="flex items-center gap-2">
          {payload && (
            <span className="text-[9px] text-[#74817b]">
              Updated {formatObservation(payload.generatedAt)}
            </span>
          )}
          <Badge
            variant="outline"
            className="border-[#d4d9d3] bg-[#fbfaf6] text-[9px] text-[#6f7d78]"
          >
            LATEST AVAILABLE
          </Badge>
        </div>
      </div>

      {status === "loading" && !payload && (
        <div className="grid min-h-32 place-items-center rounded-2xl border border-[#d9ddd7] bg-[#fbfaf6]">
          <LoaderCircle className="size-5 animate-spin text-[#718079]" aria-label="Loading market snapshot" />
        </div>
      )}

      {status === "error" && !payload && (
        <Card className="border-[#e3beb7] bg-[#f6e7e3] shadow-none">
          <CardContent className="p-4 text-xs text-[#813d35]">
            The market snapshot could not be loaded. Check the Redis and provider connections.
          </CardContent>
        </Card>
      )}

      {payload && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {payload.markets.map((market) => (
            <Card key={market.id} className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[9px] font-bold text-[#718079]">
                    {market.symbol}
                  </span>
                  <Activity className="size-3.5 text-[#8b9892]" />
                </div>
                <p
                  className={cn(
                    "mb-0 mt-5 text-2xl font-semibold tracking-[-0.04em]",
                    market.status === "unavailable" && "text-base text-[#9a463c]",
                  )}
                >
                  {market.displayValue}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-[#74817b]">{market.name}</span>
                  <span
                    className={cn(
                      market.tone === "positive" && "text-[#1d6c50]",
                      market.tone === "negative" && "text-[#ae5548]",
                      market.tone === "neutral" && "text-[#7b6a45]",
                    )}
                  >
                    {market.displayMove}
                  </span>
                </div>
                <div className="mt-4 border-t border-[#e1e3df] pt-2 text-[8px] leading-4 text-[#87928d]">
                  <p>{market.provider} · {formatObservation(market.observationAt)}</p>
                  {market.errorMessage && <p className="mt-1 text-[#9a463c]">{market.errorMessage}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-2 text-[9px] leading-4 text-[#87928d]">
        FMP Basic supplies quota-protected SPX, VIX, gold, and Bitcoin quotes. FRED and Nasdaq
        observations are daily closes; Nasdaq supplies RSP and JNK without consuming the FMP
        allowance.
      </p>
    </section>
  );
}
