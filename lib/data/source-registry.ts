import type {
  DataFrequency,
  IndicatorSourceDefinition,
  ReadingFormat,
  SourceClassification,
} from "./types";

type PublicSourceInput = {
  id: string;
  pillarId: string;
  indicator: string;
  seriesId: string;
  frequency: DataFrequency;
  unit: string;
  format?: ReadingFormat;
  staleAfterDays: number;
  featured?: boolean;
  transformation?: string;
};

function fred(input: PublicSourceInput): IndicatorSourceDefinition {
  return {
    ...input,
    provider: "Federal Reserve Bank of St. Louis (FRED)",
    providerShort: "FRED",
    classification: "aggregated-public",
    format: input.format ?? "number",
    transformation: input.transformation ?? "Latest reported level",
    revisionPolicy: "Latest-vintage FRED value. Historical reviews must retain the retrieved value and retrieval timestamp because the source series may be revised.",
    sourceUrl: `https://fred.stlouisfed.org/series/${input.seriesId}`,
    adapter: "fred",
    integration: "credential-required",
  };
}

function bls(input: PublicSourceInput & { active?: boolean }): IndicatorSourceDefinition {
  return {
    ...input,
    provider: "U.S. Bureau of Labor Statistics",
    providerShort: "BLS",
    classification: "primary-public",
    format: input.format ?? "number",
    transformation: input.transformation ?? "Latest seasonally adjusted level",
    revisionPolicy: "BLS values can be revised on later releases. Historical reviews must retain the value retrieved at review time.",
    sourceUrl: `https://data.bls.gov/timeseries/${input.seriesId}`,
    adapter: "bls",
    integration: input.active ? "active" : "planned",
  };
}

function mapped(input: {
  id: string;
  pillarId: string;
  indicator: string;
  provider: string;
  providerShort: string;
  classification: SourceClassification;
  seriesId?: string | null;
  frequency: DataFrequency;
  unit: string;
  sourceUrl: string;
  integration?: IndicatorSourceDefinition["integration"];
  staleAfterDays: number;
  transformation?: string;
  revisionPolicy?: string;
  format?: ReadingFormat;
}): IndicatorSourceDefinition {
  return {
    seriesId: null,
    adapter: null,
    integration: "planned",
    format: "number",
    transformation: "Source-specific normalization pending",
    revisionPolicy: "Retain observation date, release or retrieval timestamp, and the value available at review time.",
    ...input,
  };
}

