-- Sector heatmap: optional index/ETF proxy per market for Index vs Stocks views.

ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS index_symbol TEXT;

COMMENT ON COLUMN public.markets.index_symbol IS
  'Optional US-listed ETF/index proxy used for the Index heatmap view';

-- Seed common sector ETF proxies when index_symbol is still empty (name match, case-insensitive).
UPDATE public.markets m
SET index_symbol = s.symbol,
    updated_at = NOW()
FROM (
  VALUES
    ('Big Tech', 'XLK'),
    ('AI & Semiconductors', 'SOXX'),
    ('Cloud & Enterprise Software', 'IGV'),
    ('Consumer Staples', 'XLP'),
    ('Consumer Discretionary', 'XLY'),
    ('Healthcare', 'XLV'),
    ('Biotech', 'XBI'),
    ('Financials & Banks', 'XLF'),
    ('Insurance & Asset Management', 'KIE'),
    ('Energy', 'XLE'),
    ('Utilities', 'XLU'),
    ('Industrials', 'XLI'),
    ('Materials & Mining', 'XLB'),
    ('Real Estate & REITs', 'XLRE'),
    ('Telecom & Media', 'XLC'),
    ('Defense & Aerospace', 'ITA'),
    ('Transportation', 'IYT'),
    ('Autos & EVs', 'DRIV'),
    ('Payments & Fintech', 'FINX'),
    ('Emerging Markets', 'EEM'),
    ('Drones', 'BOTZ'),
    ('Resturants', 'EATZ'),
    ('Restaurants', 'EATZ'),
    ('Space & Satellites', 'UFO'),
    ('Cloud Software', 'IGV'),
    ('AI', 'SOXX'),
    ('Banks', 'XLF'),
    ('Defense', 'ITA'),
    ('Payments', 'FINX'),
    ('Insurance & Asset Managers', 'KIE')
) AS s(name, symbol)
WHERE lower(m.name) = lower(s.name)
  AND (m.index_symbol IS NULL OR btrim(m.index_symbol) = '');
