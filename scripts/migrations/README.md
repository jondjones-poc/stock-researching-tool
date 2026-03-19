# Database migrations

Run against your Postgres/Supabase database in order when needed.

## Order

0. **000_portfolio_data.sql** (optional — greenfield only)  
   Full `CREATE TABLE portfolio_data` + indexes matching production.  
   **Requires `stock_ticker_cache` first** (foreign key on `instrument_id`).  
   Skip if the table already exists.

1. **001_portfolio_data_fk_stock_ticker_cache.sql**  
   Adds foreign key: `portfolio_data.instrument_id` → `stock_ticker_cache.instrument_id`  
   - Requires both tables to exist.  
   - If you get a foreign key violation, populate `stock_ticker_cache` first (e.g. run "Get Stock Symbols" on the Dividends page), then re-run.

2. **002_portfolio_data_ticker_column.sql**  
   Ensures `portfolio_data` has a `ticker` column (the app uses `ticker`).  
   - If your table only has `stock_ticker`, this adds `ticker` and copies values from `stock_ticker`.  
   - Safe to run multiple times (no-op if `ticker` already exists).

3. **003_portfolio_data_is_dividend.sql**  
   Adds `is_dividend` (boolean, default true) to `portfolio_data` for the Dividend/Growth/All filter on the Dividends page.  
   - Safe to run multiple times (ADD COLUMN IF NOT EXISTS).

4. **004_stock_ticker_cache_dividend_per_share.sql**  
   Adds `dividend_per_share` (numeric) to `stock_ticker_cache`.  
   - Populated by "Get Stock Symbols" (FMP API). Load route uses COALESCE(portfolio_data.dividend_per_share, stock_ticker_cache.dividend_per_share) so the dividends table shows a value from either place.  
   - Safe to run multiple times (ADD COLUMN IF NOT EXISTS).

- `portfolio_data.instrument_id` references `stock_ticker_cache.instrument_id`.
- `stock_ticker_cache` is filled by "Get Stock Symbols" (eToro market-data API); then portfolio rows can reference it by `instrument_id`.

## Running

From project root (replace with your connection string):

```bash
psql "postgresql://postgres.[ref]:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres" -f scripts/migrations/001_portfolio_data_fk_stock_ticker_cache.sql
psql "..." -f scripts/migrations/002_portfolio_data_ticker_column.sql
```

Or run the contents of each file in the Supabase SQL Editor.
