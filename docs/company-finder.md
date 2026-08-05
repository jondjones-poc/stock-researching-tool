# Deep Value Stocks

US-listed cash-backed screen under Research → **Deep Value Stocks**.

## Definition

Companies whose **cash and investments** cover a large share of **market value**.

Example at **90%**: about 90% of the stock is cash-backed, so you’re paying for roughly the remaining 10% of the business.

Filter dropdown: `90%` (default), `80%`, `70%`, `60%`, `50%`.

## Extra metrics

- **Score** = marketCap − cash − operatingCashFlowYtd
- **Net Cash** = cash − Total Debt, using a **single** SEC XBRL Total Debt fact only (`DebtInstrumentCarryingAmount`, or a concept labeled “Total Debt”). If that fact is missing, Net Cash is **null** (no summing of current + long-term debt).
- **Net Cash filter** = `(net_cash / marketCap) * 100` (default 0% = no threshold; slide up like FCF). Companies with no Net Cash (SEC Total Debt not tagged) are **excluded by default** — tick “Include companies with no Net Cash” in the funnel icon popup next to the slider to keep them.
- **FCF YTD** = SEC free cash flow tag when available, else OCF − CapEx for the same period
- **FCF ≥ market filter** = `(fcf / marketCap) * 100` (default 20%)
- **Confidence Score** = data-reliability indicator (0–100), separate from value score. Starts at 100; SEC filing age / foreign filer / going-concern / reverse-split / discontinued-ops text flags subtract points. Shown as stars in the grid. Cached until a newer SEC accession appears.
- **Sector / country** = Finnhub profile when available, else SEC SIC description + address country
- **Est $/share/wk** = (OCF ÷ weeks in period) ÷ shares
- **Weekly OCF yield** = weekly OCF ÷ market cap

## Data sources

- **SEC** `company_tickers.json` + `companyfacts` + `submissions` (cash, Total Debt → Net Cash, OCF, FCF/CapEx, shares, SIC, country)
- **Quotes / profile** Finnhub preferred (price, industry, country); FMP batch fallback for quotes
- Results cached in Postgres; UI reads DB only (sector/country dropdowns use distinct cached values)

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

Warrants / units / rights (e.g. `ABLVW` / `ASPSZ` when the common ticker exists for the same CIK) are excluded from the scrape universe and hidden in the UI — company cash was incorrectly applied to those tickers.

Admin can also click **Run scrape batch** on the page.
