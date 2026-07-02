-- Links eToro ticker (symbol_full) to the symbol used in stock_valuations / portfolio_stocks.
-- Example: symbol_full = FB.US, research_symbol = META

ALTER TABLE stock_ticker_cache
  ADD COLUMN IF NOT EXISTS research_symbol TEXT;

COMMENT ON COLUMN stock_ticker_cache.research_symbol IS
  'Portfolio/research list symbol when it differs from eToro symbol_full (e.g. GOOGL for GOOG.US)';

-- Seed common renames (only where not already set)
UPDATE stock_ticker_cache
SET research_symbol = 'GOOGL', updated_at = CURRENT_TIMESTAMP
WHERE UPPER(SPLIT_PART(COALESCE(symbol_full, ''), '.', 1)) = 'GOOG'
  AND (research_symbol IS NULL OR TRIM(research_symbol) = '');

UPDATE stock_ticker_cache
SET research_symbol = 'META', updated_at = CURRENT_TIMESTAMP
WHERE UPPER(SPLIT_PART(COALESCE(symbol_full, ''), '.', 1)) = 'FB'
  AND (research_symbol IS NULL OR TRIM(research_symbol) = '');
