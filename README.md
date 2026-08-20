# Macro Environment Monitor

A Next.js dashboard for evaluating whether the U.S. equity macro environment is supportive, neutral, or hostile. It combines a transparent nine-pillar scorecard, authoritative public readings, a weekly review workflow, and a device-local decision journal.

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

Copy `.env.example` to `.env.local` and add keys for the sources you want to enable. `FRED_API_KEY`, `BEA_API_KEY`, and `CENSUS_API_KEY` enable their respective public APIs. BEA and Census indicators are automatically omitted from the API and UI until their keys are configured. Treasury Fiscal Data and BLS readings do not require a key, although an optional `BLS_API_KEY` raises the BLS request allowance.

An optional `BLS_API_KEY` raises BLS's daily request allowance. When anonymous BLS access is exhausted, the featured Core CPI, payrolls, and unemployment readings automatically fall back to their BLS-originated FRED series using `FRED_API_KEY`.

`FMP_API_KEY` enables the selected licensed market-data integration. Its indicators are automatically omitted from the API and UI until the key is configured. The first adapter calculates transparent 20-session relative returns for KRE/SPY, RSP/SPY, IWM/SPY, and XLI/XLP. Choose an FMP subscription whose usage and display rights match your deployment; a key alone does not grant redistribution rights.

To enable shared source caching, also set `REDIS_URL` to a `redis://` or TLS `rediss://` connection string. Redis is required for FMP quota protection. FRED and Treasury provider payloads are cached for one hour, BLS payloads for twelve hours, and FMP historical breadth payloads for twenty-four hours. FMP calls fail closed when the shared quota ledger is unavailable.

## Docker

The Compose stack runs the production Next.js server and a private Redis instance. Redis data is persisted in the `redis-data` Docker volume. Keep `FRED_API_KEY` in `.env.local`; Compose loads that file at runtime without copying it into the application image.

```bash
docker compose up --build -d
docker compose ps
```

Open `http://localhost:3000`. To inspect the cache or follow the application logs:

```bash
docker compose exec redis redis-cli INFO keyspace
docker compose logs -f app
```

Stop the containers without deleting the Redis volume:

```bash
docker compose down
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

## Data status

The dashboard keeps its pillar scores manually controlled. The cross-asset snapshot now uses quota-protected FMP quotes where the configured plan permits them and daily-close FRED observations otherwise. The indicator workspace includes normalized public readings from Treasury Fiscal Data and BLS; keyed BEA, Census, and FRED readings; and keyed FMP breadth proxies. Each reading exposes provenance, observation date, calculation, and freshness. See [the data-source policy](docs/data-sources.md) for coverage, licensing boundaries, and revision handling.

The S&P 500 and VIX cards use individual FMP quotes supported by the configured Basic plan. Nasdaq 100, 10-year real yield, and high-yield OAS use daily FRED observations. RSP is shown as unavailable because its quote is not included in the configured FMP Basic entitlement. The snapshot refreshes from Redis every five minutes while visible; upstream data is cached for 55 minutes during market hours and six hours outside the market window.

## Weekly history

The Journal view saves versioned, dated review snapshots in browser local storage. Each snapshot freezes the scorecard, review narrative, hypothesis, checklist, and authoritative readings available at save time. The latest two reviews can be compared, outcomes can be scored later without rewriting the original evidence, and every review can be exported as Markdown.
