import {
  loadCachedProvider,
  type CacheResultStatus,
  type IndicatorDataCache,
  type RequestGate,
} from "./cache";

export const SENATE_WINDOWS = ["30D", "90D", "YTD", "1Y"] as const;
export type SenateWindow = typeof SENATE_WINDOWS[number];
export type SenateParty = "Democratic" | "Republican" | "Independent/Other" | "Unmapped";
export type SenateOwner = "Senator" | "Spouse" | "Joint" | "Dependent child" | "Other/Unknown";

export type AmountRange = {
  lower: number | null;
  upper: number | null;
  display: string;
};

export type RawSenateDisclosure = {
  symbol?: unknown;
  senateID?: unknown;
  disclosureDate?: unknown;
  transactionDate?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  office?: unknown;
  district?: unknown;
  owner?: unknown;
  assetDescription?: unknown;
  assetType?: unknown;
  type?: unknown;
  amount?: unknown;
  comment?: unknown;
  link?: unknown;
  [key: string]: unknown;
};

export type SenateMember = {
  senateId: string;
  firstName: string;
  lastName: string;
  party: Exclude<SenateParty, "Unmapped">;
  state: string;
  sourceUrl: string;
};

export type NormalizedSenateTransaction = {
  sourceId: string;
  sourceFilingId: string | null;
  senateId: string;
  senatorName: string;
  partyAtTrade: SenateParty;
  partyResolution: "official-current-roster" | "unmapped";
  state: string | null;
  owner: SenateOwner;
  ownerRaw: string;
  transactionDate: string;
  disclosureDate: string;
  disclosureLagDays: number;
  tickerAtTrade: string | null;
  canonicalTicker: string | null;
  securityId: string | null;
  assetName: string;
  assetType: string;
  transactionType: string;
  amountRange: AmountRange;
  filingUrl: string | null;
  amendmentStatus: "original" | "amended";
  supersededSourceIds: string[];
  rawVersionCount: number;
  eligiblePurchase: boolean;
  ingestionTime: string;
  freshness: "fresh" | "stale";
};

export type SenateTickerAggregate = {
  ticker: string;
  company: string;
  democraticBuyers: number;
  republicanBuyers: number;
  independentBuyers: number;
  totalDistinctBuyers: number;
  purchaseEvents: number;
  amountRange: AmountRange;
  latestTradeDate: string;
  latestDisclosureDate: string;
  freshness: "fresh" | "stale";
};

export type SenatePartyRanking = {
  party: Exclude<SenateParty, "Unmapped">;
  ticker: string;
  company: string;
  distinctBuyers: number;
  purchaseEvents: number;
  amountRange: AmountRange;
  latestTradeDate: string;
};

export type SenateDataQuality = {
  rawRecords: number;
  normalizedRecords: number;
  exactDuplicates: number;
  supersededVersions: number;
  unmappedMembers: number;
  unknownTickers: number;
  invalidDates: number;
  invalidAmountRanges: number;
  truncated: boolean;
  notes: string[];
};

export type SenateTradesResponse = {
  generatedAt: string;
  window: SenateWindow;
  windowStart: string;
  ruleVersion: "senate-purchases-v1";
  status: "ready" | "partial" | "unavailable";
  source: {
    provider: "Financial Modeling Prep";
    endpoint: "Latest Senate Financial Disclosures";
    sourceUrl: "https://site.financialmodelingprep.com/developer/docs/stable/senate-latest";
    officialRosterUrl: "https://www.senate.gov/general/contact_information/senators_cfm.xml";
    officialFilingDatabaseUrl: "https://www.disclosure.senate.gov/";
  };
  lastSuccessfulRefresh: string | null;
  freshness: "fresh" | "stale" | "unavailable";
  overview: {
    eligiblePurchases: number;
    distinctSenatorHouseholds: number;
    bipartisanTickers: number;
    medianDisclosureLagDays: number | null;
  };
  bipartisan: SenateTickerAggregate[];
  popularByParty: Record<Exclude<SenateParty, "Unmapped">, SenatePartyRanking[]>;
  transactions: NormalizedSenateTransaction[];
  quality: SenateDataQuality;
  errorCode?: "configuration-required" | "quota-unavailable" | "source-failed" | "missing-data";
  errorMessage?: string;
  cache: {
    backend: "redis" | "none";
    status: CacheResultStatus;
  };
};

