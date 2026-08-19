"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronRight,
  CircleGauge,
  Database,
  LayoutDashboard,
  NotebookPen,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SourceStatusPanel } from "@/components/source-status-panel";
import { sourceForIndicator } from "@/lib/data/source-registry";
import {
  INITIAL_PILLARS,
  SCORE_OPTIONS,
  regimeFromScore,
  scoreLabel,
  totalScore,
  type Pillar,
  type Score,
} from "@/lib/macro";
import { cn } from "@/lib/utils";

const sampleMarkets = [
  { name: "S&P 500", symbol: "SPX", value: "6,462", move: "+0.28%", direction: "up" },
  { name: "Nasdaq 100", symbol: "NDX", value: "23,713", move: "+0.42%", direction: "up" },
  { name: "Equal weight", symbol: "RSP", value: "189.41", move: "−0.14%", direction: "down" },
  { name: "10Y real yield", symbol: "DFII10", value: "1.78%", move: "−3 bp", direction: "down-good" },
  { name: "High yield", symbol: "HY OAS", value: "2.89%", move: "+1 bp", direction: "flat" },
  { name: "Volatility", symbol: "VIX", value: "14.82", move: "−2.1%", direction: "down-good" },
];

const releaseCalendar = [
  { day: "20", month: "AUG", event: "FOMC minutes", importance: "High" },
  { day: "21", month: "AUG", event: "Initial jobless claims", importance: "Medium" },
  { day: "22", month: "AUG", event: "Powell at Jackson Hole", importance: "High" },
];

const dailyChecks = [
  "2Y and 10Y Treasury yields",
  "10Y real yield",
  "DXY / broad USD trend",
  "VIX and term structure",
  "SPX / NDX / RSP / Russell 2000",
  "Semiconductors and high-yield credit",
  "Oil / gold / copper",
  "Today’s macro releases and Fed speakers",
  "Earnings revisions and AI-capex news",
];

type ReviewState = {
  growth: string;
  inflation: string;
  liquidity: string;
  increaseExposure: string;
  reduceRisk: string;
  favoredSectors: string;
  pressuredSectors: string;
  invalidation: string;
};

const initialReview: ReviewState = {
  growth: "Stable",
  inflation: "Cooling",
  liquidity: "Expanding",
  increaseExposure: "Breadth improves while credit stays calm and real yields remain contained.",
  reduceRisk: "Credit spreads widen materially or the dollar and real yields rise together.",
  favoredSectors: "Quality technology, semiconductors, selective industrials",
  pressuredSectors: "Highly levered small caps and long-duration defensives",
  invalidation: "HY OAS > 350 bps with declining EPS revision breadth",
};

