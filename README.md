# Macro Environment Monitor

A Next.js dashboard for evaluating whether the U.S. equity macro environment is supportive, neutral, or hostile. It combines a live, transparent 0–100 macro risk model, a nine-pillar scorecard, authoritative public readings, a U.S. sector view, a weekly review workflow, and a device-local decision journal.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- shadcn/ui components
- pnpm
- Vitest

## Run locally

```bash
corepack enable
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

`APP_URL` controls canonical and social metadata. Local development defaults to `http://localhost:3000`; set the real public HTTPS origin in `.env.local` before a production build or Docker Compose rollout. The production Compose stack intentionally fails configuration when `APP_URL` is absent so it cannot publish incorrect canonical URLs.

The interface supports English, Simplified Chinese, and Traditional Chinese. Use the language selector in the header; the choice is saved in browser local storage and the first visit follows the browser language. Dashboard navigation, controls, statuses, help text, and localized dates switch immediately. Provider names, ticker symbols, source payloads, saved user notes, and published AI-report prose remain in their original language to preserve auditability.

Copy `.env.example` to `.env.local` and add keys for the sources you want to enable. `FRED_API_KEY`, `BEA_API_KEY`, and `CENSUS_API_KEY` enable their respective public APIs. BEA and Census indicators are automatically omitted from the API and UI until their keys are configured. Treasury Fiscal Data and BLS readings do not require a key, although an optional `BLS_API_KEY` raises the BLS request allowance.

An optional `BLS_API_KEY` raises BLS's daily request allowance. When anonymous BLS access is exhausted, the featured Core CPI, payrolls, and unemployment readings automatically fall back to their BLS-originated FRED series using `FRED_API_KEY`.

`FMP_API_KEY` enables quota-protected SPX, VIX, gold (`GCUSD`), and Bitcoin (`BTCUSD`) quotes in the market snapshot, plus the delayed Senate financial-disclosure feed when the configured plan permits that endpoint. The four 20-session ETF relative-strength indicators use Nasdaq public daily market data for KRE/SPY, RSP/SPY, IWM/SPY, and XLI/XLP, so they do not consume the FMP allowance. The September Fed-decision indicator uses Polymarket's public Gamma API without a local credential and caches its normalized cut/hold/hike distribution for fifteen minutes. Choose an FMP subscription whose usage and display rights match your deployment; a key alone does not grant redistribution rights.

To enable shared source caching, also set `REDIS_URL` to a `redis://` or TLS `rediss://` connection string. Redis is required for FMP quota protection. FRED and Treasury provider payloads are cached for one hour, BLS payloads for twelve hours, and Nasdaq ETF history, NFCI history, and normalized Senate disclosure results for six hours. Market quotes have a 40-call daily ledger and Senate pagination has a separate eight-call daily ledger. FMP calls fail closed when the shared quota ledger is unavailable.

The AI market insight is published by a daily ChatGPT/Codex desktop task, so it does not require `OPENAI_API_KEY` or API credits. The task reads the dashboard's current indicator and market-snapshot observations, writes `reports/market-insights/YYYY-MM-DD.md`, and runs `pnpm insight:publish` to validate the Markdown and store structured JSON in Redis. Redis is required by the Overview card. Dated reports live for 48 hours; an eight-day `latest` key keeps the previous report visible until the next task completes. Keep the Mac awake and the desktop app running at the scheduled time. AI synthesis is informational and should be checked against the linked source observations.

## Docker

The Compose stack runs the production Next.js server and a private Redis instance. Redis data is persisted in the `redis-data` Docker volume. Keep `FRED_API_KEY` in `.env.local`; Compose loads that file at runtime without copying it into the application image.

```bash
docker compose --env-file .env.local up --build -d
docker compose --env-file .env.local ps
```

Open `http://localhost:3000`. To inspect the cache or follow the application logs:

```bash
docker compose --env-file .env.local exec redis redis-cli INFO keyspace
docker compose --env-file .env.local logs -f app
```

Stop the containers without deleting the Redis volume:

```bash
docker compose --env-file .env.local down
```

## Validate

```bash
pnpm check
```

## Move to macOS

The repository pins Node.js 22 in `.nvmrc` and pnpm in `package.json`. After cloning it on the Mac:

