-- Per-period heatmap quote cache (today, 1m, ytd, 1y, 2y).
CREATE TABLE IF NOT EXISTS public.market_stock_period_cache (
  symbol       TEXT NOT NULL,
  period       TEXT NOT NULL,
  name         TEXT,
  price        NUMERIC(18, 4),
  change_abs   NUMERIC(18, 4),
  change_pct   NUMERIC(10, 4),
  data_source  TEXT,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol, period)
);

CREATE INDEX IF NOT EXISTS idx_market_stock_period_cache_period_fetched
  ON public.market_stock_period_cache (period, fetched_at DESC);
