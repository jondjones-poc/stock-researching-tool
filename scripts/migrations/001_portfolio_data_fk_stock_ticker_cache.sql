-- Link portfolio_data.instrument_id to stock_ticker_cache.instrument_id via foreign key.
-- Run after both tables exist. Ensure stock_ticker_cache is populated (e.g. run "Get Stock Symbols")
-- for any instrument_id values that exist in portfolio_data, or the FK will fail on existing rows.
--
-- Usage: psql "<connection_string>" -f scripts/migrations/001_portfolio_data_fk_stock_ticker_cache.sql

-- Add foreign key: portfolio_data.instrument_id -> stock_ticker_cache.instrument_id
-- ON DELETE RESTRICT: prevent deleting a stock_ticker_cache row if portfolio_data references it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'portfolio_data'::regclass
      AND conname = 'portfolio_data_instrument_id_fkey'
  ) THEN
    ALTER TABLE public.portfolio_data
      ADD CONSTRAINT portfolio_data_instrument_id_fkey
      FOREIGN KEY (instrument_id)
      REFERENCES public.stock_ticker_cache (instrument_id)
      ON DELETE RESTRICT;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table portfolio_data or stock_ticker_cache does not exist. Create them first.';
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'FK add failed: some portfolio_data.instrument_id values are not in stock_ticker_cache. Run "Get Stock Symbols" to populate the cache, or fix data.';
END
$$;
