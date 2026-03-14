-- Ensure portfolio_data has a "ticker" column for app compatibility.
-- The app (portfolio/load, portfolio/save, dividends) uses column name "ticker".
-- If your schema uses "stock_ticker" instead, this script adds "ticker" and syncs from stock_ticker.
-- If "ticker" already exists, this is a no-op.
--
-- Usage: psql "<connection_string>" -f scripts/migrations/002_portfolio_data_ticker_column.sql

DO $$
BEGIN
  -- Add ticker column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portfolio_data' AND column_name = 'ticker'
  ) THEN
    ALTER TABLE public.portfolio_data ADD COLUMN ticker TEXT NULL;

    -- If stock_ticker exists, copy values so app can read ticker
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'portfolio_data' AND column_name = 'stock_ticker'
    ) THEN
      UPDATE public.portfolio_data SET ticker = stock_ticker WHERE ticker IS NULL AND stock_ticker IS NOT NULL;
    END IF;

    RAISE NOTICE 'Added column portfolio_data.ticker';
  END IF;
END
$$;
