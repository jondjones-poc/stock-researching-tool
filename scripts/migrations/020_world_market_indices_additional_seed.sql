-- Additional major world market indices (idempotent).

INSERT INTO world_market_indices (
  slug, name, index_name, symbol, data_source, fred_series_id,
  lat, lng, country_codes, icon, note, display_order, is_active
)
SELECT v.slug, v.name, v.index_name, v.symbol, v.data_source, v.fred_series_id,
       v.lat, v.lng, v.country_codes, v.icon, v.note, v.display_order, true
FROM (
  VALUES
    ('canada', 'Canada', 'S&P/TSX Composite', '^GSPTSE', 'FMP', NULL::varchar,
     56.1304, -106.3468, ARRAY['CAN']::text[], '🇨🇦', 'Toronto Stock Exchange benchmark', 12),
    ('south-korea', 'South Korea', 'KOSPI Composite', '^KS11', 'FMP', NULL,
     35.9078, 127.7669, ARRAY['KOR']::text[], '🇰🇷', NULL, 13),
    ('taiwan', 'Taiwan', 'TAIEX', '^TWII', 'FMP', NULL,
     23.6978, 120.9605, ARRAY['TWN']::text[], '🇹🇼', 'Taiwan Capitalization Weighted Stock Index', 14),
    ('singapore', 'Singapore', 'Straits Times Index', '^STI', 'FMP', NULL,
     1.3521, 103.8198, ARRAY['SGP']::text[], '🇸🇬', NULL, 15),
    ('mexico', 'Mexico', 'IPC', '^MXX', 'FMP', NULL,
     23.6345, -102.5528, ARRAY['MEX']::text[], '🇲🇽', 'Índice de Precios y Cotizaciones (BMV)', 16),
    ('switzerland', 'Switzerland', 'Swiss Market Index', '^SSMI', 'FMP', NULL,
     46.8182, 8.2275, ARRAY['CHE']::text[], '🇨🇭', 'SMI — large & mid-cap Swiss equities', 17),
    ('south-africa', 'South Africa', 'FTSE/JSE Top 40', '^J200', 'FMP', NULL,
     -30.5595, 22.9375, ARRAY['ZAF']::text[], '🇿🇦', 'JSE Top 40 index', 18)
) AS v(slug, name, index_name, symbol, data_source, fred_series_id, lat, lng, country_codes, icon, note, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM world_market_indices WHERE slug = v.slug
);