function scoreTone(score: Score) {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function scoreClasses(score: Score) {
  if (score > 0) return "border-[#a9c6b8] bg-[#e4efe8] text-[#155b43]";
  if (score < 0) return "border-[#e3beb7] bg-[#f6e7e3] text-[#9a463c]";
  return "border-[#dfcfaa] bg-[#f5ecd8] text-[#805c22]";
}

function TrendIcon({ trend }: { trend: Pillar["trend"] }) {
  if (trend === "Improving") return <ArrowUpRight className="size-4 text-[#1d6c50]" aria-hidden="true" />;
  if (trend === "Deteriorating") return <ArrowDownRight className="size-4 text-[#ae5548]" aria-hidden="true" />;
  return <ArrowRight className="size-4 text-[#68766f]" aria-hidden="true" />;
}

export function MacroDashboard() {
  const [pillars, setPillars] = useState(INITIAL_PILLARS);
  const [activeTab, setActiveTab] = useState("overview");
  const [observations, setObservations] = useState([
    "Real yields eased from the monthly high, reducing pressure on long-duration equities.",
    "Credit remained calm while the S&P 500 advanced.",
    "Breadth weakened as equal-weight lagged the headline index.",
  ]);
  const [draftObservation, setDraftObservation] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [review, setReview] = useState(initialReview);
  const [completedChecks, setCompletedChecks] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let storedState: {
      pillars?: Pillar[];
      observations?: string[];
      review?: ReviewState;
      completedChecks?: string[];
    } | null = null;
    try {
      const saved = window.localStorage.getItem("macro-monitor-state-v1");
      if (saved) {
        storedState = JSON.parse(saved);
      }
    } catch {
      // Keep the safe defaults if browser storage is unavailable or invalid.
    }
    const hydrationTimer = window.setTimeout(() => {
      if (storedState?.pillars?.length === INITIAL_PILLARS.length) setPillars(storedState.pillars);
      if (storedState?.observations) setObservations(storedState.observations);
      if (storedState?.review) setReview(storedState.review);
      if (storedState?.completedChecks) setCompletedChecks(storedState.completedChecks);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      "macro-monitor-state-v1",
      JSON.stringify({ pillars, observations, review, completedChecks }),
    );
  }, [completedChecks, hydrated, observations, pillars, review]);

  const total = useMemo(() => totalScore(pillars), [pillars]);
  const regime = useMemo(() => regimeFromScore(total), [total]);
  const supportive = pillars.filter((pillar) => pillar.score > 0);
  const pressures = pillars.filter((pillar) => pillar.score < 0);
  const completion = Math.round((completedChecks.length / dailyChecks.length) * 100);

  function updateScore(id: string, score: Score) {
    setPillars((current) => current.map((pillar) => (pillar.id === id ? { ...pillar, score } : pillar)));
  }

  function addObservation() {
    const value = draftObservation.trim();
    if (!value) return;
    setObservations((current) => [value, ...current].slice(0, 5));
    setDraftObservation("");
    setDialogOpen(false);
  }

  function resetWorkspace() {
    setPillars(INITIAL_PILLARS);
    setObservations([
      "Real yields eased from the monthly high, reducing pressure on long-duration equities.",
      "Credit remained calm while the S&P 500 advanced.",
      "Breadth weakened as equal-weight lagged the headline index.",
    ]);
    setReview(initialReview);
    setCompletedChecks([]);
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#f3f2ec] text-[#17231f]">
        <aside className="fixed inset-x-0 bottom-0 z-50 flex h-[68px] items-center border-t border-white/10 bg-[#102b24] px-4 text-white md:inset-y-0 md:left-0 md:right-auto md:h-auto md:w-[76px] md:flex-col md:border-r md:border-t-0 md:px-0 md:py-5">
          <button
            className="grid size-10 place-items-center rounded-full bg-[#cce77e] font-display text-lg font-bold text-[#102b24]"
            onClick={() => setActiveTab("overview")}
            aria-label="Macro monitor home"
          >
            M
          </button>
          <nav className="mx-auto flex gap-2 md:mt-16 md:grid" aria-label="Primary navigation">
            {[
              { value: "overview", label: "Overview", icon: LayoutDashboard },
              { value: "indicators", label: "Indicators", icon: BarChart3 },
              { value: "review", label: "Weekly review", icon: BookOpenCheck },
            ].map((item) => (
              <Tooltip key={item.value}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "grid size-10 place-items-center rounded-xl text-[#9dafaa] transition hover:bg-white/10 hover:text-[#cce77e]",
                      activeTab === item.value && "bg-white/10 text-[#cce77e]",
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="grid size-10 place-items-center rounded-full border border-white/25 text-[11px] font-bold md:mt-auto" aria-label="Profile">
                IC
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Local research workspace</TooltipContent>
          </Tooltip>
        </aside>

        <div className="pb-24 md:ml-[76px] md:pb-10">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <header className="sticky top-0 z-40 border-b border-[#d9ddd7]/90 bg-[#f3f2ec]/90 px-4 py-4 backdrop-blur-xl sm:px-7 lg:px-12">
              <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
                <div>
                  <p className="mb-1 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">MACRO ENVIRONMENT MONITOR</p>
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-xl font-medium tracking-tight sm:text-2xl">U.S. equity regime</h1>
                    <Badge variant="outline" className="hidden border-[#cad0ca] bg-white/55 text-[9px] tracking-[0.12em] text-[#617069] sm:inline-flex">
                      MANUAL MODE
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TabsList className="hidden h-10 rounded-full border border-[#d6dcd5] bg-[#faf9f5] p-1 lg:flex">
                    <TabsTrigger value="overview" className="rounded-full px-4 text-xs">Overview</TabsTrigger>
                    <TabsTrigger value="indicators" className="rounded-full px-4 text-xs">Indicators</TabsTrigger>
                    <TabsTrigger value="review" className="rounded-full px-4 text-xs">Review</TabsTrigger>
                  </TabsList>
                  <Button className="rounded-full bg-[#175f47] px-4 text-xs text-white hover:bg-[#104b38]" onClick={() => setActiveTab("review")}>
                    <NotebookPen className="size-4" />
                    <span className="hidden sm:inline">Start weekly review</span>
                    <span className="sm:hidden">Review</span>
                  </Button>
                </div>
              </div>
            </header>

            <TabsContent value="overview" className="m-0 focus-visible:outline-none">
              <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-12 lg:py-10">
                <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[10px] font-extrabold tracking-[0.18em] text-[#6f7d78]">WEEK 34 · SAMPLE WORKSPACE</p>
                    <h2 className="font-display text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Good evening, Ivor.</h2>
                  </div>
                  <p className="max-w-md text-xs leading-5 text-[#6f7d78]">Score the direction and interaction of multiple signals. No single indicator determines the regime.</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,.7fr)]">
                  <Card className="grid-bg overflow-hidden border-0 bg-[#175f47] text-white shadow-[0_24px_70px_rgba(23,95,71,.16)]">
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
                      <p className="text-[9px] font-extrabold tracking-[0.2em] text-white/55">CURRENT REGIME</p>
                      <span className="flex items-center gap-2 text-[9px] font-extrabold tracking-[0.16em] text-white/55">
                        <i className="size-2 rounded-full bg-[#cce77e] shadow-[0_0_0_5px_rgba(204,231,126,.12)]" /> WORKING VIEW
                      </span>
                    </CardHeader>
                    <CardContent className="pt-8">
                      <div className="grid gap-8 md:grid-cols-[1fr_.9fr] md:items-center">
                        <div>
                          <p className="mb-2 text-xs font-extrabold tracking-[0.1em] text-[#d6ef95]">{regime.label.toUpperCase()}</p>
                          <p className="font-display text-[88px] leading-[.82] tracking-[-0.08em] sm:text-[112px]">
                            {total > 0 ? "+" : ""}{total}<span className="ml-2 font-sans text-base tracking-normal text-white/45">/ 18</span>
                          </p>
                        </div>
                        <div className="border-t border-white/20 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                          <p className="font-display text-2xl leading-tight">{regime.posture}, with explicit invalidation signals.</p>
                          <p className="mt-3 text-xs leading-5 text-white/65">
                            {supportive.slice(0, 2).map((item) => item.area).join(" and ")} provide support
                            {pressures.length ? `, while ${pressures.map((item) => item.area.toLowerCase()).join(" and ")} constrain conviction.` : "."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-9 grid grid-cols-[auto_1fr_auto] items-center gap-3 text-[8px] font-bold tracking-[0.16em] text-white/45">
                        <span>HOSTILE</span>
                        <div className="relative h-px bg-white/20">
                          <i className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-[#175f47] bg-[#cce77e] outline outline-1 outline-[#cce77e]" style={{ left: `${((total + 18) / 36) * 100}%` }} />
                        </div>
                        <span>SUPPORTIVE</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#c7d7a0] bg-[#dcebb4] shadow-none">
                    <CardHeader className="flex-row items-start justify-between space-y-0">
                      <div>
                        <p className="text-[9px] font-extrabold tracking-[0.2em] text-[#55705e]">THIS WEEK’S FOCUS</p>
                        <CardTitle className="mt-8 font-display text-[28px] font-medium leading-[1.12] tracking-[-0.03em]">
                          Are credit and equities confirming the same liquidity message?
                        </CardTitle>
                      </div>
                      <span className="font-mono text-[10px] text-[#55705e]">01</span>
                    </CardHeader>
                    <CardContent className="mt-auto pt-7">
                      <Button variant="ghost" className="w-full justify-between rounded-full px-0 text-xs font-bold hover:bg-transparent" onClick={() => setActiveTab("review")}>
                        Open review checklist <ArrowRight className="size-4" />
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                    <CardHeader className="flex-row items-end justify-between space-y-0">
                      <div>
                        <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">9 PILLARS · CLICK A SCORE TO EDIT</p>
                        <CardTitle className="font-display text-3xl font-medium tracking-tight">Weekly scorecard</CardTitle>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs text-[#175f47]" onClick={() => setActiveTab("indicators")}>
                        All indicators <ChevronRight className="size-4" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="divide-y divide-[#dde0db] border-t border-[#dde0db]">
                        {pillars.map((pillar) => (
                          <div className="grid min-h-[64px] grid-cols-[10px_minmax(90px,1fr)_minmax(150px,auto)] items-center gap-3 py-2 sm:grid-cols-[10px_minmax(120px,1fr)_150px_120px]" key={pillar.id}>
                            <span className={cn("size-2 rounded-full", scoreTone(pillar.score) === "positive" ? "bg-[#1d6c50]" : scoreTone(pillar.score) === "negative" ? "bg-[#ae5548]" : "bg-[#b78334]")} />
                            <div>
                              <p className="mb-0 text-sm font-semibold">{pillar.area}</p>
                              <p className="mb-0 mt-0.5 hidden text-[10px] text-[#78857f] md:block">{pillar.change}</p>
                            </div>
                            <Select value={String(pillar.score)} onValueChange={(value) => updateScore(pillar.id, Number(value) as Score)}>
                              <SelectTrigger className={cn("h-8 w-full rounded-full border px-3 text-[10px] font-bold shadow-none", scoreClasses(pillar.score))} aria-label={`Score ${pillar.area}`}>
                                <SelectValue>{scoreLabel(pillar.score)}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {SCORE_OPTIONS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label} ({option.value > 0 ? "+" : ""}{option.value})</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <div className="hidden items-center justify-end gap-2 text-[10px] text-[#6f7d78] sm:flex">
                              {pillar.trend}<TrendIcon trend={pillar.trend} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                    <CardHeader className="flex-row items-end justify-between space-y-0">
                      <div>
                        <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">WEEKLY DELTA</p>
                        <CardTitle className="font-display text-3xl font-medium tracking-tight">What changed</CardTitle>
                      </div>
                      <Badge variant="secondary" className="rounded-md font-mono text-[9px]">W34</Badge>
                    </CardHeader>
                    <CardContent>
                      <ol className="divide-y divide-[#dde0db] border-t border-[#dde0db]">
                        {observations.map((observation, index) => (
                          <li className="grid grid-cols-[28px_1fr] gap-3 py-4" key={`${observation}-${index}`}>
                            <span className="pt-0.5 font-mono text-[9px] font-bold text-[#1d6c50]">{String(index + 1).padStart(2, "0")}</span>
                            <p className="mb-0 text-xs leading-5 text-[#66746e]">{observation}</p>
                          </li>
                        ))}
                      </ol>
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="mt-3 w-full rounded-full border-[#a9c6b8] bg-transparent text-xs font-bold text-[#175f47] hover:bg-[#e5efe8]">
                            <Plus className="size-4" /> Add observation
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-display text-2xl">Add this week’s change</DialogTitle>
                            <DialogDescription>Record the signal, its direction, and why it matters for U.S. equities.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-2">
                            <Label htmlFor="observation">Observation</Label>
                            <Textarea id="observation" value={draftObservation} onChange={(event) => setDraftObservation(event.target.value)} placeholder="Example: High-yield spreads widened while the index made a new high…" />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button className="bg-[#175f47] hover:bg-[#104b38]" onClick={addObservation}>Save observation</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                </div>

                <section className="mt-4">
                  <div className="mb-4 flex items-end justify-between">
                    <div><p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">CROSS-ASSET CONFIRMATION</p><h3 className="font-display text-3xl">Market snapshot</h3></div>
                    <Badge variant="outline" className="border-[#d4d9d3] bg-[#fbfaf6] text-[9px] text-[#6f7d78]">ILLUSTRATIVE DATA</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {sampleMarkets.map((market) => (
                      <Card key={market.symbol} className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between"><span className="font-mono text-[9px] font-bold text-[#718079]">{market.symbol}</span><Activity className="size-3.5 text-[#8b9892]" /></div>
                          <p className="mb-0 mt-5 text-2xl font-semibold tracking-[-0.04em]">{market.value}</p>
                          <div className="mt-1 flex items-center justify-between text-[10px]"><span className="text-[#74817b]">{market.name}</span><span className={market.direction === "up" || market.direction === "down-good" ? "text-[#1d6c50]" : market.direction === "down" ? "text-[#ae5548]" : "text-[#7b6a45]"}>{market.move}</span></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="indicators" className="m-0 focus-visible:outline-none">
              <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-7 lg:px-12 lg:py-10">
                <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_390px] lg:items-end">
                  <div>
                    <p className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-[#6f7d78]">SIGNAL LIBRARY</p>
                    <h2 className="font-display text-4xl tracking-[-0.04em] sm:text-5xl">Indicators by pillar</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66746e]">Use primary data, score the direction rather than the absolute level, and record the mechanism connecting each signal to equities.</p>
                  </div>
                  <Card className="border-[#c8d6a7] bg-[#dfeabf] shadow-none">
                    <CardContent className="flex gap-3 p-4 text-xs leading-5 text-[#385346]"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p className="mb-0"><strong>Research discipline:</strong> verify hypotheses with the Federal Reserve, Treasury, BLS, BEA, Census, SEC filings, and company transcripts.</p></CardContent>
                  </Card>
                </div>
                <SourceStatusPanel />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pillars.map((pillar, index) => (
                    <Card key={pillar.id} className="group border-[#d9ddd7] bg-[#fbfaf6] shadow-none transition hover:-translate-y-0.5 hover:border-[#a9bcb2] hover:shadow-[0_18px_45px_rgba(23,35,31,.07)]">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] font-bold text-[#78857f]">{String(index + 1).padStart(2, "0")}</span>
                          <div className="flex gap-1.5"><Badge variant="outline" className="text-[9px]">{pillar.priority}</Badge><Badge className={cn("border text-[9px] shadow-none", scoreClasses(pillar.score))}>{pillar.score > 0 ? "+" : ""}{pillar.score}</Badge></div>
                        </div>
                        <CardTitle className="font-display text-3xl font-medium">{pillar.area}</CardTitle>
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
                        <div className="flex items-center justify-between text-[10px] text-[#6f7d78]"><span>Current trend</span><span className="flex items-center gap-1.5 font-semibold text-[#33453e]">{pillar.trend}<TrendIcon trend={pillar.trend} /></span></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="review" className="m-0 focus-visible:outline-none">
              <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-7 lg:px-12 lg:py-10">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-[#6f7d78]">REPEATABLE PROCESS</p>
                    <h2 className="font-display text-4xl tracking-[-0.04em] sm:text-5xl">Weekly macro review</h2>
                    <p className="mt-3 text-sm text-[#66746e]">Your entries save automatically on this device.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-full" onClick={resetWorkspace}><RotateCcw className="size-4" /> Reset sample</Button>
                    <Button className="rounded-full bg-[#175f47] hover:bg-[#104b38]"><Save className="size-4" /> Saved locally</Button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
                  <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                    <CardHeader>
                      <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#e1eadf] text-[#175f47]"><CircleGauge className="size-5" /></div><div><CardTitle className="font-display text-2xl">1. Define the regime</CardTitle><CardDescription>Classify the three drivers before interpreting the market.</CardDescription></div></div>
                    </CardHeader>
                    <CardContent className="grid gap-5 sm:grid-cols-3">
                      {[
                        { key: "growth", label: "Growth", options: ["Accelerating", "Stable", "Slowing"] },
                        { key: "inflation", label: "Inflation", options: ["Accelerating", "Stable", "Cooling"] },
                        { key: "liquidity", label: "Liquidity", options: ["Expanding", "Neutral", "Contracting"] },
                      ].map((field) => (
                        <div className="grid gap-2" key={field.key}>
                          <Label>{field.label}</Label>
                          <Select value={review[field.key as keyof Pick<ReviewState, "growth" | "inflation" | "liquidity">]} onValueChange={(value) => setReview((current) => ({ ...current, [field.key]: value }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{field.options.map((option) => <SelectItem value={option} key={option}>{option}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-[#c8d6a7] bg-[#dfeabf] shadow-none xl:row-span-2">
                    <CardHeader>
                      <div className="flex items-center justify-between"><div><p className="mb-2 text-[9px] font-extrabold tracking-[0.18em] text-[#58705f]">DAILY 5-MINUTE CHECK</p><CardTitle className="font-display text-2xl">Market pulse</CardTitle></div><span className="font-mono text-xs font-bold">{completion}%</span></div>
                      <Progress value={completion} className="mt-2 h-1.5 bg-white/55" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {dailyChecks.map((item) => {
                        const checked = completedChecks.includes(item);
                        return (
                          <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 text-xs leading-5 transition hover:bg-white/30" key={item}>
                            <button
                              type="button"
                              className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded border", checked ? "border-[#175f47] bg-[#175f47] text-white" : "border-[#8ca293] bg-white/40")}
                              onClick={() => setCompletedChecks((current) => checked ? current.filter((value) => value !== item) : [...current, item])}
                              aria-pressed={checked}
                              aria-label={`${checked ? "Uncheck" : "Check"} ${item}`}
                            >
                              {checked && <Check className="size-3" />}
                            </button>
                            <span className={checked ? "text-[#5f7066] line-through" : "text-[#2f473b]"}>{item}</span>
                          </label>
                        );
                      })}
                    </CardContent>
                  </Card>

                  <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                    <CardHeader>
                      <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#e1eadf] text-[#175f47]"><TrendingUp className="size-5" /></div><div><CardTitle className="font-display text-2xl">2. Portfolio implications</CardTitle><CardDescription>Write conditional actions, not unconditional forecasts.</CardDescription></div></div>
                    </CardHeader>
                    <CardContent className="grid gap-5 md:grid-cols-2">
                      {[
                        { key: "increaseExposure", label: "Increase exposure if" },
                        { key: "reduceRisk", label: "Reduce risk if" },
                        { key: "favoredSectors", label: "Sectors favored" },
                        { key: "pressuredSectors", label: "Sectors under pressure" },
                      ].map((field) => (
                        <div className="grid gap-2" key={field.key}>
                          <Label htmlFor={field.key}>{field.label}</Label>
                          <Textarea id={field.key} className="min-h-24 resize-none bg-white/55" value={review[field.key as keyof ReviewState]} onChange={(event) => setReview((current) => ({ ...current, [field.key]: event.target.value }))} />
                        </div>
                      ))}
                      <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="invalidation">Key invalidation signal</Label>
                        <Input id="invalidation" value={review.invalidation} onChange={(event) => setReview((current) => ({ ...current, invalidation: event.target.value }))} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none xl:col-span-2">
                    <CardHeader className="flex-row items-center justify-between space-y-0">
                      <div><CardTitle className="font-display text-2xl">Upcoming releases</CardTitle><CardDescription>Events to include in the next review.</CardDescription></div><CalendarDays className="size-5 text-[#6f7d78]" />
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                      {releaseCalendar.map((release) => (
                        <div key={release.event} className="flex items-center gap-4 rounded-2xl border border-[#dde0db] bg-white/45 p-4">
                          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#173f34] text-white"><span className="text-lg font-bold leading-none">{release.day}</span><span className="text-[8px] tracking-[.15em] text-white/60">{release.month}</span></div>
                          <div><p className="mb-1 text-sm font-semibold">{release.event}</p><Badge variant="outline" className="h-5 text-[8px]">{release.importance}</Badge></div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card className="mt-4 border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                  <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="flex gap-3"><Database className="mt-0.5 size-5 shrink-0 text-[#175f47]" /><div><p className="mb-1 text-sm font-semibold">The public source pipeline is active</p><p className="mb-0 text-xs leading-5 text-[#6f7d78]">Treasury and BLS readings load without credentials. Add a server-side FRED API key to enable Federal Reserve, rates, and credit series. Scores remain manually controlled.</p></div></div>
                    <Button variant="outline" className="rounded-full" onClick={() => setActiveTab("indicators")}><Settings2 className="size-4" /> Review source map</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </TooltipProvider>
  );
}
