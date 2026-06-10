-- Markets heatmap: user-defined market sectors with top-3 stock symbols each.
-- Run in Supabase SQL Editor or: psql "<connection>" -f scripts/migrations/011_markets_heatmap.sql

CREATE TABLE IF NOT EXISTS public.markets (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT markets_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.market_stocks (
  id           SERIAL PRIMARY KEY,
  market_id    INTEGER NOT NULL REFERENCES public.markets (id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  stock_order  SMALLINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT market_stocks_market_order_unique UNIQUE (market_id, stock_order),
  CONSTRAINT market_stocks_market_symbol_unique UNIQUE (market_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_markets_display_order ON public.markets (display_order, name);
CREATE INDEX IF NOT EXISTS idx_market_stocks_market_id ON public.market_stocks (market_id);
CREATE INDEX IF NOT EXISTS idx_market_stocks_symbol ON public.market_stocks (symbol);

COMMENT ON TABLE public.markets IS 'User-defined market sectors for the money-flow heatmap';
COMMENT ON TABLE public.market_stocks IS 'Representative symbols per market (stock_order for display sort)';
