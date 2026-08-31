# Daily market insight report contract

The scheduled desktop task writes one file named `YYYY-MM-DD.md` in this directory, then runs `pnpm insight:publish -- reports/market-insights/YYYY-MM-DD.md`. Generated reports are intentionally ignored by Git; this contract remains versioned.

The task should retrieve `/api/indicators`, `/api/market-snapshot`, `/api/financial-conditions/nfci`, and `/api/senate-trades?window=90D`. NFCI and Senate inputs are descriptive context only: identify their observation/disclosure dates, freshness, missing or partial states, and cross-signal agreement or conflict. Never infer intent from a disclosure, treat the filing as a live trade, invent an exact amount from a range, or let Senate activity mechanically determine the macro regime.

Use the New York calendar date and this exact structure:

```markdown
---
reportDate: 2026-08-20
generatedAt: 2026-08-20T11:30:00.000Z
model: codex-scheduled-task
---
# A concise detailed-report headline

## Brief
One or two compact sentences for the dashboard card.

## Overview
A concise macroeconomic synthesis grounded only in the retrieved dashboard readings. Distinguish observation dates from retrieval times and explain uncertainty.

## Key signals
- Three to five evidence-based signals.
- Include cross-asset confirmation or conflict.
- Identify stale or unavailable inputs when material.

## Risks
- Two to four risks to the interpretation.
- Do not give personalized investment advice.

## What to watch next
- Two to four specific future observations.
- Keep each item concise and testable.
```

The publisher rejects missing, reordered, empty, or incorrectly sized sections before connecting to Redis. It writes the structured JSON to a 48-hour dated key and an eight-day `latest` fallback key. Run a validation without writing to Redis with:

```bash
pnpm insight:publish -- reports/market-insights/YYYY-MM-DD.md --dry-run
```
