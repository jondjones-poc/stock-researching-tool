-- CNN Fear & Greed Index cache (refresh at most once per 24h unless forced).
CREATE TABLE IF NOT EXISTS fear_greed_cache (
  cache_key TEXT PRIMARY KEY DEFAULT 'cnn',
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  latest_value NUMERIC,
  latest_date DATE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE fear_greed_cache IS
  'Cached CNN Fear & Greed historical points; TTL enforced in app (24 hours).';
