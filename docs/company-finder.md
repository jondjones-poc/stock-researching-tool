# Company Finder

US-listed cash/OCF screen under Research → **Company Finder**.

## Score

`score = marketCap - cash - operatingCashFlowYtd`

- **Negative score** = cash + OCF can cover the equity value (default “buy candidates” filter)
- **Est $/share/wk** = (OCF ÷ weeks in period) ÷ shares
- **Weekly OCF yield** = weekly OCF ÷ market cap

## Data sources

- **SEC** `company_tickers.json` + `companyfacts` (cash, OCF, shares) — free API
- **Quotes** Finnhub preferred (free throughput); FMP batch fallback
- Results cached in Postgres; UI reads DB only

## Setup

```bash
node scripts/apply-company-finder.mjs
node scripts/apply-company-finder.mjs --warm --reset --batch=40
```

## Daily scrape

Schedule once per day:

```bash
curl -X POST https://YOUR-APP/api/company-finder/refresh \
  -H "x-cron-secret: $KEEPALIVE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"batchSize":75}'
```

Each run advances a cursor through the SEC ticker universe (~thousands of names), so the full set warms over multiple days.

Admin can also click **Run scrape batch** on the page.
