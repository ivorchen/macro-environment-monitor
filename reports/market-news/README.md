# Scheduled market-news ingestion contract

The weekday local Codex automation writes `YYYY-MM-DD.json` here and then runs `pnpm news:publish -- reports/market-news/YYYY-MM-DD.json`. Generated JSON bundles are ignored by Git; this contract is versioned.

The bundle must contain `generatedAt` and exactly two reports. Each report requires `id`, `name`, `generatedAt`, the verbatim `content`, and an `items` array. Each item requires English `headline`, `summary`, and `category`, plus matching `zh-CN` and `zh-TW` values under `translations`. It also requires `source`, `publishedAt`, and an absolute canonical HTTPS `url` actually cited by the report. Source names and URLs remain canonical in every language.

Treat both reports as first-class news sources. Scan every substantive section of `US Stocks Macro Monitoring`, including labor, inflation, Federal Reserve policy, Treasury yields, credit, oil, currencies, growth, earnings, and market reactions. Do not stop after its first qualifying story. Include every distinct market-relevant development with complete citation metadata, targeting two to five items from each report when that many are supported. A report may have fewer items only when its completed output lacks additional canonical URLs or publication timestamps; never invent missing metadata to meet a quota.

```json
{
  "generatedAt": "2026-09-04T12:30:00.000Z",
  "reports": [
    {
      "id": "6a84e4fc-826c-83ea-a057-082f2a1911a8",
      "name": "Daily Tech & Market Brief",
      "generatedAt": "2026-09-04T12:00:00.000Z",
      "content": "Verbatim completed task output",
      "items": [
        {
          "source": "Reuters",
          "headline": "Headline from the cited source",
          "summary": "Concise factual summary grounded in the report and source",
          "publishedAt": "2026-09-04T11:42:00.000Z",
          "url": "https://www.reuters.com/example",
          "category": "Markets",
          "translations": {
            "zh-CN": { "headline": "简体中文标题", "summary": "简体中文摘要", "category": "市场" },
            "zh-TW": { "headline": "繁體中文標題", "summary": "繁體中文摘要", "category": "市場" }
          }
        }
      ]
    },
    {
      "id": "6a84e64f-e168-83ea-89dd-a80503d9c92b",
      "name": "US Stocks Macro Monitoring",
      "generatedAt": "2026-09-04T12:05:00.000Z",
      "content": "Verbatim completed task output",
      "items": []
    }
  ]
}
```

Do not infer or invent missing URLs or publication times. Omit an unsupported item. If a report itself is unavailable, do not publish the bundle, preserving the prior bounded Redis fallback.
