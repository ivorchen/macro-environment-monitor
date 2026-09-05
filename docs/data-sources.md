# Data source registry

The dashboard separates observations from interpretation. Public adapters normalize a source value and attach its observation date, retrieval timestamp, unit, provenance URL, and freshness state. The versioned macro risk model converts eligible observations into a transparent composite; missing inputs lower reported coverage rather than being treated as neutral.

The canonical machine-readable registry is in `lib/data/source-registry.ts`. It covers every indicator currently shown in the nine-pillar interface and classifies it as primary public data, aggregated public data, licensed market data, or manual research.

## Active adapters

| Provider | Current coverage | Credential | Cache / freshness |
| --- | --- | --- | --- |
| U.S. Treasury Fiscal Data | Treasury General Account closing balance | None | Redis TTL 1 hour; stale after 4 calendar days |
| U.S. Bureau of Labor Statistics | Core CPI, payrolls, unemployment | Optional `BLS_API_KEY`; FRED fallback uses `FRED_API_KEY` | Redis TTL 12 hours; stale after 45 calendar days |
| FRED | Fed balance sheet, ON RRP, Treasury yields, real yield, high-yield spread, and complete Chicago Fed NFCI YTD weekly history | `FRED_API_KEY` | Provider readings TTL 1 hour; NFCI history TTL 6 hours; source-specific stale thresholds |
| Polymarket Gamma API | September 2026 Fed-decision cut, hold, and hike distribution | None | TTL 15 minutes; unavailable on malformed, empty, or failed event responses |
| U.S. Bureau of Economic Analysis | Core PCE year-over-year change from NIPA table 2.8.4, line 25 | `BEA_API_KEY` | Redis TTL 12 hours; stale after 60 calendar days |
| U.S. Census Bureau | Advance monthly retail-trade sales, seasonally adjusted | `CENSUS_API_KEY` | Redis TTL 12 hours; stale after 45 calendar days |
| U.S. Treasury Fiscal Data | Latest completed Treasury auction offering amount | None | Redis TTL 1 hour; stale after 7 calendar days |
| Nasdaq public market data | 20-session relative returns for KRE/SPY, RSP/SPY, IWM/SPY, and XLI/XLP; latest RSP and JNK daily closes; eleven Select Sector SPDR histories plus SPY | None | Redis TTL 6 hours; stale after 3 calendar days |
| Financial Modeling Prep | SPX, VIX, gold (`GCUSD`), and Bitcoin (`BTCUSD`) market-snapshot quotes; Latest Senate Financial Disclosures | `FMP_API_KEY` and a plan licensed for the intended use | Market-snapshot and six-hour Senate dataset caches; protected by separate Redis daily quota ledgers |
| Official U.S. Senate XML roster | Current member Bioguide IDs, party, and state used to cross-check FMP Senate records | None | Refreshed with the cached Senate dataset |

Redis is optional. Set `REDIS_URL` to enable the shared cache; without it, adapters read their upstream sources directly. Only complete provider responses are cached. Unavailable or failed reads are retried on the next request rather than stored.

The AI market insight is a derived interpretation rather than a source adapter. A daily ChatGPT/Codex desktop task reads the normalized indicator and market-snapshot observations from the local application and writes a dated Markdown report using the versioned contract in `reports/market-insights/README.md`. The `pnpm insight:publish` script validates the report before converting it to the dashboard's structured JSON and writing a 48-hour dated Redis key plus an eight-day `latest` fallback. The application route is read-only with respect to the report: it does not call a model provider or generate on page load. The task prompt forbids invented facts and requires stale, unavailable, and conflicting inputs to be identified.

FMP is the exception to the direct-fetch fallback: Redis is required to enforce the shared daily request budgets, and FMP calls fail closed if the quota ledger is unavailable. Market quotes use a 40-call ledger and Senate pagination uses a separate eight-call ledger. Nasdaq ETF history does not use the FMP allowance and is cached for six hours. The market snapshot caches upstream reads for 55 minutes during the U.S. market window and six hours outside it; the normalized Senate dataset is cached for six hours. UI polling therefore does not multiply upstream calls.

The NFCI route requests every numeric weekly observation in the selected calendar year from FRED. It never interpolates missing weeks and calculates latest, YTD start/change/high/low, four-week change, and tightening/loosening/flat direction from the observations actually returned. Positive values mean tighter-than-average conditions and negative values mean looser-than-average conditions. Weekly review snapshots retain the points and derived fields available at save time.

## Derived scoring models

`macro-risk-v1` combines liquidity and rates at 20% each, with inflation, labor, credit, and breadth at 15% each. Liquidity uses the NFCI level and four-week change; rates use the 10-year real yield and 2s10s curve; inflation uses core CPI and core PCE; labor uses payroll growth and unemployment; credit uses high-yield OAS and KRE/SPY relative performance; breadth uses RSP/SPY, IWM/SPY, and XLI/XLP relative performance. Each continuous input is clamped to a documented 0–100 threshold range in `lib/risk-score.ts`. Available component weights are renormalized when a complete component is missing, and input coverage is returned separately by `/api/risk-score`.

