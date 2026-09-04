"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, LoaderCircle, RefreshCw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  NormalizedSenateTransaction,
  SenateParty,
  SenateTradesResponse,
  SenateWindow,
} from "@/lib/data/senate-trades";
import { SENATE_WINDOWS } from "@/lib/data/senate-trades";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function formatDate(value: string | null, locale: string, unavailable: string) {
  if (!value) return unavailable;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function formatRefresh(value: string | null, locale: string, unavailable: string) {
  if (!value) return unavailable;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

function partyTone(party: SenateParty) {
  if (party === "Democratic") return "border-[#b9cce2] bg-[#e7eff8] text-[#285986]";
  if (party === "Republican") return "border-[#e3beb7] bg-[#f6e7e3] text-[#93453b]";
  if (party === "Independent/Other") return "border-[#c8d6a7] bg-[#e8efd5] text-[#526a34]";
  return "border-[#dfcfaa] bg-[#f5ecd8] text-[#805c22]";
}

function SourceLink({ transaction }: { transaction: NormalizedSenateTransaction }) {
  const { t } = useI18n();
  if (!transaction.filingUrl) return <span className="text-[#8b9691]">{t("senate.noLink")}</span>;
  return (
    <a href={transaction.filingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#175f47] hover:underline">
      {t("senate.filing")} <ExternalLink className="size-3" />
    </a>
  );
}

export function SenateTradesPanel() {
  const { intlLocale, t } = useI18n();
  const [windowValue, setWindowValue] = useState<SenateWindow>("90D");
  const [payload, setPayload] = useState<SenateTradesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [party, setParty] = useState("all");
  const [owner, setOwner] = useState("all");
  const [transactionType, setTransactionType] = useState("all");
  const [tickerQuery, setTickerQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/senate-trades?window=${windowValue}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Senate trades endpoint returned ${response.status}.`);
        return response.json() as Promise<SenateTradesResponse>;
      })
      .then((nextPayload) => {
        if (!active) return;
        setPayload(nextPayload);
        setStatus("ready");
        setSelectedTicker(null);
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [reloadToken, windowValue]);

  const filteredTransactions = useMemo(() => (payload?.transactions ?? []).filter((transaction) =>
    (party === "all" || transaction.partyAtTrade === party)
    && (owner === "all" || transaction.owner === owner)
    && (transactionType === "all" || transaction.transactionType === transactionType)
    && (!tickerQuery.trim() || transaction.canonicalTicker?.includes(tickerQuery.trim().toUpperCase())),
  ), [owner, party, payload?.transactions, tickerQuery, transactionType]);

  const tickerTransactions = useMemo(() => selectedTicker
    ? (payload?.transactions ?? []).filter((transaction) => transaction.canonicalTicker === selectedTicker)
    : [], [payload?.transactions, selectedTicker]);
  const parties = [...new Set((payload?.transactions ?? []).map((transaction) => transaction.partyAtTrade))];
  const owners = [...new Set((payload?.transactions ?? []).map((transaction) => transaction.owner))];
  const transactionTypes = [...new Set((payload?.transactions ?? []).map((transaction) => transaction.transactionType))];

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-7 lg:px-12 lg:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-extrabold tracking-[0.2em] text-[#6f7d78]">{t("senate.eyebrow").toUpperCase()}</p>
          <h2 className="font-display text-4xl tracking-[-0.04em] sm:text-5xl">{t("senate.title")}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66746e]">
            {t("senate.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-[#d4d9d3] bg-[#fbfaf6] p-1" aria-label={t("senate.window")}>
            {SENATE_WINDOWS.map((option) => (
              <button
                key={option}
                className={cn("rounded-full px-3 py-1.5 text-xs font-semibold text-[#68766f]", windowValue === option && "bg-[#175f47] text-white")}
                onClick={() => {
                  setStatus("loading");
                  setWindowValue(option);
                }}
                aria-pressed={windowValue === option}
              >
                {option}
              </button>
            ))}
          </div>
          <Button variant="outline" className="rounded-full" onClick={() => {
            setStatus("loading");
            setReloadToken((value) => value + 1);
          }}>
            <RefreshCw className={cn("size-4", status === "loading" && "animate-spin")} /> {t("common.refresh")}
          </Button>
        </div>
      </div>

      {status === "loading" && !payload && (
        <div className="grid min-h-64 place-items-center rounded-2xl border border-[#d9ddd7] bg-[#fbfaf6]">
          <LoaderCircle className="size-6 animate-spin text-[#718079]" aria-label={t("senate.loading")} />
        </div>
      )}

      {status === "error" && !payload && (
        <Card className="border-[#e3beb7] bg-[#f6e7e3] shadow-none">
          <CardContent className="grid min-h-48 place-items-center p-6 text-center text-sm text-[#813d35]">
            {t("senate.routeError")}
          </CardContent>
        </Card>
      )}

      {payload?.status === "unavailable" && (
        <Card className="border-[#e3beb7] bg-[#f6e7e3] shadow-none">
          <CardContent className="grid min-h-52 place-items-center p-6 text-center">
            <div>
              <AlertTriangle className="mx-auto mb-3 size-7 text-[#9a463c]" />
              <p className="font-display text-2xl text-[#813d35]">{t("senate.unavailable")}</p>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-[#955d54]">{payload.errorMessage}</p>
              <p className="mt-3 text-[10px] text-[#955d54]">{t("senate.noRankings")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {payload && payload.status !== "unavailable" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: t("senate.eligible"), value: String(payload.overview.eligiblePurchases), isRefresh: false },
              { label: t("senate.households"), value: String(payload.overview.distinctSenatorHouseholds), isRefresh: false },
              { label: t("senate.bipartisanTickers"), value: String(payload.overview.bipartisanTickers), isRefresh: false },
              { label: t("senate.medianLag"), value: payload.overview.medianDisclosureLagDays === null ? "—" : t("senate.daysValue", { count: payload.overview.medianDisclosureLagDays }), isRefresh: false },
              { label: t("senate.lastRefresh"), value: formatRefresh(payload.lastSuccessfulRefresh, intlLocale, t("senate.noRefresh")), isRefresh: true },
            ].map(({ label, value, isRefresh }) => (
              <Card key={label} className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
                <CardContent className="p-4">
                  <p className="text-[8px] font-extrabold tracking-[.14em] text-[#74817b]">{label.toUpperCase()}</p>
                  <p className={cn("mt-2 font-display text-2xl", isRefresh && "font-sans text-sm font-semibold leading-5")}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
            <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mb-2 text-[9px] font-extrabold tracking-[.18em] text-[#6f7d78]">{t("senate.partyHouseholds").toUpperCase()}</p>
                    <CardTitle className="font-display text-3xl">{t("senate.bipartisan")}</CardTitle>
                  </div>
                  <Badge variant="outline" className="border-[#d4d9d3]">{t("senate.transactionFrom", { date: formatDate(payload.windowStart, intlLocale, t("common.unavailable")) })}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead className="border-y border-[#dfe2dd] text-[8px] font-bold tracking-[.12em] text-[#74817b]">
                      <tr>
                        <th className="py-3 pr-3">TICKER / COMPANY</th>
                        <th className="px-3">DEM</th>
                        <th className="px-3">REP</th>
                        <th className="px-3">TOTAL</th>
                        <th className="px-3">EVENTS</th>
                        <th className="px-3">DISCLOSED RANGE</th>
                        <th className="px-3">LATEST TRADE</th>
                        <th className="pl-3">FRESHNESS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e4e6e2]">
                      {payload.bipartisan.map((item) => (
                        <tr key={item.ticker}>
                          <td className="py-3 pr-3">
                            <button className="text-left" onClick={() => setSelectedTicker(item.ticker)}>
                              <span className="font-mono font-bold text-[#175f47] hover:underline">{item.ticker}</span>
                              <span className="mt-0.5 block max-w-52 truncate text-[10px] text-[#74817b]">{item.company}</span>
                            </button>
                          </td>
                          <td className="px-3 font-semibold text-[#285986]">{item.democraticBuyers}</td>
                          <td className="px-3 font-semibold text-[#93453b]">{item.republicanBuyers}</td>
                          <td className="px-3 font-semibold">{item.totalDistinctBuyers}</td>
                          <td className="px-3">{item.purchaseEvents}</td>
                          <td className="px-3 font-mono text-[10px]">{item.amountRange.display}</td>
                          <td className="px-3">{formatDate(item.latestTradeDate, intlLocale, t("common.unavailable"))}</td>
                          <td className="pl-3"><Badge variant="outline" className={item.freshness === "fresh" ? "border-[#a9c6b8] text-[#155b43]" : "border-[#dfcfaa] text-[#805c22]"}>{item.freshness}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!payload.bipartisan.length && (
                    <p className="py-10 text-center text-xs text-[#74817b]">{t("senate.noBipartisan")}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#c8d6a7] bg-[#dfeabf] shadow-none">
              <CardHeader>
                <CardTitle className="font-display text-3xl">{t("senate.popular")}</CardTitle>
                <p className="text-xs leading-5 text-[#58705f]">{t("senate.popularHelp")}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {(["Democratic", "Republican", "Independent/Other"] as const).map((partyName) => (
                  <div key={partyName}>
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline" className={partyTone(partyName)}>{partyName}</Badge>
                      <span className="text-[9px] text-[#68796e]">{t("senate.topTen")}</span>
                    </div>
                    <ol className="space-y-1.5">
                      {payload.popularByParty[partyName].map((item, index) => (
                        <li key={`${partyName}-${item.ticker}`}>
                          <button className="grid w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded-xl bg-white/30 px-2.5 py-2 text-left hover:bg-white/45" onClick={() => setSelectedTicker(item.ticker)}>
                            <span className="font-mono text-[9px] text-[#718079]">{String(index + 1).padStart(2, "0")}</span>
                            <span><strong className="font-mono text-xs">{item.ticker}</strong><span className="ml-2 text-[9px] text-[#718079]">{t("senate.events", { count: item.purchaseEvents })}</span></span>
                            <span className="text-[10px] font-semibold">{t("senate.buyers", { count: item.distinctBuyers })}</span>
                          </button>
                        </li>
                      ))}
                      {!payload.popularByParty[partyName].length && <li className="text-[10px] text-[#718079]">{t("senate.noEligible")}</li>}
                    </ol>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {selectedTicker && (
            <Card className="mt-4 border-[#9fb9ad] bg-[#edf2ec] shadow-none">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <p className="mb-2 text-[9px] font-extrabold tracking-[.18em] text-[#62756b]">{t("senate.drilldown").toUpperCase()}</p>
                  <CardTitle className="font-display text-3xl">{selectedTicker}</CardTitle>
                  <p className="mt-1 text-xs text-[#64756d]">{t("senate.drilldownHelp")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTicker(null)}>{t("common.close")}</Button>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {tickerTransactions.map((transaction) => (
                  <div key={transaction.sourceId} className="rounded-2xl border border-[#ced9d1] bg-white/45 p-4 text-xs">
                    <div className="flex items-center justify-between gap-2"><strong>{transaction.senatorName}</strong><Badge variant="outline" className={partyTone(transaction.partyAtTrade)}>{transaction.partyAtTrade}</Badge></div>
                    <p className="mt-2 text-[#65756d]">{transaction.owner} · {transaction.transactionType} · {transaction.amountRange.display}</p>
                    <p className="mt-2 text-[10px] text-[#718079]">{t("senate.tradeDisclosure", { trade: formatDate(transaction.transactionDate, intlLocale, t("common.unavailable")), disclosed: formatDate(transaction.disclosureDate, intlLocale, t("common.unavailable")), days: transaction.disclosureLagDays })}</p>
                    <div className="mt-3"><SourceLink transaction={transaction} /></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="mt-4 border-[#d9ddd7] bg-[#fbfaf6] shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="mb-2 text-[9px] font-extrabold tracking-[.18em] text-[#6f7d78]">{t("senate.auditRecords").toUpperCase()}</p><CardTitle className="font-display text-3xl">{t("senate.recent")}</CardTitle></div>
                <Badge variant="outline">{t("senate.shown", { count: filteredTransactions.length })}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <label className="relative lg:col-span-2">
                  <span className="sr-only">{t("senate.filterTicker")}</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#83908a]" />
                  <Input className="pl-9" value={tickerQuery} onChange={(event) => setTickerQuery(event.target.value)} placeholder={t("senate.ticker")} />
                </label>
                {[
                  { label: t("senate.party"), value: party, setValue: setParty, options: parties },
                  { label: t("senate.owner"), value: owner, setValue: setOwner, options: owners },
                  { label: t("senate.transaction"), value: transactionType, setValue: setTransactionType, options: transactionTypes },
                ].map((filter) => (
                  <label key={filter.label}>
                    <span className="sr-only">{filter.label}</span>
                    <select className="h-10 w-full rounded-md border border-[#d5dad5] bg-white/55 px-3 text-xs" value={filter.value} onChange={(event) => filter.setValue(event.target.value)}>
                      <option value="all">{t("senate.allValues", { label: filter.label.toLowerCase() })}</option>
                      {filter.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-xs">
                  <thead className="border-y border-[#dfe2dd] text-[8px] font-bold tracking-[.12em] text-[#74817b]">
                    <tr><th className="py-3 pr-3">DISCLOSED / TRADE</th><th className="px-3">SENATOR / PARTY</th><th className="px-3">OWNER</th><th className="px-3">TICKER / ASSET</th><th className="px-3">TYPE</th><th className="px-3">AMOUNT RANGE</th><th className="px-3">LAG</th><th className="pl-3">SOURCE</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#e4e6e2]">
                    {filteredTransactions.slice(0, 100).map((transaction) => (
                      <tr key={transaction.sourceId}>
                        <td className="py-3 pr-3"><strong>{formatDate(transaction.disclosureDate, intlLocale, t("common.unavailable"))}</strong><span className="mt-0.5 block text-[9px] text-[#7d8983]">{t("senate.transaction")} {formatDate(transaction.transactionDate, intlLocale, t("common.unavailable"))}</span></td>
                        <td className="px-3"><span className="font-semibold">{transaction.senatorName}</span><Badge variant="outline" className={cn("ml-2", partyTone(transaction.partyAtTrade))}>{transaction.partyAtTrade}</Badge></td>
                        <td className="px-3">{transaction.owner}</td>
                        <td className="px-3"><button className="font-mono font-bold text-[#175f47] hover:underline" onClick={() => transaction.canonicalTicker && setSelectedTicker(transaction.canonicalTicker)}>{transaction.canonicalTicker ?? "—"}</button><span className="mt-0.5 block max-w-56 truncate text-[9px] text-[#7d8983]">{transaction.assetName} · {transaction.assetType}</span></td>
                        <td className="px-3">{transaction.transactionType}{transaction.amendmentStatus === "amended" && <Badge variant="outline" className="ml-1 border-[#dfcfaa] text-[#805c22]">amended</Badge>}</td>
                        <td className="px-3 font-mono text-[10px]">{transaction.amountRange.display}</td>
                        <td className="px-3">{transaction.disclosureLagDays}d</td>
                        <td className="pl-3"><SourceLink transaction={transaction} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[9px] leading-4 text-[#7c8983]">{t("senate.sectorNote")}</p>
            </CardContent>
          </Card>

          <Card className="mt-4 border-[#dfcfaa] bg-[#f5ecd8] shadow-none">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <p className="font-semibold text-[#6e5124]">{t("senate.guardrails")}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] leading-4 text-[#805f2a]">
                  {payload.quality.notes.map((note) => <li key={note}>{note}</li>)}
                  <li>{t("senate.disclosureGuardrail")}</li>
                  <li>{t("senate.scoreGuardrail")}</li>
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[9px] text-[#805f2a]">
                <span>{t("senate.raw")}</span><strong>{payload.quality.rawRecords}</strong>
                <span>{t("senate.normalized")}</span><strong>{payload.quality.normalizedRecords}</strong>
                <span>{t("senate.duplicates")}</span><strong>{payload.quality.exactDuplicates}</strong>
                <span>{t("senate.superseded")}</span><strong>{payload.quality.supersededVersions}</strong>
                <span>{t("senate.unmapped")}</span><strong>{payload.quality.unmappedMembers}</strong>
                <span>{t("senate.unknown")}</span><strong>{payload.quality.unknownTickers}</strong>
              </div>
            </CardContent>
          </Card>

          <div className="mt-3 flex flex-wrap gap-4 text-[9px] text-[#75827c]">
            <a href={payload.source.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">{t("senate.endpointDocs")} <ExternalLink className="size-3" /></a>
            <a href={payload.source.officialRosterUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">{t("senate.officialRoster")} <ExternalLink className="size-3" /></a>
            <a href={payload.source.officialFilingDatabaseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">{t("senate.officialDatabase")} <ExternalLink className="size-3" /></a>
            <span>{payload.ruleVersion} · {payload.freshness} · {payload.cache.backend} {payload.cache.status}</span>
          </div>
        </>
      )}
    </div>
  );
}
