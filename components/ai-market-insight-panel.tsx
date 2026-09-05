"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LoaderCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyMarketInsightResponse } from "@/lib/data/market-insight";
import { useI18n } from "@/lib/i18n";

type InsightStatus = "loading" | "ready" | "error";

function formatGeneratedAt(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
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
      <h4 className="mb-3 text-[10px] font-extrabold tracking-[0.18em] text-[#a8b3c1]">
        {title.toUpperCase()}
      </h4>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li className="grid grid-cols-[8px_1fr] gap-3 text-sm leading-6 text-[#cbd3de]" key={item}>
            <span className="mt-2 size-1.5 rounded-full bg-[#70dfa9]" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AiMarketInsightPanel() {
  const { intlLocale, locale, t } = useI18n();
  const [payload, setPayload] = useState<DailyMarketInsightResponse | null>(null);
  const [status, setStatus] = useState<InsightStatus>("loading");
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
      } catch {
        if (active) setStatus("error");
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const insight = payload?.insight;
  const content = insight && locale !== "en" ? insight.translations?.[locale] ?? insight : insight;

  return (
    <Card className="ai-insight-card flex min-h-[300px] flex-col border-[#c7d7a0] bg-[#dcebb4] shadow-none xl:min-h-0">
      <CardHeader className="flex-row items-start justify-between space-y-0 xl:py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-[#78cde2]" aria-hidden="true" />
          <p className="text-[9px] font-extrabold tracking-[0.2em] text-[#93a1b1]">
            {t("ai.eyebrow").toUpperCase()}
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-[#3b4658] bg-white/5 text-[8px] tracking-[0.12em] text-[#a8b3c1]"
        >
          {t("ai.daily").toUpperCase()}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col pt-2 xl:pb-4 xl:pt-1">
        {status === "loading" && (
          <div className="flex flex-1 flex-col justify-between gap-8 xl:gap-5" aria-live="polite">
            <div>
              <LoaderCircle className="mb-5 size-5 animate-spin text-[#78cde2]" />
              <CardTitle className="font-display text-[25px] font-medium leading-[1.15] tracking-[-0.03em]">
                {t("ai.loading")}
              </CardTitle>
              <p className="mt-3 text-xs leading-5 text-[#a8b3c1]">
                {t("ai.loadingHelp")}
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-1 flex-col justify-between gap-8 xl:gap-5" role="status">
            <div>
              <CardTitle className="font-display text-[25px] font-medium leading-[1.15] tracking-[-0.03em]">
                {t("ai.unavailable")}
              </CardTitle>
              <p className="mt-3 text-xs leading-5 text-[#ff9a9a]">{t("ai.errorHelp")}</p>
            </div>
          </div>
        )}

        {status === "ready" && insight && content && (
          <>
            <div className="flex flex-1 flex-col justify-between gap-8 xl:gap-5">
              <div>
                <CardTitle className="font-display text-[25px] font-medium leading-[1.15] tracking-[-0.03em]">
                  {content.brief}
                </CardTitle>
                <p className="mt-4 text-[9px] text-[#9ba7b6]">
                  {t("ai.generated", { value: formatGeneratedAt(insight.generatedAt, intlLocale) })} · {payload.cache.status === "previous-day" ? t("ai.previous") : t("ai.redis")}
                </p>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-between rounded-full px-0 text-xs font-bold hover:bg-transparent"
                aria-controls="ai-market-insight-details"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? t("ai.hide") : t("ai.show")}
                <ChevronDown
                  className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </Button>
            </div>

            {expanded && (
              <section
                id="ai-market-insight-details"
                className="mt-6 border-t border-[#30394a] pt-6 xl:mt-5 xl:pt-5"
              >
                <p className="mb-3 text-[9px] font-extrabold tracking-[0.2em] text-[#93a1b1]">
                  {t("ai.details", { date: insight.reportDate }).toUpperCase()}
                </p>
                <h3 className="font-display text-3xl font-medium leading-tight tracking-[-0.03em]">
                  {content.detailed.headline}
                </h3>
                <p className="pt-2 text-xs leading-5 text-[#9ba7b6]">
                  {t("ai.generatedHelp")}
                </p>

                <div className="mt-6 space-y-8">
                <p className="text-[15px] leading-7 text-[#d4dbe5]">{content.detailed.overview}</p>
                <div className="grid gap-8 border-t border-[#30394a] pt-7 md:grid-cols-2">
                  <ReportList title={t("ai.keySignals")} items={content.detailed.keySignals} />
                  <ReportList title={t("ai.risks")} items={content.detailed.risks} />
                </div>
                <div className="border-t border-[#30394a] pt-7">
                  <ReportList title={t("ai.watch")} items={content.detailed.watchNext} />
                </div>
                <p className="border-t border-[#30394a] pt-5 text-[9px] leading-4 text-[#8f9baa]">
                  {t("ai.disclaimer", { model: insight.model })}
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
