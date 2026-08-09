-- Add missing common + emerging sector markets with US index ETFs,
-- and seed market_region_etfs for every country/region lens.

-- 1) Upsert sector markets (US default index_symbol).
WITH new_sectors(name, display_order, index_symbol) AS (
  VALUES
    -- Common / GICS-style
    ('Healthcare', 20, 'XLV'),
    ('Pharmaceuticals', 21, 'XPH'),
    ('Utilities', 22, 'XLU'),
    ('Materials & Mining', 23, 'XLB'),
    ('Industrials', 24, 'XLI'),
    ('Real Estate & REITs', 25, 'XLRE'),
    ('Telecom & Media', 26, 'XLC'),
    ('Retail', 27, 'XRT'),
    ('Homebuilders', 28, 'XHB'),
    -- Emerging / thematic
    ('Semiconductors', 40, 'SMH'),
    ('Cybersecurity', 41, 'CIBR'),
    ('Clean Energy', 42, 'ICLN'),
    ('Autos & EVs', 43, 'DRIV'),
    ('Uranium & Nuclear', 44, 'URA'),
    ('Lithium & Batteries', 45, 'LIT'),
    ('Gold Miners', 46, 'GDX'),
    ('Water Infrastructure', 47, 'PHO'),
    ('Gaming & Esports', 48, 'ESPO'),
    ('Agribusiness', 49, 'MOO'),
    ('Quantum Computing', 50, 'QTUM'),
    ('Copper & Miners', 51, 'COPX'),
    ('5G & Connectivity', 52, 'NXTG')
)
INSERT INTO public.markets (name, display_order, index_symbol, market_group)
SELECT s.name, s.display_order, s.index_symbol, 'sector'
FROM new_sectors s
ON CONFLICT (name) DO UPDATE SET
  index_symbol = COALESCE(NULLIF(btrim(markets.index_symbol), ''), EXCLUDED.index_symbol),
  market_group = 'sector',
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 2) Region ETF map for the new sectors (and any existing name matches).
-- is_proxy = true → broad country ETF stand-in when no liquid local sector ETF exists.
WITH seed(sector_name, region_code, index_symbol, is_proxy) AS (
  VALUES
    -- ========== Healthcare ==========
    ('Healthcare', 'us', 'XLV', false),
    ('Healthcare', 'uk', 'EWU', true),
    ('Healthcare', 'jp', 'EWJ', true),
    ('Healthcare', 'eu', 'VGK', true),
    ('Healthcare', 'world', 'IXJ', false),
    ('Healthcare', 'cn', 'CHIH', false),
    ('Healthcare', 'in', 'INDA', true),
    ('Healthcare', 'ca', 'EWC', true),
    ('Healthcare', 'au', 'EWA', true),
    ('Healthcare', 'em', 'EEM', true),

    -- ========== Pharmaceuticals ==========
    ('Pharmaceuticals', 'us', 'XPH', false),
    ('Pharmaceuticals', 'uk', 'EWU', true),
    ('Pharmaceuticals', 'jp', 'EWJ', true),
    ('Pharmaceuticals', 'eu', 'VGK', true),
    ('Pharmaceuticals', 'world', 'IXJ', false),
    ('Pharmaceuticals', 'cn', 'CHIH', false),
    ('Pharmaceuticals', 'in', 'INDA', true),
    ('Pharmaceuticals', 'ca', 'EWC', true),
    ('Pharmaceuticals', 'au', 'EWA', true),
    ('Pharmaceuticals', 'em', 'EEM', true),

    -- ========== Utilities ==========
    ('Utilities', 'us', 'XLU', false),
    ('Utilities', 'uk', 'EWU', true),
    ('Utilities', 'jp', 'EWJ', true),
    ('Utilities', 'eu', 'VGK', true),
    ('Utilities', 'world', 'JXI', false),
    ('Utilities', 'cn', 'MCHI', true),
    ('Utilities', 'in', 'INDA', true),
    ('Utilities', 'ca', 'EWC', true),
    ('Utilities', 'au', 'EWA', true),
    ('Utilities', 'em', 'EEM', true),

    -- ========== Materials & Mining ==========
    ('Materials & Mining', 'us', 'XLB', false),
    ('Materials & Mining', 'uk', 'EWU', true),
    ('Materials & Mining', 'jp', 'EWJ', true),
    ('Materials & Mining', 'eu', 'VGK', true),
    ('Materials & Mining', 'world', 'MXI', false),
    ('Materials & Mining', 'cn', 'MCHI', true),
    ('Materials & Mining', 'in', 'INDA', true),
    ('Materials & Mining', 'ca', 'EWC', true),
    ('Materials & Mining', 'au', 'EWA', true),
    ('Materials & Mining', 'em', 'EEM', true),

    -- ========== Industrials ==========
    ('Industrials', 'us', 'XLI', false),
    ('Industrials', 'uk', 'EWU', true),
    ('Industrials', 'jp', 'EWJ', true),
    ('Industrials', 'eu', 'VGK', true),
    ('Industrials', 'world', 'EXI', false),
    ('Industrials', 'cn', 'MCHI', true),
    ('Industrials', 'in', 'INDA', true),
    ('Industrials', 'ca', 'EWC', true),
    ('Industrials', 'au', 'EWA', true),
    ('Industrials', 'em', 'EEM', true),

    -- ========== Real Estate & REITs ==========
    ('Real Estate & REITs', 'us', 'XLRE', false),
    ('Real Estate & REITs', 'uk', 'EWU', true),
    ('Real Estate & REITs', 'jp', 'EWJ', true),
    ('Real Estate & REITs', 'eu', 'VGK', true),
    ('Real Estate & REITs', 'world', 'REET', false),
    ('Real Estate & REITs', 'cn', 'MCHI', true),
    ('Real Estate & REITs', 'in', 'INDA', true),
    ('Real Estate & REITs', 'ca', 'EWC', true),
    ('Real Estate & REITs', 'au', 'EWA', true),
    ('Real Estate & REITs', 'em', 'EEM', true),

    -- ========== Telecom & Media ==========
    ('Telecom & Media', 'us', 'XLC', false),
    ('Telecom & Media', 'uk', 'EWU', true),
    ('Telecom & Media', 'jp', 'EWJ', true),
    ('Telecom & Media', 'eu', 'VGK', true),
    ('Telecom & Media', 'world', 'IXP', false),
    ('Telecom & Media', 'cn', 'KWEB', false),
    ('Telecom & Media', 'in', 'INDA', true),
    ('Telecom & Media', 'ca', 'EWC', true),
    ('Telecom & Media', 'au', 'EWA', true),
    ('Telecom & Media', 'em', 'EEM', true),

    -- ========== Retail ==========
    ('Retail', 'us', 'XRT', false),
    ('Retail', 'uk', 'EWU', true),
    ('Retail', 'jp', 'EWJ', true),
    ('Retail', 'eu', 'VGK', true),
    ('Retail', 'world', 'RXI', false),
    ('Retail', 'cn', 'MCHI', true),
    ('Retail', 'in', 'INCO', false),
    ('Retail', 'ca', 'EWC', true),
    ('Retail', 'au', 'EWA', true),
    ('Retail', 'em', 'EEM', true),

    -- ========== Homebuilders ==========
    ('Homebuilders', 'us', 'XHB', false),
    ('Homebuilders', 'uk', 'EWU', true),
    ('Homebuilders', 'jp', 'EWJ', true),
    ('Homebuilders', 'eu', 'VGK', true),
    ('Homebuilders', 'world', 'XHB', false),
    ('Homebuilders', 'cn', 'MCHI', true),
    ('Homebuilders', 'in', 'INDA', true),
    ('Homebuilders', 'ca', 'EWC', true),
    ('Homebuilders', 'au', 'EWA', true),
    ('Homebuilders', 'em', 'EEM', true),

    -- ========== Semiconductors ==========
    ('Semiconductors', 'us', 'SMH', false),
    ('Semiconductors', 'uk', 'EWU', true),
    ('Semiconductors', 'jp', 'EWJ', true),
    ('Semiconductors', 'eu', 'FEZ', true),
    ('Semiconductors', 'world', 'SMH', false),
    ('Semiconductors', 'cn', 'KWEB', false),
    ('Semiconductors', 'in', 'INDA', true),
    ('Semiconductors', 'ca', 'EWC', true),
    ('Semiconductors', 'au', 'EWA', true),
    ('Semiconductors', 'em', 'EEM', true),

    -- ========== Cybersecurity (global thematic) ==========
    ('Cybersecurity', 'us', 'CIBR', false),
    ('Cybersecurity', 'uk', 'CIBR', false),
    ('Cybersecurity', 'jp', 'CIBR', false),
    ('Cybersecurity', 'eu', 'CIBR', false),
    ('Cybersecurity', 'world', 'CIBR', false),
    ('Cybersecurity', 'cn', 'CIBR', false),
    ('Cybersecurity', 'in', 'CIBR', false),
    ('Cybersecurity', 'ca', 'CIBR', false),
    ('Cybersecurity', 'au', 'CIBR', false),
    ('Cybersecurity', 'em', 'CIBR', false),

    -- ========== Clean Energy ==========
    ('Clean Energy', 'us', 'ICLN', false),
    ('Clean Energy', 'uk', 'ICLN', false),
    ('Clean Energy', 'jp', 'ICLN', false),
    ('Clean Energy', 'eu', 'ICLN', false),
    ('Clean Energy', 'world', 'ICLN', false),
    ('Clean Energy', 'cn', 'ICLN', false),
    ('Clean Energy', 'in', 'ICLN', false),
    ('Clean Energy', 'ca', 'ICLN', false),
    ('Clean Energy', 'au', 'ICLN', false),
    ('Clean Energy', 'em', 'ICLN', false),

    -- ========== Autos & EVs ==========
    ('Autos & EVs', 'us', 'DRIV', false),
    ('Autos & EVs', 'uk', 'EWU', true),
    ('Autos & EVs', 'jp', 'EWJ', true),
    ('Autos & EVs', 'eu', 'VGK', true),
    ('Autos & EVs', 'world', 'DRIV', false),
    ('Autos & EVs', 'cn', 'KARS', false),
    ('Autos & EVs', 'in', 'INDA', true),
    ('Autos & EVs', 'ca', 'EWC', true),
    ('Autos & EVs', 'au', 'EWA', true),
    ('Autos & EVs', 'em', 'EEM', true),

    -- ========== Uranium & Nuclear ==========
    ('Uranium & Nuclear', 'us', 'URA', false),
    ('Uranium & Nuclear', 'uk', 'URA', false),
    ('Uranium & Nuclear', 'jp', 'URA', false),
    ('Uranium & Nuclear', 'eu', 'URA', false),
    ('Uranium & Nuclear', 'world', 'URA', false),
    ('Uranium & Nuclear', 'cn', 'URA', false),
    ('Uranium & Nuclear', 'in', 'URA', false),
    ('Uranium & Nuclear', 'ca', 'URA', false),
    ('Uranium & Nuclear', 'au', 'URA', false),
    ('Uranium & Nuclear', 'em', 'URA', false),

    -- ========== Lithium & Batteries ==========
    ('Lithium & Batteries', 'us', 'LIT', false),
    ('Lithium & Batteries', 'uk', 'LIT', false),
    ('Lithium & Batteries', 'jp', 'LIT', false),
    ('Lithium & Batteries', 'eu', 'LIT', false),
    ('Lithium & Batteries', 'world', 'LIT', false),
    ('Lithium & Batteries', 'cn', 'LIT', false),
    ('Lithium & Batteries', 'in', 'LIT', false),
    ('Lithium & Batteries', 'ca', 'LIT', false),
    ('Lithium & Batteries', 'au', 'LIT', false),
    ('Lithium & Batteries', 'em', 'LIT', false),

    -- ========== Gold Miners ==========
    ('Gold Miners', 'us', 'GDX', false),
    ('Gold Miners', 'uk', 'GDX', false),
    ('Gold Miners', 'jp', 'GDX', false),
    ('Gold Miners', 'eu', 'GDX', false),
    ('Gold Miners', 'world', 'GDX', false),
    ('Gold Miners', 'cn', 'GDX', false),
    ('Gold Miners', 'in', 'GDX', false),
    ('Gold Miners', 'ca', 'GDX', false),
    ('Gold Miners', 'au', 'GDX', false),
    ('Gold Miners', 'em', 'GDX', false),

    -- ========== Water Infrastructure ==========
    ('Water Infrastructure', 'us', 'PHO', false),
    ('Water Infrastructure', 'uk', 'PHO', false),
    ('Water Infrastructure', 'jp', 'PHO', false),
    ('Water Infrastructure', 'eu', 'PHO', false),
    ('Water Infrastructure', 'world', 'PHO', false),
    ('Water Infrastructure', 'cn', 'PHO', false),
    ('Water Infrastructure', 'in', 'PHO', false),
    ('Water Infrastructure', 'ca', 'PHO', false),
    ('Water Infrastructure', 'au', 'PHO', false),
    ('Water Infrastructure', 'em', 'PHO', false),

    -- ========== Gaming & Esports ==========
    ('Gaming & Esports', 'us', 'ESPO', false),
    ('Gaming & Esports', 'uk', 'ESPO', false),
    ('Gaming & Esports', 'jp', 'ESPO', false),
    ('Gaming & Esports', 'eu', 'ESPO', false),
    ('Gaming & Esports', 'world', 'ESPO', false),
    ('Gaming & Esports', 'cn', 'ESPO', false),
    ('Gaming & Esports', 'in', 'ESPO', false),
    ('Gaming & Esports', 'ca', 'ESPO', false),
    ('Gaming & Esports', 'au', 'ESPO', false),
    ('Gaming & Esports', 'em', 'ESPO', false),

    -- ========== Agribusiness ==========
    ('Agribusiness', 'us', 'MOO', false),
    ('Agribusiness', 'uk', 'MOO', false),
    ('Agribusiness', 'jp', 'MOO', false),
    ('Agribusiness', 'eu', 'MOO', false),
    ('Agribusiness', 'world', 'MOO', false),
    ('Agribusiness', 'cn', 'MOO', false),
    ('Agribusiness', 'in', 'MOO', false),
    ('Agribusiness', 'ca', 'MOO', false),
    ('Agribusiness', 'au', 'MOO', false),
    ('Agribusiness', 'em', 'MOO', false),

    -- ========== Quantum Computing ==========
    ('Quantum Computing', 'us', 'QTUM', false),
    ('Quantum Computing', 'uk', 'QTUM', false),
    ('Quantum Computing', 'jp', 'QTUM', false),
    ('Quantum Computing', 'eu', 'QTUM', false),
    ('Quantum Computing', 'world', 'QTUM', false),
    ('Quantum Computing', 'cn', 'QTUM', false),
    ('Quantum Computing', 'in', 'QTUM', false),
    ('Quantum Computing', 'ca', 'QTUM', false),
    ('Quantum Computing', 'au', 'QTUM', false),
    ('Quantum Computing', 'em', 'QTUM', false),

    -- ========== Copper & Miners ==========
    ('Copper & Miners', 'us', 'COPX', false),
    ('Copper & Miners', 'uk', 'COPX', false),
    ('Copper & Miners', 'jp', 'COPX', false),
    ('Copper & Miners', 'eu', 'COPX', false),
    ('Copper & Miners', 'world', 'COPX', false),
    ('Copper & Miners', 'cn', 'COPX', false),
    ('Copper & Miners', 'in', 'COPX', false),
    ('Copper & Miners', 'ca', 'COPX', false),
    ('Copper & Miners', 'au', 'COPX', false),
    ('Copper & Miners', 'em', 'COPX', false),

    -- ========== 5G & Connectivity ==========
    ('5G & Connectivity', 'us', 'NXTG', false),
    ('5G & Connectivity', 'uk', 'NXTG', false),
    ('5G & Connectivity', 'jp', 'NXTG', false),
    ('5G & Connectivity', 'eu', 'NXTG', false),
    ('5G & Connectivity', 'world', 'NXTG', false),
    ('5G & Connectivity', 'cn', 'KWEB', false),
    ('5G & Connectivity', 'in', 'NXTG', false),
    ('5G & Connectivity', 'ca', 'NXTG', false),
    ('5G & Connectivity', 'au', 'NXTG', false),
    ('5G & Connectivity', 'em', 'NXTG', false)
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
