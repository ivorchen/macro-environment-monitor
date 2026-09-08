# Nine-pillar alpha scoring

Version: macro-risk-v2-alpha. This is a descriptive, uncalibrated heuristic, not a forecast or investment recommendation. Historical v1 scores are not directly comparable.

Weights sum to 100: liquidity 15, rates 15, inflation 10, growth 10, labor 10, credit 10, earnings 10, breadth 10, positioning 10. Missing components are excluded and remaining weights renormalized; coverage counts all 16 expected inputs across nine pillars.

New public-data proxies, fetched through the existing FRED adapter and Redis provider cache:

- Growth: INDPRO year-over-year percentage change. Linear score from 10 at -5% to 90 at +5%, clamped to 0–100. Industrial output is not total GDP.
- Earnings: CP year-over-year percentage change, matching the same quarter one year earlier. Linear score from 10 at -20% to 90 at +20%, clamped. BEA reported economy-wide after-tax profits are lagged and revisable, not forward S&P 500 EPS or analyst revisions. Source: https://fred.stlouisfed.org/series/CP
- Positioning: VIXCLS daily close. Linear risk-sentiment score from 75 at VIX 12 to 10 at 40, clamped. This is expected volatility, not investor holdings, fund flows, or a contrarian entry signal. Source: https://fred.stlouisfed.org/series/VIXCLS

Monthly and quarterly FRED observation dates represent period starts, not release dates. Stale thresholds are 75 days for INDPRO, 200 for CP, and 5 for VIXCLS. Existing stale-data behavior remains: last available readings may be scored and are labeled stale in source readings. Missing credentials, provider failures, or insufficient history leave scores unavailable; never substitute zero for missing observations.

Licensed consensus estimates and actual positioning feeds remain unimplemented. Alpha proxies must remain visibly labeled. No new paid subscriptions are required.