type SenateDataset = Omit<SenateTradesResponse, "window" | "windowStart" | "overview" | "bipartisan" | "popularByParty" | "transactions" | "cache"> & {
  allTransactions: NormalizedSenateTransaction[];
  rawRecords: RawSenateDisclosure[];
};

const DAY_MS = 24 * 60 * 60 * 1_000;
// FMP Basic accepts at most 25 rows and only page 0 for this endpoint. Treat the
// resulting dataset as explicitly truncated instead of attempting premium pages.
const PAGE_LIMIT = 25;
const MAX_PAGES = 1;
const SOURCE_URL = "https://site.financialmodelingprep.com/developer/docs/stable/senate-latest" as const;
const OFFICIAL_ROSTER_URL = "https://www.senate.gov/general/contact_information/senators_cfm.xml" as const;
const OFFICIAL_FILING_URL = "https://www.disclosure.senate.gov/" as const;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isoDate(value: unknown) {
  const candidate = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(`${candidate}T00:00:00Z`))
    ? candidate
    : null;
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS));
}

function compactAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseAmountRange(value: unknown): AmountRange {
  const display = text(value) || "Unknown";
  const numbers = [...display.matchAll(/[\d,]+/g)]
    .map((match) => Number(match[0].replaceAll(",", "")))
    .filter(Number.isFinite);
  if (/over|more than|greater than/i.test(display) && numbers[0] !== undefined) {
    return { lower: numbers[0], upper: null, display };
  }
  if (/under|less than/i.test(display) && numbers[0] !== undefined) {
    return { lower: 0, upper: numbers[0], display };
  }
  if (numbers.length >= 2) return { lower: numbers[0], upper: numbers[1], display };
  if (numbers.length === 1) return { lower: numbers[0], upper: numbers[0], display };
  return { lower: null, upper: null, display };
}

