"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Landmark,
  LayoutDashboard,
  PieChart,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AiMarketInsightPanel } from "@/components/ai-market-insight-panel";
import { EconomicCalendarPanel } from "@/components/economic-calendar-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Label } from "@/components/ui/label";
import { MarketSnapshotPanel } from "@/components/market-snapshot-panel";
import { NfciYtdChart } from "@/components/nfci-ytd-chart";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SourceStatusPanel } from "@/components/source-status-panel";
import { SenateTradesPanel } from "@/components/senate-trades-panel";
import { SectorViewPanel } from "@/components/sector-view-panel";
import { MarketNewsPanel } from "@/components/market-news-panel";
import { sourceForIndicator } from "@/lib/data/source-registry";
import {
  INITIAL_PILLARS,
  type Pillar,
  type Score,
} from "@/lib/macro";
import { applyRiskScoreToPillars, type RiskScoreResponse, type RiskZone } from "@/lib/risk-score";
import { cn } from "@/lib/utils";
import { useI18n, type MessageKey } from "@/lib/i18n";

function scoreTone(score: Score) {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function isoWeek(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

function greetingKey(date: Date | null): MessageKey {
  if (!date) return "overview.greetingEvening";
  const hour = date.getHours();
  if (hour < 12) return "overview.greetingMorning";
  if (hour < 18) return "overview.greetingAfternoon";
  return "overview.greetingEvening";
}

const LEGACY_SAMPLE_OBSERVATIONS = [
  "Real yields eased from the monthly high, reducing pressure on long-duration equities.",
  "Credit remained calm while the S&P 500 advanced.",
  "Breadth weakened as equal-weight lagged the headline index.",
];

function isLegacySampleObservations(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length === LEGACY_SAMPLE_OBSERVATIONS.length
    && value.every((item, index) => item === LEGACY_SAMPLE_OBSERVATIONS[index]);
}

function scoreClasses(score: Score) {
  if (score > 0) return "border-[#a9c6b8] bg-[#e4efe8] text-[#155b43]";
  if (score < 0) return "border-[#e3beb7] bg-[#f6e7e3] text-[#9a463c]";
  return "border-[#dfcfaa] bg-[#f5ecd8] text-[#805c22]";
}

function regimePanelTheme(score: number) {
  if (score >= 81) {
    return {
      background: "#124f3d",
      accent: "#d7f28d",
      glow: "rgba(215, 242, 141, 0.16)",
      shadow: "rgba(18, 79, 61, 0.24)",
    };
  }
  if (score >= 61) {
    return {
      background: "#162b2a",
      accent: "#3dd6a0",
      glow: "rgba(61, 214, 160, 0.17)",
      shadow: "rgba(0, 0, 0, 0.28)",
    };
  }
  if (score >= 41) {
    return {
      background: "#1b2230",
      accent: "#59bdd6",
      glow: "rgba(89, 189, 214, 0.16)",
      shadow: "rgba(0, 0, 0, 0.28)",
    };
  }
  if (score >= 21) {
    return {
      background: "#30231c",
      accent: "#f2c14e",
      glow: "rgba(242, 193, 78, 0.16)",
      shadow: "rgba(0, 0, 0, 0.28)",
    };
  }
  return {
    background: "#311d24",
    accent: "#ff7777",
    glow: "rgba(255, 177, 165, 0.16)",
    shadow: "rgba(93, 27, 36, 0.3)",
  };
}

function zoneCopy(zone: RiskScoreResponse["zone"]): { label: MessageKey; posture: MessageKey } {
  const safeZone: RiskZone = zone === "unavailable" ? "mixed" : zone;
  return {
    label: `risk.zone.${safeZone}` as MessageKey,
    posture: `risk.posture.${safeZone}` as MessageKey,
  };
}

function TrendIcon({ trend }: { trend: Pillar["trend"] }) {
  if (trend === "Improving") return <ArrowUpRight className="size-4 text-[#1d6c50]" aria-hidden="true" />;
  if (trend === "Deteriorating") return <ArrowDownRight className="size-4 text-[#ae5548]" aria-hidden="true" />;
  return <ArrowRight className="size-4 text-[#68766f]" aria-hidden="true" />;
}

export function MacroDashboard() {
  const { t } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>(() => INITIAL_PILLARS.map((pillar) => ({ ...pillar, score: 0, trend: "Stable" })));
  const [riskScore, setRiskScore] = useState<RiskScoreResponse | null>(null);
  const [riskStatus, setRiskStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [activeTab, setActiveTab] = useState("overview");
  const [observations, setObservations] = useState<string[]>([]);
  const [draftObservation, setDraftObservation] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let storedState: { observations?: string[] } | null = null;
    try {
      const saved = window.localStorage.getItem("macro-monitor-state-v1");
      if (saved) storedState = JSON.parse(saved);
    } catch {
      // Keep the safe defaults if browser storage is unavailable or invalid.
    }
    const hydrationTimer = window.setTimeout(() => {
      if (storedState?.observations && !isLegacySampleObservations(storedState.observations)) {
        setObservations(storedState.observations);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const saved = window.localStorage.getItem("macro-monitor-state-v1");
      const current = saved ? JSON.parse(saved) as Record<string, unknown> : {};
      window.localStorage.setItem("macro-monitor-state-v1", JSON.stringify({ ...current, observations }));
    } catch {
      // Browser storage is optional; keep the in-memory observation list.
    }
  }, [hydrated, observations]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/risk-score", { cache: "no-store" });
        if (!response.ok) throw new Error(`Risk score returned ${response.status}`);
        const payload = await response.json() as RiskScoreResponse;
        if (!active) return;
        setRiskScore(payload);
        setPillars(applyRiskScoreToPillars(INITIAL_PILLARS, payload.components));
        setRiskStatus(payload.score === null ? "unavailable" : "ready");
      } catch {
        if (active) setRiskStatus("unavailable");
      }
    };
    void load();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15 * 60 * 1_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const hasRiskScore = riskStatus === "ready" && riskScore?.score !== null && riskScore?.score !== undefined;
  const total = hasRiskScore ? riskScore.score! : 50;
  const regimeCopy = useMemo(() => zoneCopy(riskScore?.zone ?? "unavailable"), [riskScore?.zone]);
  const regime = useMemo(() => ({ label: t(regimeCopy.label), posture: t(regimeCopy.posture) }), [regimeCopy, t]);
  const regimeTheme = useMemo(() => regimePanelTheme(total), [total]);
  const livePillarIds = useMemo(() => new Set(
    riskScore?.components.filter((component) => component.score !== null).map((component) => component.id) ?? [],
  ), [riskScore]);
  const isLivePillar = (id: string) => riskStatus === "ready" && livePillarIds.has(id as RiskScoreResponse["components"][number]["id"]);

  function addObservation() {
    const value = draftObservation.trim();
    if (!value) return;
    setObservations((current) => [value, ...current].slice(0, 5));
    setDraftObservation("");
    setDialogOpen(false);
  }

  return (
    <TooltipProvider>
      <main className="macro-shell min-h-screen bg-[#0e1014] text-[#f3f5f7]">
        <aside className="fixed inset-x-0 bottom-0 z-50 flex h-[68px] items-center border-t border-border bg-card px-4 text-card-foreground md:inset-y-0 md:left-0 md:right-auto md:h-auto md:w-[76px] md:flex-col md:border-r md:border-t-0 md:px-0 md:py-5">
          <button
            className="grid size-10 place-items-center overflow-hidden rounded-xl transition-opacity hover:opacity-90"
            onClick={() => setActiveTab("overview")}
            aria-label={t("nav.home")}
          >
            <Image src="/favicon.svg" alt="" width={40} height={40} priority />
          </button>
          <nav className="mx-auto flex gap-2 md:mt-16 md:grid" aria-label={t("nav.primary")}>
            {[
              { value: "overview", label: t("nav.overview"), icon: LayoutDashboard },
              { value: "indicators", label: t("nav.indicators"), icon: BarChart3 },
              { value: "sectors", label: t("nav.sectors"), icon: PieChart },
              { value: "senate", label: t("nav.senate"), icon: Landmark },
            ].map((item) => (
              <Tooltip key={item.value}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                      activeTab === item.value && "bg-accent text-accent-foreground",
                    )}
                    onClick={() => setActiveTab(item.value)}
                    aria-label={item.label}
                  >
                    <item.icon className="size-[19px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ))}
          </nav>
        </aside>

        <div className="pb-24 md:ml-[76px] md:pb-10">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <header className="sticky top-0 z-40 border-b border-[#252c38] bg-[#0e1014]/90 px-4 py-4 backdrop-blur-xl sm:px-7 lg:px-12">
              <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
                <div>
                  <p className="mb-1 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">{t("header.product").toUpperCase()}</p>
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-xl font-medium tracking-tight sm:text-2xl">{t("header.regime")}</h1>
                    <Badge variant="outline" className="hidden border-[#30394a] bg-[#151922] text-[9px] tracking-[0.12em] text-[#59bdd6] sm:inline-flex">
                      {t("header.automatic").toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TabsList className="hidden h-10 rounded-full border border-[#30394a] bg-[#151922] p-1 lg:flex">
                    <TabsTrigger value="overview" className="rounded-full px-4 text-xs">{t("nav.overview")}</TabsTrigger>
                    <TabsTrigger value="indicators" className="rounded-full px-4 text-xs">{t("nav.indicators")}</TabsTrigger>
                    <TabsTrigger value="sectors" className="rounded-full px-4 text-xs">{t("nav.sectors")}</TabsTrigger>
                    <TabsTrigger value="senate" className="rounded-full px-4 text-xs">{t("nav.senate")}</TabsTrigger>
                  </TabsList>
                  <ThemeSwitcher />
                  <LanguageSwitcher />
                </div>
              </div>
            </header>

            <TabsContent value="overview" className="m-0 focus-visible:outline-none">
              <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-12 lg:py-10">
                <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[10px] font-extrabold tracking-[0.18em] text-[#6f7d78]">{now ? t("overview.week", { week: isoWeek(now) }).toUpperCase() : "\u00a0"}</p>
                    <h2 className="font-display text-4xl font-medium tracking-[-0.04em] sm:text-5xl">{t(greetingKey(now))}</h2>
                  </div>
                  <p className="max-w-md text-xs leading-5 text-[#6f7d78]">{t("overview.guidance")}</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,.7fr)]">
                  <Card
                    className="regime-card grid-bg overflow-hidden border border-[#30394a] text-white transition-[background-color,box-shadow] duration-500 xl:col-span-2"
                    style={{
                      backgroundColor: regimeTheme.background,
                      boxShadow: `0 24px 70px ${regimeTheme.shadow}`,
                    }}
                  >
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
                      <p className="text-[9px] font-extrabold tracking-[0.2em] text-white/55">{t("overview.currentRegime").toUpperCase()}</p>
                      <span className="flex items-center gap-2 text-[9px] font-extrabold tracking-[0.16em] text-white/55">
                        <i
                          className="size-2 rounded-full transition-colors duration-500"
                          style={{
                            backgroundColor: regimeTheme.accent,
                            boxShadow: `0 0 0 5px ${regimeTheme.glow}`,
                          }}
                        /> {t("overview.workingView").toUpperCase()}
                      </span>
                    </CardHeader>
                    <CardContent className="pt-8">
                      <div className="grid gap-8 md:grid-cols-[1fr_.9fr] md:items-center">
                        <div>
                          <p
                            className="mb-2 text-xs font-extrabold tracking-[0.1em] transition-colors duration-500"
                            style={{ color: regimeTheme.accent }}
                          >
                            {riskStatus === "ready" ? regime.label.toUpperCase() : t(riskStatus === "loading" ? "common.loading" : "risk.unavailable").toUpperCase()}
                          </p>
                          <p className="font-display text-[88px] leading-[.82] tracking-[-0.08em] sm:text-[112px]">
                            {hasRiskScore ? riskScore.score : "—"}<span className="ml-2 font-sans text-base tracking-normal text-white/45">/ 100</span>
                          </p>
                        </div>
                        <div className="border-t border-white/20 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                          <p className="font-display text-2xl leading-tight">{riskStatus === "ready" ? regime.posture : t(riskStatus === "loading" ? "risk.loading" : "risk.unavailableHelp")}</p>
                          <p className="mt-3 text-xs leading-5 text-white/65">
                            {riskStatus === "ready" && riskScore ? t("risk.coverage", { coverage: riskScore.coverage, version: riskScore.methodologyVersion }) : t(riskStatus === "loading" ? "risk.loading" : "risk.unavailableHelp")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-9 grid grid-cols-[auto_1fr_auto] items-center gap-3 text-[8px] font-bold tracking-[0.16em] text-white/45">
                        <span>{t("overview.hostile").toUpperCase()}</span>
                        <div className="relative h-px bg-white/20">
                          <i
                            className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 outline outline-1 transition-[background-color,border-color,outline-color,left] duration-500"
                            style={{
                              left: `${total}%`,
                              backgroundColor: regimeTheme.accent,
                              borderColor: regimeTheme.background,
                              outlineColor: regimeTheme.accent,
                            }}
                          />
                        </div>
                        <span>{t("overview.supportive").toUpperCase()}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="xl:col-span-2">
                    <AiMarketInsightPanel />
                  </div>

                  <EconomicCalendarPanel />

                  <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                    <CardHeader className="flex-row items-end justify-between space-y-0">
                      <div>
                        <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">{riskStatus === "ready" ? t("overview.pillars", { count: livePillarIds.size }).toUpperCase() : t("common.loading").toUpperCase()}</p>
                        <CardTitle className="font-display text-3xl font-medium tracking-tight">{t("overview.scorecard")}</CardTitle>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs text-[#175f47]" onClick={() => setActiveTab("indicators")}>
                        {t("overview.allIndicators")} <ChevronRight className="size-4" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="divide-y divide-[#dde0db] border-t border-[#dde0db]">
                        {pillars.map((pillar) => (
                          <div className="grid min-h-[64px] grid-cols-[10px_minmax(90px,1fr)_minmax(150px,auto)] items-center gap-3 py-2 sm:grid-cols-[10px_minmax(120px,1fr)_150px_120px]" key={pillar.id}>
                            <span className={cn("size-2 rounded-full", scoreTone(pillar.score) === "positive" ? "bg-[#1d6c50]" : scoreTone(pillar.score) === "negative" ? "bg-[#ae5548]" : "bg-[#b78334]")} />
                            <div>
                              <p className="mb-0 text-sm font-semibold">{t(`pillar.${pillar.id}` as MessageKey)}</p>
                              {isLivePillar(pillar.id) && <p className="mb-0 mt-0.5 hidden text-[10px] text-[#78857f] md:block">{pillar.change}</p>}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-9 w-full justify-center rounded-full px-3 text-xs font-bold shadow-none",
                                scoreClasses(pillar.score),
                              )}
                              aria-label={`${t(`pillar.${pillar.id}` as MessageKey)}: ${isLivePillar(pillar.id) ? t(pillar.score === 2 ? "score.strongPositive" : pillar.score === 1 ? "score.positive" : pillar.score === 0 ? "score.neutral" : pillar.score === -1 ? "score.negative" : "score.strongNegative") : t("common.unavailable")}`}
                            >
                              {isLivePillar(pillar.id) ? t(pillar.score === 2 ? "score.strongPositive" : pillar.score === 1 ? "score.positive" : pillar.score === 0 ? "score.neutral" : pillar.score === -1 ? "score.negative" : "score.strongNegative") : t("common.unavailable")}
                            </Badge>
                            <div className="hidden items-center justify-end gap-2 text-[10px] text-[#6f7d78] sm:flex">
                              {isLivePillar(pillar.id) ? <>{t(`trend.${pillar.trend}` as MessageKey)}<TrendIcon trend={pillar.trend} /></> : t("common.unavailable")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                    <CardHeader className="flex-row items-end justify-between space-y-0">
                      <div>
                        <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">{t("overview.weeklyDelta").toUpperCase()}</p>
                        <CardTitle className="font-display text-3xl font-medium tracking-tight">{t("overview.whatChanged")}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="rounded-md font-mono text-[9px]">{now ? `W${isoWeek(now)}` : "—"}</Badge>
                    </CardHeader>
                    <CardContent>
                      {observations.length ? <ol className="divide-y divide-[#dde0db] border-t border-[#dde0db]">
                        {observations.map((observation, index) => (
                          <li className="grid grid-cols-[28px_1fr] gap-3 py-4" key={`${observation}-${index}`}>
                            <span className="pt-0.5 font-mono text-[9px] font-bold text-[#1d6c50]">{String(index + 1).padStart(2, "0")}</span>
                            <p className="mb-0 text-xs leading-5 text-[#66746e]">{observation}</p>
                          </li>
                        ))}
                      </ol> : <p className="border-t border-[#dde0db] py-5 text-xs leading-5 text-[#78857f]">{t("overview.noChanges")}</p>}
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="mt-3 w-full rounded-full border-[#a9c6b8] bg-transparent text-xs font-bold text-[#175f47] hover:bg-[#e5efe8]">
                            <Plus className="size-4" /> {t("overview.addObservation")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-display text-2xl">{t("overview.addChange")}</DialogTitle>
                            <DialogDescription>{t("overview.addChangeHelp")}</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-2">
                            <Label htmlFor="observation">{t("overview.observation")}</Label>
                            <Textarea id="observation" value={draftObservation} onChange={(event) => setDraftObservation(event.target.value)} placeholder={t("overview.observationPlaceholder")} />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                            <Button className="bg-[#175f47] hover:bg-[#104b38]" onClick={addObservation}>{t("overview.saveObservation")}</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                </div>

                {riskScore && (
                  <section className="mt-4 grid gap-px overflow-hidden rounded-xl border border-[#293141] bg-[#293141] md:grid-cols-3 xl:grid-cols-6">
                    {riskScore.components.map((component) => (
                      <div className="bg-[#151922] p-4" key={component.id}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[9px] font-bold tracking-[.14em] text-[#7f8a99]">{t(`pillar.${component.id}` as MessageKey).toUpperCase()}</p>
                          <span className="text-lg font-semibold text-[#eef2f6]">{component.score ?? "—"}</span>
                        </div>
                        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#262d3a]"><div className="h-full bg-[#59bdd6]" style={{ width: `${component.score ?? 0}%` }} /></div>
                        <p className="mt-3 text-[9px] leading-4 text-[#7f8a99]">{component.inputsUsed}/{component.inputsExpected} {t("risk.inputs")}</p>
                      </div>
                    ))}
                  </section>
                )}

                <NfciYtdChart />
                <MarketSnapshotPanel />
                <MarketNewsPanel />
              </div>
            </TabsContent>

            <TabsContent value="sectors" className="m-0 focus-visible:outline-none">
              <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-7 lg:px-12 lg:py-10">
                <SectorViewPanel />
              </div>
            </TabsContent>

            <TabsContent value="indicators" className="m-0 focus-visible:outline-none">
              <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-7 lg:px-12 lg:py-10">
                <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_390px] lg:items-end">
                  <div>
                    <p className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-[#6f7d78]">{t("indicators.eyebrow").toUpperCase()}</p>
                    <h2 className="font-display text-4xl tracking-[-0.04em] sm:text-5xl">{t("indicators.title")}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66746e]">{t("indicators.description")}</p>
                  </div>
                  <Card className="border-[#c8d6a7] bg-[#dfeabf] shadow-none">
                    <CardContent className="flex gap-3 p-4 text-xs leading-5 text-[#385346]"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p className="mb-0"><strong>{t("indicators.discipline")}</strong> {t("indicators.disciplineText")}</p></CardContent>
                  </Card>
                </div>
                <SourceStatusPanel />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pillars.map((pillar, index) => (
                    <Card key={pillar.id} className="group border-[#d9ddd7] bg-[#fbfaf6] shadow-none transition hover:-translate-y-0.5 hover:border-[#a9bcb2] hover:shadow-[0_18px_45px_rgba(23,35,31,.07)]">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] font-bold text-[#78857f]">{String(index + 1).padStart(2, "0")}</span>
                          <div className="flex gap-1.5"><Badge variant="outline" className="text-[9px]">{t(`priority.${pillar.priority}` as MessageKey)}</Badge><Badge className={cn("border text-[9px] shadow-none", scoreClasses(pillar.score))}>{isLivePillar(pillar.id) ? `${pillar.score > 0 ? "+" : ""}${pillar.score}` : "—"}</Badge></div>
                        </div>
                        <CardTitle className="font-display text-3xl font-medium">{t(`pillar.${pillar.id}` as MessageKey)}</CardTitle>
                        <CardDescription className="min-h-10 text-xs leading-5">{pillar.question}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {pillar.indicators.map((indicator) => {
                            const source = sourceForIndicator(pillar.id, indicator);
                            return (
                              <span key={indicator} className="inline-flex items-center gap-1.5 rounded-full border border-[#dce0db] bg-white/60 px-2.5 py-1 text-[10px] text-[#5e6d66]">
                                {indicator}
                                {source && <i className="font-mono text-[7px] not-italic tracking-[0.08em] text-[#8a9690]">{source.providerShort.toUpperCase()}</i>}
                              </span>
                            );
                          })}
                        </div>
                        <Separator className="my-5" />
                        <div className="flex items-center justify-between text-[10px] text-[#6f7d78]"><span>{t("indicators.currentTrend")}</span><span className="flex items-center gap-1.5 font-semibold text-[#33453e]">{isLivePillar(pillar.id) ? <>{t(`trend.${pillar.trend}` as MessageKey)}<TrendIcon trend={pillar.trend} /></> : t("common.unavailable")}</span></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="senate" className="m-0 focus-visible:outline-none">
              <SenateTradesPanel />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </TooltipProvider>
  );
}
