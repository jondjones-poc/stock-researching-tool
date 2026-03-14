-- Add is_dividend column to portfolio_data for Dividend/Growth/All filter on Dividends page.
-- Run this if you get "Failed to load portfolio data" and the load API logs a column/is_dividend error.
--
-- Usage: psql "<connection_string>" -f scripts/migrations/003_portfolio_data_is_dividend.sql

ALTER TABLE public.portfolio_data
  ADD COLUMN IF NOT EXISTS is_dividend BOOLEAN NULL DEFAULT true;

COMMENT ON COLUMN public.portfolio_data.is_dividend IS 'true = dividend stock (show in Dividend filter), false = growth (show in Growth filter)';
