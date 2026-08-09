-- Cache free historical OHLCV (Yahoo/etc.) for dashboard charts + SMA lookback.

CREATE TABLE IF NOT EXISTS public.price_history_cache (
  symbol      TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'YAHOO',
  bars        JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol)
);

CREATE INDEX IF NOT EXISTS idx_price_history_cache_fetched_at
  ON public.price_history_cache (fetched_at DESC);

COMMENT ON TABLE public.price_history_cache IS
  'Cached daily OHLCV bars for dashboard charts (free sources; refreshed ~daily)';
