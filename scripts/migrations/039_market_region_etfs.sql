-- Per-region ETF overrides for the same sector markets (US default stays on markets.index_symbol).

CREATE TABLE IF NOT EXISTS public.market_region_etfs (
  market_id    INTEGER NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  region_code  TEXT NOT NULL,
  index_symbol TEXT NOT NULL,
  is_proxy     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (market_id, region_code)
);

ALTER TABLE public.market_region_etfs
  DROP CONSTRAINT IF EXISTS market_region_etfs_region_code_check;

ALTER TABLE public.market_region_etfs
  ADD CONSTRAINT market_region_etfs_region_code_check
  CHECK (region_code IN ('us', 'uk', 'jp', 'eu', 'world', 'cn', 'in', 'ca', 'au', 'em'));

CREATE INDEX IF NOT EXISTS idx_market_region_etfs_region
  ON public.market_region_etfs (region_code, index_symbol);

COMMENT ON TABLE public.market_region_etfs IS
  'Country/region ETF proxy per sector market for the sectors heatmap lens';

COMMENT ON COLUMN public.market_region_etfs.is_proxy IS
  'True when the symbol is a broad country ETF stand-in (no liquid sector ETF)';

-- Seed region ETFs for existing sector markets (matched by name, case-insensitive).
-- is_proxy = true means we fell back to the broad country/region ETF.
WITH seed(sector_name, region_code, index_symbol, is_proxy) AS (
  VALUES
    -- United Kingdom
    ('AI', 'uk', 'EWU', true),
    ('Big Tech', 'uk', 'EWU', true),
    ('Cloud Software', 'uk', 'EWU', true),
    ('Banks', 'uk', 'EUFN', false),
    ('Insurance & Asset Managers', 'uk', 'EUFN', false),
    ('Payments', 'uk', 'EUFN', false),
    ('Energy', 'uk', 'EWU', true),
    ('Biotech', 'uk', 'EWU', true),
    ('Consumer Staples', 'uk', 'EWU', true),
    ('Consumer Discretionary', 'uk', 'EWU', true),
    ('Defense', 'uk', 'EWU', true),
    ('Transportation', 'uk', 'EWU', true),
    ('Drones', 'uk', 'BOTZ', false),
    ('Space & Satellites', 'uk', 'UFO', false),
    ('Resturants', 'uk', 'EWU', true),
    ('Restaurants', 'uk', 'EWU', true),

    -- Japan
    ('AI', 'jp', 'EWJ', true),
    ('Big Tech', 'jp', 'EWJ', true),
    ('Cloud Software', 'jp', 'EWJ', true),
    ('Banks', 'jp', 'EWJ', true),
    ('Insurance & Asset Managers', 'jp', 'EWJ', true),
    ('Payments', 'jp', 'EWJ', true),
    ('Energy', 'jp', 'EWJ', true),
    ('Biotech', 'jp', 'EWJ', true),
    ('Consumer Staples', 'jp', 'EWJ', true),
    ('Consumer Discretionary', 'jp', 'EWJ', true),
    ('Defense', 'jp', 'EWJ', true),
    ('Transportation', 'jp', 'EWJ', true),
    ('Drones', 'jp', 'BOTZ', false),
    ('Space & Satellites', 'jp', 'UFO', false),
    ('Resturants', 'jp', 'EWJ', true),
    ('Restaurants', 'jp', 'EWJ', true),

    -- Europe
    ('AI', 'eu', 'FEZ', true),
    ('Big Tech', 'eu', 'FEZ', true),
    ('Cloud Software', 'eu', 'FEZ', true),
    ('Banks', 'eu', 'EUFN', false),
    ('Insurance & Asset Managers', 'eu', 'EUFN', false),
    ('Payments', 'eu', 'EUFN', false),
    ('Energy', 'eu', 'VGK', true),
    ('Biotech', 'eu', 'VGK', true),
    ('Consumer Staples', 'eu', 'VGK', true),
    ('Consumer Discretionary', 'eu', 'VGK', true),
    ('Defense', 'eu', 'VGK', true),
    ('Transportation', 'eu', 'VGK', true),
    ('Drones', 'eu', 'BOTZ', false),
    ('Space & Satellites', 'eu', 'UFO', false),
    ('Resturants', 'eu', 'VGK', true),
    ('Restaurants', 'eu', 'VGK', true),

    -- World / Global
    ('AI', 'world', 'SOXX', false),
    ('Big Tech', 'world', 'XLK', false),
    ('Cloud Software', 'world', 'IGV', false),
    ('Banks', 'world', 'IXG', false),
    ('Insurance & Asset Managers', 'world', 'IXG', false),
    ('Payments', 'world', 'FINX', false),
    ('Energy', 'world', 'IXC', false),
    ('Biotech', 'world', 'IBB', false),
    ('Consumer Staples', 'world', 'KXI', false),
    ('Consumer Discretionary', 'world', 'RXI', false),
    ('Defense', 'world', 'ITA', false),
    ('Transportation', 'world', 'IYT', false),
    ('Drones', 'world', 'BOTZ', false),
    ('Space & Satellites', 'world', 'UFO', false),
    ('Resturants', 'world', 'EATZ', false),
    ('Restaurants', 'world', 'EATZ', false),

    -- China
    ('AI', 'cn', 'KWEB', false),
    ('Big Tech', 'cn', 'KWEB', false),
    ('Cloud Software', 'cn', 'KWEB', false),
    ('Banks', 'cn', 'CHIX', false),
    ('Insurance & Asset Managers', 'cn', 'CHIX', false),
    ('Payments', 'cn', 'KWEB', false),
    ('Energy', 'cn', 'CHIE', false),
    ('Biotech', 'cn', 'CHIH', false),
    ('Consumer Staples', 'cn', 'MCHI', true),
    ('Consumer Discretionary', 'cn', 'MCHI', true),
    ('Defense', 'cn', 'MCHI', true),
    ('Transportation', 'cn', 'MCHI', true),
    ('Drones', 'cn', 'BOTZ', false),
    ('Space & Satellites', 'cn', 'UFO', false),
    ('Resturants', 'cn', 'MCHI', true),
    ('Restaurants', 'cn', 'MCHI', true),

    -- India
    ('AI', 'in', 'INDA', true),
    ('Big Tech', 'in', 'INDA', true),
    ('Cloud Software', 'in', 'INDA', true),
    ('Banks', 'in', 'INDA', true),
    ('Insurance & Asset Managers', 'in', 'INDA', true),
    ('Payments', 'in', 'INDA', true),
    ('Energy', 'in', 'INDA', true),
    ('Biotech', 'in', 'INDA', true),
    ('Consumer Staples', 'in', 'INCO', false),
    ('Consumer Discretionary', 'in', 'INCO', false),
    ('Defense', 'in', 'INDA', true),
    ('Transportation', 'in', 'INDA', true),
    ('Drones', 'in', 'BOTZ', false),
    ('Space & Satellites', 'in', 'UFO', false),
    ('Resturants', 'in', 'INCO', false),
    ('Restaurants', 'in', 'INCO', false),

    -- Canada
    ('AI', 'ca', 'EWC', true),
    ('Big Tech', 'ca', 'EWC', true),
    ('Cloud Software', 'ca', 'EWC', true),
    ('Banks', 'ca', 'EWC', true),
    ('Insurance & Asset Managers', 'ca', 'EWC', true),
    ('Payments', 'ca', 'EWC', true),
    ('Energy', 'ca', 'EWC', true),
    ('Biotech', 'ca', 'EWC', true),
    ('Consumer Staples', 'ca', 'EWC', true),
    ('Consumer Discretionary', 'ca', 'EWC', true),
    ('Defense', 'ca', 'EWC', true),
    ('Transportation', 'ca', 'EWC', true),
    ('Drones', 'ca', 'BOTZ', false),
    ('Space & Satellites', 'ca', 'UFO', false),
    ('Resturants', 'ca', 'EWC', true),
    ('Restaurants', 'ca', 'EWC', true),

    -- Australia
    ('AI', 'au', 'EWA', true),
    ('Big Tech', 'au', 'EWA', true),
    ('Cloud Software', 'au', 'EWA', true),
    ('Banks', 'au', 'EWA', true),
    ('Insurance & Asset Managers', 'au', 'EWA', true),
    ('Payments', 'au', 'EWA', true),
    ('Energy', 'au', 'EWA', true),
    ('Biotech', 'au', 'EWA', true),
    ('Consumer Staples', 'au', 'EWA', true),
    ('Consumer Discretionary', 'au', 'EWA', true),
    ('Defense', 'au', 'EWA', true),
    ('Transportation', 'au', 'EWA', true),
    ('Drones', 'au', 'BOTZ', false),
    ('Space & Satellites', 'au', 'UFO', false),
    ('Resturants', 'au', 'EWA', true),
    ('Restaurants', 'au', 'EWA', true),

    -- Emerging Markets
    ('AI', 'em', 'EEM', true),
    ('Big Tech', 'em', 'EEM', true),
    ('Cloud Software', 'em', 'EEM', true),
    ('Banks', 'em', 'EEM', true),
    ('Insurance & Asset Managers', 'em', 'EEM', true),
    ('Payments', 'em', 'EEM', true),
    ('Energy', 'em', 'EEM', true),
    ('Biotech', 'em', 'EEM', true),
    ('Consumer Staples', 'em', 'EEM', true),
    ('Consumer Discretionary', 'em', 'EEM', true),
    ('Defense', 'em', 'EEM', true),
    ('Transportation', 'em', 'EEM', true),
    ('Drones', 'em', 'BOTZ', false),
    ('Space & Satellites', 'em', 'UFO', false),
    ('Resturants', 'em', 'EEM', true),
    ('Restaurants', 'em', 'EEM', true)
)
INSERT INTO public.market_region_etfs (market_id, region_code, index_symbol, is_proxy, updated_at)
SELECT m.id, s.region_code, upper(s.index_symbol), s.is_proxy, NOW()
FROM seed s
JOIN public.markets m
  ON lower(m.name) = lower(s.sector_name)
 AND COALESCE(m.market_group, 'sector') = 'sector'
ON CONFLICT (market_id, region_code) DO UPDATE SET
  index_symbol = EXCLUDED.index_symbol,
  is_proxy = EXCLUDED.is_proxy,
  updated_at = NOW();

-- Mirror US defaults from markets.index_symbol for every sector that has one.
INSERT INTO public.market_region_etfs (market_id, region_code, index_symbol, is_proxy, updated_at)
SELECT m.id, 'us', upper(btrim(m.index_symbol)), false, NOW()
FROM public.markets m
WHERE COALESCE(m.market_group, 'sector') = 'sector'
  AND m.index_symbol IS NOT NULL
  AND btrim(m.index_symbol) <> ''
ON CONFLICT (market_id, region_code) DO UPDATE SET
  index_symbol = EXCLUDED.index_symbol,
  is_proxy = FALSE,
  updated_at = NOW();
