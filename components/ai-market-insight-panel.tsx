"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LoaderCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyMarketInsightResponse } from "@/lib/data/market-insight";

type InsightStatus = "loading" | "ready" | "error";

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h4 className="mb-3 text-[10px] font-extrabold tracking-[0.18em] text-[#60726a]">
        {title.toUpperCase()}
      </h4>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li className="grid grid-cols-[8px_1fr] gap-3 text-sm leading-6 text-[#34443d]" key={item}>
            <span className="mt-2 size-1.5 rounded-full bg-[#76a15d]" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AiMarketInsightPanel() {
  const [payload, setPayload] = useState<DailyMarketInsightResponse | null>(null);
  const [status, setStatus] = useState<InsightStatus>("loading");
  const [error, setError] = useState("The daily insight could not be loaded.");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/market-insight", { cache: "no-store" });
        const body = await response.json() as DailyMarketInsightResponse | { error?: string };
        if (!response.ok) {
          throw new Error("error" in body && body.error ? body.error : `Market insight returned ${response.status}.`);
        }
        if (active) {
          setPayload(body as DailyMarketInsightResponse);
          setStatus("ready");
        }
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "The daily insight could not be loaded.");
          setStatus("error");
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const insight = payload?.insight;

  return (
    <Card className="flex min-h-[300px] flex-col border-[#c7d7a0] bg-[#dcebb4] shadow-none xl:min-h-0">
      <CardHeader className="flex-row items-start justify-between space-y-0 xl:py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-[#416652]" aria-hidden="true" />
          <p className="text-[9px] font-extrabold tracking-[0.2em] text-[#55705e]">
            AI MARKET INSIGHT
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-[#9fb87c] bg-white/35 text-[8px] tracking-[0.12em] text-[#55705e]"
        >
          DAILY
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col pt-2 xl:pb-4 xl:pt-1">
        {status === "loading" && (
          <div className="flex flex-1 flex-col justify-between gap-8 xl:gap-5" aria-live="polite">
            <div>
              <LoaderCircle className="mb-5 size-5 animate-spin text-[#55705e]" />
              <CardTitle className="font-display text-[25px] font-medium leading-[1.15] tracking-[-0.03em]">
                Loading today&apos;s macro read…
              </CardTitle>
              <p className="mt-3 text-xs leading-5 text-[#55705e]">
                Published reports are loaded from the shared Redis cache.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-1 flex-col justify-between gap-8 xl:gap-5" role="status">
            <div>
              <CardTitle className="font-display text-[25px] font-medium leading-[1.15] tracking-[-0.03em]">
                Daily insight is unavailable
              </CardTitle>
              <p className="mt-3 text-xs leading-5 text-[#6d5a45]">{error}</p>
            </div>
            <p className="text-[9px] leading-4 text-[#60726a]">
              Check that Redis is running and that the daily scheduled task completed successfully.
            </p>
          </div>
        )}

        {status === "ready" && insight && (
          <>
            <div className="flex flex-1 flex-col justify-between gap-8 xl:gap-5">
              <div>
                <CardTitle className="font-display text-[25px] font-medium leading-[1.15] tracking-[-0.03em]">
                  {insight.brief}
                </CardTitle>
                <p className="mt-4 text-[9px] text-[#60726a]">
                  Generated {formatGeneratedAt(insight.generatedAt)} · {payload.cache.status === "previous-day" ? "Previous daily report" : "Redis cache"}
                </p>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-between rounded-full px-0 text-xs font-bold hover:bg-transparent"
                aria-controls="ai-market-insight-details"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? "Hide detailed analysis" : "Read detailed analysis"}
                <ChevronDown
                  className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </Button>
            </div>

            {expanded && (
              <section
                id="ai-market-insight-details"
                className="mt-6 border-t border-[#b5c98b] pt-6 xl:mt-5 xl:pt-5"
              >
                <p className="mb-3 text-[9px] font-extrabold tracking-[0.2em] text-[#55705e]">
                  DETAILED ANALYSIS · {insight.reportDate}
                </p>
                <h3 className="font-display text-3xl font-medium leading-tight tracking-[-0.03em]">
                  {insight.detailed.headline}
                </h3>
                <p className="pt-2 text-xs leading-5 text-[#60726a]">
                  Generated once daily from the dashboard&apos;s latest available source readings.
                </p>

                <div className="mt-6 space-y-8">
                <p className="text-[15px] leading-7 text-[#26352f]">{insight.detailed.overview}</p>
                <div className="grid gap-8 border-t border-[#b5c98b] pt-7 md:grid-cols-2">
                  <ReportList title="Key signals" items={insight.detailed.keySignals} />
                  <ReportList title="Risks" items={insight.detailed.risks} />
                </div>
                <div className="border-t border-[#b5c98b] pt-7">
                  <ReportList title="What to watch next" items={insight.detailed.watchNext} />
                </div>
                <p className="border-t border-[#b5c98b] pt-5 text-[9px] leading-4 text-[#78857f]">
                  AI-generated synthesis from retrieved dashboard data. Verify the underlying observations before relying on the analysis. This is not investment advice. Model: {insight.model}.
                </p>
              </div>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
