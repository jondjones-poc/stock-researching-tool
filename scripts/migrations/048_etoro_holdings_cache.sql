-- Long-lived cache of live eToro holdings for the dashboard symbol list.
-- Holdings change rarely; homepage should not hit eToro on every load.

CREATE TABLE IF NOT EXISTS public.etoro_holdings_cache (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  holdings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.etoro_holdings_cache IS
  'Single-row cache of eToro open stock holdings (symbols/shares) for fast dashboard loads.';
