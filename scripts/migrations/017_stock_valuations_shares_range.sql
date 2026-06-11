-- Shares outstanding 5-year range + latest count (computed on Refresh)
ALTER TABLE public.stock_valuations
  ADD COLUMN IF NOT EXISTS shares_outstanding BIGINT NULL,
  ADD COLUMN IF NOT EXISTS shares_range_low BIGINT NULL,
  ADD COLUMN IF NOT EXISTS shares_range_high BIGINT NULL;