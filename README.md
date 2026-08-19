# Macro Environment Monitor

A Next.js dashboard for evaluating whether the U.S. equity macro environment is supportive, neutral, or hostile. The first slice implements a transparent nine-pillar scorecard, indicator library, weekly review workflow, and device-local persistence.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- shadcn/ui components
- pnpm
- Vitest

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

To enable Federal Reserve, rates, and credit readings from FRED, copy `.env.example` to `.env.local` and add a free `FRED_API_KEY`. Treasury Fiscal Data and BLS readings do not require local credentials.

## Validate

```bash
pnpm test
pnpm lint
pnpm build
```

## Data status

The dashboard keeps its cross-asset market cards clearly labeled as illustrative and its pillar scores manually controlled. The indicator workspace now includes normalized public readings from Treasury Fiscal Data and BLS, plus FRED when a server-side API key is configured. Each reading exposes provenance, observation date, and freshness. See [the data-source policy](docs/data-sources.md) for coverage and revision handling.
