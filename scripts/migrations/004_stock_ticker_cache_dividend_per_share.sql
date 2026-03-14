-- Add dividend_per_share to stock_ticker_cache (annual dividend per share from FMP, populated by "Get Stock Symbols").
-- Run this so dividend per share is visible in the cache and used when portfolio_data.dividend_per_share is empty.
--
-- Usage: psql "<connection_string>" -f scripts/migrations/004_stock_ticker_cache_dividend_per_share.sql

ALTER TABLE public.stock_ticker_cache
  ADD COLUMN IF NOT EXISTS dividend_per_share NUMERIC(12,4) NULL;

COMMENT ON COLUMN public.stock_ticker_cache.dividend_per_share IS 'Annual dividend per share (from FMP), updated by Get Stock Symbols';
