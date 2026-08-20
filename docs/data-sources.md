# Data source registry

The dashboard separates observations from interpretation. Public adapters normalize a source value and attach its observation date, retrieval timestamp, unit, provenance URL, and freshness state. Pillar scores remain explicit user judgments.

The canonical machine-readable registry is in `lib/data/source-registry.ts`. It covers every indicator currently shown in the nine-pillar interface and classifies it as primary public data, aggregated public data, licensed market data, or manual research.

## Active adapters

| Provider | Current coverage | Credential | Cache / freshness |
| --- | --- | --- | --- |
| U.S. Treasury Fiscal Data | Treasury General Account closing balance | None | Redis TTL 1 hour; stale after 4 calendar days |
| U.S. Bureau of Labor Statistics | Core CPI, payrolls, unemployment | Optional `BLS_API_KEY`; FRED fallback uses `FRED_API_KEY` | Redis TTL 12 hours; stale after 45 calendar days |
| FRED | Fed balance sheet, ON RRP, Treasury yields, real yield, and high-yield spread | `FRED_API_KEY` | Redis TTL 1 hour; source-specific stale thresholds |

Redis is optional. Set `REDIS_URL` to enable the shared cache; without it, adapters read their upstream sources directly. Only complete provider responses are cached. Unavailable or failed reads are retried on the next request rather than stored.

Featured BLS readings use the BLS API first. If BLS is unavailable or its anonymous daily allowance is exhausted, the app automatically retrieves the equivalent BLS-originated series through FRED (`CPILFESL`, `PAYEMS`, and `UNRATE`). Successful fallback readings retain their FRED/BLS provenance and are cached for twelve hours.

## Revision and history policy

- A current reading is the latest value returned by its authoritative source.
- Observation date and retrieval time are different fields and are never conflated.
- A source is marked stale when its observation date exceeds the registry threshold for its release frequency.
- Missing credentials, timeouts, malformed responses, and missing observations produce explicit unavailable readings; they do not silently reuse illustrative values.
- Several macro series are revised. Dated weekly reviews retain the value, observation date, and retrieval timestamp available at save time. Later refreshes and outcome updates do not rewrite the historical decision context.
- Licensed market breadth, consensus earnings, futures-implied policy, and positioning data remain isolated behind `licensed-market-data` classifications until a vendor and usage terms are selected.

## Local configuration

Copy `.env.example` to `.env.local`, add a FRED API key, and restart `pnpm dev`. Treasury and BLS sources work without local credentials.