```bash
nvm install
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Add your API keys to the new `.env.local`; that file is intentionally excluded from Git. The weekly journal is stored in browser local storage and the Compose Redis cache is stored in a local Docker volume, so neither moves with the repository. Export any journal entries you want to retain before leaving the current browser. Redis only contains refreshable source data and can safely start empty on the Mac.

## Macro risk score

The headline regime is calculated from current source observations rather than a fixed sample total. `macro-risk-v1` maps six independent components to 0–100 and combines them as liquidity 20%, rates 20%, inflation 15%, labor 15%, credit 15%, and breadth 15%. Each component shows its score and input coverage. Missing components are excluded and remaining weights are normalized; missing individual inputs reduce the disclosed coverage instead of silently becoming neutral. The route refreshes through the existing provider caches every fifteen minutes. Thresholds and transformations are versioned in `lib/risk-score.ts` and covered by unit tests.

The zones are Defensive (0–20), Cautious (21–40), Mixed (41–60), Risk supportive (61–80), and Euphoric (81–100). The read-only nine-pillar scorecard derives available pillar badges from the same components. Growth, earnings, and positioning remain neutral with an explicit “no automated rule” explanation until suitable directional data is available. This is an observational framework, not a forecast or investment recommendation.

## Data status

The cross-asset snapshot uses quota-protected FMP quotes where the configured plan permits them, Nasdaq daily ETF data for RSP and JNK, and daily-close FRED observations otherwise. The indicator workspace includes normalized public readings from Treasury Fiscal Data, BLS, and Nasdaq; plus keyed BEA, Census, and FRED readings. Each reading exposes provenance, observation date, calculation, and freshness. See [the data-source policy](docs/data-sources.md) for coverage, licensing boundaries, scoring thresholds, and revision handling.

The S&P 500, VIX, gold, and Bitcoin cards use individual FMP quotes supported by the configured Basic plan. Nasdaq 100, 10-year real yield, and high-yield OAS use daily FRED observations, while RSP and JNK use their latest Nasdaq daily closes. The snapshot refreshes from Redis every five minutes while visible; upstream data is cached for 55 minutes during market hours and six hours outside the market window.

The Overview page's AI market insight is generated once each New York day by the scheduled desktop task. It summarizes only the readings retrieved from the local application, identifies stale or unavailable inputs, and provides an expandable detailed report. The web route only reads the published Redis value and never calls the OpenAI API. See [the report contract](reports/market-insights/README.md) for the exact Markdown structure and manual publish command.

## Financial conditions

The Overview includes a reusable **Chicago Fed NFCI — YTD** chart backed by FRED's weekly `NFCI` series. The `/api/financial-conditions/nfci` route accepts an optional `year` query, preserves every available weekly observation without interpolation, and returns the latest value, YTD change/high/low, four-week change, direction, source, observation date, retrieval time, and freshness. Positive NFCI values are tighter than average and negative values are looser than average; the chart is an aggregate cross-check, not a tenth pillar or a mechanical signal.

Saved weekly reviews retain the complete NFCI point set and derived statistics available at save time so a historical chart can be reproduced without newer observations.

## Sector view

The **Sectors** workspace ranks the eleven U.S. Select Sector SPDR ETFs using Nasdaq daily closes. `sector-etf-risk-v1` combines absolute momentum (40%), 20-session relative strength versus SPY (35%), 14-session RSI (15%), and inverse 20-session realized volatility (10%). Cards expose the one-day and 20-session returns, relative return, RSI, volatility, observation date, and data status. Results are cached in Redis for six hours and do not consume the FMP allowance.

This is an ETF-level price model. It does not claim constituent advance/decline breadth, earnings breadth, or expected returns. A licensed constituent feed would be required before adding those measures.

## Senate trading disclosures

The **Senate trades** workspace uses FMP's paginated Latest Senate Financial Disclosures endpoint and cross-checks party codes with the official Senate XML roster. It supports 30D, 90D, YTD, and 1Y transaction-date windows, defaulting to 90D. Direct-equity purchases are normalized separately from other disclosed assets; spouse and dependent-child ownership remain labeled, amounts remain lower/upper ranges, and trade date, disclosure date, lag, source link, freshness, deduplication, and amendment lineage remain visible.

Bipartisan results require at least one distinct Democratic and one distinct Republican senator household. Party lists rank first by distinct senators, then event count, most recent transaction date, and ticker; Independents remain separate. The current-roster party resolution is explicitly labeled, and unmapped members do not silently enter party rankings. The module is descriptive and never changes the automated macro risk score.

Cached APIs are available at `/api/senate-trades`, `/api/senate-trades/recent`, `/api/senate-trades/bipartisan`, `/api/senate-trades/popular`, and `/api/senate-trades/ticker/[ticker]`. Saved weekly reviews retain the selected window, rule version, aggregates, and eligible source evidence.

## Interface behavior

- The header theme switch toggles between light and dark modes, persists the choice on the device, and follows the operating-system preference on the first visit.
- The header language selector switches between English, Simplified Chinese, and Traditional Chinese, persists the selection on the device, and updates the document language and locale-aware dates.
- The Overview page includes a Redis-backed **Market News** feed extracted from citations in the weekday `Daily Tech & Market Brief` and `US Stocks Macro Monitoring` reports. A local Codex automation reads the latest completed task outputs after both 8:00 AM Toronto reports, writes a strict JSON handoff, and runs `pnpm news:publish`. The publisher stores the full report text and a canonicalized, deduplicated feed; entries without a real HTTPS source URL are rejected rather than invented. Both report and feed fallback keys expire after eight days.
- The headline score is a live 0–100 reading, not a persisted sample number. Its six component tiles disclose their current score and data coverage.
- Weekly scorecard status chips are read-only summaries derived from the live component model; unmodeled pillars remain explicitly unavailable rather than appearing neutral.
- The dedicated **Sectors** workspace compares all eleven Select Sector SPDR ETFs against SPY using a separate, disclosed price-behavior model.
- The market snapshot presents nine cards in a maximum three-column grid: SPX, Nasdaq 100, equal weight, 10-year real yield, high-yield OAS, VIX, gold, JNK, and Bitcoin.
- The regime summary and AI market insight use separate full-width rows on large screens, avoiding stretched side-by-side cards.
- **Read detailed analysis** expands the AI insight card in place and displays the complete report. It does not open a modal or introduce a nested scrolling area; **Hide detailed analysis** collapses it again.
- **Senate trades** is a separate read-only research workspace with an explicit unavailable state when FMP or Redis quota protection cannot be reached.

## Weekly history

The Journal view saves versioned, dated review snapshots in browser local storage. Each snapshot freezes the scorecard, review narrative, hypothesis, checklist, authoritative readings, complete NFCI YTD history, and 90-day Senate aggregate evidence available at save time. The latest two reviews can be compared, outcomes can be scored later without rewriting the original evidence, and every review can be exported as Markdown.
