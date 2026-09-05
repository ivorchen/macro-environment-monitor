"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EconomicCalendarEvent, EconomicCalendarResponse } from "@/lib/data/economic-calendar";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function eventDateParts(date: string, locale: string) {
  const value = new Date(`${date}T12:00:00Z`);
  return {
    day: new Intl.DateTimeFormat(locale, { day: "2-digit", timeZone: "UTC" }).format(value),
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(value).toUpperCase(),
  };
}

function eventLabel(event: EconomicCalendarEvent, t: (key: MessageKey) => string) {
  return t(`calendar.event.${event.category}` as MessageKey) || event.name;
}

export function EconomicCalendarPanel() {
  const { intlLocale, t } = useI18n();
  const [payload, setPayload] = useState<EconomicCalendarResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/economic-calendar", { cache: "no-store" });
      if (!response.ok) throw new Error(`Economic calendar returned ${response.status}`);
      setPayload(await response.json() as EconomicCalendarResponse);
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
    <Card className="economic-calendar-card overflow-hidden border-border bg-card text-card-foreground shadow-none xl:col-span-2">
      <CardHeader className="gap-4 space-y-0 px-6 pb-5 pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-[#59bdd6]">{t("calendar.eyebrow").toUpperCase()}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <CardTitle className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{t("review.releases")}</CardTitle>
            {payload?.status === "ready" && <Badge variant="outline" className="h-6 border-primary/40 bg-primary/10 px-2.5 text-[10px] font-semibold text-primary">{t("calendar.live")}</Badge>}
          </div>
          <CardDescription className="mt-2 text-sm leading-6 text-muted-foreground">{t("calendar.description")}</CardDescription>
        </div>
        <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-lg border-border bg-secondary px-3 text-xs text-secondary-foreground hover:bg-accent hover:text-accent-foreground" aria-label={t("calendar.refresh")} onClick={() => void load()} disabled={status === "loading"}>
          <RefreshCw className={cn("size-4", status === "loading" && "animate-spin")} />
          {t("common.refresh")}
        </Button>
      </CardHeader>

      {status === "loading" && !payload && (
        <CardContent className="grid min-h-28 place-items-center">
          <LoaderCircle className="size-5 animate-spin text-primary" aria-label={t("calendar.loading")} />
        </CardContent>
      )}

      {(status === "error" || payload?.status === "unavailable") && (
        <CardContent className="px-6 pb-6">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <CalendarDays className="mt-0.5 size-4 shrink-0" />
            <div><p className="font-semibold">{t("calendar.unavailable")}</p><p className="mt-1 text-xs opacity-80">{payload?.errorMessage ?? t("calendar.unavailableHelp")}</p></div>
          </div>
        </CardContent>
      )}

      {status === "ready" && payload?.status === "ready" && (
        <CardContent className="px-6 pb-6">
          {payload.events.length === 0 ? (
            <div className="rounded-xl border border-border bg-secondary p-4 text-sm text-muted-foreground">{t("calendar.empty")}</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {payload.events.map((event) => {
                const date = eventDateParts(event.date, intlLocale);
                return (
                  <a key={event.id} href={event.sourceUrl} target="_blank" rel="noreferrer" className="economic-calendar-event group grid min-h-[92px] grid-cols-[56px_minmax(0,1fr)_16px] items-center gap-4 rounded-xl border p-4 text-secondary-foreground transition-colors">
                    <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                      <span className="text-xl font-bold leading-none">{date.day}</span>
                      <span className="text-[9px] font-semibold tracking-[.15em] text-primary-foreground/75">{date.month}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-[15px] font-semibold leading-5">{eventLabel(event, t)}</p>
                      <Badge variant="outline" className={cn("h-6 px-2.5 text-[10px] font-semibold", event.importance === "high" ? "economic-calendar-high" : "economic-calendar-medium")}>{t(`calendar.importance.${event.importance}` as MessageKey)}</Badge>
                    </div>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground">
            <p>{t("calendar.footer", { start: payload.windowStart, end: payload.windowEnd })} · <a href={payload.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{t("calendar.source")}</a></p>
            <p className="shrink-0">{t("common.updated", { value: new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.generatedAt)) })}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
