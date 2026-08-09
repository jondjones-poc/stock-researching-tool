-- Cache stock-search fundamentals (PE, FCF, name, etc.) — refresh at most once per 24h.

CREATE TABLE IF NOT EXISTS public.stock_research_cache (
  symbol      TEXT PRIMARY KEY,
  payload     JSONB NOT NULL,
  source      TEXT NOT NULL DEFAULT 'LIVE',
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_research_cache_fetched_at
  ON public.stock_research_cache (fetched_at DESC);

COMMENT ON TABLE public.stock_research_cache IS
  'Cached fundamentals snapshot for /research/stock-search; TTL 24 hours';
