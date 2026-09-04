"use client";

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Download,
  GitCompareArrows,
  History,
  Save,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  compareLatestReviews,
  outcomeRatingLabel,
  reviewToMarkdown,
  sortReviewHistory,
  type HypothesisDraft,
  type OutcomeRating,
  type ReviewOutcome,
  type WeeklyReviewSnapshot,
} from "@/lib/review-history";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type WeeklyHistoryPanelProps = {
  history: WeeklyReviewSnapshot[];
  totalScore: number;
  regimeLabel: string;
  posture: string;
  defaultInvalidation: string;
  onSaveReview: (reviewDate: string, hypothesis: HypothesisDraft) => Promise<string | null>;
  onUpdateOutcome: (id: string, outcome: Pick<ReviewOutcome, "rating" | "note">) => void;
};

const OUTCOME_OPTIONS: Array<{ value: Exclude<OutcomeRating, null>; label: string }> = [
  { value: 2, label: "Confirmed" },
  { value: 1, label: "Mostly right" },
  { value: 0, label: "Mixed" },
  { value: -1, label: "Mostly wrong" },
  { value: -2, label: "Invalidated" },
];

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatReviewDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function downloadReview(review: WeeklyReviewSnapshot, previous?: WeeklyReviewSnapshot) {
  const blob = new Blob([reviewToMarkdown(review, previous)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `macro-review-${review.reviewDate}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export function WeeklyHistoryPanel({
  history,
  totalScore,
  regimeLabel,
  posture,
  defaultInvalidation,
  onSaveReview,
  onUpdateOutcome,
}: WeeklyHistoryPanelProps) {
  const { intlLocale, t } = useI18n();
  const [reviewDate, setReviewDate] = useState(localDateInputValue);
  const [hypothesis, setHypothesis] = useState<HypothesisDraft>({
    claim: "",
    mechanism: "",
    horizon: "1–3 months",
    confirmation: "",
    invalidation: defaultInvalidation,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const orderedHistory = useMemo(() => sortReviewHistory(history), [history]);
  const comparison = useMemo(() => compareLatestReviews(history), [history]);

  function updateHypothesis(key: keyof HypothesisDraft, value: string) {
    setHypothesis((current) => ({ ...current, [key]: value }));
  }

  async function saveReview() {
    setMessage(null);
    setSaved(false);
    const missing = Object.entries(hypothesis).find(([, value]) => !value.trim());
    if (!reviewDate || missing) {
      setMessage("Choose a date and complete all five hypothesis fields before saving.");
      return;
    }

    setSaving(true);
    const error = await onSaveReview(reviewDate, hypothesis);
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }

    setSaved(true);
    setMessage("Review saved with a frozen copy of the currently available source readings.");
    setHypothesis((current) => ({
      ...current,
      claim: "",
      mechanism: "",
      confirmation: "",
    }));
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-7 lg:px-12 lg:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-[#6f7d78]">{t("journal.eyebrow").toUpperCase()}</p>
          <h2 className="font-display text-4xl tracking-[-0.04em] sm:text-5xl">{t("journal.title")}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66746e]">
            Freeze the evidence behind each decision, compare it with the prior review, and score the thesis only after its stated horizon.
          </p>
        </div>
        <Badge variant="outline" className="border-[#a9c6b8] bg-[#e4efe8] text-[#155b43]">
          {history.length} saved {history.length === 1 ? "review" : "reviews"}
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
        <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="font-display text-3xl">{t("journal.save")}</CardTitle>
                <CardDescription className="mt-1">{t("journal.saveHelp")}</CardDescription>
              </div>
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e1eadf] text-[#175f47]">
                <CalendarPlus className="size-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 rounded-2xl border border-[#dce0db] bg-white/45 p-4 sm:grid-cols-[180px_1fr] sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="review-date">{t("journal.reviewDate")}</Label>
                <Input id="review-date" type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div><p className="text-[9px] font-bold tracking-[0.12em] text-[#78857f]">{t("journal.regime").toUpperCase()}</p><p className="mt-1 text-sm font-semibold">{regimeLabel}</p></div>
                <div><p className="text-[9px] font-bold tracking-[0.12em] text-[#78857f]">{t("journal.score").toUpperCase()}</p><p className="mt-1 text-sm font-semibold">{totalScore} / 100</p></div>
                <div><p className="text-[9px] font-bold tracking-[0.12em] text-[#78857f]">{t("journal.posture").toUpperCase()}</p><p className="mt-1 text-sm font-semibold">{posture}</p></div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="hypothesis-claim">{t("journal.claim")}</Label>
                <Textarea id="hypothesis-claim" className="min-h-20 resize-none bg-white/55" value={hypothesis.claim} onChange={(event) => updateHypothesis("claim", event.target.value)} placeholder="What do you believe is happening?" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hypothesis-mechanism">{t("journal.mechanism")}</Label>
                <Textarea id="hypothesis-mechanism" className="min-h-24 resize-none bg-white/55" value={hypothesis.mechanism} onChange={(event) => updateHypothesis("mechanism", event.target.value)} placeholder="Why should this affect U.S. equities?" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hypothesis-confirmation">{t("journal.confirmation")}</Label>
                <Textarea id="hypothesis-confirmation" className="min-h-24 resize-none bg-white/55" value={hypothesis.confirmation} onChange={(event) => updateHypothesis("confirmation", event.target.value)} placeholder="What other evidence should agree?" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hypothesis-horizon">{t("journal.horizon")}</Label>
                <Select value={hypothesis.horizon} onValueChange={(value) => updateHypothesis("horizon", value)}>
                  <SelectTrigger id="hypothesis-horizon"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Days", "Weeks", "1–3 months", "6–12 months", "Full cycle"].map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hypothesis-invalidation">{t("journal.invalidation")}</Label>
                <Input id="hypothesis-invalidation" value={hypothesis.invalidation} onChange={(event) => updateHypothesis("invalidation", event.target.value)} placeholder="What would prove the thesis wrong?" />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e3df] pt-4">
              <p className={cn("text-xs", saved ? "text-[#175f47]" : "text-[#8a5a51]")} aria-live="polite">
                {message ?? "A saved date is immutable; use a new date for the next review."}
              </p>
              <Button className="rounded-full bg-[#175f47] hover:bg-[#104b38]" onClick={() => void saveReview()} disabled={saving}>
                <Save className="size-4" /> {saving ? "Capturing…" : "Save dated review"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#c8d6a7] bg-[#dfeabf] shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div><CardTitle className="font-display text-2xl">{t("journal.latestPrior")}</CardTitle><CardDescription className="mt-1 text-[#58705f]">{t("journal.savedOnly")}</CardDescription></div>
              <GitCompareArrows className="size-5 text-[#175f47]" />
            </div>
          </CardHeader>
          <CardContent>
            {!comparison ? (
              <div className="rounded-2xl border border-[#b9c99e] bg-white/25 p-5 text-sm leading-6 text-[#52685a]">
                Save at least two dated reviews to unlock score, pillar, and reading comparisons.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/35 p-4"><p className="text-[9px] font-bold tracking-[.12em] text-[#657865]">{t("journal.current").toUpperCase()}</p><p className="mt-1 font-display text-2xl">{comparison.current.totalScore > 0 ? "+" : ""}{comparison.current.totalScore}</p><p className="text-[10px] text-[#657865]">{formatReviewDate(comparison.current.reviewDate, intlLocale)}</p></div>
                  <div className="rounded-2xl bg-white/35 p-4"><p className="text-[9px] font-bold tracking-[.12em] text-[#657865]">{t("journal.change").toUpperCase()}</p><p className="mt-1 font-display text-2xl">{comparison.scoreDelta > 0 ? "+" : ""}{comparison.scoreDelta}</p><p className="text-[10px] text-[#657865]">{comparison.regimeChanged ? t("journal.regimeChanged") : t("journal.regimeUnchanged")}</p></div>
                </div>
                <div>
                  <p className="mb-2 text-[9px] font-extrabold tracking-[.14em] text-[#657865]">{t("journal.pillarMoves").toUpperCase()}</p>
                  <div className="space-y-2">
                    {comparison.pillarChanges.length ? comparison.pillarChanges.map((change) => (
                      <div key={change.id} className="flex items-center justify-between rounded-xl bg-white/30 px-3 py-2 text-xs"><span>{change.area}</span><span className="font-mono font-bold">{change.previousScore} → {change.currentScore}</span></div>
                    )) : <p className="text-xs text-[#657865]">{t("journal.noPillarMoves")}</p>}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[9px] font-extrabold tracking-[.14em] text-[#657865]">{t("journal.readingMoves").toUpperCase()}</p>
                  <div className="space-y-2">
                    {comparison.indicatorChanges.length ? comparison.indicatorChanges.slice(0, 5).map((change) => (
                      <div key={change.id} className="rounded-xl bg-white/30 px-3 py-2 text-xs"><p className="font-semibold">{change.indicator}</p><p className="mt-0.5 font-mono text-[10px] text-[#657865]">{change.previousDisplayValue} → {change.currentDisplayValue}</p></div>
                    )) : <p className="text-xs text-[#657865]">{t("journal.noReadingMoves")}</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="review-history-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><p className="mb-2 text-[9px] font-extrabold tracking-[0.18em] text-[#6f7d78]">{t("journal.historyEyebrow").toUpperCase()}</p><h3 id="review-history-title" className="font-display text-3xl">{t("journal.history")}</h3></div>
          <History className="size-5 text-[#6f7d78]" />
        </div>

        {!orderedHistory.length ? (
          <Card className="border-dashed border-[#cfd5cf] bg-[#fbfaf6]/60 shadow-none">
            <CardContent className="grid min-h-40 place-items-center p-6 text-center"><div><Clock3 className="mx-auto mb-3 size-6 text-[#829088]" /><p className="text-sm font-semibold">{t("journal.empty")}</p><p className="mt-1 text-xs text-[#74817b]">{t("journal.emptyHelp")}</p></div></CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {orderedHistory.map((review, index) => {
              const previous = orderedHistory[index + 1];
              const unavailable = review.indicatorReadings.filter((reading) => reading.freshness === "unavailable").length;
              return (
                <Card key={review.id} className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div><p className="text-[9px] font-bold tracking-[.14em] text-[#74817b]">{formatReviewDate(review.reviewDate, intlLocale)}</p><CardTitle className="mt-1 font-display text-2xl">{review.regimeLabel}</CardTitle><CardDescription>{review.posture} · {review.totalScore} / {review.scoreScale ?? 18}</CardDescription></div>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => downloadReview(review, previous)}><Download className="size-3.5" /> {t("journal.export")}</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-[#e1e3df] bg-white/40 p-4"><p className="text-[9px] font-bold tracking-[.13em] text-[#74817b]">CLAIM</p><p className="mt-1 text-sm leading-5">{review.hypothesis.claim}</p><p className="mt-2 text-[10px] text-[#74817b]">Horizon: {review.hypothesis.horizon}</p></div>
                    <div className="flex flex-wrap gap-2 text-[9px]"><Badge variant="outline">{review.pillars.length} pillars</Badge><Badge variant="outline">{review.indicatorReadings.length} readings</Badge>{unavailable > 0 && <Badge variant="outline" className="border-[#e3beb7] text-[#9a463c]">{unavailable} unavailable</Badge>}<Badge variant="outline">{review.completedChecks.length} checks</Badge></div>
                    <div className="grid gap-3 border-t border-[#e1e3df] pt-4 sm:grid-cols-[180px_1fr]">
                      <div className="grid gap-2">
                        <Label htmlFor={`outcome-${review.id}`}>{t("journal.outcome")}</Label>
                        <Select value={review.outcome.rating === null ? "pending" : String(review.outcome.rating)} onValueChange={(value) => onUpdateOutcome(review.id, { rating: value === "pending" ? null : Number(value) as Exclude<OutcomeRating, null>, note: review.outcome.note })}>
                          <SelectTrigger id={`outcome-${review.id}`}><SelectValue>{outcomeRatingLabel(review.outcome.rating)}</SelectValue></SelectTrigger>
                          <SelectContent><SelectItem value="pending">{t("journal.notReviewed")}</SelectItem>{OUTCOME_OPTIONS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2"><Label htmlFor={`outcome-note-${review.id}`}>{t("journal.outcomeEvidence")}</Label><Textarea id={`outcome-note-${review.id}`} className="min-h-20 resize-none bg-white/55" value={review.outcome.note} onChange={(event) => onUpdateOutcome(review.id, { rating: review.outcome.rating, note: event.target.value })} placeholder="What happened, and which confirmation or invalidation signal fired?" /></div>
                    </div>
                    {review.outcome.evaluatedAt && <p className="flex items-center gap-1.5 text-[9px] text-[#74817b]"><CheckCircle2 className="size-3" /> Outcome revisited {new Date(review.outcome.evaluatedAt).toLocaleDateString(intlLocale)}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
