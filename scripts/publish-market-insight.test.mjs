import { describe, expect, it } from "vitest";

import { parseMarketInsightMarkdown, redisKeys } from "./publish-market-insight.mjs";

const report = `---
reportDate: 2026-08-20
generatedAt: 2026-08-20T11:30:00.000Z
model: codex-scheduled-task
---
# Cross-asset signals remain mixed

## Brief
Credit remains calm, but real yields keep the macro signal from becoming fully supportive.

## Overview
The latest available dashboard readings show constructive credit alongside a restrictive real-rate backdrop. Observation dates differ, so conviction remains moderate.

## Key signals
- High-yield spreads remain contained.
- Real yields remain restrictive.
- Breadth is not confirming every headline move.

## Risks
- Stale releases may hide a newer change.
- Volatility could break the current credit confirmation.

## What to watch next
- Compare the next credit close with breadth.
- Watch whether real yields and gold confirm each other.
`;

describe("market insight Markdown publisher", () => {
  it("parses the scheduled-task report contract", () => {
    const parsed = parseMarketInsightMarkdown(report);
    expect(parsed.reportDate).toBe("2026-08-20");
    expect(parsed.detailed.headline).toBe("Cross-asset signals remain mixed");
    expect(parsed.detailed.keySignals).toHaveLength(3);
  });

  it("builds the dated and latest Redis keys", () => {
    expect(redisKeys("2026-08-20", "test-prefix:")).toEqual({
      daily: "test-prefix:ai-market-insight:v1:2026-08-20",
      latest: "test-prefix:ai-market-insight:v1:latest",
    });
  });

  it("rejects incomplete reports before Redis is touched", () => {
    expect(() => parseMarketInsightMarkdown(report.replace("## Risks", "## Missing")))
      .toThrow("required sections");
  });
});
