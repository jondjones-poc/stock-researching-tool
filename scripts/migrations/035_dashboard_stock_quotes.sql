-- Homepage dashboard stock quote cache (Finnhub-backed, warmed daily by Cloudflare cron).
-- Stocks/ETFs only — FRED indexes and special cards (GREED, AII) are not stored here.

CREATE TABLE IF NOT EXISTS public.dashboard_stock_quotes (
  symbol       TEXT PRIMARY KEY,
  name         TEXT,
  price        NUMERIC(18, 4) NOT NULL,
  change_abs   NUMERIC(18, 4) NOT NULL DEFAULT 0,
  change_pct   NUMERIC(10, 4) NOT NULL DEFAULT 0,
  volume       NUMERIC(20, 0),
  market_cap   NUMERIC(20, 0),
  data_source  TEXT NOT NULL DEFAULT 'FINNHUB',
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_stock_quotes_fetched_at
  ON public.dashboard_stock_quotes (fetched_at DESC);

COMMENT ON TABLE public.dashboard_stock_quotes IS
  'Cached Finnhub quotes for homepage dashboard stocks; refreshed by daily Cloudflare cron.';