export const INDICATOR_SOURCE_REGISTRY: readonly IndicatorSourceDefinition[] = [
  fred({ id: "liquidity-fed-balance-sheet", pillarId: "liquidity", indicator: "Fed balance sheet", seriesId: "WALCL", frequency: "weekly", unit: "USD millions", format: "usd-millions-to-trillions", staleAfterDays: 10, featured: true }),
  {
    id: "liquidity-tga",
    pillarId: "liquidity",
    indicator: "TGA",
    provider: "U.S. Treasury Fiscal Data",
    providerShort: "Treasury",
    classification: "primary-public",
    seriesId: "operating_cash_balance",
    frequency: "daily",
    unit: "USD millions",
    format: "usd-millions-to-billions",
    transformation: "Treasury General Account closing balance",
    revisionPolicy: "Daily Treasury Statement records can be corrected. Preserve the retrieved value and timestamp in dated reviews.",
    staleAfterDays: 4,
    sourceUrl: "https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/operating-cash-balance",
    adapter: "treasury",
    integration: "active",
    featured: true,
  },
  fred({ id: "liquidity-on-rrp", pillarId: "liquidity", indicator: "ON RRP", seriesId: "RRPONTSYD", frequency: "daily", unit: "USD billions", staleAfterDays: 4, featured: true }),
  fred({ id: "liquidity-bank-reserves", pillarId: "liquidity", indicator: "Bank reserves", seriesId: "WRESBAL", frequency: "weekly", unit: "USD millions", format: "usd-millions-to-trillions", staleAfterDays: 10 }),
  fred({ id: "liquidity-broad-usd", pillarId: "liquidity", indicator: "Broad USD", seriesId: "DTWEXBGS", frequency: "daily", unit: "Index Jan 2006=100", format: "index", staleAfterDays: 4 }),
  fred({ id: "liquidity-financial-conditions", pillarId: "liquidity", indicator: "Financial conditions", seriesId: "NFCI", frequency: "weekly", unit: "Standard deviations", staleAfterDays: 10 }),

  mapped({ id: "rates-fed-funds-path", pillarId: "rates", indicator: "Fed funds path", provider: "CME Group FedWatch / licensed futures feed", providerShort: "Market data", classification: "licensed-market-data", frequency: "daily", unit: "Probability / implied rate", sourceUrl: "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html", integration: "licensed", staleAfterDays: 2, transformation: "Fed-funds futures probabilities by meeting" }),
  fred({ id: "rates-2y", pillarId: "rates", indicator: "2Y yield", seriesId: "DGS2", frequency: "daily", unit: "Percent", format: "percent", staleAfterDays: 4, featured: true }),
  fred({ id: "rates-10y", pillarId: "rates", indicator: "10Y yield", seriesId: "DGS10", frequency: "daily", unit: "Percent", format: "percent", staleAfterDays: 4, featured: true }),
  fred({ id: "rates-real-10y", pillarId: "rates", indicator: "10Y real yield", seriesId: "DFII10", frequency: "daily", unit: "Percent", format: "percent", staleAfterDays: 4, featured: true }),
  fred({ id: "rates-2s10s", pillarId: "rates", indicator: "2s10s", seriesId: "T10Y2Y", frequency: "daily", unit: "Percentage points", format: "percent", staleAfterDays: 4 }),
  mapped({ id: "rates-term-premium", pillarId: "rates", indicator: "Term premium", provider: "Federal Reserve Bank of New York", providerShort: "NY Fed", classification: "primary-public", frequency: "daily", unit: "Percent", sourceUrl: "https://www.newyorkfed.org/research/data_indicators/term-premia-tabs", staleAfterDays: 5, format: "percent", transformation: "Adrian-Crump-Moench 10-year term-premium estimate" }),

  bls({ id: "inflation-core-cpi", pillarId: "inflation", indicator: "Core CPI", seriesId: "CUSR0000SA0L1E", frequency: "monthly", unit: "Index 1982-84=100", format: "index", staleAfterDays: 45, featured: true, active: true }),
  mapped({ id: "inflation-core-pce", pillarId: "inflation", indicator: "Core PCE", provider: "U.S. Bureau of Economic Analysis", providerShort: "BEA", classification: "primary-public", seriesId: "NIPA-T2.3.4-PCEPILFE", frequency: "monthly", unit: "Index 2017=100", format: "index", sourceUrl: "https://www.bea.gov/data/personal-consumption-expenditures-price-index-excluding-food-and-energy", staleAfterDays: 45 }),
  bls({ id: "inflation-ppi", pillarId: "inflation", indicator: "PPI", seriesId: "WPSFD4", frequency: "monthly", unit: "Index Nov 2009=100", format: "index", staleAfterDays: 45 }),
  bls({ id: "inflation-shelter", pillarId: "inflation", indicator: "Shelter", seriesId: "CUSR0000SAH1", frequency: "monthly", unit: "Index 1982-84=100", format: "index", staleAfterDays: 45 }),
  bls({ id: "inflation-wages-eci", pillarId: "inflation", indicator: "Wages / ECI", seriesId: "CIU1010000000000A", frequency: "quarterly", unit: "Index Dec 2005=100", format: "index", staleAfterDays: 120 }),
  fred({ id: "inflation-breakevens", pillarId: "inflation", indicator: "Breakevens", seriesId: "T10YIE", frequency: "daily", unit: "Percent", format: "percent", staleAfterDays: 4 }),

  mapped({ id: "growth-gdp-nowcast", pillarId: "growth", indicator: "GDP / nowcast", provider: "Federal Reserve Bank of Atlanta", providerShort: "Atlanta Fed", classification: "primary-public", frequency: "event-driven", unit: "Annualized percent", format: "percent", sourceUrl: "https://www.atlantafed.org/cqer/research/gdpnow", staleAfterDays: 14, transformation: "Latest GDPNow estimate" }),
  mapped({ id: "growth-ism-manufacturing", pillarId: "growth", indicator: "ISM manufacturing", provider: "Institute for Supply Management", providerShort: "ISM", classification: "licensed-market-data", frequency: "monthly", unit: "Diffusion index", format: "index", sourceUrl: "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/", integration: "licensed", staleAfterDays: 40 }),
  mapped({ id: "growth-ism-services", pillarId: "growth", indicator: "ISM services", provider: "Institute for Supply Management", providerShort: "ISM", classification: "licensed-market-data", frequency: "monthly", unit: "Diffusion index", format: "index", sourceUrl: "https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/", integration: "licensed", staleAfterDays: 40 }),
  mapped({ id: "growth-retail-sales", pillarId: "growth", indicator: "Retail sales", provider: "U.S. Census Bureau", providerShort: "Census", classification: "primary-public", seriesId: "MARTS", frequency: "monthly", unit: "USD millions", sourceUrl: "https://www.census.gov/retail/index.html", staleAfterDays: 45 }),
  fred({ id: "growth-industrial-production", pillarId: "growth", indicator: "Industrial production", seriesId: "INDPRO", frequency: "monthly", unit: "Index 2017=100", format: "index", staleAfterDays: 45 }),
  mapped({ id: "growth-housing", pillarId: "growth", indicator: "Housing", provider: "U.S. Census Bureau", providerShort: "Census", classification: "primary-public", seriesId: "HVIP", frequency: "monthly", unit: "Thousands of units", sourceUrl: "https://www.census.gov/construction/nrc/", staleAfterDays: 45, transformation: "Housing starts and permits trend" }),

  bls({ id: "labor-payrolls", pillarId: "labor", indicator: "Payrolls", seriesId: "CES0000000001", frequency: "monthly", unit: "Thousands of persons", format: "thousands-to-millions", staleAfterDays: 45, featured: true, active: true }),
  bls({ id: "labor-unemployment", pillarId: "labor", indicator: "Unemployment", seriesId: "LNS14000000", frequency: "monthly", unit: "Percent", format: "percent", staleAfterDays: 45, featured: true, active: true }),
  fred({ id: "labor-jobless-claims", pillarId: "labor", indicator: "Jobless claims", seriesId: "ICSA", frequency: "weekly", unit: "Number", staleAfterDays: 10 }),
  bls({ id: "labor-jolts", pillarId: "labor", indicator: "JOLTS", seriesId: "JTS000000000000000JOL", frequency: "monthly", unit: "Level in thousands", staleAfterDays: 50 }),
  bls({ id: "labor-quits", pillarId: "labor", indicator: "Quits", seriesId: "JTS000000000000000QUR", frequency: "monthly", unit: "Rate", format: "percent", staleAfterDays: 50 }),
  bls({ id: "labor-temporary-help", pillarId: "labor", indicator: "Temporary help", seriesId: "CES6056132001", frequency: "monthly", unit: "Thousands of persons", format: "thousands-to-millions", staleAfterDays: 45 }),

  fred({ id: "credit-hy-spreads", pillarId: "credit", indicator: "HY spreads", seriesId: "BAMLH0A0HYM2", frequency: "daily", unit: "Percent", format: "percent", staleAfterDays: 4, featured: true }),
  fred({ id: "credit-ig-spreads", pillarId: "credit", indicator: "IG spreads", seriesId: "BAMLC0A0CM", frequency: "daily", unit: "Percent", format: "percent", staleAfterDays: 4 }),
  mapped({ id: "credit-default-outlook", pillarId: "credit", indicator: "Default outlook", provider: "Moody's / S&P Global", providerShort: "Credit research", classification: "licensed-market-data", frequency: "monthly", unit: "Percent", format: "percent", sourceUrl: "https://www.spglobal.com/ratings/en/", integration: "licensed", staleAfterDays: 45 }),
  fred({ id: "credit-lending-standards", pillarId: "credit", indicator: "Lending standards", seriesId: "DRTSCILM", frequency: "quarterly", unit: "Net percent", format: "percent", staleAfterDays: 120 }),
  mapped({ id: "credit-regional-banks", pillarId: "credit", indicator: "Regional banks", provider: "Licensed market-data provider", providerShort: "Market data", classification: "licensed-market-data", frequency: "daily", unit: "Relative return", sourceUrl: "https://www.nyse.com/market-data", integration: "licensed", staleAfterDays: 2, transformation: "Regional-bank index relative strength" }),
  fred({ id: "credit-funding-stress", pillarId: "credit", indicator: "Funding stress", seriesId: "SOFR", frequency: "daily", unit: "Percent", format: "percent", staleAfterDays: 4, transformation: "SOFR level and dislocation versus policy corridor" }),

  mapped({ id: "earnings-forward-eps", pillarId: "earnings", indicator: "Forward EPS", provider: "Licensed consensus-estimates provider", providerShort: "Consensus", classification: "licensed-market-data", frequency: "weekly", unit: "Index earnings", sourceUrl: "https://insight.factset.com/earnings-insight", integration: "licensed", staleAfterDays: 10 }),
  mapped({ id: "earnings-revision-breadth", pillarId: "earnings", indicator: "Revision breadth", provider: "Licensed consensus-estimates provider", providerShort: "Consensus", classification: "licensed-market-data", frequency: "weekly", unit: "Net percent", format: "percent", sourceUrl: "https://insight.factset.com/earnings-insight", integration: "licensed", staleAfterDays: 10 }),
  mapped({ id: "earnings-revenue-growth", pillarId: "earnings", indicator: "Revenue growth", provider: "SEC filings and company guidance", providerShort: "SEC / filings", classification: "manual-research", frequency: "quarterly", unit: "Percent", format: "percent", sourceUrl: "https://www.sec.gov/edgar/search/", staleAfterDays: 120 }),
  mapped({ id: "earnings-forward-pe", pillarId: "earnings", indicator: "Forward P/E", provider: "Licensed consensus-estimates provider", providerShort: "Consensus", classification: "licensed-market-data", frequency: "daily", unit: "Multiple", sourceUrl: "https://insight.factset.com/earnings-insight", integration: "licensed", staleAfterDays: 3 }),
  mapped({ id: "earnings-equity-risk-premium", pillarId: "earnings", indicator: "Equity risk premium", provider: "Derived from consensus earnings and Treasury yields", providerShort: "Derived", classification: "licensed-market-data", frequency: "daily", unit: "Percentage points", format: "percent", sourceUrl: "https://pages.stern.nyu.edu/~adamodar/", integration: "licensed", staleAfterDays: 3, transformation: "Forward earnings yield less risk-free yield" }),
  mapped({ id: "earnings-fcf-yield", pillarId: "earnings", indicator: "FCF yield", provider: "Licensed fundamentals provider", providerShort: "Fundamentals", classification: "licensed-market-data", frequency: "daily", unit: "Percent", format: "percent", sourceUrl: "https://www.sec.gov/edgar/search/", integration: "licensed", staleAfterDays: 10 }),

  mapped({ id: "breadth-equal-weight", pillarId: "breadth", indicator: "Equal weight", provider: "Licensed index and market-data provider", providerShort: "Market data", classification: "licensed-market-data", frequency: "daily", unit: "Relative return", sourceUrl: "https://www.spglobal.com/spdji/en/indices/equity/sp-500-equal-weight-index/", integration: "licensed", staleAfterDays: 2 }),
  mapped({ id: "breadth-above-200d", pillarId: "breadth", indicator: "% above 200D", provider: "Licensed exchange breadth feed", providerShort: "Market data", classification: "licensed-market-data", frequency: "daily", unit: "Percent", format: "percent", sourceUrl: "https://www.nyse.com/market-data", integration: "licensed", staleAfterDays: 2 }),
  mapped({ id: "breadth-advance-decline", pillarId: "breadth", indicator: "Advance-decline", provider: "Licensed exchange breadth feed", providerShort: "Market data", classification: "licensed-market-data", frequency: "daily", unit: "Cumulative issues", sourceUrl: "https://www.nyse.com/market-data", integration: "licensed", staleAfterDays: 2 }),
  mapped({ id: "breadth-new-highs-lows", pillarId: "breadth", indicator: "New highs / lows", provider: "Licensed exchange breadth feed", providerShort: "Market data", classification: "licensed-market-data", frequency: "daily", unit: "Issue count", sourceUrl: "https://www.nyse.com/market-data", integration: "licensed", staleAfterDays: 2 }),
  mapped({ id: "breadth-small-large", pillarId: "breadth", indicator: "Small vs large", provider: "Licensed index and market-data provider", providerShort: "Market data", classification: "licensed-market-data", frequency: "daily", unit: "Relative return", sourceUrl: "https://www.lseg.com/en/ftse-russell", integration: "licensed", staleAfterDays: 2 }),
  mapped({ id: "breadth-cyclicals-defensives", pillarId: "breadth", indicator: "Cyclicals vs defensives", provider: "Licensed sector market-data provider", providerShort: "Market data", classification: "licensed-market-data", frequency: "daily", unit: "Relative return", sourceUrl: "https://www.spglobal.com/spdji/en/", integration: "licensed", staleAfterDays: 2 }),

  mapped({ id: "positioning-vix-curve", pillarId: "positioning", indicator: "VIX curve", provider: "Cboe Global Markets", providerShort: "Cboe", classification: "licensed-market-data", frequency: "daily", unit: "Index / spread", sourceUrl: "https://www.cboe.com/tradable_products/vix/", integration: "licensed", staleAfterDays: 2 }),
  mapped({ id: "positioning-put-call", pillarId: "positioning", indicator: "Put / call", provider: "Cboe Global Markets", providerShort: "Cboe", classification: "primary-public", frequency: "daily", unit: "Ratio", sourceUrl: "https://www.cboe.com/us/options/market_statistics/", staleAfterDays: 3 }),
  mapped({ id: "positioning-aaii", pillarId: "positioning", indicator: "AAII", provider: "American Association of Individual Investors", providerShort: "AAII", classification: "manual-research", frequency: "weekly", unit: "Percent", format: "percent", sourceUrl: "https://www.aaii.com/sentimentsurvey", staleAfterDays: 10 }),
  mapped({ id: "positioning-fund-flows", pillarId: "positioning", indicator: "Fund flows", provider: "Investment Company Institute", providerShort: "ICI", classification: "primary-public", frequency: "weekly", unit: "USD millions", sourceUrl: "https://www.ici.org/research/stats/flows", staleAfterDays: 14 }),
  mapped({ id: "positioning-cta", pillarId: "positioning", indicator: "CTA positioning", provider: "Licensed systematic-strategy research", providerShort: "Positioning", classification: "licensed-market-data", frequency: "daily", unit: "Exposure estimate", sourceUrl: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm", integration: "licensed", staleAfterDays: 3 }),
  mapped({ id: "positioning-cftc", pillarId: "positioning", indicator: "CFTC futures", provider: "U.S. Commodity Futures Trading Commission", providerShort: "CFTC", classification: "primary-public", frequency: "weekly", unit: "Contracts", sourceUrl: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm", staleAfterDays: 10 }),
];

export const FEATURED_SOURCE_DEFINITIONS = INDICATOR_SOURCE_REGISTRY.filter((source) => source.featured);

export function sourceForIndicator(pillarId: string, indicator: string) {
  return INDICATOR_SOURCE_REGISTRY.find(
    (source) => source.pillarId === pillarId && source.indicator === indicator,
  );
}

export function sourcesForPillar(pillarId: string) {
  return INDICATOR_SOURCE_REGISTRY.filter((source) => source.pillarId === pillarId);
}
