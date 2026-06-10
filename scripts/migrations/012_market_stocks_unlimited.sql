-- Allow any number of stocks per market (was limited to 3).
-- Run after 011_markets_heatmap.sql

ALTER TABLE public.market_stocks
  DROP CONSTRAINT IF EXISTS market_stocks_stock_order_check;

COMMENT ON TABLE public.market_stocks IS 'Representative symbols per market (stock_order for display sort)';
