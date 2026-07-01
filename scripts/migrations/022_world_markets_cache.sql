-- 24-hour cache for World Index Performance API responses (per period).

CREATE TABLE IF NOT EXISTS world_markets_cache (
  period VARCHAR(16) PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_markets_cache_expires
  ON world_markets_cache (expires_at);

COMMENT ON TABLE world_markets_cache IS 'Cached /api/world-markets responses keyed by period (24h TTL)';
