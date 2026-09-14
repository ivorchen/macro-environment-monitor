"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIME_BOOK_RANGES, type PrimeBookPoint, type PrimeBookRange, type PrimeBookResponse } from "@/lib/data/prime-book";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const WIDTH = 1000;
const HEIGHT = 280;
const PAD = { top: 22, right: 24, bottom: 34, left: 48 };

const COPY = {
  en: {
    eyebrow: "Positioning · Provider-separated evidence", title: "Prime Book positioning",
    description: "Institutional crowding and directional risk appetite from licensed prime-broker observations. Context only—not a trading signal.",
    loading: "Loading Prime Book history", endpointError: "The Prime Book endpoint could not be loaded.",
    unavailable: "Licensed positioning data is not configured", sourceGate: "The panel will remain empty until a source and dashboard-display rights are documented.",
    provider: "Provider", gross: "Gross leverage", net: "Net leverage", ratio: "Long / Short", momentum: "Momentum L/S",
    percentile: "historical percentile", week: "1W", month: "1M", quarter: "3M", observations: "observations",
    stale: "Latest provider observation is stale", ratioWarning: "Gross, Net, and reported L/S need review", methodology: "Methodology / universe",
    derived: "Derived from Gross and Net", noMomentum: "Not supplied", refresh: "Refresh Prime Book panel", exact: "Exact provider values",
    publicEyebrow: "Public regulatory aggregate · OFR", publicTitle: "Public Form PF hedge-fund positioning",
    publicDescription: "Quarterly aggregate equity exposures from qualifying hedge funds filing SEC Form PF. This is a delayed structural baseline—not a prime-broker client book or trading signal.",
    publicGross: "Gross equity / NAV", publicNet: "Net equity / NAV", quarterOverQuarter: "QoQ", yearOverYear: "1Y",
    publicStale: "The latest OFR Form PF vintage may be delayed", publicGuardrail: "Public aggregate—not Goldman, Morgan Stanley, or J.P. Morgan Prime Book data.",
  },
  "zh-CN": {
    eyebrow: "仓位 · 按供应商分隔的证据", title: "Prime Book 对冲基金仓位", description: "基于获授权的主经纪商数据观察机构拥挤度与方向性风险偏好。仅作背景，不是交易信号。",
    loading: "正在加载 Prime Book 历史", endpointError: "无法加载 Prime Book 接口。", unavailable: "尚未配置获授权的仓位数据", sourceGate: "在记录数据来源及看板展示权之前，本面板将保持为空。",
    provider: "供应商", gross: "总杠杆", net: "净杠杆", ratio: "多空比", momentum: "动量多空比", percentile: "历史百分位", week: "1周", month: "1月", quarter: "3月", observations: "个观测",
    stale: "最新供应商观测已过期", ratioWarning: "总杠杆、净杠杆与公布多空比需要复核", methodology: "方法 / 样本范围", derived: "由总杠杆和净杠杆推导", noMomentum: "未提供", refresh: "刷新 Prime Book 面板", exact: "供应商精确值",
    publicEyebrow: "公开监管汇总 · OFR", publicTitle: "公开 Form PF 对冲基金仓位", publicDescription: "基于提交 SEC Form PF 的合资格对冲基金季度股票风险汇总。这是有延迟的结构性基准，并非主经纪商客户账簿或交易信号。",
    publicGross: "股票总敞口 / NAV", publicNet: "股票净敞口 / NAV", quarterOverQuarter: "环比", yearOverYear: "1年", publicStale: "最新 OFR Form PF 数据版本可能延迟", publicGuardrail: "公开汇总数据，并非高盛、摩根士丹利或摩根大通 Prime Book 数据。",
  },
  "zh-TW": {
    eyebrow: "部位 · 按供應商分隔的證據", title: "Prime Book 對沖基金部位", description: "根據獲授權的主經紀商資料觀察機構擁擠度與方向性風險偏好。僅作背景，不是交易訊號。",
    loading: "正在載入 Prime Book 歷史", endpointError: "無法載入 Prime Book 介面。", unavailable: "尚未設定獲授權的部位資料", sourceGate: "在記錄資料來源及看板展示權之前，本面板將保持空白。",
    provider: "供應商", gross: "總槓桿", net: "淨槓桿", ratio: "多空比", momentum: "動量多空比", percentile: "歷史百分位", week: "1週", month: "1月", quarter: "3月", observations: "個觀測",
    stale: "最新供應商觀測已過期", ratioWarning: "總槓桿、淨槓桿與公布多空比需要複核", methodology: "方法 / 樣本範圍", derived: "由總槓桿和淨槓桿推導", noMomentum: "未提供", refresh: "重新整理 Prime Book 面板", exact: "供應商精確值",
    publicEyebrow: "公開監管彙總 · OFR", publicTitle: "公開 Form PF 對沖基金部位", publicDescription: "根據提交 SEC Form PF 的合資格對沖基金季度股票風險彙總。這是有延遲的結構性基準，並非主經紀商客戶帳簿或交易訊號。",
    publicGross: "股票總曝險 / NAV", publicNet: "股票淨曝險 / NAV", quarterOverQuarter: "季比", yearOverYear: "1年", publicStale: "最新 OFR Form PF 資料版本可能延遲", publicGuardrail: "公開彙總資料，並非高盛、摩根士丹利或摩根大通 Prime Book 資料。",
  },
} as const;

