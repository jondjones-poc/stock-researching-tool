-- PE / FCF historical range snapshots (computed on Refresh, read by range gauges)
ALTER TABLE public.stock_valuations
  ADD COLUMN IF NOT EXISTS pe_range_low NUMERIC(12, 4) NULL,
  ADD COLUMN IF NOT EXISTS pe_range_high NUMERIC(12, 4) NULL,
  ADD COLUMN IF NOT EXISTS fcf_range_low NUMERIC(18, 2) NULL,
  ADD COLUMN IF NOT EXISTS fcf_range_high NUMERIC(18, 2) NULL,
  ADD COLUMN IF NOT EXISTS fundamentals_refreshed_at TIMESTAMPTZ NULL;
