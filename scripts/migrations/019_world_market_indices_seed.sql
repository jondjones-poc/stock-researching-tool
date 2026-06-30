-- Seed default world market indices (idempotent).

INSERT INTO world_market_indices (
  slug, name, index_name, symbol, data_source, fred_series_id,
  lat, lng, country_codes, icon, note, display_order, is_active
)
SELECT v.slug, v.name, v.index_name, v.symbol, v.data_source, v.fred_series_id,
       v.lat, v.lng, v.country_codes, v.icon, v.note, v.display_order, true
FROM (
  VALUES
    ('us', 'United States', 'S&P 500', '^GSPC', 'FMP', NULL::varchar,
     39.8283, -98.5795, ARRAY['USA']::text[], '🇺🇸', NULL::text, 1),
    ('uk', 'United Kingdom', 'FTSE 100', '^FTSE', 'FMP', NULL,
     54.0, -2.5, ARRAY['GBR']::text[], '🇬🇧', NULL, 2),
    ('japan', 'Japan', 'Nikkei 225', '^N225', 'FMP', NULL,
     36.2048, 138.2529, ARRAY['JPN']::text[], '🇯🇵', NULL, 3),
    ('hong-kong', 'Hong Kong', 'Hang Seng', '^HSI', 'FMP', NULL,
     22.3193, 114.1694, ARRAY['HKG']::text[], '🇭🇰', 'Hang Seng Index (Hong Kong)', 4),
    ('europe', 'Eurozone', 'Euro Stoxx 50', '^STOXX50E', 'FMP', NULL,
     50.1109, 8.6821, ARRAY['DEU','FRA','ITA','ESP','NLD','BEL','AUT','IRL','FIN','PRT','GRC']::text[],
     '🇪🇺', 'Euro Stoxx 50 — broad euro-area benchmark', 5),
    ('china', 'China', 'Share Price Index', 'CHINA', 'FRED', 'SPASTT01CNQ661N',
     35.8617, 104.1954, ARRAY['CHN']::text[], '🇨🇳', 'OECD mainland China share price index (monthly)', 6),
    ('germany', 'Germany', 'Share Price Index', 'GERMANY', 'FRED', 'SPASTT01DEM661N',
     51.1657, 10.4515, ARRAY['DEU']::text[], '🇩🇪', 'OECD Germany share price index (monthly)', 7),
    ('france', 'France', 'Share Price Index', 'FRANCE', 'FRED', 'SPASTT01FRM661N',
     46.2276, 2.2137, ARRAY['FRA']::text[], '🇫🇷', 'OECD France share price index (monthly)', 8),
    ('india', 'India', 'Share Price Index', 'INDIA', 'FRED', 'SPASTT01INM661N',
     20.5937, 78.9629, ARRAY['IND']::text[], '🇮🇳', 'OECD India share price index (monthly)', 9),
    ('brazil', 'Brazil', 'Share Price Index', 'BRAZIL', 'FRED', 'SPASTT01BRM661N',
     -14.235, -51.9253, ARRAY['BRA']::text[], '🇧🇷', 'OECD Brazil share price index (monthly)', 10),
    ('australia', 'Australia', 'Share Price Index', 'AUSTRALIA', 'FRED', 'SPASTT01AUM661N',
     -25.2744, 133.7751, ARRAY['AUS']::text[], '🇦🇺', 'OECD Australia share price index (monthly)', 11)
) AS v(slug, name, index_name, symbol, data_source, fred_series_id, lat, lng, country_codes, icon, note, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM world_market_indices WHERE slug = v.slug
);
