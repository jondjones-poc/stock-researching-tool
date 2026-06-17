-- Allow PRECIOUS METALS as a watchlist category.
ALTER TABLE dashboard_watchlist
  DROP CONSTRAINT IF EXISTS dashboard_watchlist_category_check;

ALTER TABLE dashboard_watchlist
  ADD CONSTRAINT dashboard_watchlist_category_check
  CHECK (category IN ('GROWTH', 'DIVIDEND & VALUE', 'MARKETS', 'PRECIOUS METALS', 'WATCHLIST'));

-- Move gold/silver out of MARKETS into PRECIOUS METALS; add COMEX gold (GCUSD).

UPDATE dashboard_watchlist
SET
  category = 'PRECIOUS METALS',
  updated_at = CURRENT_TIMESTAMP
WHERE symbol IN ('GLD', 'SIUSD', 'SILVER')
  AND category = 'MARKETS';

UPDATE dashboard_watchlist
SET
  symbol = 'SIUSD',
  name = 'Silver (COMEX futures, $/oz)',
  category = 'PRECIOUS METALS',
  data_source = 'FMP',
  fred_series_id = NULL,
  icon = '🥈',
  color = 'gray',
  updated_at = CURRENT_TIMESTAMP
WHERE symbol = 'SILVER';

UPDATE dashboard_watchlist
SET
  name = 'Gold (GLD — spot bullion ETF)',
  category = 'PRECIOUS METALS',
  data_source = 'FMP',
  icon = '🥇',
  color = 'yellow',
  updated_at = CURRENT_TIMESTAMP
WHERE symbol = 'GLD';

UPDATE dashboard_watchlist
SET
  name = 'Silver (COMEX futures, $/oz)',
  category = 'PRECIOUS METALS',
  data_source = 'FMP',
  icon = '🥈',
  color = 'gray',
  display_order = 3,
  updated_at = CURRENT_TIMESTAMP
WHERE symbol = 'SIUSD';

UPDATE dashboard_watchlist
SET display_order = CASE symbol
  WHEN 'GLD' THEN 1
  WHEN 'GCUSD' THEN 2
  WHEN 'SIUSD' THEN 3
  ELSE display_order
END
WHERE symbol IN ('GLD', 'GCUSD', 'SIUSD');

INSERT INTO dashboard_watchlist (
  symbol, name, category, icon, color, data_source, display_order, is_active
)
SELECT
  'GCUSD',
  'Gold (COMEX futures, $/oz)',
  'PRECIOUS METALS',
  '🥇',
  'yellow',
  'FMP',
  COALESCE(
    (SELECT MAX(display_order) + 1 FROM dashboard_watchlist WHERE category = 'PRECIOUS METALS'),
    2
  ),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM dashboard_watchlist WHERE symbol = 'GCUSD'
);

-- Seed rows when table exists but metals were never inserted.
INSERT INTO dashboard_watchlist (
  symbol, name, category, icon, color, data_source, display_order, is_active
)
SELECT v.symbol, v.name, v.category, v.icon, v.color, v.data_source, v.display_order, true
FROM (
  VALUES
    ('GLD', 'Gold (GLD — spot bullion ETF)', 'PRECIOUS METALS', '🥇', 'yellow', 'FMP', 1),
    ('GCUSD', 'Gold (COMEX futures, $/oz)', 'PRECIOUS METALS', '🥇', 'yellow', 'FMP', 2),
    ('SIUSD', 'Silver (COMEX futures, $/oz)', 'PRECIOUS METALS', '🥈', 'gray', 'FMP', 3)
) AS v(symbol, name, category, icon, color, data_source, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM dashboard_watchlist WHERE symbol = v.symbol
);
