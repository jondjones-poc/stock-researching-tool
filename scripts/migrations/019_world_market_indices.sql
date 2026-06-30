-- World market indices for the World Markets map (config + map country colouring).

CREATE TABLE IF NOT EXISTS world_market_indices (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  index_name VARCHAR(255) NOT NULL,
  symbol VARCHAR(64) NOT NULL,
  data_source VARCHAR(16) NOT NULL CHECK (data_source IN ('FMP', 'FRED')),
  fred_series_id VARCHAR(64),
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  country_codes TEXT[] NOT NULL DEFAULT '{}',
  icon VARCHAR(16) NOT NULL DEFAULT '📊',
  note TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_world_market_indices_active_order
  ON world_market_indices (is_active, display_order, name);

COMMENT ON TABLE world_market_indices IS 'Regional stock indices for World Markets map and table';
COMMENT ON COLUMN world_market_indices.country_codes IS 'ISO 3166-1 alpha-3 codes used to colour countries on the choropleth map (e.g. USA, GBR, DEU)';
