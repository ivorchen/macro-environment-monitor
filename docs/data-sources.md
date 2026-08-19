# Data source registry

The dashboard separates observations from interpretation. Public adapters normalize a source value and attach its observation date, retrieval timestamp, unit, provenance URL, and freshness state. Pillar scores remain explicit user judgments.

The canonical machine-readable registry is in `lib/data/source-registry.ts`. It covers every indicator currently shown in the nine-pillar interface and classifies it as primary public data, aggregated public data, licensed market data, or manual research.

## Active adapters

| Provider | Current coverage | Credential | Cache / freshness |
| --- | --- | --- | --- |
| U.S. Treasury Fiscal Data | Treasury General Account closing balance | None | API responses are edge-cacheable for 15 minutes; stale after 4 calendar days |
| U.S. Bureau of Labor Statistics | Core CPI, payrolls, unemployment | None for the current request volume | API responses are edge-cacheable for 15 minutes; stale after 45 calendar days |
| FRED | Fed balance sheet, ON RRP, Treasury yields, real yield, and high-yield spread | `FRED_API_KEY` | API responses are edge-cacheable for 15 minutes; source-specific stale thresholds |

## Revision and history policy

- A current reading is the latest value returned by its authoritative source.
- Observation date and retrieval time are different fields and are never conflated.
- A source is marked stale when its observation date exceeds the registry threshold for its release frequency.
- Missing credentials, timeouts, malformed responses, and missing observations produce explicit unavailable readings; they do not silently reuse illustrative values.
- Several macro series are revised. Before weekly history is enabled, a saved review must retain the value available at review time as well as its retrieval timestamp. A later refresh must not rewrite the historical decision context.
- Licensed market breadth, consensus earnings, futures-implied policy, and positioning data remain isolated behind `licensed-market-data` classifications until a vendor and usage terms are selected.

## Local configuration

Copy `.env.example` to `.env.local`, add a FRED API key, and restart `pnpm dev`. Treasury and BLS sources work without local credentials.
