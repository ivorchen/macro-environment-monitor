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

## Validate

```bash
pnpm test
pnpm lint
pnpm build
```

## Data status

The current dashboard uses clearly labeled illustrative market readings and manually controlled scores. Live adapters for authoritative sources such as FRED, U.S. Treasury Fiscal Data, BLS, BEA, and market-data providers are intentionally left for the next phase so scoring logic remains inspectable before external credentials and provider contracts are chosen.
