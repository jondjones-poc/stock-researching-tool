-- Daily EOD closes for market heatmap period returns (FMP historical).
CREATE TABLE IF NOT EXISTS public.market_stock_eod (
  symbol     TEXT NOT NULL,
  trade_date DATE NOT NULL,
  close      NUMERIC(18, 4) NOT NULL,
  PRIMARY KEY (symbol, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_market_stock_eod_symbol_date
  ON public.market_stock_eod (symbol, trade_date DESC);

CREATE TABLE IF NOT EXISTS public.market_stock_eod_meta (
  symbol      TEXT PRIMARY KEY,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