function aggregateAmountRanges(ranges: readonly AmountRange[]): AmountRange {
  const lower = ranges.every((range) => range.lower !== null)
    ? ranges.reduce((sum, range) => sum + (range.lower ?? 0), 0)
    : null;
  const upper = ranges.every((range) => range.upper !== null)
    ? ranges.reduce((sum, range) => sum + (range.upper ?? 0), 0)
    : null;
  const display = lower === null
    ? "Unknown"
    : upper === null
      ? `${compactAmount(lower)}+`
      : lower === upper
        ? compactAmount(lower)
        : `${compactAmount(lower)} – ${compactAmount(upper)}`;
  return { lower, upper, display };
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function xmlField(block: string, field: string) {
  const match = block.match(new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`, "i"));
  return decodeXml(match?.[1]?.trim() ?? "");
}

export function parseOfficialSenateRoster(xml: string): SenateMember[] {
  return [...xml.matchAll(/<member>([\s\S]*?)<\/member>/gi)].flatMap((match) => {
    const senateId = xmlField(match[1], "bioguide_id");
    const partyCode = xmlField(match[1], "party").toUpperCase();
    if (!senateId) return [];
    const party: SenateMember["party"] = partyCode === "D"
      ? "Democratic"
      : partyCode === "R"
        ? "Republican"
        : "Independent/Other";
    return [{
      senateId,
      firstName: xmlField(match[1], "first_name"),
      lastName: xmlField(match[1], "last_name"),
      party,
      state: xmlField(match[1], "state"),
      sourceUrl: OFFICIAL_ROSTER_URL,
    }];
  });
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function canonicalTicker(value: unknown) {
  const candidate = text(value).toUpperCase().replaceAll(".", "-");
  return /^[A-Z][A-Z0-9-]{0,9}$/.test(candidate) && !["N/A", "NA", "NONE"].includes(candidate)
    ? candidate
    : null;
}

function owner(value: unknown): SenateOwner {
  const normalized = text(value).toLowerCase();
  if (normalized.includes("spouse")) return "Spouse";
  if (normalized.includes("child") || normalized.includes("dependent")) return "Dependent child";
  if (normalized.includes("joint")) return "Joint";
  if (normalized.includes("self") || normalized.includes("senator")) return "Senator";
  return "Other/Unknown";
}

function eligibleDirectEquityPurchase(raw: RawSenateDisclosure, ticker: string | null) {
  const transactionType = text(raw.type).toLowerCase();
  const assetType = text(raw.assetType).toLowerCase();
  const excluded = /option|bond|fund|etf|exchange traded|mutual|real estate|crypt|note|treasury/.test(assetType);
  const directEquity = /stock|equity|corporation|common/.test(assetType);
  return transactionType === "purchase" && Boolean(ticker) && directEquity && !excluded;
}

function sourceFilingId(link: string) {
  if (!link) return null;
  try {
    return new URL(link).pathname.split("/").filter(Boolean).at(-1) ?? null;
  } catch {
    return null;
  }
}

function normalizeOne(
  raw: RawSenateDisclosure,
  members: ReadonlyMap<string, SenateMember>,
  now: Date,
): NormalizedSenateTransaction | null {
  const transactionDate = isoDate(raw.transactionDate);
  const disclosureDate = isoDate(raw.disclosureDate);
  if (!transactionDate || !disclosureDate) return null;
  const senateId = text(raw.senateID);
  const member = members.get(senateId);
  const ticker = canonicalTicker(raw.symbol);
  const filingUrl = /^https:\/\//.test(text(raw.link)) ? text(raw.link) : null;
  const sourceKey = [
    filingUrl,
    senateId,
    transactionDate,
    ticker,
    text(raw.assetDescription),
    text(raw.type),
    text(raw.owner),
    text(raw.amount),
  ].join("|");
  const amendment = /amend/i.test(`${text(raw.comment)} ${filingUrl ?? ""}`);
  const amountRange = parseAmountRange(raw.amount);
  const age = now.getTime() - Date.parse(`${disclosureDate}T00:00:00Z`);

  return {
    sourceId: `fmp-senate-${stableHash(sourceKey)}`,
    sourceFilingId: sourceFilingId(filingUrl ?? ""),
    senateId,
    senatorName: [text(raw.firstName), text(raw.lastName)].filter(Boolean).join(" ") || text(raw.office) || "Unknown senator",
    partyAtTrade: member?.party ?? "Unmapped",
    partyResolution: member ? "official-current-roster" : "unmapped",
    state: member?.state || text(raw.district) || null,
    owner: owner(raw.owner),
    ownerRaw: text(raw.owner) || "Unknown",
    transactionDate,
    disclosureDate,
    disclosureLagDays: daysBetween(transactionDate, disclosureDate),
    tickerAtTrade: text(raw.symbol) || null,
    canonicalTicker: ticker,
    securityId: ticker ? `ticker:${ticker}` : null,
    assetName: text(raw.assetDescription) || "Unspecified asset",
    assetType: text(raw.assetType) || "Unknown",
    transactionType: text(raw.type) || "Unknown",
    amountRange,
    filingUrl,
    amendmentStatus: amendment ? "amended" : "original",
    supersededSourceIds: [],
    rawVersionCount: 1,
    eligiblePurchase: eligibleDirectEquityPurchase(raw, ticker),
    ingestionTime: now.toISOString(),
    freshness: age <= 7 * DAY_MS ? "fresh" : "stale",
  };
}

function logicalTransactionKey(transaction: NormalizedSenateTransaction) {
  return [
    transaction.senateId,
    transaction.transactionDate,
    transaction.canonicalTicker,
    transaction.assetName.toLowerCase(),
    transaction.transactionType.toLowerCase(),
    transaction.owner,
  ].join("|");
}

export function normalizeSenateDisclosures(
  rawRecords: readonly RawSenateDisclosure[],
  members: readonly SenateMember[],
  now = new Date(),
): {
  transactions: NormalizedSenateTransaction[];
  exactDuplicates: number;
  supersededVersions: number;
  invalidDates: number;
} {
  const memberMap = new Map(members.map((member) => [member.senateId, member]));
  const exact = new Map<string, NormalizedSenateTransaction>();
  let invalidDates = 0;
  for (const raw of rawRecords) {
    const normalized = normalizeOne(raw, memberMap, now);
    if (!normalized) {
      invalidDates += 1;
      continue;
    }
    exact.set(normalized.sourceId, normalized);
  }
  const exactDuplicates = rawRecords.length - invalidDates - exact.size;
  const versions = new Map<string, NormalizedSenateTransaction[]>();
  for (const transaction of exact.values()) {
    const key = logicalTransactionKey(transaction);
    versions.set(key, [...(versions.get(key) ?? []), transaction]);
  }
  let supersededVersions = 0;
  const transactions = [...versions.values()].flatMap((group) => {
    if (group.length === 1 || !group.some((record) => record.amendmentStatus === "amended")) {
      return group;
    }
    const ordered = [...group].sort((a, b) => {
      const amendmentOrder = Number(b.amendmentStatus === "amended") - Number(a.amendmentStatus === "amended");
      return amendmentOrder || b.disclosureDate.localeCompare(a.disclosureDate) || b.sourceId.localeCompare(a.sourceId);
    });
    const current = ordered[0];
    const superseded = ordered.slice(1).map((record) => record.sourceId);
    supersededVersions += superseded.length;
    return [{
      ...current,
      supersededSourceIds: superseded,
      rawVersionCount: ordered.length,
    }];
  });
  return {
    transactions: transactions.sort((a, b) => b.disclosureDate.localeCompare(a.disclosureDate) || b.transactionDate.localeCompare(a.transactionDate)),
    exactDuplicates,
    supersededVersions,
    invalidDates,
  };
}

function partyBuyers(transactions: readonly NormalizedSenateTransaction[], party: SenateParty) {
  return new Set(transactions.filter((transaction) => transaction.partyAtTrade === party).map((transaction) => transaction.senateId)).size;
}

function aggregateTicker(transactions: readonly NormalizedSenateTransaction[]): SenateTickerAggregate[] {
  const groups = new Map<string, NormalizedSenateTransaction[]>();
  for (const transaction of transactions.filter((item) => item.eligiblePurchase && item.canonicalTicker)) {
    const ticker = transaction.canonicalTicker!;
    groups.set(ticker, [...(groups.get(ticker) ?? []), transaction]);
  }
  return [...groups].map(([ticker, group]) => ({
    ticker,
    company: group[0].assetName,
    democraticBuyers: partyBuyers(group, "Democratic"),
    republicanBuyers: partyBuyers(group, "Republican"),
    independentBuyers: partyBuyers(group, "Independent/Other"),
    totalDistinctBuyers: new Set(group.map((transaction) => transaction.senateId)).size,
    purchaseEvents: group.length,
    amountRange: aggregateAmountRanges(group.map((transaction) => transaction.amountRange)),
    latestTradeDate: group.map((transaction) => transaction.transactionDate).sort().at(-1)!,
    latestDisclosureDate: group.map((transaction) => transaction.disclosureDate).sort().at(-1)!,
    freshness: group.some((transaction) => transaction.freshness === "fresh") ? "fresh" : "stale",
  }));
}

function aggregateSort(a: SenateTickerAggregate, b: SenateTickerAggregate) {
  return b.totalDistinctBuyers - a.totalDistinctBuyers
    || Math.min(b.democraticBuyers, b.republicanBuyers) - Math.min(a.democraticBuyers, a.republicanBuyers)
    || b.purchaseEvents - a.purchaseEvents
    || b.latestTradeDate.localeCompare(a.latestTradeDate)
    || a.ticker.localeCompare(b.ticker);
}

function partyRankings(
  transactions: readonly NormalizedSenateTransaction[],
  party: Exclude<SenateParty, "Unmapped">,
): SenatePartyRanking[] {
  return aggregateTicker(transactions.filter((transaction) => transaction.partyAtTrade === party))
    .map((aggregate) => ({
      party,
      ticker: aggregate.ticker,
      company: aggregate.company,
      distinctBuyers: aggregate.totalDistinctBuyers,
      purchaseEvents: aggregate.purchaseEvents,
      amountRange: aggregate.amountRange,
      latestTradeDate: aggregate.latestTradeDate,
    }))
    .sort((a, b) => b.distinctBuyers - a.distinctBuyers
      || b.purchaseEvents - a.purchaseEvents
      || b.latestTradeDate.localeCompare(a.latestTradeDate)
      || a.ticker.localeCompare(b.ticker))
    .slice(0, 10);
}

export function calculateSenateAggregates(transactions: readonly NormalizedSenateTransaction[]) {
  const eligible = transactions.filter((transaction) => transaction.eligiblePurchase);
  const allTickers = aggregateTicker(eligible);
  return {
    overview: {
      eligiblePurchases: eligible.length,
      distinctSenatorHouseholds: new Set(eligible.map((transaction) => transaction.senateId)).size,
      bipartisanTickers: allTickers.filter((ticker) => ticker.democraticBuyers > 0 && ticker.republicanBuyers > 0).length,
      medianDisclosureLagDays: median(eligible.map((transaction) => transaction.disclosureLagDays)),
    },
    bipartisan: allTickers
      .filter((ticker) => ticker.democraticBuyers > 0 && ticker.republicanBuyers > 0)
      .sort(aggregateSort),
    popularByParty: {
      Democratic: partyRankings(eligible, "Democratic"),
      Republican: partyRankings(eligible, "Republican"),
      "Independent/Other": partyRankings(eligible, "Independent/Other"),
    },
  };
}

function median(values: readonly number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle];
}

export function senateWindowStart(window: SenateWindow, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (window === "YTD") return `${end.getUTCFullYear()}-01-01`;
  const days = window === "30D" ? 30 : window === "90D" ? 90 : 365;
  return new Date(end.getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

function unavailableDataset(options: {
  now: Date;
  code: NonNullable<SenateTradesResponse["errorCode"]>;
  message: string;
}): SenateDataset {
  return {
    generatedAt: options.now.toISOString(),
    ruleVersion: "senate-purchases-v1",
    status: "unavailable",
    source: {
      provider: "Financial Modeling Prep",
      endpoint: "Latest Senate Financial Disclosures",
      sourceUrl: SOURCE_URL,
      officialRosterUrl: OFFICIAL_ROSTER_URL,
      officialFilingDatabaseUrl: OFFICIAL_FILING_URL,
    },
    lastSuccessfulRefresh: null,
    freshness: "unavailable",
    allTransactions: [],
    rawRecords: [],
    quality: {
      rawRecords: 0,
      normalizedRecords: 0,
      exactDuplicates: 0,
      supersededVersions: 0,
      unmappedMembers: 0,
      unknownTickers: 0,
      invalidDates: 0,
      invalidAmountRanges: 0,
      truncated: false,
      notes: [options.message],
    },
    errorCode: options.code,
    errorMessage: options.message,
  };
}

async function fetchOfficialRoster(fetcher: typeof fetch) {
  const response = await fetcher(OFFICIAL_ROSTER_URL, {
    headers: { Accept: "application/xml", "User-Agent": "macro-environment-monitor/0.1" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Official Senate roster returned ${response.status}.`);
  return parseOfficialSenateRoster(await response.text());
}

async function fetchFmpPages(options: {
  apiKey: string;
  requestGate: RequestGate;
  fetcher: typeof fetch;
}) {
  const records: RawSenateDisclosure[] = [];
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const budget = await options.requestGate();
    if (!budget.allowed) {
      if (!records.length) throw new Error(`FMP Senate request budget reached (${budget.limit}).`);
      truncated = true;
      break;
    }
    const url = new URL("https://financialmodelingprep.com/stable/senate-latest");
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(PAGE_LIMIT));
    url.searchParams.set("apikey", options.apiKey);
    const response = await options.fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(body.replaceAll(/\s+/g, " ").trim().slice(0, 180) || `FMP Senate endpoint returned ${response.status}.`);
    }
    let pageRecords: RawSenateDisclosure[];
    try {
      const payload = JSON.parse(body) as unknown;
      if (!Array.isArray(payload)) throw new Error("FMP Senate response was not an array.");
      pageRecords = payload as RawSenateDisclosure[];
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "FMP Senate response was not valid JSON.");
    }
    records.push(...pageRecords);
    if (pageRecords.length < PAGE_LIMIT) return { records, truncated: false };
    if (page === MAX_PAGES - 1) truncated = true;
  }
  return { records, truncated };
}