type MetricKey = "gross_leverage" | "net_leverage" | "display_long_short_ratio";
const SERIES: Array<{ key: MetricKey; color: string }> = [
  { key: "gross_leverage", color: "#175f47" },
  { key: "net_leverage", color: "#b06a39" },
  { key: "display_long_short_ratio", color: "#426d9b" },
];

function signed(value: number | null) {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function dateLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function geometry(points: readonly PrimeBookPoint[]) {
  if (!points.length) return null;
  const allValues = points.flatMap((point) => SERIES.map(({ key }) => point[key]).filter((value): value is number => typeof value === "number"));
  if (!allValues.length) return null;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(0.2, max - min);
  const yMin = Math.max(0, min - span * 0.12);
  const yMax = max + span * 0.12;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (points.length === 1 ? plotWidth / 2 : index / (points.length - 1) * plotWidth);
  const y = (value: number) => PAD.top + (yMax - value) / (yMax - yMin) * plotHeight;
  return { x, y, yMin, yMax };
}

export function PrimeBookPanel() {
  const { locale, intlLocale, t } = useI18n();
  const copy = COPY[locale];
  const [range, setRange] = useState<PrimeBookRange>("3M");
  const [provider, setProvider] = useState("");
  const [payload, setPayload] = useState<PrimeBookResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ range });
    if (provider) query.set("provider", provider);
    void fetch(`/api/positioning/prime-book?${query}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Prime Book endpoint returned ${response.status}.`);
        return response.json() as Promise<PrimeBookResponse>;
      })
      .then((next) => { if (active) { setPayload(next); setStatus("ready"); } })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [provider, range, reload]);

  const chart = useMemo(() => geometry(payload?.points ?? []), [payload?.points]);
  const isPublicFormPf = payload?.sourceMode === "public-form-pf";
  const metricCards = payload ? [
    { label: isPublicFormPf ? copy.publicGross : copy.gross, summary: payload.metrics.grossLeverage },
    { label: isPublicFormPf ? copy.publicNet : copy.net, summary: payload.metrics.netLeverage },
    { label: copy.ratio, summary: payload.metrics.longShortRatio },
    { label: copy.momentum, summary: payload.metrics.momentumLongShortRatio },
  ] : [];

  return (
    <section className="mt-4" aria-labelledby="prime-book-title">
      <Card className="overflow-hidden border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
        <CardHeader className="gap-4 border-b border-[#e0e3de] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">{(isPublicFormPf ? copy.publicEyebrow : copy.eyebrow).toUpperCase()}</p>
            <CardTitle id="prime-book-title" className="font-display text-3xl font-medium">{isPublicFormPf ? copy.publicTitle : copy.title}</CardTitle>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-[#6f7d78]">{isPublicFormPf ? copy.publicDescription : copy.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {payload && payload.providers.length > 1 && (
              <select value={provider || payload.provider || ""} onChange={(event) => { setStatus("loading"); setProvider(event.target.value); }} className="h-9 max-w-52 rounded-full border border-[#d4d9d3] bg-white/60 px-3 text-xs" aria-label={copy.provider}>
                {payload.providers.map((item) => <option key={item.provider} value={item.provider}>{item.provider}</option>)}
              </select>
            )}
            <div className="flex rounded-full border border-[#d4d9d3] bg-white/50 p-1">
              {PRIME_BOOK_RANGES.map((option) => (
                <button key={option} onClick={() => { setStatus("loading"); setRange(option); }} className={cn("rounded-full px-2 py-1 text-[9px] font-bold", range === option && "bg-[#175f47] text-white")}>{option}</button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setStatus("loading"); setReload((value) => value + 1); }} aria-label={copy.refresh}>
              <RefreshCw className={cn("size-3.5", status === "loading" && "animate-spin")} /> {t("common.refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {status === "loading" && !payload && <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-5 animate-spin text-[#718079]" aria-label={copy.loading} /></div>}
          {status === "error" && !payload && <div className="grid min-h-48 place-items-center rounded-2xl border border-[#e3beb7] bg-[#f6e7e3] p-6 text-xs text-[#813d35]">{copy.endpointError}</div>}
          {payload?.freshness === "unavailable" && (
            <div className="grid min-h-52 place-items-center rounded-2xl border border-[#dfcfaa] bg-[#f5ecd8] p-6 text-center">
              <div><BookOpen className="mx-auto mb-3 size-6 text-[#805c22]" /><p className="font-semibold text-[#6e4e1d]">{copy.unavailable}</p><p className="mt-1 max-w-xl text-xs leading-5 text-[#805c22]">{copy.sourceGate}</p><p className="mt-2 max-w-xl text-[10px] leading-4 text-[#8e7040]">{payload.errorMessage}</p></div>
            </div>
          )}
          {payload && payload.latest && chart && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metricCards.map(({ label, summary }) => (
                  <div key={label} className="rounded-2xl border border-[#e0e3de] bg-white/45 p-3">
                    <p className="text-[8px] font-bold tracking-[.14em] text-[#78857f]">{label.toUpperCase()}</p>
                    <p className="mt-1 text-xl font-semibold">{summary ? `${summary.value.toFixed(2)}x` : "—"}</p>
                    {summary ? isPublicFormPf
                      ? <div className="mt-2 grid grid-cols-3 gap-1 text-[8px] text-[#7b8882]"><span>{copy.quarterOverQuarter}<b className="block text-[#405149]">{signed(summary.change3M)}</b></span><span>{copy.yearOverYear}<b className="block text-[#405149]">{signed(summary.change1Y)}</b></span><span>%ile<b className="block text-[#405149]">{summary.percentile.toFixed(0)}</b></span></div>
                      : <div className="mt-2 grid grid-cols-4 gap-1 text-[8px] text-[#7b8882]"><span>{copy.week}<b className="block text-[#405149]">{signed(summary.change1W)}</b></span><span>{copy.month}<b className="block text-[#405149]">{signed(summary.change1M)}</b></span><span>{copy.quarter}<b className="block text-[#405149]">{signed(summary.change3M)}</b></span><span>%ile<b className="block text-[#405149]">{summary.percentile.toFixed(0)}</b></span></div>
                      : <p className="mt-2 text-[9px] text-[#8b9691]">{copy.noMomentum}</p>}
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e0e3de] bg-white/35 p-2 sm:p-4">
                <div className="mb-2 flex flex-wrap gap-4 text-[9px] font-semibold text-[#66746e]">{SERIES.map(({ key, color }) => <span key={key} className="flex items-center gap-1.5"><i className="h-0.5 w-5" style={{ backgroundColor: color }} />{key === "gross_leverage" ? (isPublicFormPf ? copy.publicGross : copy.gross) : key === "net_leverage" ? (isPublicFormPf ? copy.publicNet : copy.net) : copy.ratio}</span>)}</div>
                <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="min-w-[680px]" role="img" aria-label={`${isPublicFormPf ? copy.publicTitle : copy.title}: ${copy.exact}`}>
                  {[0, .5, 1].map((fraction) => { const value = chart.yMin + (chart.yMax - chart.yMin) * fraction; const y = chart.y(value); return <g key={fraction}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke="#d9ddd7" /><text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#708079">{value.toFixed(2)}</text></g>; })}
                  {SERIES.map(({ key, color }) => {
                    const eligible = payload.points.map((point, index) => ({ point, index, value: point[key] })).filter((item): item is { point: PrimeBookPoint; index: number; value: number } => typeof item.value === "number");
                    const path = eligible.map((item, index) => `${index ? "L" : "M"}${chart.x(item.index).toFixed(2)},${chart.y(item.value).toFixed(2)}`).join(" ");
                    return <g key={key}><path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{eligible.map(({ point, index, value }) => <circle key={point.date} cx={chart.x(index)} cy={chart.y(value)} r="3" fill={color} tabIndex={0} aria-label={`${dateLabel(point.date, intlLocale)}: ${value.toFixed(3)}`}><title>{`${dateLabel(point.date, intlLocale)} · ${value.toFixed(3)}x · ${payload.provider}`}</title></circle>)}</g>;
                  })}
                  <text x={PAD.left} y={HEIGHT - 8} fontSize="10" fill="#708079">{dateLabel(payload.points[0].date, intlLocale)}</text><text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end" fontSize="10" fill="#708079">{dateLabel(payload.points.at(-1)!.date, intlLocale)}</text>
                </svg>
              </div>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-3 text-[9px] leading-4 text-[#7b8882]">
                <span><strong>{payload.provider}</strong> · {payload.points.length} {copy.observations} · {dateLabel(payload.latest.date, intlLocale)} · {payload.latest.methodology} · {payload.latest.universe}</span>
                {payload.latest.source_url ? <a href={payload.latest.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#175f47] hover:underline">{t("common.source")} <ExternalLink className="size-3" /></a> : <span>{payload.latest.source_reference}</span>}
              </div>
              {isPublicFormPf && <p className="mt-3 rounded-xl border border-[#c7d8e2] bg-[#e9f1f5] p-3 text-[10px] leading-4 text-[#355b70]">{copy.publicGuardrail}</p>}
              {payload.freshness === "stale" && <Badge variant="outline" className="mt-3 border-[#dfcfaa] bg-[#f5ecd8] text-[#805c22]">{isPublicFormPf ? copy.publicStale : copy.stale}</Badge>}
              {payload.dataQuality.warnings.length > 0 && <div className="mt-3 flex gap-2 rounded-xl border border-[#e3beb7] bg-[#f6e7e3] p-3 text-[10px] text-[#813d35]"><AlertTriangle className="size-4 shrink-0" /><span>{copy.ratioWarning}: {payload.dataQuality.warnings.join(" ")}</span></div>}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
