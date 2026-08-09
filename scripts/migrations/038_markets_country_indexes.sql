-- Markets: sector vs country groupings for the sectors heatmap.
-- Country rows are index-proxy ETFs (liquid US-listed) for free quote sources.

ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS market_group TEXT NOT NULL DEFAULT 'sector';

ALTER TABLE public.markets
  DROP CONSTRAINT IF EXISTS markets_market_group_check;

ALTER TABLE public.markets
  ADD CONSTRAINT markets_market_group_check
  CHECK (market_group IN ('sector', 'country'));

CREATE INDEX IF NOT EXISTS idx_markets_market_group
  ON public.markets (market_group, display_order, name);

COMMENT ON COLUMN public.markets.market_group IS
  'Heatmap bucket: sector (theme + stocks) or country (index ETF proxy)';

-- Ensure existing rows stay in the sector bucket.
UPDATE public.markets
SET market_group = 'sector'
WHERE market_group IS NULL OR btrim(market_group) = '';

-- Seed / upsert major country & world index proxies (US-listed ETFs).
INSERT INTO public.markets (name, display_order, index_symbol, market_group)
VALUES
  ('United States (S&P 500)', 100, 'SPY', 'country'),
  ('United Kingdom (FTSE)', 110, 'EWU', 'country'),
  ('Japan (Nikkei / TOPIX)', 120, 'EWJ', 'country'),
  ('World (All-Country)', 130, 'ACWI', 'country'),
  ('Europe', 140, 'VGK', 'country'),
  ('Germany (DAX)', 150, 'EWG', 'country'),
  ('France (CAC)', 160, 'EWQ', 'country'),
  ('Switzerland', 170, 'EWL', 'country'),
  ('China', 180, 'MCHI', 'country'),
  ('Hong Kong', 190, 'EWH', 'country'),
  ('India', 200, 'INDA', 'country'),
  ('Australia', 210, 'EWA', 'country'),
  ('Canada', 220, 'EWC', 'country'),
  ('South Korea', 230, 'EWY', 'country'),
  ('Taiwan', 240, 'EWT', 'country'),
  ('Brazil', 250, 'EWZ', 'country'),
  ('Mexico', 260, 'EWW', 'country'),
  ('Emerging Markets', 270, 'EEM', 'country')
ON CONFLICT (name) DO UPDATE
SET
  index_symbol = COALESCE(NULLIF(btrim(markets.index_symbol), ''), EXCLUDED.index_symbol),
  market_group = 'country',
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
