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

## Translations
\`\`\`json
{"zh-CN":{"brief":"信用保持稳定，但实际收益率仍限制宏观信号。","detailed":{"headline":"跨资产信号仍然分化","overview":"最新数据呈现建设性信用环境和限制性实际利率。","keySignals":["高收益债利差稳定。","实际收益率仍具限制性。","市场广度尚未确认。"],"risks":["滞后数据可能掩盖变化。","波动率可能打破确认。"],"watchNext":["比较下一次信用收盘与市场广度。","观察实际收益率和黄金。"]}},"zh-TW":{"brief":"信用維持穩定，但實質殖利率仍限制宏觀訊號。","detailed":{"headline":"跨資產訊號仍然分化","overview":"最新資料呈現建設性信用環境和限制性實質殖利率。","keySignals":["高收益債利差穩定。","實質殖利率仍具限制性。","市場廣度尚未確認。"],"risks":["落後資料可能掩蓋變化。","波動率可能打破確認。"],"watchNext":["比較下一次信用收盤與市場廣度。","觀察實質殖利率和黃金。"]}}}
\`\`\`
`;

describe("market insight Markdown publisher", () => {
  it("parses the scheduled-task report contract", () => {
    const parsed = parseMarketInsightMarkdown(report);
    expect(parsed.reportDate).toBe("2026-08-20");
    expect(parsed.detailed.headline).toBe("Cross-asset signals remain mixed");
    expect(parsed.detailed.keySignals).toHaveLength(3);
    expect(parsed.translations["zh-CN"].detailed.headline).toBe("跨资产信号仍然分化");
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