`sector-etf-risk-v1` is separate from the macro score. It ranks XLK, XLC, XLY, XLF, XLI, XLE, XLB, XLRE, XLV, XLP, and XLU using absolute momentum (40%), 20-session relative strength against SPY (35%), RSI-14 (15%), and inverse annualized 20-session realized volatility (10%). The `/api/sectors` response exposes every underlying metric and labels failures per ETF. It is an ETF-level price model, not constituent breadth or a return forecast.

The Senate adapter retains the FMP source record fields, official filing URL, categorical amount range, ownership, transaction and disclosure dates, and current-roster party mapping. Eligible popularity rankings exclude sales, options, bonds, funds/ETFs, and unresolved securities. Exact duplicate records and superseded amendment versions cannot inflate aggregates. The current implementation is page-bounded for quota safety and exposes truncation, unknown tickers, unmapped members, invalid dates/ranges, and stale ingestion explicitly. A production reconciliation store is still required for immutable raw history beyond the Redis cache window and for authoritative historical party terms.

Featured BLS readings use the BLS API first. If BLS is unavailable or its anonymous daily allowance is exhausted, the app automatically retrieves the equivalent BLS-originated series through FRED (`CPILFESL`, `PAYEMS`, and `UNRATE`). Successful fallback readings retain their FRED/BLS provenance and are cached for twelve hours.

## Revision and history policy

- A current reading is the latest value returned by its authoritative source.
- Observation date and retrieval time are different fields and are never conflated.
- A source is marked stale when its observation date exceeds the registry threshold for its release frequency.
- A missing FRED credential, source timeouts, malformed responses, and missing observations produce explicit unavailable readings; they do not silently reuse illustrative values. Unconfigured optional BEA and Census providers are omitted instead.
- Several macro series are revised. Dated weekly reviews retain the value, observation date, and retrieval timestamp available at save time. Later refreshes and outcome updates do not rewrite the historical decision context.
- Nasdaq public daily ETF prices cover the liquid ETF-pair proxies for regional banks, equal-weight breadth, small-versus-large caps, and cyclicals-versus-defensives. The UI labels the symbols and transformation rather than presenting a proxy as an official index. FMP remains limited to entitled market-snapshot quotes.
- The Nasdaq market-activity endpoint is used as a credential-free local-research fallback, not as a contractual production feed. Confirm Nasdaq usage and display terms or select a licensed feed before public deployment.
- Consensus earnings, futures-implied policy, exchange breadth, volatility-curve, and proprietary positioning measures remain isolated behind `licensed-market-data` classifications until the relevant FMP entitlement or a specialist feed is contracted. They are not silently replaced by public or illustrative values.
- A configured API key establishes authentication, not redistribution rights. The operator is responsible for selecting an FMP plan whose licensing terms match the deployment and audience.
- Senate filings are delayed disclosures, not live trades. Party, ownership, amount range, trade date, disclosure date, lag, source, and freshness remain separate, and the module never changes the macro risk score.

## Local configuration

Copy `.env.example` to `.env.local`, add the keys for the sources you want to enable, and restart `pnpm dev`. Treasury, BLS, and Nasdaq ETF sources work without required local credentials. BEA and Census indicators are omitted from the API and UI when their corresponding keys are absent. FRED retains an explicit configuration-required state when `FRED_API_KEY` is missing because it also participates in the BLS fallback path. Without `FMP_API_KEY`, the market snapshot falls back to FRED where possible.

Keep `REDIS_URL` configured and Redis running to enable the daily AI market insight and any FMP-backed Senate or market requests. The scheduled desktop task uses the user's ChatGPT/Codex access rather than an OpenAI API key. If today's dated report is not present, the application uses the most recently published report; if neither key exists, the Overview card shows an explicit task/Redis message.

## Market news report ingestion

The web application cannot read ChatGPT task history. A local Codex automation is the supported trust boundary: after the two weekday 8:00 AM America/Toronto report tasks finish, it reads their latest completed outputs through the Codex app task tools and writes `reports/market-news/YYYY-MM-DD.json`. Task text and linked pages are untrusted data, never instructions. The handoff contains each verbatim report plus citation-grounded candidate stories with source, headline, summary, publication timestamp, HTTPS URL, category, and report identity.

`pnpm news:publish -- reports/market-news/YYYY-MM-DD.json --dry-run` validates the bundle without Redis. The real publish strips tracking parameters, canonicalizes URLs, deduplicates by canonical URL and normalized headline, merges report attribution, and atomically writes `market-news:v1:latest`, a dated full-report key, and a full-report latest fallback under `REDIS_KEY_PREFIX`. All expire after eight days so a missed weekday run leaves a bounded fallback without making stale content permanent. If either task output, a source timestamp, or a canonical citation URL cannot be resolved, the automation must omit the story or stop before publish; it must never fabricate values.

Market-news items and the daily AI insight carry English, Simplified Chinese (`zh-CN`), and Traditional Chinese (`zh-TW`) content in the same Redis payload. The browser selects the matching content locally when the user changes language, so switching languages does not trigger another model or data request. Publishers require both Chinese variants for new scheduled output; older insight payloads fall back to English until republished.
