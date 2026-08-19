"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Server,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IndicatorApiResponse, IndicatorReading } from "@/lib/data/types";
import { cn } from "@/lib/utils";

function freshnessClasses(reading: IndicatorReading) {
  if (reading.freshness === "fresh") return "border-[#a9c6b8] bg-[#e4efe8] text-[#155b43]";
  if (reading.freshness === "stale") return "border-[#dfcfaa] bg-[#f5ecd8] text-[#805c22]";
  return "border-[#e3beb7] bg-[#f6e7e3] text-[#9a463c]";
}

function freshnessLabel(reading: IndicatorReading) {
  if (reading.errorCode === "configuration-required") return "Key required";
  if (reading.freshness === "fresh") return "Fresh";
  if (reading.freshness === "stale") return "Stale";
  return "Unavailable";
}

function formatDate(value: string | null) {
  if (!value) return "No observation";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function SourceStatusPanel() {
  const [payload, setPayload] = useState<IndicatorApiResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  async function requestPayload(signal?: AbortSignal) {
    const response = await fetch("/api/indicators", { signal });
    if (!response.ok) throw new Error(`Indicator API returned ${response.status}`);
    return (await response.json()) as IndicatorApiResponse;
  }

  async function refresh() {
    setStatus("loading");
    try {
      setPayload(await requestPayload());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    requestPayload(controller.signal)
      .then((response) => {
        setPayload(response);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="mb-8" aria-labelledby="authoritative-snapshot-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">AUTHORITATIVE SOURCE PIPELINE</p>
          <h3 id="authoritative-snapshot-title" className="font-display text-3xl">Latest public readings</h3>
        </div>
        <div className="flex items-center gap-2">
          {payload && (
            <span className="hidden text-[10px] text-[#6f7d78] sm:inline">
              {payload.summary.fresh} fresh · {payload.summary.stale} stale · {payload.summary.unavailable} unavailable
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-[#fbfaf6] text-xs"
            onClick={() => void refresh()}
            disabled={status === "loading"}
          >
            <RefreshCw className={cn("size-3.5", status === "loading" && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {status === "error" && (
        <Card className="border-[#e3beb7] bg-[#f6e7e3] shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex gap-3 text-[#813d35]">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">The indicator service could not be reached.</p>
                <p className="mt-1 text-xs opacity-75">Manual scores remain available. Retry when the source connection recovers.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>Try again</Button>
          </CardContent>
        </Card>
      )}

      {status === "loading" && !payload && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Card key={index} className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
              <CardContent className="grid min-h-36 place-items-center p-5 text-[#86918c]">
                <LoaderCircle className="size-5 animate-spin" aria-label="Loading source" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {payload && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {payload.readings.map((reading) => (
            <Card key={reading.id} className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
              <CardHeader className="space-y-0 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-extrabold tracking-[0.13em] text-[#738079]">{reading.providerShort.toUpperCase()}</p>
                    <CardTitle className="mt-1.5 text-sm font-semibold">{reading.indicator}</CardTitle>
                  </div>
                  <Badge className={cn("border text-[8px] shadow-none", freshnessClasses(reading))}>
                    {freshnessLabel(reading)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className={cn("font-display text-3xl tracking-[-0.04em]", reading.freshness === "unavailable" && "text-lg text-[#8a5a51]")}>
                  {reading.displayValue}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#e1e3df] pt-3 text-[9px] text-[#74817b]">
                  <span className="flex items-center gap-1.5">
                    {reading.freshness === "fresh" ? <CheckCircle2 className="size-3" /> : reading.freshness === "stale" ? <Clock3 className="size-3" /> : <Server className="size-3" />}
                    {reading.errorCode === "configuration-required" ? "FRED_API_KEY" : formatDate(reading.observationDate)}
                  </span>
                  <a
                    href={reading.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#175f47] hover:underline"
                    aria-label={`Open source for ${reading.indicator}`}
                  >
                    Source <ExternalLink className="size-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-4 text-[#74817b]">
        Observation dates and retrieval freshness are shown separately. FRED readings require a server-side API key; manual scoring remains independent of source availability.
      </p>
    </section>
  );
}
