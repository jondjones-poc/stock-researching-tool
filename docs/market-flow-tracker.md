# Global Market Flow Tracker

Price-momentum dashboard comparing **large-cap vs small-cap** ETFs across ten major markets.

> This tool tracks **price leadership / momentum**. It does **not** show confirmed investor cash flows.

Live URL path: [`/research/markets`](https://stock-researching-tool.netlify.app/research/markets)

The former sector heatmap now lives at [`/research/sectors`](https://stock-researching-tool.netlify.app/research/sectors).

---

## Card insight features

Each market card shows:

- **vs Small-cap / vs Large-cap** — size gap from this card’s point of view (hover for meaning / why care / theory)
- **Top holdings** — first three tickers from a weekly-cached holdings list

Ask AI prompts include SPY-relative, spread, and the cached top 10 holdings.

The bottom chart includes a dashed **vs SPY** benchmark line and series toggles.

Holdings refresh about once a week during `/api/market-flow/refresh` (or immediately with `forceHoldings` / `forceFullHistory`).


---

## Setup

### 1. Environment

Add to `.env` / `.env.local` (see also root `.env.example`):

```bash
# Required for DB
SUPABASE_DB_PASSWORD=...

# Live prices (optional if mock mode)
FMP_API_KEY=...

# Force mock data (no FMP calls)
MARKET_FLOW_MOCK=true

# Cron / scheduled refresh (optional; falls back to KEEPALIVE_SECRET)
MARKET_FLOW_CRON_SECRET=some-long-secret
KEEPALIVE_SECRET=some-long-secret
```

If `MARKET_FLOW_MOCK=true` **or** `FMP_API_KEY` is empty, the updater generates deterministic mock EOD series.

Offline seed of mock prices (no running server required):

```bash
npx tsx scripts/import-market-flow-mock.mts
```

### 2. Database

```bash
node scripts/apply-market-flow-tracker.mjs
```

Or run `scripts/migrations/026_market_flow_tracker.sql` in the Supabase SQL editor, then:

```bash
node scripts/apply-market-flow-tracker.mjs --seed-only
```

### 3. First price import

With the app running:

```bash
# As admin (browser session cookie), click "Admin refresh" on /research/markets
# Or via cron secret:
curl -X POST http://localhost:3000/api/market-flow/refresh \
  -H "x-cron-secret: $KEEPALIVE_SECRET" \
  -H "Content-Type: application/json"
```

Use `"forceFullHistory": true` in the JSON body to re-pull ~11 years (needed for 3y/5y/10y returns).

After adding long periods (migration `027`), run an admin refresh with full history once so older prices are imported.

---

## Daily updates

Schedule once per day (Netlify scheduled function, cron-job.org, GitHub Actions, etc.):

```bash
curl -X POST https://YOUR-APP/api/market-flow/refresh \
  -H "x-cron-secret: $KEEPALIVE_SECRET"
```

Behavior:

- Seeds markets/funds if missing
- After the first import, only fetches from `last_price_date - 5 days`
- `ON CONFLICT DO NOTHING` prevents duplicate prices
- Continues if one fund fails
- Recomputes returns from DB
- Marks data stale in the UI after 3 days without updates

---

## Changing funds

Edit `src/app/config/marketFlow.ts` (and the matching rows in `scripts/apply-market-flow-tracker.mjs` if you re-seed from the script), then re-run the apply script and refresh prices.

Or update `market_flow_funds.symbol` / `name` directly in SQL — the updater keys off the DB rows.

---

## API

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/market-flow?period=1m&view=vs` | Dashboard from DB |
| GET | `/api/market-flow/[slug]?period=1y` | Market detail |
| GET | `/api/market-flow/global-chart?cap=large&period=1y` | Indexed multi-market chart |
| POST | `/api/market-flow/refresh` | Admin cookie **or** `x-cron-secret` |

---

## Tests

```bash
npm test -- --testPathPattern=market-flow
```

---

## Deployment

1. Apply migration `026` on production DB
2. Set `FMP_API_KEY` (or `MARKET_FLOW_MOCK=true` for demo)
3. Set `KEEPALIVE_SECRET` / `MARKET_FLOW_CRON_SECRET`
4. Deploy Next app (Netlify)
5. Run one refresh after deploy
6. Attach daily cron to `/api/market-flow/refresh`

---

## Disclaimer copy used in-app

Market Flow Tracker shows price momentum and relative leadership between large-cap and small-cap funds. It does **not** measure confirmed investor cash flows.
