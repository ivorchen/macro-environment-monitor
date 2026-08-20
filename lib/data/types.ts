export type SourceAdapter = "fred" | "treasury" | "bls" | "bea" | "census" | "fmp";

export type SourceClassification =
  | "primary-public"
  | "aggregated-public"
  | "licensed-market-data"
  | "manual-research";

export type DataFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "event-driven";

export type ReadingFormat =
  | "number"
  | "percent"
  | "index"
  | "usd-billions"
  | "usd-dollars-to-billions"
  | "usd-millions-to-billions"
  | "usd-millions-to-trillions"
  | "signed-thousands"
  | "thousands-to-millions";

export type ReadingCalculation = "latest" | "period-change" | "year-over-year-percent";

export type IntegrationStatus = "active" | "credential-required" | "planned" | "licensed";

export type IndicatorSourceDefinition = {
  id: string;
  pillarId: string;
  indicator: string;
  provider: string;
  providerShort: string;
  classification: SourceClassification;
  seriesId: string | null;
  frequency: DataFrequency;
  unit: string;
  format: ReadingFormat;
  calculation: ReadingCalculation;
  transformation: string;
  revisionPolicy: string;
  staleAfterDays: number;
  sourceUrl: string;
  adapter: SourceAdapter | null;
  integration: IntegrationStatus;
  featured?: boolean;
};

export type ReadingFreshness = "fresh" | "stale" | "unavailable";

export type IndicatorReading = {
  id: string;
  pillarId: string;
  indicator: string;
  provider: string;
  providerShort: string;
  value: number | null;
  displayValue: string;
  unit: string;
  transformation: string;
  observationDate: string | null;
  fetchedAt: string;
  freshness: ReadingFreshness;
  sourceUrl: string;
  seriesId: string | null;
  errorCode?: "configuration-required" | "source-failed" | "missing-observation";
  errorMessage?: string;
};

export type IndicatorApiResponse = {
  generatedAt: string;
  readings: IndicatorReading[];
  cache: {
    backend: "redis" | "none";
    hits: SourceAdapter[];
    misses: SourceAdapter[];
    bypassed: SourceAdapter[];
  };
  summary: {
    fresh: number;
    stale: number;
    unavailable: number;
  };
};

export type AdapterOptions = {
  fetcher?: typeof fetch;
  now?: Date;
};
