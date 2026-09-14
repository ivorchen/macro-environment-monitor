# Prime Book positioning data contract

The positioning panel loads the public U.S. Office of Financial Research Hedge Fund Monitor as a separate `OFR / SEC Form PF public aggregate` provider. It combines the official quarterly long equity notional, short equity notional, and aggregate net-assets series to derive gross equity exposure/NAV, net equity exposure/NAV, and long/short ratio. It is always labeled as a delayed regulatory aggregate and never as Prime Book data.

Actual Prime Book positioning remains provider-specific licensed research; public prices, Form PF aggregates, and 13F filings are not substitutes. Before adding licensed observations, document the source's update frequency, lag, history, universe, and dashboard-display/redistribution rights.

The default manual ingestion file is `data/prime-book-observations.json`. Set `PRIME_BOOK_DATA_PATH` to use an operator-managed file outside the checkout. The server reads the file at request time, so a valid update does not require a rebuild.

Each observation must contain:

```json
{
  "date": "2026-09-03",
  "provider": "Licensed provider name",
  "gross_leverage": 3.04,
  "net_leverage": 0.76,
  "long_short_ratio": 1.67,
  "momentum_long_short_ratio": 1.42,
  "source_reference": "Licensed report title and edition",
  "source_published_at": "2026-09-03T12:00:00Z",
  "ingested_at": "2026-09-03T13:00:00Z",
  "methodology": "Provider-published methodology summary",
  "universe": "Provider-specific client universe",
  "expected_update_days": 7
}
```

Use `source_url` instead of or alongside `source_reference` only when the HTTPS URL may be shown to dashboard users. Never copy restricted report text into this file.

The API rejects structurally invalid rows, derives long and short exposure from Gross and Net, and checks any reported L/S ratio against the derived ratio with a 0.03 absolute rounding tolerance. It lists providers separately and returns only one provider series per request; it never splices provider histories together. Missing data remains unavailable, and observations older than twice the expected update interval are stale.

## Public OFR source

The server fetches these token-free Hedge Fund Monitor series once per day and caches successful responses in Redis when available:

- `FPF-ALLQHF_NAV_SUM`
- `FPF-ASSETCLASS_EQUITIES_LGNE_SUM`
- `FPF-ASSETCLASS_EQUITIES_SGNE_SUM`

OFR publishes the underlying Form PF aggregates quarterly. One-week and one-month changes are therefore not calculated for this provider; the UI displays quarter-over-quarter and one-year changes. Historical observations are aggregated, rounded, masked, and subject to revision. Source methodology: <https://www.financialresearch.gov/hedge-fund-monitor/datasets/fpf/>.

Endpoint: `GET /api/positioning/prime-book?range=3M&provider=Licensed%20provider%20name`.