async function loadDataset(options: {
  fmpApiKey?: string;
  requestGate?: RequestGate;
  fetcher: typeof fetch;
  now: Date;
}): Promise<SenateDataset> {
  if (!options.fmpApiKey) {
    return unavailableDataset({ now: options.now, code: "configuration-required", message: "Add FMP_API_KEY to load Senate disclosures." });
  }
  if (!options.requestGate) {
    return unavailableDataset({ now: options.now, code: "quota-unavailable", message: "Redis quota protection is required for FMP Senate requests." });
  }

  try {
    const [roster, fmp] = await Promise.all([
      fetchOfficialRoster(options.fetcher),
      fetchFmpPages({ apiKey: options.fmpApiKey, requestGate: options.requestGate, fetcher: options.fetcher }),
    ]);
    const normalized = normalizeSenateDisclosures(fmp.records, roster, options.now);
    if (!normalized.transactions.length) {
      return unavailableDataset({ now: options.now, code: "missing-data", message: "The Senate sources returned no valid disclosure records." });
    }
    const unmappedMembers = new Set(normalized.transactions.filter((transaction) => transaction.partyAtTrade === "Unmapped").map((transaction) => transaction.senateId)).size;
    const unknownTickers = normalized.transactions.filter((transaction) => !transaction.canonicalTicker).length;
    const invalidAmountRanges = normalized.transactions.filter((transaction) => transaction.amountRange.lower === null).length;
    const latestDisclosure = normalized.transactions.map((transaction) => transaction.disclosureDate).sort().at(-1)!;
    const stale = options.now.getTime() - Date.parse(`${latestDisclosure}T00:00:00Z`) > 7 * DAY_MS;
    const notes = [
      "Party is resolved from the current official Senate roster; unmatched or historical party ambiguity remains explicit.",
      "FMP Latest is page-bounded to preserve the configured daily request budget; a production reconciliation store remains required for immutable long-term raw history.",
      ...(fmp.truncated ? ["The FMP result reached the page cap or request budget; rankings may be incomplete."] : []),
      ...(unmappedMembers ? [`${unmappedMembers} member IDs could not be mapped to the current official roster and are excluded from party rankings.`] : []),
    ];

    return {
      generatedAt: options.now.toISOString(),
      ruleVersion: "senate-purchases-v1",
      status: fmp.truncated || unmappedMembers > 0 ? "partial" : "ready",
      source: {
        provider: "Financial Modeling Prep",
        endpoint: "Latest Senate Financial Disclosures",
        sourceUrl: SOURCE_URL,
        officialRosterUrl: OFFICIAL_ROSTER_URL,
        officialFilingDatabaseUrl: OFFICIAL_FILING_URL,
      },
      lastSuccessfulRefresh: options.now.toISOString(),
      freshness: stale ? "stale" : "fresh",
      allTransactions: normalized.transactions,
      rawRecords: fmp.records.map((record) => ({ ...record })),
      quality: {
        rawRecords: fmp.records.length,
        normalizedRecords: normalized.transactions.length,
        exactDuplicates: normalized.exactDuplicates,
        supersededVersions: normalized.supersededVersions,
        unmappedMembers,
        unknownTickers,
        invalidDates: normalized.invalidDates,
        invalidAmountRanges,
        truncated: fmp.truncated,
        notes,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Senate disclosure ingestion failed.";
    return unavailableDataset({
      now: options.now,
      code: /budget|quota/i.test(message) ? "quota-unavailable" : "source-failed",
      message,
    });
  }
}

export async function loadSenateTrades(options: {
  window?: SenateWindow;
  fmpApiKey?: string;
  requestGate?: RequestGate;
  cache?: IndicatorDataCache;
  fetcher?: typeof fetch;
  now?: Date;
} = {}): Promise<SenateTradesResponse> {
  const now = options.now ?? new Date();
  const window = options.window ?? "90D";
  const result = await loadCachedProvider({
    cache: options.cache,
    cacheKey: "senate-trades:dataset:v1",
    ttlSeconds: 6 * 60 * 60,
    loader: () => loadDataset({
      fmpApiKey: options.fmpApiKey,
      requestGate: options.requestGate,
      fetcher: options.fetcher ?? fetch,
      now,
    }),
    shouldCache: (dataset) => dataset.allTransactions.length > 0,
  });
  const windowStart = senateWindowStart(window, now);
  const transactions = result.value.allTransactions.filter((transaction) => transaction.transactionDate >= windowStart);
  const aggregates = calculateSenateAggregates(transactions);

  return {
    generatedAt: result.value.generatedAt,
    window,
    windowStart,
    ruleVersion: result.value.ruleVersion,
    status: result.value.status,
    source: result.value.source,
    lastSuccessfulRefresh: result.value.lastSuccessfulRefresh,
    freshness: result.value.freshness,
    ...aggregates,
    transactions,
    quality: result.value.quality,
    errorCode: result.value.errorCode,
    errorMessage: result.value.errorMessage,
    cache: {
      backend: options.cache?.backend ?? "none",
      status: result.status,
    },
  };
}

export function isSenateWindow(value: string | null): value is SenateWindow {
  return SENATE_WINDOWS.includes(value as SenateWindow);
}
