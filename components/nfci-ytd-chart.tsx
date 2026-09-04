"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NfciPoint, NfciYtdResponse } from "@/lib/data/nfci";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 260;
const PADDING = { top: 18, right: 24, bottom: 30, left: 44 };

function signed(value: number | null, digits = 2) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function shortDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function chartGeometry(points: readonly NfciPoint[]) {
  if (!points.length) return null;
  const values = points.map((point) => point.value);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = Math.max(0.2, maximum - minimum);
  const yMin = minimum - span * 0.12;
  const yMax = maximum + span * 0.12;
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const x = (index: number) => PADDING.left + (points.length === 1 ? plotWidth / 2 : index / (points.length - 1) * plotWidth);
  const y = (value: number) => PADDING.top + (yMax - value) / (yMax - yMin) * plotHeight;
  return {
    path: points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" "),
    zeroY: y(0),
    yMin,
    yMax,
    x,
    y,
  };
}

export function NfciYtdChart() {
  const { intlLocale, t } = useI18n();
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [payload, setPayload] = useState<NfciYtdResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch(`/api/financial-conditions/nfci?year=${year}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`NFCI endpoint returned ${response.status}.`);
        return response.json() as Promise<NfciYtdResponse>;
      })
      .then((nextPayload) => {
        if (!active) return;
        setPayload(nextPayload);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [reloadToken, year]);

  const geometry = useMemo(() => chartGeometry(payload?.points ?? []), [payload?.points]);
  const statistics = payload?.statistics;

  return (
    <section className="mt-4" aria-labelledby="nfci-title">
      <Card className="overflow-hidden border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
        <CardHeader className="gap-4 border-b border-[#e0e3de] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">
              {t("nfci.eyebrow").toUpperCase()}
            </p>
            <CardTitle id="nfci-title" className="font-display text-3xl font-medium">
              {t("nfci.title")}
            </CardTitle>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-[#6f7d78]">
              {t("nfci.description")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="nfci-year">{t("nfci.year")}</label>
            <select
              id="nfci-year"
              value={year}
              onChange={(event) => {
                setStatus("loading");
                setYear(Number(event.target.value));
              }}
              className="h-9 rounded-full border border-[#d4d9d3] bg-white/60 px-3 text-xs"
            >
              {Array.from({ length: 6 }, (_, index) => currentYear - index).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setStatus("loading");
                setReloadToken((value) => value + 1);
              }}
              aria-label={t("nfci.refresh")}
            >
              <RefreshCw className={cn("size-3.5", status === "loading" && "animate-spin")} />
              {t("common.refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {status === "loading" && !payload && (
            <div className="grid min-h-72 place-items-center">
              <LoaderCircle className="size-5 animate-spin text-[#718079]" aria-label={t("nfci.loading")} />
            </div>
          )}

          {status === "error" && !payload && (
            <div className="grid min-h-52 place-items-center rounded-2xl border border-[#e3beb7] bg-[#f6e7e3] p-6 text-center text-xs text-[#813d35]">
              {t("nfci.endpointError")}
            </div>
          )}

          {payload?.freshness === "unavailable" && (
            <div className="grid min-h-52 place-items-center rounded-2xl border border-[#e3beb7] bg-[#f6e7e3] p-6 text-center">
              <div>
                <Activity className="mx-auto mb-3 size-6 text-[#9a463c]" />
                <p className="font-semibold text-[#813d35]">{t("nfci.unavailable")}</p>
                <p className="mt-1 max-w-lg text-xs leading-5 text-[#955d54]">{payload.errorMessage}</p>
              </div>
            </div>
          )}

          {payload && statistics && geometry && (
            <>
              <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {[
                  [t("nfci.latest"), statistics.latest.value.toFixed(2), shortDate(statistics.latest.date, intlLocale)],
                  [t("nfci.ytdChange"), signed(statistics.ytdChange), t("nfci.from", { value: statistics.ytdStart.value.toFixed(2) })],
                  [t("nfci.fourWeek"), signed(statistics.fourWeekChange), t(`nfci.${statistics.direction}`)],
                  [t("nfci.ytdHigh"), statistics.ytdHigh.value.toFixed(2), shortDate(statistics.ytdHigh.date, intlLocale)],
                  [t("nfci.ytdLow"), statistics.ytdLow.value.toFixed(2), shortDate(statistics.ytdLow.date, intlLocale)],
                  [t("nfci.direction"), t(`nfci.${statistics.direction}`), t("nfci.observations", { count: payload.points.length })],
                ].map(([label, value, detail]) => (
                  <div key={label} className="rounded-2xl border border-[#e0e3de] bg-white/45 p-3">
                    <p className="text-[8px] font-bold tracking-[.14em] text-[#78857f]">{label.toUpperCase()}</p>
                    <p className={cn(
                      "mt-1 text-lg font-semibold capitalize",
                      label === t("nfci.direction") && statistics.direction === "tightening" && "text-[#a3493d]",
                      label === t("nfci.direction") && statistics.direction === "loosening" && "text-[#176148]",
                    )}>{value}</p>
                    <p className="mt-0.5 text-[9px] capitalize text-[#83908a]">{detail}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#e0e3de] bg-white/35 p-2 sm:p-4">
                <svg
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  className="min-w-[680px]"
                  role="img"
                  aria-label={t("nfci.aria", { year: payload.year })}
                >
                  <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={geometry.zeroY} y2={geometry.zeroY} stroke="#9da8a2" strokeDasharray="7 6" />
                  <text x={PADDING.left - 8} y={geometry.zeroY + 3} textAnchor="end" fontSize="10" fill="#708079">0</text>
                  <text x={PADDING.left - 8} y={PADDING.top + 4} textAnchor="end" fontSize="10" fill="#708079">{geometry.yMax.toFixed(2)}</text>
                  <text x={PADDING.left - 8} y={CHART_HEIGHT - PADDING.bottom} textAnchor="end" fontSize="10" fill="#708079">{geometry.yMin.toFixed(2)}</text>
                  <path d={geometry.path} fill="none" stroke="#175f47" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  {payload.points.map((point, index) => (
                    <circle
                      key={point.date}
                      cx={geometry.x(index)}
                      cy={geometry.y(point.value)}
                      r={index === payload.points.length - 1 ? 5 : 3}
                      fill={point.value > 0 ? "#a85448" : "#175f47"}
                      stroke="#fbfaf6"
                      strokeWidth="2"
                      tabIndex={0}
                      aria-label={`${shortDate(point.date, intlLocale)}: NFCI ${point.value.toFixed(3)}, Federal Reserve Bank of St. Louis`}
                    >
                      <title>{`${shortDate(point.date, intlLocale)} · ${point.value.toFixed(3)} · FRED`}</title>
                    </circle>
                  ))}
                  <text x={PADDING.left} y={CHART_HEIGHT - 8} fontSize="10" fill="#708079">{shortDate(payload.points[0].date, intlLocale)}</text>
                  <text x={CHART_WIDTH - PADDING.right} y={CHART_HEIGHT - 8} textAnchor="end" fontSize="10" fill="#708079">{shortDate(statistics.latest.date, intlLocale)}</text>
                </svg>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[9px] leading-4 text-[#7b8882]">
                <span>
                  {t("nfci.retrieved", { value: new Date(payload.generatedAt).toLocaleString(intlLocale) })} · {payload.freshness} · {payload.cache.backend} {payload.cache.status}
                </span>
                <a href={payload.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#175f47] hover:underline">
                  FRED {t("common.source")} <ExternalLink className="size-3" />
                </a>
              </div>
            </>
          )}

          {payload?.freshness === "stale" && (
            <Badge variant="outline" className="mt-3 border-[#dfcfaa] bg-[#f5ecd8] text-[#805c22]">
              {t("nfci.staleBadge")}
            </Badge>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
