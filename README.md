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

To enable Federal Reserve, rates, and credit readings from FRED, copy `.env.example` to `.env.local` and add a free `FRED_API_KEY`. Treasury Fiscal Data and BLS readings do not require local credentials.

An optional `BLS_API_KEY` raises BLS's daily request allowance. When anonymous BLS access is exhausted, the featured Core CPI, payrolls, and unemployment readings automatically fall back to their BLS-originated FRED series using `FRED_API_KEY`.

To enable shared source caching, also set `REDIS_URL` to a `redis://` or TLS `rediss://` connection string. FRED and Treasury provider payloads are cached for one hour; BLS payloads are cached for twelve hours. Redis failures fall back to direct source requests.

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

The dashboard keeps its cross-asset market cards clearly labeled as illustrative and its pillar scores manually controlled. The indicator workspace now includes normalized public readings from Treasury Fiscal Data and BLS, plus FRED when a server-side API key is configured. Each reading exposes provenance, observation date, and freshness. See [the data-source policy](docs/data-sources.md) for coverage and revision handling.

The S&P 500, Nasdaq 100, equal-weight S&P 500, and VIX cards are illustrative placeholders. They are not live, delayed, or periodically refreshed market quotes.

## Weekly history

The Journal view saves versioned, dated review snapshots in browser local storage. Each snapshot freezes the scorecard, review narrative, hypothesis, checklist, and authoritative readings available at save time. The latest two reviews can be compared, outcomes can be scored later without rewriting the original evidence, and every review can be exported as Markdown.
