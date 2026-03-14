-- stock_ticker_cache: used by "Get Stock Symbols" (fetch-symbols) to cache eToro instrument ID -> symbol mappings.
-- Run this script against your Supabase/Postgres database to create the table or add missing columns.
--
-- Usage (Supabase): psql connection string from Dashboard > Settings > Database, then:
--   psql "postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres" -f scripts/stock_ticker_cache_schema.sql

-- 1. Create table if it doesn't exist (full schema)
CREATE TABLE IF NOT EXISTS stock_ticker_cache (
  instrument_id   INTEGER PRIMARY KEY,
  symbol_full     TEXT,
  display_name    TEXT,
  exchange        TEXT,
  type            TEXT,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  dividend_per_share NUMERIC(12,4) NULL
);

-- 2. Add any missing columns (no-op if table was just created with full schema; needed if table existed with fewer columns)
ALTER TABLE stock_ticker_cache ADD COLUMN IF NOT EXISTS symbol_full    TEXT;
ALTER TABLE stock_ticker_cache ADD COLUMN IF NOT EXISTS display_name   TEXT;
ALTER TABLE stock_ticker_cache ADD COLUMN IF NOT EXISTS exchange       TEXT;
ALTER TABLE stock_ticker_cache ADD COLUMN IF NOT EXISTS type           TEXT;
ALTER TABLE stock_ticker_cache ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE stock_ticker_cache ADD COLUMN IF NOT EXISTS dividend_per_share NUMERIC(12,4) NULL;

-- Optional: ensure primary key exists (if table was created without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'stock_ticker_cache'::regclass AND conname = 'stock_ticker_cache_pkey'
  ) THEN
    ALTER TABLE stock_ticker_cache ADD PRIMARY KEY (instrument_id);
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL; -- table didn't exist, nothing to do
END
$$;
