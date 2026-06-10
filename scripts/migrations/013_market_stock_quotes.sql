-- Cached live quotes for market heatmap (FMP / Finnhub).
CREATE TABLE IF NOT EXISTS public.market_stock_quotes (
  symbol       TEXT PRIMARY KEY,
  name         TEXT,
  price        NUMERIC(18, 4),
  change_abs   NUMERIC(18, 4),
  change_pct   NUMERIC(10, 4),
  data_source  TEXT NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_stock_quotes_fetched_at
  ON public.market_stock_quotes (fetched_at DESC);
