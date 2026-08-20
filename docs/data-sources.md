# Data source registry

The dashboard separates observations from interpretation. Public adapters normalize a source value and attach its observation date, retrieval timestamp, unit, provenance URL, and freshness state. Pillar scores remain explicit user judgments.

The canonical machine-readable registry is in `lib/data/source-registry.ts`. It covers every indicator currently shown in the nine-pillar interface and classifies it as primary public data, aggregated public data, licensed market data, or manual research.

## Active adapters

| Provider | Current coverage | Credential | Cache / freshness |
| --- | --- | --- | --- |
| U.S. Treasury Fiscal Data | Treasury General Account closing balance | None | Redis TTL 1 hour; stale after 4 calendar days |
| U.S. Bureau of Labor Statistics | Core CPI, payrolls, unemployment | Optional `BLS_API_KEY`; FRED fallback uses `FRED_API_KEY` | Redis TTL 12 hours; stale after 45 calendar days |
| FRED | Fed balance sheet, ON RRP, Treasury yields, real yield, and high-yield spread | `FRED_API_KEY` | Redis TTL 1 hour; source-specific stale thresholds |
| U.S. Bureau of Economic Analysis | Core PCE year-over-year change from NIPA table 2.8.4, line 25 | `BEA_API_KEY` | Redis TTL 12 hours; stale after 60 calendar days |
| U.S. Census Bureau | Advance monthly retail-trade sales, seasonally adjusted | `CENSUS_API_KEY` | Redis TTL 12 hours; stale after 45 calendar days |
| U.S. Treasury Fiscal Data | Latest completed Treasury auction offering amount | None | Redis TTL 1 hour; stale after 7 calendar days |
| Financial Modeling Prep | 20-session relative returns for KRE/SPY, RSP/SPY, IWM/SPY, and XLI/XLP | `FMP_API_KEY` and a plan licensed for the intended use | Redis TTL 24 hours; stale after 3 calendar days |

Redis is optional. Set `REDIS_URL` to enable the shared cache; without it, adapters read their upstream sources directly. Only complete provider responses are cached. Unavailable or failed reads are retried on the next request rather than stored.

FMP is the exception to the direct-fetch fallback: Redis is required to enforce the shared daily request budget, and FMP calls fail closed if the quota ledger is unavailable. The market snapshot caches upstream reads for 55 minutes during the U.S. market window and six hours outside it. The UI can poll the local API every five minutes without multiplying FMP calls.

Featured BLS readings use the BLS API first. If BLS is unavailable or its anonymous daily allowance is exhausted, the app automatically retrieves the equivalent BLS-originated series through FRED (`CPILFESL`, `PAYEMS`, and `UNRATE`). Successful fallback readings retain their FRED/BLS provenance and are cached for twelve hours.

## Revision and history policy

- A current reading is the latest value returned by its authoritative source.
- Observation date and retrieval time are different fields and are never conflated.
- A source is marked stale when its observation date exceeds the registry threshold for its release frequency.
- A missing FRED credential, source timeouts, malformed responses, and missing observations produce explicit unavailable readings; they do not silently reuse illustrative values. Unconfigured optional BEA, Census, and FMP providers are omitted instead.
- Several macro series are revised. Dated weekly reviews retain the value, observation date, and retrieval timestamp available at save time. Later refreshes and outcome updates do not rewrite the historical decision context.
- Financial Modeling Prep is the selected first licensed provider. Its adapter currently covers liquid ETF-pair proxies for regional banks, equal-weight breadth, small-versus-large caps, and cyclicals-versus-defensives. The UI labels the symbols and transformation rather than presenting a proxy as an official index.
- Consensus earnings, futures-implied policy, exchange breadth, volatility-curve, and proprietary positioning measures remain isolated behind `licensed-market-data` classifications until the relevant FMP entitlement or a specialist feed is contracted. They are not silently replaced by public or illustrative values.
- A configured API key establishes authentication, not redistribution rights. The operator is responsible for selecting an FMP plan whose licensing terms match the deployment and audience.

## Local configuration

Copy `.env.example` to `.env.local`, add the keys for the sources you want to enable, and restart `pnpm dev`. Treasury and BLS sources work without required local credentials. BEA, Census, and FMP indicators are omitted from the API and UI when their corresponding keys are absent. FRED retains an explicit configuration-required state when `FRED_API_KEY` is missing because it also participates in the BLS fallback path.
